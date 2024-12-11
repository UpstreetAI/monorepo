import type { ZodTypeAny } from 'zod';
import type {
  ActionMessage,
  ChatMessages,
  SubtleAiCompleteOpts,
  PendingActionMessage,
  ReadableAudioStream,
  PlayableAudioStream,
  ActOpts,
  ActionMessageEventData,
  ActionStep,
  Evaluator,
  DebugOptions,
} from '../types';
import {
  ConversationObject,
} from './conversation-object';
import {
  generateAgentActionStep,
  executeAgentActionStep,
} from '../runtime';
import {
  ActiveAgentObject,
} from './active-agent-object';
// import { QueueManager } from 'queue-manager';
// import { fetchChatCompletion, fetchJsonCompletion } from '../util/fetch.mjs';
import { formatConversationMessage } from '../util/message-utils';
import { chatEndpointUrl } from '../util/endpoints.mjs';
import { ReACTEvaluator } from '../evaluators/react-evaluator';

import { NotEnoughCreditsError } from '../util/error-utils.mjs';

//

export class GenerativeAgentObject {
  // members
  agent: ActiveAgentObject;
  conversation: ConversationObject; // the conversation that this generative agent is bound to
  // state
  // generativeQueueManager = new QueueManager();

  //
  
  constructor(
    agent: ActiveAgentObject,
    {
      conversation,
    }: {
      conversation: ConversationObject;
    },
  ) {
    this.agent = agent;
    this.conversation = conversation;
  }

  //

  get location() {
    return new URL(`${chatEndpointUrl}/rooms/${this.conversation.room}`);
  }

  //

  async embed(text: string) {
    return await this.agent.appContextValue.embed(text);
  }
  async complete(
    messages: ChatMessages,
    opts?: SubtleAiCompleteOpts,
  ) {
    const model = opts?.model ?? this.agent.model;
    return await this.agent.appContextValue.complete(messages, {
      model,
    });
  }
  async completeJson(
    messages: ChatMessages,
    format: ZodTypeAny,
    opts?: SubtleAiCompleteOpts,
  ) {
    const model = opts?.model ?? this.agent.model;
    return await this.agent.appContextValue.completeJson(messages, format, {
      model,
    });
  }
  // async generateImage(prompt: string, opts?: SubtleAiImageOpts) {
  //   return await this.agent.appContextValue.generateImage(prompt, opts);
  // }

  // methods

  // returns the ActionStep that the agent took
  async act(hint?: string, actOpts?: ActOpts, debugOpts?: DebugOptions) {
    // await this.generativeQueueManager.waitForTurn(async () => {
      return await this.conversation.typing(async () => {
        try {
          const evaluator = new ReACTEvaluator({
            hint,
            actOpts,
            debugOpts,
          });
          return await this.evaluate(evaluator);
        } catch (err) {
          if (err instanceof NotEnoughCreditsError) {
            this.say('Not enough credits');
          } else {
            console.warn('think error', err);
          }
        }
      });
    // });
  }
  async evaluate(evaluator: Evaluator) {
    return await this.conversation.typing(async () => {
      const step = await evaluator.evaluate({
        generativeAgent: this,
      });
      await executeAgentActionStep(this, step);
      return step;
    });
  }
  /* async generate(hint: string, schema?: ZodTypeAny) {
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
  } */
  async say(text: string) {
    await this.conversation.typing(async () => {
      // console.log('say text', {
      //   text,
      // });
      const timestamp = Date.now();
      const step = {
        action: {
          method: 'say',
          args: {
            text,
          },
          timestamp,
        },
      };
      await executeAgentActionStep(this, step);
    });
  }
  async monologue(text: string) {
    await this.conversation.typing(async () => {
      const actOpts = {
        forceAction: 'say',
      };
      const debugOpts = {
        debug: this.agent.appContextValue.useDebug(),
      };
      const step = await generateAgentActionStep({
        generativeAgent: this,
        hint: 'Comment on the following:' + '\n' +
          text,
        actOpts,
        debugOpts,
      });
      await executeAgentActionStep(this, step);
    });
  }

  async addMessage(message: PendingActionMessage) {
    const newMessage = formatConversationMessage(message, {
      agent: this.agent,
    });
    return await this.conversation.addLocalAndRemoteMessage(newMessage);
  }

  addAudioStream(playableAudioStream: PlayableAudioStream) {
    this.conversation.addAudioStream(playableAudioStream);
  }
}