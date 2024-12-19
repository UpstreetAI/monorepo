import { useEffect } from 'react';
import {
  AgentObject,
} from './agent-object';
import type {
  AppContextValue,
  GetMemoryOpts,
  Memory,
  ActionMessageEventData,
  // LiveTriggerEvent,
  AgentObjectData,
} from '../types';
import {
  ConversationObject,
} from './conversation-object';
import {
  GenerativeAgentObject,
} from './generative-agent-object';
import {
  ChatsManager,
} from './chats-manager';
import {
  DiscordManager,
} from './discord-manager';
import {
  TwitterManager,
} from './twitter-manager';
import {
  TwitterSpacesManager,
} from './twitter-spaces-manager';
import {
  TelnyxManager,
} from './telnyx-manager';
import {
  ConversationManager,
} from './conversation-manager';
import {
  LiveManager,
} from './live-manager';
import { PingManager } from './ping-manager';
import { AgentRegistry } from './render-registry';
import { DataSourceManager } from './data-source-manager';

//

export class ActiveAgentObject extends AgentObject {
  // arguments
  config: AgentObjectData;
  appContextValue: AppContextValue;
  registry: AgentRegistry;
  // state
  conversationManager: ConversationManager;
  chatsManager: ChatsManager;
  discordManager: DiscordManager;
  twitterManager: TwitterManager;
  twitterSpacesManager: TwitterSpacesManager;
  telnyxManager: TelnyxManager;
  liveManager: LiveManager;
  pingManager: PingManager;
  generativeAgentsMap = new WeakMap<ConversationObject, GenerativeAgentObject>();
  dataSourceManager: DataSourceManager;
  //
  
  constructor(
    config: AgentObjectData,
    {
      appContextValue,
      registry,
    }: {
      appContextValue: AppContextValue;
      registry: AgentRegistry;
    }
  ) {
    super(config);

    //

    this.config = config;
    this.appContextValue = appContextValue;
    this.registry = registry;

    //

    const conversationManager = this.appContextValue.useConversationManager();
    this.conversationManager = conversationManager;
    const chatsSpecification = this.appContextValue.useChatsSpecification();
    this.chatsManager = new ChatsManager({
      agent: this,
      chatsSpecification,
    });
    this.discordManager = new DiscordManager({
      codecs: appContextValue.useCodecs(),
    });
    this.twitterManager = new TwitterManager({
      codecs: appContextValue.useCodecs(),
    });
    this.twitterSpacesManager = new TwitterSpacesManager({
      codecs: appContextValue.useCodecs(),
    });
    this.telnyxManager = new TelnyxManager();
    this.liveManager = new LiveManager({
      agent: this,
    });
    this.dataSourceManager = new DataSourceManager();
    const bindLiveManager = () => {
      // dispatch up to the registry so the runtime can update its bookkeeping
      const proxyRegistryEvent = (event: MessageEvent) => {
        const registry = this.appContextValue.useRegistry();
        registry.dispatchEvent(new MessageEvent(event.type, {
          data: null,
        }));
      };
      this.liveManager.addEventListener('updatealarm', (e: MessageEvent) => {
        proxyRegistryEvent(e);
      });
    };
    bindLiveManager();
    this.pingManager = new PingManager({
      userId: this.id,
      supabase: this.useSupabase(),
    });
  }

  // static hooks

  useConfig() {
    return this.config;
  }
  useAuthToken() {
    return this.appContextValue.useAuthToken();
  }
  useSupabase() {
    return this.appContextValue.useSupabase();
  }
  useWallets() {
    return this.appContextValue.useWallets();
  }

  useEpoch(deps: any[]) {
    const tick = () => {
      this.dispatchEvent(new MessageEvent('epochchange', {
        data: null,
      }));
    };
    useEffect(() => {
      tick();
      return tick;
    }, deps);
  }

  // convert this ActiveAgentObject to a cached GenerativeAgentObject for inference
  generative({
    conversation,
  }: {
    conversation: ConversationObject;
  }) {
    let generativeAgent = this.generativeAgentsMap.get(conversation);
    if (!generativeAgent) {
      generativeAgent = new GenerativeAgentObject(this, {
        conversation,
      });
      this.generativeAgentsMap.set(conversation, generativeAgent);
    }
    return generativeAgent;
  }

  async getMemories(
    opts?: GetMemoryOpts,
  ) {
    // console.log('getMemories 1', {
    //   opts,
    // });
    const { matchCount = 1 } = opts || {};

    const supabase = this.useSupabase();
    const { data, error } = await supabase.from('memories')
      .select('*')
      .eq('user_id', this.id)
      .limit(matchCount);
    // console.log('getMemories 2', {
    //   data,
    //   error,
    // });
    if (!error) {
      return data as Array<Memory>;
    } else {
      throw new Error(error);
    }
  }
  async getMemory(
    query: string,
    opts?: GetMemoryOpts,
  ) {
    // console.log('getMemory 1', {
    //   query,
    // });
    const embedding = await this.appContextValue.embed(query);
    const { matchThreshold = 0.5, matchCount = 1 } = opts || {};

    const supabase = this.useSupabase();
    const { data, error } = await supabase.rpc('match_memory_user_id', {
      user_id: this.id,
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });
    if (!error) {
      // console.log('getMemory 2', {
      //   data,
      // });
      return data as Array<Memory>;
    } else {
      throw new Error(error);
    }
  }
  async addMemory(
    text: string,
    content?: any,
    // opts?: MemoryOpts,
  ) {
    // const { matchThreshold = 0.5, matchCount = 1 } = opts || {};

    const id = crypto.randomUUID();
    const embedding = await this.appContextValue.embed(text);

    const supabase = this.useSupabase();
    const writeResult = await supabase
      .from('ai_memory')
      .insert({
        id,
        user_id: this.id,
        text,
        embedding,
        content,
      });
    const { error: error2, data: data2 } = writeResult;
    if (!error2) {
      // console.log('app context value recall 3', {
      //   data2,
      // });
      return data2 as Memory;
    } else {
      throw new Error(error2);
    }
  }
  live() {
    this.chatsManager.live();
    this.discordManager.live();
    this.telnyxManager.live();
    this.pingManager.live();
  }
  destroy() {
    this.chatsManager.destroy();
    this.discordManager.destroy();
    this.telnyxManager.destroy();
    this.pingManager.destroy();
  }
}