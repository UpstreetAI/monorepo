import { z } from 'zod';
// import type { ZodTypeAny } from 'zod';
// import { printNode, zodToTs } from 'zod-to-ts';
import dedent from 'dedent';
import {
  ChatMessages,
  PendingActionMessage,
  ActiveAgentObject,
  GenerativeAgentObject,
  ActionMessage,
  ActionProps,
  ActionMessageEvent,
  ActionMessageEventData,
  ConversationObject,
  // TaskEventData,
  ActOpts,
  DebugOptions,
  ActionStep,
  ActionPropsAux,
  AbortableMessageEvent,
  PendingActionEventData,
  PerceptionPropsAux,
} from './types';
import {
  PendingActionEvent,
} from './classes/pending-action-event';
import {
  PendingUniformEvent,
} from './classes/pending-uniform-event';
import {
  AbortablePerceptionEvent,
} from './classes/abortable-perception-event';
import {
  ExtendableMessageEvent,
} from './util/extendable-message-event';
import {
  saveMessageToDatabase,
} from './util/saveMessageToDatabase.js';
import {
  formatBasicSchema,
  formatReactSchema,
} from './util/format-schema';
import * as debugLevels from './util/debug-levels.mjs';

//

type ServerHandler = {
  fetch(request: Request, env: object): Response | Promise<Response>;
};

//

const getPrompts = (generativeAgent: GenerativeAgentObject) => {
  const {
    agent,
    conversation: agentConversation,
  } = generativeAgent;
  const prompts = agent.registry.prompts
    .filter((prompt) => {
      const {
        conversation: promptConversation,
        children,
      } = prompt;
      return (
        (
          (typeof children === 'string' && children.length > 0) ||
          (Array.isArray(children) && children.filter((child) => typeof child === 'string' && child.length > 0).length > 0)
        ) &&
        (!promptConversation || promptConversation === agentConversation)
      );
    })
    .map((prompt) => {
      return Array.isArray(prompt.children) ? prompt.children.join('\n') : (prompt.children as string);
    })
    .map((prompt) => dedent(prompt));
  // console.log('got prompts', prompts);
  return prompts;
};

export async function generateAgentActionStep({
  generativeAgent,
  hint,
  mode,
  actOpts,
  debugOpts,
}: {
  generativeAgent: GenerativeAgentObject,
  mode: 'basic' | 'react',
  hint?: string,
  actOpts?: ActOpts,
  debugOpts?: DebugOptions,
}) {
  // wait for the conversation to be loaded so that we can use its conversation history in the prompts
  {
    const { agent, conversation } = generativeAgent;
    const { appContextValue } = agent;
    const conversationManager = appContextValue.useConversationManager();
    await conversationManager.waitForConversationLoad(conversation);
  }

  // collect the prompts
  const prompts = getPrompts(generativeAgent);
  if (hint) {
    prompts.push(hint);
  }
  // console.log('prompts', prompts, new Error().stack);
  const promptString = prompts.join('\n\n');
  const promptMessages = [
    {
      role: 'user',
      content: promptString,
    },
  ];
  if (debugOpts?.debug >= debugLevels.DEBUG) {
    console.info('prompt: ' + generativeAgent.agent.name + ':\n' + promptString);
  }
  // perform inference
  return await _generateAgentActionStepFromMessages({
    generativeAgent,
    promptMessages,
    mode,
    actOpts,
    debugOpts,
  });
}
async function _generateAgentActionStepFromMessages({
  generativeAgent,
  promptMessages,
  mode,
  actOpts,
  debugOpts,
}: {
  generativeAgent: GenerativeAgentObject,
  promptMessages: ChatMessages,
  mode: 'basic' | 'react',
  actOpts?: ActOpts,
  debugOpts?: DebugOptions,
}) {
  const { agent, conversation } = generativeAgent;
  const {
    // formatters,
    actions,
    uniforms,
  } = agent.registry;

  const resultSchema = (() => {
    switch (mode) {
      case 'basic':
        return formatBasicSchema({
          actions,
          uniforms,
          conversation,
          actOpts,
        });
      case 'react':
        return formatReactSchema({
          actions,
          uniforms,
          conversation,
          actOpts,
        });
      default:
        throw new Error('invalid mode: ' + mode);
    }
  })();

  const completionMessage = await generativeAgent.completeJson(promptMessages, resultSchema);
  if (completionMessage) {
    const result = {} as ActionStep;
    const observation = (completionMessage.content as any).observation as string | null;
    const thought = (completionMessage.content as any).thought as string | null;
    const action = (completionMessage.content as any).action as PendingActionMessage | null;
    const uniformObject = (completionMessage.content as any).uniforms as object | null;

    // logging
    if (debugOpts?.debug >= debugLevels.INFO) {
      if (observation) {
        console.info(`[•observation: ${generativeAgent.agent.name}: ${observation}]`);
      }
      if (thought) {
        console.info(`[•thought: ${generativeAgent.agent.name}: ${thought}]`);
      }
    }
    if (debugOpts?.debug >= debugLevels.INFO) {
      if (action !== null) {
        const jsonString = [
          generativeAgent.agent.name,
          ...JSON.stringify(action, null, 2).split('\n'),
        ]
          .map((line) => '  ' + line)
          .join('\n');
        console.info(`[•action\n${jsonString}\n]`);
      } else {
        console.info(`[•skip action: ${generativeAgent.agent.name}]`);
      }
    }

    // parse action
    if (action) {
      const { method } = action;
      const actionHandlers = actions.filter((action) => action.type === method);
      if (actionHandlers.length > 0) {
        const actionHandler = actionHandlers[0];
        if (actionHandler.schema) {
          try {
            const actionSchema = z.object({
              method: z.string(),
              args: actionHandler.schema,
            });
            const parsedMessage = actionSchema.parse(action);
            result.action = action;
          } catch (err) {
            console.warn('zod schema action parse error: ' + JSON.stringify(action) + '\n' + JSON.stringify(err.issues));
          }
        }
      } else {
        throw new Error('no action handler found for method: ' + method);
      }
    }

    // parse uniforms
    if (uniformObject) {
      const uniformsResult = {} as {
        [key: string]: object,
      };
      for (const method in uniformObject) {
        const args = uniformObject[method];
        const uniformHandlers = uniforms.filter((uniform) => uniform.type === method);
        if (uniformHandlers.length > 0) {
          const uniformHandler = uniformHandlers[0];
          if (uniformHandler.schema) {
            try {
              const uniformSchema = z.object({
                method: z.string(),
                args: uniformHandler.schema,
              });
              const parsedMessage = uniformSchema.parse({
                method,
                args,
              });
              uniformsResult[method] = args;
            } catch (err) {
              console.warn('zod schema uniform parse error: ' + JSON.stringify(args) + '\n' + JSON.stringify(err.issues));
            }
          }
        } else {
          throw new Error('no uniform handler found for method: ' + method);
        }
      }
      result.uniforms = uniformsResult;
    }

    // parse reasonig
    if (observation) {
      result.observation = observation;
    }
    if (thought) {
      result.thought = thought;
    }

    return result;
  } else {
    throw new Error('failed to generate action completion: invalid schema?');
  }
}

interface PriorityModifier {
  type: string;
  conversation?: ConversationObject;
  priority?: number;
  handler?: ((e: any) => Promise<void>) | ((e: any) => void);
}
export const collectPriorityModifiers = <T extends PriorityModifier>(modifiers: T[]) => {
  const result = new Map<number, T[]>();
  for (const modifier of modifiers) {
    const priority = modifier.priority ?? 0;
    let modifiers = result.get(priority);
    if (!modifiers) {
      modifiers = [];
      result.set(priority, modifiers);
    }
    modifiers.push(modifier);
  }
  return Array.from(result.entries())
    .sort((aEntry, bEntry) => aEntry[0] - bEntry[0])
    // .map((entry) => entry[1]);
};
export const filterModifiersPerConversation = <T extends PriorityModifier>(
  modifiers: Array<[number, T[]]>, 
  conversation: ConversationObject | null
) => {
  return modifiers.map(([priority, modifiersArray]) => [
    priority,
    modifiersArray.filter(modifier => 
      !modifier.conversation || modifier.conversation === conversation
    ),
  ]) as Array<[number, T[]]>;
};
export const filterModifiersPerType = <T extends PriorityModifier>(modifiers: Array<[number, T[]]>, name: string) => {
  return modifiers.map(([priority, modifiersArray]) => [
    priority,
    modifiersArray.filter((modifier) => modifier.type === '*' || modifier.type === name),
  ]) as Array<[number, T[]]>;
};

export async function executeAgentActionStep(
  generativeAgent: GenerativeAgentObject,
  step: ActionStep,
) {
  const {
    agent,
    conversation,
  } = generativeAgent;
  const {
    actions,
    actionModifiers,
    uniforms,
  } = agent.registry;
  const {
    action: message,
    uniforms: uniformsArgs,
  } = step;

  let actionsPerPriority: Array<[number, ActionPropsAux[]]> = [
    [0, actions],
  ];
  actionsPerPriority = filterModifiersPerConversation(actionsPerPriority, conversation);
  let actionModifiersPerPriority = collectPriorityModifiers(actionModifiers);
  actionModifiersPerPriority = filterModifiersPerConversation(actionModifiersPerPriority, conversation);
  let uniformsPerPriority = collectPriorityModifiers(uniforms);
  uniformsPerPriority = filterModifiersPerConversation(uniformsPerPriority, conversation);
  if (message) {
    actionsPerPriority = filterModifiersPerType(actionsPerPriority, message.method);
    actionModifiersPerPriority = filterModifiersPerType(actionModifiersPerPriority, message.method);
    uniformsPerPriority = filterModifiersPerType(uniformsPerPriority, message.method);
  }

  const mergePriorityHandlers = (handlersPerPriority: Array<[number, Array<() => Promise<AbortableMessageEvent<PendingActionEventData>>>]>) => {
    const resultsMap = new Map<number, Array<() => Promise<AbortableMessageEvent<PendingActionEventData>>>>();
    for (const [priority, handlers] of handlersPerPriority) {
      let handlersPerPriority = resultsMap.get(priority);
      if (!handlersPerPriority) {
        handlersPerPriority = [];
        resultsMap.set(priority, handlersPerPriority);
      }
      handlersPerPriority.push(...handlers);
    }
    // return the sorted results [priority, handlers]
    const entries = Array.from(resultsMap.entries());
    const sorted = entries.sort((a, b) => a[0] - b[0]);
    return sorted;
  };
  const makeActionHandler = (modifier: PriorityModifier) => {
    return async () => {
      const e = new PendingActionEvent({
        agent: generativeAgent,
        message,
      });
      if (message) {
        await modifier.handler(e);
      }
      return e;
    };
  };
  const makeUniformHandler = (modifier: PriorityModifier) => {
    return async () => {
      if (uniformsArgs) {
        for (const method in uniformsArgs) {
          if (modifier.type === method) {
            const args = uniformsArgs[method];
            const e = new PendingUniformEvent({
              agent: generativeAgent,
              message: {
                method,
                args,
              },
            });
            await modifier.handler(e);
            return e;
          }
        }
      }
    };
  };
  const actionsHandlers : [
    number,
    Array<() => Promise<AbortableMessageEvent<PendingActionEventData>>>
  ][] = actionsPerPriority.map(([priority, actions]) => [
    priority,
    actions.map(makeActionHandler),
  ]);
  const actionModifiersHandlers : [
    number,
    Array<() => Promise<AbortableMessageEvent<PendingActionEventData>>>
  ][] = actionModifiersPerPriority.map(([priority, modifiers]) => [
    priority,
    modifiers.map(makeActionHandler),
  ]);
  const uniformsHandlers : [
    number,
    Array<() => Promise<AbortableMessageEvent<PendingActionEventData>>>
  ][] = uniformsPerPriority.map(([priority, uniforms]) => [
    priority,
    uniforms.map(makeUniformHandler),
  ]);
  const handlersPerPriority = mergePriorityHandlers([
    ...actionsHandlers,
    ...actionModifiersHandlers,
    ...uniformsHandlers,
  ]);

  // for each priority, run the modifiers, checking for abort at each step
  let aborted = false;
  for (const [priority, handlers] of handlersPerPriority) {
    const promises = handlers.map((handler) => handler());
    const messageEvents = await Promise.all(promises);
    aborted = aborted || messageEvents.some((messageEvent) => messageEvent.abortController.signal.aborted);
    if (aborted) {
      break;
    }
  }
}

// run all perception modifiers and perceptions for a given event
// the modifiers have a chance to abort the perception
const handleChatPerception = async (data: ActionMessageEventData, {
  agent,
  conversation,
}: {
  agent: ActiveAgentObject;
  conversation: ConversationObject;
}) => {
  const {
    agent: sourceAgent,
    message,
  } = data;

  const {
    perceptions,
  } = agent.registry;

  let perceptionsPerPriority = collectPriorityModifiers(perceptions);
  perceptionsPerPriority = filterModifiersPerConversation(perceptionsPerPriority, conversation);
  perceptionsPerPriority = filterModifiersPerType(perceptionsPerPriority, message.method);
  let aborted = false;
  for (const [priority, perceptionsBlock] of perceptionsPerPriority) {
    const blockPromises = [];
    for (const perception of perceptionsBlock) {
      const targetAgent = agent.generative({
        conversation,
      });
      const e = new AbortablePerceptionEvent({
        targetAgent,
        sourceAgent,
        message,
      });
      const p = (async () => {
        await perception.handler(e);
        return e;
      })();
      blockPromises.push(p);
    }
    const messageEvents = await Promise.all(blockPromises);
    aborted = aborted || messageEvents.some((messageEvent) => messageEvent.abortController.signal.aborted);
    if (aborted) {
      break;
    }
  }

  return {
    aborted,
  };
};
export const bindConversationToAgent = ({
  agent,
  conversation,
}: {
  agent: ActiveAgentObject;
  conversation: ConversationObject;
}) => {
  // handle incoming perceptions
  conversation.addEventListener('localmessage', (e: ActionMessageEvent) => {
    const { message } = e.data;
    e.waitUntil((async () => {
      try {
        // handle the perception
        const {
          aborted,
        } = await handleChatPerception(e.data, {
          agent,
          conversation,
        });
        // if applicable, save the perception to the databaase
        const {
          hidden,
        } = message;
        if (!aborted && !hidden) {
          (async () => {
            const supabase = agent.useSupabase();
            const jwt = agent.useAuthToken();
            await saveMessageToDatabase({
              supabase,
              jwt,
              userId: agent.id,
              conversationId: conversation.getKey(),
              message,
            });
          })();
        }
      } catch (err) {
        console.warn('caught new message error', err);
      }
    })());
  });
  // handle committed messages
  conversation.addEventListener('remotemessage', async (e: ExtendableMessageEvent<ActionMessageEventData>) => {
    const { message } = e.data;
    const {
      hidden,
    } = message;
    if (!hidden) {
      // save the new message to the database
      (async () => {
        const supabase = agent.useSupabase();
        const jwt = agent.useAuthToken();
        await saveMessageToDatabase({
          supabase,
          jwt,
          userId: agent.id,
          conversationId: conversation.getKey(),
          message,
        });
      })();
    }
  });
};

// XXX can move this to the agent renderer
export const compileUserAgentServer = async ({
  agent,
}: {
  agent: ActiveAgentObject;
}) => {
  const servers = agent.registry.servers
    .map((serverProps) => {
      const childFn = serverProps.children as () => ServerHandler;
      if (typeof childFn === 'function') {
        const server = childFn();
        return server;
      } else {
        console.warn('server child is not a function', childFn);
        return null;
      }
    })
    .filter((server) => server !== null) as Array<ServerHandler>;

  return {
    async fetch(request: Request, env: object) {
      for (const server of servers) {
        // console.log('try server fetch 1', server.fetch.toString());
        const res = await server.fetch(request, env);
        // console.log('try server fetch 2', res);
        if (res instanceof Response) {
          return res;
        }
      }
      console.warn('no server handler found, so returning default 404');
      return new Response(
        JSON.stringify({
          error: `Not found: agent server handler (${servers.length} routes)`,
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    },
  };
};