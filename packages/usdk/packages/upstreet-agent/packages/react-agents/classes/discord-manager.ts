import uuidByString from 'uuid-by-string';
import {
  DiscordRoomSpec,
  DiscordArgs,
  ConversationEventData,
  ActiveAgentObject,
  ExtendableMessageEvent,
  ActionMessageEventData,
  PlayableAudioStream,
} from '../types';
import {
  ConversationObject,
} from './conversation-object';
import { Player } from 'react-agents-client/util/player.mjs';
import { DiscordBotClient } from '../lib/discord/discord-client';
import { formatConversationMessage } from '../util/message-utils';
import {
  bindConversationToAgent,
} from '../runtime';
import {
  QueueManager,
} from 'queue-manager';

//

const getIdFromUserId = (userId: string) => uuidByString(userId);
const makePlayerFromMember = (member: any) => {
  const {
    userId,
    displayName,
    displayAvatarURL,
  } = member;
  const id = getIdFromUserId(userId);
  const player = new Player(id, {
    name: displayName,
    previewUrl: displayAvatarURL,
  });
  return player;
};
const testRoomNameMatch = (channelName: string, channelSpec: DiscordRoomSpec) => {
  if (typeof channelSpec === 'string') {
    return channelName.toLowerCase() === channelSpec.toLowerCase();
  } else if (channelSpec instanceof RegExp) {
    return channelSpec.test(channelName);
  } else {
    return false;
  }
};
const bindOutgoing = ({
  conversation,
  discordBotClient,
  channelId,
  userId,
}: {
  conversation: ConversationObject,
  discordBotClient: DiscordBotClient,
  channelId?: string,
  userId?: string,
}) => {
  // chat messages
  conversation.addEventListener('remotemessage', async (e: ExtendableMessageEvent<ActionMessageEventData>) => {
    // console.log('discord manager outgoing message', e.data, {
    //   channelId,
    //   userId,
    // });
    const {
      message,
    } = e.data;
    const {
      attachments,
    } = message;
    const {
      method,
      args,
    } = message;

    if (method === 'say') {
      let {
        text,
      } = args as { text: string };
      
      if (attachments && Object.keys(attachments).length > 0) {
        text += '\n' + Object.values(attachments)
          .filter(attachment => attachment && typeof attachment === 'object' && 'url' in attachment)
          .map(attachment => attachment.url)
          .join('\n');
      }

      discordBotClient.input.writeText(text, {
        channelId,
        userId,
      });
    } else {
      // ignore
    }
  });
  // audio
  const queueManager = new QueueManager();
  conversation.addEventListener('audiostream', async (e: MessageEvent) => {
    await queueManager.waitForTurn(async () => {
      console.log('conversation outgoing audio stream start', e.data);
      const audioStream = e.data.audioStream as PlayableAudioStream;
      await discordBotClient.input.pushStream(audioStream);
      console.log('conversation outgoing audio stream end', e.data);
    });
  });
  // typing
  conversation.addEventListener('typingstart', (e) => {
    discordBotClient.input.sendTyping({
      channelId,
      userId,
    }); // expires after 10 seconds
  });
  // conversation.addEventListener('typingend', (e) => {
  // });
};

//

export class DiscordBot extends EventTarget {
  token: string;
  channels: DiscordRoomSpec[];
  dms: DiscordRoomSpec[];
  userWhitelist: string[];
  agent: ActiveAgentObject;
  channelConversations: Map<string, ConversationObject>; // channelId -> conversation
  dmConversations: Map<string, ConversationObject>; // userId -> conversation
  abortController: AbortController;
  constructor(args: DiscordArgs) {
    super();

    // arguments
    const {
      token,
      channels,
      dms,
      userWhitelist,
      agent,
      codecs,
      jwt,
    } = args;
    this.token = token;
    this.channels = channels;
    this.dms = dms;
    this.userWhitelist = userWhitelist;
    this.agent = agent;

    // abort controller
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const {
      name,
      previewUrl,
    } = agent;

    // initialize discord bot client
    const discordBotClient = new DiscordBotClient({
      token,
      codecs,
      jwt,
      name,
      previewUrl,
    });
    // bind discord bot client
    signal.addEventListener('abort', () => {
      discordBotClient.destroy();
    });

    this.channelConversations = new Map();
    this.dmConversations = new Map();

    // connect discord bot client
    const _connect = async () => {
      console.log('discord connect 1');
      const status = await discordBotClient.status();

      if (status.error) {
        throw new Error('discord status error: ' + status.error);
      }

      if (signal.aborted) return;

      console.log('discord connect 2');
      let connectableChannels = status.channels
        .filter((channel: any) => [0, 2].includes(channel.type));
      if (channels.length > 0) {
        connectableChannels = connectableChannels
          .filter((channel: any) =>
            channels
              .some(channelSpec => testRoomNameMatch(channel.name, channelSpec))
          );
      }

      let connectableDms = status.users;
      if (dms.length > 0) {
        connectableDms = connectableDms
          .filter((user: any) =>
            dms
              .some(dmSpec => testRoomNameMatch(user.displayName, dmSpec))
          );
      }
      // console.log('got channels + users', {
      //   connectableChannels,
      //   connectableDms,
      // });

      console.log('discord connect 3', {
        connectableChannels: connectableChannels.map(c => c.name),
        connectableDms: connectableDms.map(c => c.displayName),
        userWhitelist,
      });
      await discordBotClient.connect({
        channels: connectableChannels.map((o: any) => o.name),
        dms: connectableDms.map((o: any) => o.displayName),
        userWhitelist,
      });
      console.log('discord connect 4');
      if (signal.aborted) return;
      console.log('discord connect 5');
    };
    const _bindChannels = () => {
      discordBotClient.addEventListener('channelconnect', (e: MessageEvent<{channel: any}>) => {
        const {
          channel,
        } = e.data;
        const {
          id: channelId,
          type,
        } = channel;
        if (
          type === 0 || // text channel
          type === 2 || // voice channel
          type === 13 // stage
        ) {
          // Check if channel conversation already exists.
          // XXX: This would occur during a hot reload 
          if (this.channelConversations.has(channelId)) {
            console.log('channel conversation already exists, skipping', channelId);
            return
          }

          const conversation = new ConversationObject({
            agent,
            getHash: () => {
              return `discord:channel:${channelId}`;
            },
          });

          this.agent.conversationManager.addConversation(conversation);
          this.channelConversations.set(channelId, conversation);

          bindConversationToAgent({
            agent,
            conversation,
          });
          bindOutgoing({
            conversation,
            discordBotClient,
            channelId,
          });

          // console.log('write text to channel', {
          //   channelId,
          // });
          // const text = `hi there!`;
          // discordBotClient.input.writeText(text, {
          //   channelId,
          // });
        // } else if (type === 2) { // voice channel
        //   // nothing
        }
      });
      discordBotClient.addEventListener('dmconnect', (e: MessageEvent<{user: any}>) => {
        const {
          user,
        } = e.data;
        const {
          id: userId,
        } = user;

        // Check if dm conversation already exists for this user.
        // This occurs when the same user exists in multiple common servers.
        if (this.dmConversations.has(userId)) {
          console.log('dm conversation already exists for this user, skipping', userId);
          return
        }
        
        const conversation = new ConversationObject({
          agent,
          getHash: () => {
            return `discord:dm:${userId}`;
          },
        });

        this.agent.conversationManager.addConversation(conversation);
        this.dmConversations.set(userId, conversation);

        bindConversationToAgent({
          agent,
          conversation,
        });
        bindOutgoing({
          conversation,
          discordBotClient,
          userId,
        });

        // console.log('write text to user', {
        //   userId,
        // });
        // const text = `hiya!!`;
        // discordBotClient.input.writeText(text, {
        //   userId,
        // });
      });
    };
    const _bindGuildMemberAdd = () => {
      discordBotClient.addEventListener('guildmemberadd', (e: MessageEvent<{member: any}>) => {
        const { member } = e.data;
        // console.log('got guild member add', {
        //   member,
        // });
        const player = makePlayerFromMember(member);
        for (const conversation of this.channelConversations.values()) {
          conversation.addAgent(player.playerId, player);
        }

        // XXX do not add extra agents to DMs
        const dmConversation = this.dmConversations.get(member.userId);
        if (dmConversation) {
          dmConversation.addAgent(player.playerId, player);
        }
      });
    };
    const _bindGuildMemberRemove = () => {
      discordBotClient.addEventListener('guildmemberremove', (e: MessageEvent<{member: any}>) => {
        const { member } = e.data;
        // console.log('got guild member remove', {
        //   member,
        // });
        const playerId = getIdFromUserId(member.userId);
        for (const conversation of this.channelConversations.values()) {
          conversation.removeAgent(playerId);
        }

        // XXX do not remove extra agents from DMs
        const dmConversation = this.dmConversations.get(member.userId);
        if (dmConversation) {
          dmConversation.removeAgent(playerId);
        }
      });
    };
    const _bindIncoming = () => {
      // chat messages
      discordBotClient.output.addEventListener('text', async (e: MessageEvent) => {
        const {
          userId,
          username,
          text,
          channelId, // if there is no channelId, it's a DM
          // XXX discord channel/dm distinction can be made more explicit with a type: string field...
        } = e.data;

        // look up conversation
        let conversation: ConversationObject | null = null;
        if (channelId) {
          conversation = this.channelConversations.get(channelId) ?? null;
        } else {
          conversation = this.dmConversations.get(userId) ?? null;
        }
        if (conversation) {
          const rawMessage = {
            method: 'say',
            args: {
              text,
            },
          };
          const id = getIdFromUserId(userId);
          const agent = {
            id,
            name: username,
          };
          const newMessage = formatConversationMessage(rawMessage, {
            agent,
          });
          await conversation.addLocalMessage(newMessage);
        } else {
          console.warn('got message for unknown conversation', {
            data: e.data,
            channelConversations: this.channelConversations,
            dmConversations: this.dmConversations,
          });
        }
      });
    };

    (async () => {
      _bindChannels();
      _bindGuildMemberAdd();
      _bindGuildMemberRemove();
      _bindIncoming();
      await _connect();
    })().catch(err => {
      console.warn('discord bot error', err);
    });
  }
  destroy() {
    this.abortController.abort();
    this.abortController = new AbortController();
  }
}
export class DiscordManager {
  codecs;
  constructor({
    codecs,
  }) {
    this.codecs = codecs;
  }
  addDiscordBot(args: DiscordArgs) {
    const discordBot = new DiscordBot(args);
    return discordBot;
  }
  removeDiscordBot(discordBot: DiscordBot) {
    discordBot.destroy();
  }
  live() {
    // nothing
  }
  destroy() {
    // nothing
  }
}