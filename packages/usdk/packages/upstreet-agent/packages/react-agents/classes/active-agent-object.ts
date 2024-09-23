import { useEffect } from 'react';
// import { z } from 'zod';
// import dedent from 'dedent';
import {
  AgentObject,
} from './agent-object';
import type {
  AppContextValue,
  GetMemoryOpts,
  Memory,
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
  TaskManager,
} from './task-manager';
import { PingManager } from './ping-manager';
import { AgentRegistry } from './render-registry';

//

export class ActiveAgentObject extends AgentObject {
  // arguments
  agentJson: AgentObject;
  appContextValue: AppContextValue;
  registry: AgentRegistry;
  // state
  chatsManager: ChatsManager;
  discordManager: DiscordManager;
  taskManager: TaskManager;
  pingManager: PingManager;
  generativeAgentsMap = new WeakMap<ConversationObject, GenerativeAgentObject>();

  //
  
  constructor(
    agentJson: AgentObject,
    {
      appContextValue,
      registry,
    }: {
      appContextValue: AppContextValue;
      registry: AgentRegistry;
    }
  ) {
    super(agentJson);

    //

    this.agentJson = agentJson;
    this.appContextValue = appContextValue;
    this.registry = registry;

    //

    const conversationManager = this.appContextValue.useConversationManager();
    const chatsSpecification = this.appContextValue.useChatsSpecification();
    this.chatsManager = new ChatsManager({
      agent: this,
      conversationManager,
      chatsSpecification,
    });
    this.discordManager = new DiscordManager({
      conversationManager,
    });
    this.taskManager = new TaskManager({
      agent: this,
    });
    this.pingManager = new PingManager({
      userId: this.id,
      supabase: this.useSupabase(),
    });
  }

  // static hooks

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
      generativeAgent = new GenerativeAgentObject(this, conversation);
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
    //   agent: this,
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

    // const jwt = this.useAuthToken();
    // const supabase = makeAnonymousClient(env, jwt);
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
      console.log('app context value recall 3', {
        data2,
      });
      return data2 as Memory;
    } else {
      throw new Error(error2);
    }
  }
  live() {
    this.chatsManager.live();
    this.discordManager.live();
    this.pingManager.live();
  }
  destroy() {
    this.chatsManager.destroy();
    this.discordManager.destroy();
    this.pingManager.destroy();
  }
}