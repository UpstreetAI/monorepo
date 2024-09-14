// import { useContext } from 'react';
// import { z } from 'zod';
import type { ZodTypeAny } from 'zod';
// import dedent from 'dedent';
import type {
  ActionMessage,
  ChatMessages,
  SubtleAiImageOpts,
  PendingActionMessage,
  ReadableAudioStream,
  PlayableAudioStream,
  AgentThinkOptions,
} from '../types';
import {
  ConversationObject,
} from './conversation-object';
import {
  generateAgentAction,
  executeAgentAction,
  // generateJsonMatchingSchema,
  // generateString,
} from '../runtime';
import {
  ActiveAgentObject,
} from './active-agent-object';
import {
  QueueManager,
} from '../util/queue-manager.mjs';
import { fetchChatCompletion, fetchJsonCompletion } from '../util/fetch.mjs';

//

export class GenerativeAgentObject {
  // members
  agent: ActiveAgentObject;
  conversation: ConversationObject;
  // state
  generativeQueueManager = new QueueManager();

  //
  
  constructor(
    agent: ActiveAgentObject,
    conversation: ConversationObject,
  ) {
    this.agent = agent;
    this.conversation = conversation;
  }

  //

  get location() {
    return new URL(this.conversation.getBrowserUrl());
  }

  //

  async embed(text: string) {
    return await this.agent.appContextValue.embed(text);
  }
  async complete(
    messages: ChatMessages,
  ) {
    return await this.agent.appContextValue.complete(messages, {
      model: this.agent.model,
    });
  }
  async completeJson(
    messages: ChatMessages,
    format: ZodTypeAny,
  ) {
    return await this.agent.appContextValue.completeJson(messages, format, {
      model: this.agent.model,
    });
  }
  async generateImage(prompt: string, opts?: SubtleAiImageOpts) {
    return await this.agent.appContextValue.generateImage(prompt, opts);
  }

  // methods

  async think(hint?: string, thinkOpts?: AgentThinkOptions) {
    await this.generativeQueueManager.waitForTurn(async () => {
      // console.log('agent renderer think 1');
      await this.conversation.typing(async () => {
        // console.log('agent renderer think 2');
        try {
          const pendingMessage = await generateAgentAction(this, hint, thinkOpts);
          // console.log('agent renderer think 3');
          await executeAgentAction(this, pendingMessage);
          // console.log('agent renderer think 4');
        } catch (err) {
          console.warn('think error', err);
        }
      });
      // console.log('agent renderer think 5');
    });
  }
  async generate(hint: string, schema?: ZodTypeAny) {
    // console.log('agent renderer generate 1');
    await this.conversation.typing(async () => {
      // console.log('agent renderer generate 2');
      try {
        const messages = [
          {
            role: 'user',
            content: hint,
          },
        ];
        const jwt = this.agent.appContextValue.useAuthToken();

        let pendingMessagePromise = schema
          ? fetchJsonCompletion({
              messages,
            }, schema, {
              jwt,
            })
          : fetchChatCompletion({
            messages,
          }, {
            jwt,
          });
        const pendingMessage = await pendingMessagePromise;
        // console.log('agent renderer generate 3');
        return pendingMessage;
      } catch (err) {
        console.warn('generate error', err);
      }
    });
    // console.log('agent renderer think 5');
  }
  async say(text: string) {
    await this.conversation.typing(async () => {
      // console.log('say text', {
      //   text,
      // });
      const timestamp = Date.now();
      const pendingMessage = {
        method: 'say',
        args: {
          text,
        },
        timestamp,
      };
      await executeAgentAction(this, pendingMessage);
    });
  }
  async monologue(text: string) {
    await this.conversation.typing(async () => {
      // console.log('monologue text', {
      //   text,
      // });
      const pendingMessage = await generateAgentAction(
        this,
        'Comment on the following:' + '\n' +
          text,
        {
          forceAction: 'say',
        },
      );
      await executeAgentAction(this, pendingMessage);
    });
  }

  async addMessage(message: PendingActionMessage) {
    const { agent } = this;
    const { id: userId, name } = agent;
    const { method, args, attachments } = message;
    const timestamp = new Date();
    const newMessage = {
      userId,
      name,
      method,
      args,
      attachments,
      timestamp,
      human: false,
      hidden: false,
    };
    return await this.conversation.addLocalAndRemoteMessage(newMessage);
  }

  addAudioStream(playableAudioStream: PlayableAudioStream) {
    this.conversation.addAudioStream(playableAudioStream);
  }
}