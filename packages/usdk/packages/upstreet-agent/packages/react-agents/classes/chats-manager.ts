import { EventEmitter } from 'events';
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
} from '../util/queue-manager.mjs';
import {
  Debouncer,
} from '../util/debouncer.mjs';
import {
  bindConversationToAgent,
} from '../runtime';
import {
  makePromise,
} from '../util/util.mjs';
import { Player } from './player';
import { NetworkRealms } from '../lib/multiplayer/public/network-realms.mjs';
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
} from '../devices/audio-transcriber.mjs';

//

type TranscribeStream = {
  microphoneInput: EventEmitter,
  transcribedVoiceInput: TranscribedVoiceInput,
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
  rooms = new Map<string, NetworkRealms>();
  incomingMessageDebouncer = new Debouncer();
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
    // console.log('chats manager join room', {
    //   room,
    //   endpointUrl,
    //   key,
    // }, new Error().stack);
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

      const realmsPromise = (async () => {
        const realms = new NetworkRealms({
          endpointUrl,
          playerId: agent.id,
          audioManager: null,
          metadata: {
            conversation,
          },
        });
        this.rooms.set(key, realms);

        const virtualWorld = realms.getVirtualWorld();
        const virtualPlayers = realms.getVirtualPlayers();

        // Initiate network realms connection.
        const connectPromise = makePromise();
        const onConnect = async (e) => {
          e.waitUntil(
            (async () => {
              const realmKey = e.data.rootRealmKey;

              // Initialize network realms player.
              const getJson = () => {
                const {
                  name,
                  id,
                  description,
                  bio,
                  previewUrl,
                  model,
                  address,
                } = this.agent;
                return {
                  name,
                  id,
                  description,
                  bio,
                  previewUrl,
                  model,
                  address,
                };
              };
              const agentJson = getJson();
              const localPlayer = new Player(agent.id, agentJson);

              const _pushInitialPlayer = () => {
                realms.localPlayer.initializePlayer(
                  {
                    realmKey,
                  },
                  {},
                );
                realms.localPlayer.setKeyValue(
                  'playerSpec',
                  localPlayer.getPlayerSpec(),
                );
              };
              _pushInitialPlayer();

              const _bindRoomState = () => {
                const _bindScene = () => {
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
              _bindRoomState();

              connectPromise.resolve();
            })(),
          );
        };
        realms.addEventListener('connect', onConnect);

        // console.log('track remote players');
        const _trackRemotePlayers = () => {
          virtualPlayers.addEventListener('join', (e) => {
            const { playerId, player } = e.data;
            console.log('remote player joined:', playerId);

            const remotePlayer = new Player(playerId);
            conversation.addAgent(playerId, remotePlayer);

            // apply initial remote player state
            {
              const playerSpec = player.getKeyValue('playerSpec');
              if (playerSpec) {
                remotePlayer.setPlayerSpec(playerSpec);
              }
            }
            // Handle remote player state updates
            player.addEventListener('update', (e) => {
              const { key, val } = e.data;
              if (key === 'playerSpec') {
                remotePlayer.setPlayerSpec(val);
              }
            });
          });
          virtualPlayers.addEventListener('leave', async (e) => {
            const { playerId } = e.data;
            console.log('remote player left:', playerId);
            // const remotePlayer = conversation.getAgent(playerId);
            // if (remotePlayer) {
              conversation.removeAgent(playerId);
            // } else {
            //   console.warn('remote player not found', playerId);
            //   debugger;
            // }
          });
        };
        _trackRemotePlayers();

        const _bindMultiplayerChat = () => {
          const _bindIncoming = () => {
            // chat messages
            realms.addEventListener('chat', async (e) => {
              const { playerId, message } = e.data;
              if (playerId !== agent.id) {
                await conversation.addLocalMessage(message);
              // } else {
              //   // XXX fix this
              //   console.warn('received own message from realms "chat" event; this should not happen', message);
              }
            });

            // audio streams
            const transcribeStreams = new Map<string, TranscribeStream>();
            virtualPlayers.addEventListener('audiostart', async (e) => {
              const { playerId, streamId, type, disposition } = e.data;
              console.log('got audio start', {
                playerId,
                streamId,
                type,
                disposition,
              });

              if (disposition === 'text') {
                if (type === 'audio/pcm-f32-48000') {
                  const microphoneInput = new EventEmitter();
                  const jwt = agent.appContextValue.useAuthToken();
                  const transcribedVoiceInput = new TranscribedVoiceInput({
                    audioInput: microphoneInput,
                    sampleRate: 48000,
                    jwt,
                  });
                  transcribedVoiceInput.addEventListener('speechstart', e => {
                    console.log('capturing...');
                  });
                  transcribedVoiceInput.addEventListener('speechstop', e => {
                    console.log('captured');
                  });
                  transcribedVoiceInput.addEventListener('transcription', async (e) => {
                    console.log('transcription', e.data);
                  });

                  const transcribeStream = {
                    microphoneInput,
                    transcribedVoiceInput,
                  };
                  transcribeStreams.set(streamId, transcribeStream);
                } else {
                  console.warn('unhandled audio type', type);
                }
              }
            });
            virtualPlayers.addEventListener('audio', async (e) => {
              const { playerId, streamId, data } = e.data;
              const transcribeStream = transcribeStreams.get(streamId);
              transcribeStream.microphoneInput.emit('data', data);
              // let avg = 0;
              // for (let i = 0; i < data.length; i++) {
              //   avg += Math.abs(data[i]);
              // }
              // avg /= data.length;
              // console.log('got audio data', avg);
            });
            virtualPlayers.addEventListener('audioend', async (e) => {
              const { playerId, streamId } = e.data;
              const transcribeStream = transcribeStreams.get(streamId);
              transcribeStream.microphoneInput.emit('end');
              console.log('got audio end', playerId, streamId);
              transcribeStreams.delete(streamId);
            });
          };
          const _bindOutgoing = () => {
            // chat messages
            conversation.addEventListener('remotemessage', async (e: ExtendableMessageEvent<ActionMessageEventData>) => {
              const { message } = e.data;
              if (realms.isConnected()) {
                realms.sendChatMessage(message);
              }
            });
            // audio
            conversation.addEventListener('audiostream', async (e: MessageEvent) => {
              const audioStream = e.data.audioStream as PlayableAudioStream;
              (async () => {
                const {
                  waitForFinish,
                } = realms.addAudioSource(audioStream);
                await waitForFinish();
                realms.removeAudioSource(audioStream);
              })();
            });
            // typing
            const sendTyping = (typing: boolean) => {
              if (realms.isConnected()) {
                // try {
                  realms.sendChatMessage({
                    method: 'typing',
                    userId: this.agent.id,
                    name: this.agent.name,
                    args: {
                      typing,
                    },
                    hidden: true,
                  });
                // } catch (err) {
                //   console.warn(err);
                // }
              }
            };
            conversation.addEventListener('typingstart', (e: MessageEvent) => {
              sendTyping(true);
            });
            conversation.addEventListener('typingend', (e: MessageEvent) => {
              sendTyping(false);
            });
          };
          const _bindAgent = () => {
            bindConversationToAgent({
              agent: this.agent,
              conversation,
            });
          };
          const _bindDisconnect = () => {
            realms.addEventListener('disconnect', async (e) => {
              console.log('realms emitted disconnect');
  
              cleanup();
  
              // try to reconnect, if applicable
              if (this.chatsSpecification.roomSpecifications.some((spec) => roomsSpecificationEquals(spec, roomSpecification))) {
                console.log('rejoining room', roomSpecification);
                await this.#join(roomSpecification);
                console.log('rejoined room', roomSpecification);
              }
            });
          };

          _bindIncoming();
          _bindOutgoing();
          _bindAgent();
          _bindDisconnect();
        };
        _bindMultiplayerChat();

        await realms.updateRealmsKeys({
          realmsKeys: [room],
          rootRealmKey: room,
        });

        await connectPromise;
      })();
      try {
        await realmsPromise;
      } catch (err) {
        console.warn(err);

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