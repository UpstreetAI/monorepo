import {
  EventEmitter,
} from 'events';
import * as Y from 'yjs';
import type {
  PlayableAudioStream,
  ActiveAgentObject,
  ChatsSpecification,
  RoomSpecification,
  ActionMessageEventData,
} from '../types';
import {
  ConversationObject,
} from './conversation-object';
import {
  MultiQueueManager,
} from 'queue-manager';
// import {
//   Debouncer,
// } from '../util/debouncer.mjs';
import {
  bindConversationToAgent,
} from '../runtime';
import {
  makePromise,
} from '../util/util.mjs';
import { Player } from 'react-agents-client/util/player.mjs';
import { ReactAgentsMultiplayerConnection } from 'react-agents-client/react-agents-client.mjs';
import {
  ExtendableMessageEvent,
} from '../util/extendable-message-event';
import {
  SceneObject,
} from './scene-object';
import {
  roomsSpecificationEquals,
} from './chats-specification';
import {
  TranscribedVoiceInput,
} from 'react-agents/devices/audio-transcriber.mjs';

//

type TranscriptionStream = {
  audioInput: EventEmitter;
  transcribedVoiceInput: TranscribedVoiceInput;
};

//

export const getChatKey = ({
  room,
  endpointUrl,
}: {
  room: string;
  endpointUrl: string;
}) => {
  return `${endpointUrl}/${room}`;
};

//

// tracks an agent's connected chat rooms based on the changing chatsSpecification
export class ChatsManager {
  // members
  agent: ActiveAgentObject;
  chatsSpecification: ChatsSpecification;
  // state
  rooms = new Map<string, ReactAgentsMultiplayerConnection>();
  // incomingMessageDebouncer = new Debouncer();
  roomsQueueManager = new MultiQueueManager();
  abortController: AbortController | null = null;

  constructor({
    agent,
    chatsSpecification,
  }: {
    agent: ActiveAgentObject,
    chatsSpecification: ChatsSpecification,
  }) {
    this.agent = agent;
    this.chatsSpecification = chatsSpecification;
  }

  async #join(roomSpecification: RoomSpecification) {
    const {
      room,
      endpointUrl,
    } = roomSpecification;
    const key = getChatKey(roomSpecification);
    await this.roomsQueueManager.waitForTurn(key, async () => {
      const {
        agent,
      } = this;

      const conversation = new ConversationObject({
        agent,
        getHash: () => {
          return getChatKey({
            room,
            endpointUrl,
          });
        },
      });
      this.agent.conversationManager.addConversation(conversation);

      const cleanup = () => {
        this.agent.conversationManager.removeConversation(conversation);
        this.rooms.delete(key);
      };

      const getProfile = () => {
        const {
          id,
          name,
          description,
          bio,
          previewUrl,
          model,
          address,
        } = this.agent;
        return {
          id,
          name,
          description,
          bio,
          previewUrl,
          model,
          address,
        };
      };
      const profile = getProfile();
      const debug = true;
      const multiplayerConnection = new ReactAgentsMultiplayerConnection({
        room,
        profile,
        metadata: {
          conversation,
        },
      });
      const localLogLevel = debug ? ReactAgentsMultiplayerConnection.logLevels.debug : ReactAgentsMultiplayerConnection.logLevels.info;
      multiplayerConnection.addEventListener('log', (e: any) => {
        const { args, logLevel } = e.data;
        if (localLogLevel >= logLevel) {
          console.log(...args);
        }
      });

      this.rooms.set(key, multiplayerConnection);

      // Initiate network realms connection.
      const onConnect = async (e: any) => {
        const _bindScene = () => {
          const { realms } = multiplayerConnection;
          const headRealm = realms.getClosestRealm(realms.lastRootRealmKey);
          const { networkedCrdtClient } = headRealm;

          const doc = networkedCrdtClient.getDoc() as Y.Doc;
          const name = doc.getText('name');
          const description = doc.getText('description');
          const getScene = () => new SceneObject({
            name: name.toString(),
            description: description.toString(),
          });
          const _updateScene = () => {
            const scene = getScene();
            conversation.setScene(scene);
          };
          _updateScene();
          name.observe(_updateScene);
          description.observe(_updateScene);
        };
        _bindScene();
      };
      multiplayerConnection.addEventListener('connect', onConnect);

      const { playersMap } = multiplayerConnection;
      playersMap.addEventListener('join', (e: any) => {
        const { player } = e.data;
        const { playerId } = player;
        console.log('chats manager | remote player joined:', playerId, 'room:', room);

        const remotePlayer = new Player(playerId, {});
        conversation.addAgent(playerId, remotePlayer);
      });
      playersMap.addEventListener('leave', async (e: any) => {
        const { player } = e.data;
        const { playerId } = player;
        console.log('chats manager |  remote player left:', playerId, 'room:', room);
        conversation.removeAgent(playerId);
      });

      multiplayerConnection.addEventListener('chat', async (e) => {
        const { playerId, message } = e.data;
        if (playerId !== agent.id) {
          await conversation.addLocalMessage(message);
        // } else {
        //   // XXX fix this
        //   console.warn('received own message from realms "chat" event; this should not happen', message);
        }
      });

      const _trackAudio = () => {
        const transcriptionStreams = new Map<string, TranscriptionStream>();
        playersMap.addEventListener('audiostart', async (e: any) => {
          // console.log('got audio start', e.data);
          const { playerId, streamId, type, disposition } = e.data;
          if (disposition === 'text') {
            if (type === 'audio/pcm-f32-48000') {
              const audioInput = new EventEmitter();
              const sampleRate = 48000;
              const codecs = agent.appContextValue.useCodecs();
              const jwt = agent.useAuthToken();
              const transcribedVoiceInput = new TranscribedVoiceInput({
                audioInput,
                sampleRate,
                codecs,
                jwt,
              });
              transcribedVoiceInput.addEventListener('speechstart', e => {
                // console.log('chats manager speech start', e.data);
                conversation.dispatchEvent(new MessageEvent('speechstart', {
                  data: e.data,
                }));
              });
              transcribedVoiceInput.addEventListener('speechstop', e => {
                // console.log('chats manager speech stop', e.data);
                conversation.dispatchEvent(new MessageEvent('speechstop', {
                  data: e.data,
                }));
              });
              transcribedVoiceInput.addEventListener('speechcancel', e => {
                // console.log('chats manager speech cancel', e.data);
                conversation.dispatchEvent(new MessageEvent('speechcancel', {
                  data: e.data,
                }));
              });
              transcribedVoiceInput.addEventListener('transcription', e => {
                // console.log('chats manager transcription', e.data);
                conversation.dispatchEvent(new MessageEvent('transcription', {
                  data: e.data,
                }));
              });
              const transcriptionStream = {
                audioInput,
                transcribedVoiceInput,
              };
              transcriptionStreams.set(streamId, transcriptionStream);
            } else {
              console.warn('unhandled audio text disposition type', type);
            }
          // } else {
          //   // nothing
          }
        });
        playersMap.addEventListener('audio', async (e: any) => {
          const { playerId, streamId, data } = e.data;
          // console.log('got audio data', playerId, streamId);
          const transcriptionStream = transcriptionStreams.get(streamId);
          if (transcriptionStream) {
            transcriptionStream.audioInput.emit('data', data);
          } else {
            // console.warn('audio data: no transcription stream', e.data);
          }
        });
        playersMap.addEventListener('audioend', async (e: any) => {
          // console.log('got audio end', e.data);
          const { playerId, streamId } = e.data;
          const transcriptionStream = transcriptionStreams.get(streamId);
          if (transcriptionStream) {
            transcriptionStream.audioInput.emit('end');
            transcriptionStreams.delete(streamId);
          } else {
            // console.warn('audio end: no transcription stream', e.data);
          }
        });
      };
      const _trackVideo = () => {
        playersMap.addEventListener('videostart', async (e: any) => {
          // console.log('got video start', e.data);
          conversation.dispatchEvent(new MessageEvent('videostart', {
            data: e.data,
          }));
        });
        playersMap.addEventListener('video', async (e: any) => {
          // console.log('got video data', e.data);
          conversation.dispatchEvent(new MessageEvent('video', {
            data: e.data,
          }));
        });
        playersMap.addEventListener('videoend', async (e: any) => {
          // console.log('got video end', e.data);
          conversation.dispatchEvent(new MessageEvent('videoend', {
            data: e.data,
          }));
        });
      };
      const _bindOutgoingChat = () => {
        const remotemessage = async (e: ExtendableMessageEvent<ActionMessageEventData>) => {
          const { message } = e.data;
          multiplayerConnection.sendChatMessage(message);
        };
        conversation.addEventListener('remotemessage', remotemessage);

        const cleanupOutgoingChat = () => {
          conversation.removeEventListener('remotemessage', remotemessage);
        };
        multiplayerConnection.addEventListener('disconnect', cleanupOutgoingChat);
      };

      const _bindOutgoingAudio = () => {
        const audiostream = async (e: MessageEvent) => {
          const audioStream = e.data.audioStream as PlayableAudioStream;
          const { waitForFinish } = multiplayerConnection.addAudioSource(audioStream);
          await waitForFinish();
          multiplayerConnection.removeAudioSource(audioStream);
        };
        conversation.addEventListener('audiostream', audiostream);

        const cleanupOutgoingAudio = () => {
          conversation.removeEventListener('audiostream', audiostream);
        };
        multiplayerConnection.addEventListener('disconnect', cleanupOutgoingAudio);
      };

      const _bindOutgoingTyping = () => {
        const sendTyping = (typing: boolean) => {
          multiplayerConnection.sendChatMessage({
            method: 'typing',
            userId: this.agent.id,
            name: this.agent.name,
            args: {
              typing,
            },
            hidden: true,
          });
        };
        const typingstart = (e: MessageEvent) => {
          sendTyping(true);
        };
        conversation.addEventListener('typingstart', typingstart);

        const typingend = (e: MessageEvent) => {
          sendTyping(false);
        };
        conversation.addEventListener('typingend', typingend);

        const cleanupOutgoingTyping = () => {
          conversation.removeEventListener('typingstart', typingstart);
          conversation.removeEventListener('typingend', typingend);
        };
        multiplayerConnection.addEventListener('disconnect', cleanupOutgoingTyping);
      };

      const _bindAgent = () => {
        bindConversationToAgent({
          agent: this.agent,
          conversation,
        });
      };
      const _bindDisconnect = () => {
        multiplayerConnection.addEventListener('disconnect', async (e: any) => {
          console.log('realms emitted disconnect');

          // clean up the old connection
          cleanup();

          // try to reconnect, if applicable
          if (this.chatsSpecification.roomSpecifications.some((spec) => roomsSpecificationEquals(spec, roomSpecification))) {
            console.log('rejoining room', roomSpecification);
            await this.#join(roomSpecification);
            console.log('rejoined room', roomSpecification);
          }
        });
      };

      _trackAudio();
      _trackVideo();
      _bindOutgoingChat();
      _bindOutgoingAudio();
      _bindOutgoingTyping();
      _bindAgent();
      _bindDisconnect();

      try {
        await multiplayerConnection.waitForConnect();
      } catch (err) {
        console.warn(err);

        // clean up the old connection
        cleanup();
      }
    });
  }
  async #leave(roomSpecification: RoomSpecification) {
    const {
      room,
      endpointUrl,
    } = roomSpecification;
    const key = getChatKey(roomSpecification);
    console.log('chats manager leave room', {
      room,
      endpointUrl,
      key,
    });
    await this.roomsQueueManager.waitForTurn(key, async () => {
      const realms = this.rooms.get(key);
      if (realms) {
        const conversation = realms.metadata.conversation;
        this.agent.conversationManager.removeConversation(conversation);

        this.rooms.delete(key);

        realms.disconnect();
      }
    });
  }

  live() {
    // console.log('chats manager live!', new Error().stack);

    this.abortController = new AbortController();
    const {
      signal,
    } = this.abortController;

    (async () => {
      // listen for rooms changes
      const onjoin = (e: ExtendableMessageEvent<RoomSpecification>) => {
        e.waitUntil((async () => {
          await this.#join(e.data);
        })());
      };
      this.chatsSpecification.addEventListener('join', onjoin);
      const onleave = (e: ExtendableMessageEvent<RoomSpecification>) => {
        e.waitUntil((async () => {
          await this.#leave(e.data);
        })());
      };
      this.chatsSpecification.addEventListener('leave', onleave);

      // clean up listeners
      signal.addEventListener('abort', () => {
        this.chatsSpecification.removeEventListener('join', onjoin);
        this.chatsSpecification.removeEventListener('leave', onleave);
      });

      // connect to initial rooms
      await this.chatsSpecification.waitForLoad();
      if (signal.aborted) return;
    })();

    // disconnect on destroy
    signal.addEventListener('abort', () => {
      for (const realms of Array.from(this.rooms.values())) {
        realms.disconnect();
      }
      this.rooms.clear();
    });
  }
  destroy() {
    // console.log('chats manager destroy!!', new Error().stack);

    if (this.abortController !== null) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}