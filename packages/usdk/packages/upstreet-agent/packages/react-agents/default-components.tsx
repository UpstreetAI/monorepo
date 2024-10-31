import React, { useRef, useState, useEffect, useMemo, useContext } from 'react';
import dedent from 'dedent';
import { ZodTypeAny, ZodUnion, z } from 'zod';
import { printNode, zodToTs } from 'zod-to-ts';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { minimatch } from 'minimatch';
import { timeAgo } from 'react-agents/util/time-ago.mjs';
// import { Client as TwitterClient } from 'twitter-api-sdk';
// console.log('twitter client', TwitterClient);

import type {
  AppContextValue,
  // AgentProps,
  ActionProps,
  ActionPropsAux,
  UniformPropsAux,
  // PromptProps,
  FormatterProps,
  // ParserProps,
  // PerceptionProps,
  // SchedulerProps,
  // ServerProps,
  SceneObject,
  AgentObject,
  ActiveAgentObject,
  ConversationObject,
  PendingActionEvent,
  ActionEvent,
  PerceptionEvent,
  ActionMessage,
  PlayableAudioStream,
  Attachment,
  FormattedAttachment,
  AgentThinkOptions,
  GenerativeAgentObject,
  DiscordBotRoomSpec,
  DiscordBotRoomSpecs,
  DiscordBotProps,
  DiscordBotArgs,
  TwitterBotProps,
  TelnyxProps,
  TelnyxBotArgs,
} from './types';
import {
  AppContext,
} from './context';
import {
  // Agent,
  Action,
  ActionModifier,
  Prompt,
  Formatter,
  Perception,
  PerceptionModifier,
  Task,
  // Scheduler,
  Server,
  Conversation,
  Defer,
  Uniform,
} from './components';
import {
  AbortableActionEvent,
} from './classes/abortable-action-event';
import {
  AbortablePerceptionEvent,
} from './classes/abortable-perception-event';
import {
  useAgent,
  useAuthToken,
  // useAgents,
  // useScene,
  useActions,
  useUniforms,
  useFormatters,
  useName,
  usePersonality,
  useStoreItems,
  usePurchases,
  useKv,
  useTts,
  useConversation,
  useCachedMessages,
  useNumMessages,
} from './hooks';
import { shuffle, parseCodeBlock } from './util/util.mjs';
import {
  storeItemType,
} from './util/agent-features.mjs';
import {
  currencies,
  intervals,
} from './constants.mjs';
import {
  // describe,
  describeJson,
} from './util/vision.mjs';
import {
  imageSizes,
  fetchImageGeneration,
} from './util/generate-image.mjs';
import {
  generateSound,
} from './util/generate-sound.mjs';
import {
  generateModel,
} from './util/generate-model.mjs';
import {
  generateVideo,
} from './util/generate-video.mjs';
import { r2EndpointUrl } from './util/endpoints.mjs';
import { webbrowserActionsToText } from './util/browser-action-utils.mjs';
import { createBrowser/*, testBrowser*/ } from 'react-agents/util/create-browser.mjs';

// Note: this comment is used to remove imports before running tsdoc
// END IMPORTS

// utils

const getRandomId = () => crypto.randomUUID(); // used for schema substitutions
const defaultPriorityOffset = 100;
const maxDefaultMemoryValues = 8;
const maxMemoryQueries = 8;
const maxMemoryQueryValues = 3;

// defaults

/**
 * Renders the default agent components.
 * @returns The JSX elements representing the default agent components.
 */
export const DefaultAgentComponents = () => {
  return (
    <>
      <DefaultFormatters />
      <DefaultActions />
      <DefaultPerceptions />
      <DefaultGenerators />
      <DefaultSenses />
      <DefaultDrivers />
      <RAGMemory />
      {/* <LiveMode /> */}
      <DefaultPrompts />
      {/* <DefaultServers /> */}
    </>
  );
};

// actions

const ChatActions = () => {
  return (
    <>
      <Action
        name="say"
        description={dedent`\
          A character says something.
          The given text message is sent literally and should be fully in character.
          It should not include any placeholders.
        `}
        schema={
          z.object({
            text: z.string(),
          })
        }
        examples={[
          {
            text: 'Hello, there! How are you doing?',
          },
        ]}
        // handler={async (e: PendingActionEvent) => {
        //   await e.commit();
        // }}
      />
    </>
  );
};
const StoreActions = () => {
  const agent = useAgent();
  const storeItems = useStoreItems();
  return (
    <>
      {!!agent.stripeConnectAccountId && storeItems.length > 0 && (
        <Action
          name="paymentRequest"
          description={dedent`\
            Request payment or a subscription for an item available in the store.
          `}
          schema={storeItemType}
          examples={[
            {
              type: 'payment',
              props: {
                name: 'potion',
                description: 'Heals 50 HP',
                amount: 1,
                currency: currencies[0],
              },
            },
            {
              type: 'subscription',
              props: {
                name: 'Blessing',
                description: 'Get daily blessings delivered in your DMs',
                amount: 1,
                currency: currencies[0],
                interval: intervals[0],
                intervalCount: 1,
              },
            },
          ]}
          handler={async (e: PendingActionEvent) => {
            const {
              stripeConnectAccountId,
            } = e.data.agent.agent;
            (e.data.message.args as any).stripeConnectAccountId = stripeConnectAccountId;

            await e.commit();
          }}
        />
      )}
    </>
  );
};

//

type EveryNMessagesOptions = {
  signal: AbortSignal,
};
const EveryNMessages = ({
  n,
  children,
}: {
  n: number,
  children: (opts: EveryNMessagesOptions) => void,
}) => {
  const numMessages = useNumMessages();
  const startNumMessages = useMemo(() => numMessages, []);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const diff = numMessages - startNumMessages;
    if (diff % n === 0) {
      if (!abortControllerRef.current) {
        abortControllerRef.current = new AbortController();
      }
      const { signal } = abortControllerRef.current;

      const fn = children;
      fn({
        signal,
      });

      return () => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
      };
    }
  }, [numMessages, startNumMessages, n]);

  return null;
};

//

const DefaultMemoriesInternal = () => {
  const agent = useAgent();
  const conversation = useConversation();
  const [recentMemoriesValue, setRecentMemoriesValue] = useState<string[]>([]);
  const [queriedMemoriesValue, setQueriedMemoriesValue] = useState<string[]>([]);

  const refreshRecentMemories = async ({
    signal,
  }: {
    signal: AbortSignal,
  }) => {
    const memories = await agent.getMemories({
      matchCount: maxDefaultMemoryValues,
      signal,
    });
    // console.log('got new value 1', memories, signal.aborted);
    if (signal.aborted) return;

    const value = memories.map(memory => memory.text);
    // console.log('got new value 2', value);
    setRecentMemoriesValue(value);
  };
  const refreshEmbeddedMemories = async ({
    signal,
  }: {
    signal: AbortSignal,
  }) => {
    const embeddingString = conversation.getEmbeddingString();
    const memories = await agent.getMemory(embeddingString, {
      matchCount: maxDefaultMemoryValues,
      signal,
    });
    // console.log('got new value 3', memories, signal.aborted);
    if (signal.aborted) return;

    const value = memories.map(memory => memory.text);
    // console.log('got new value 4', value);
    setQueriedMemoriesValue(value);
  };

  const allMemoriesValue = [
    ...recentMemoriesValue,
    ...queriedMemoriesValue,
  ];
  // console.log('render all memories', {
  //   allMemoriesValue,
  //   recentMemoriesValue,
  //   queriedMemoriesValue,
  // });

  return (
    <>
      {allMemoriesValue.length > 0 && (
        <Prompt>
          {dedent`\
            # Memories
            Your character remembers the following:
            \`\`\`
          ` + '\n' +
          JSON.stringify(queriedMemoriesValue, null, 2) + '\n' +
          dedent`\
            \`\`\`
          ` + '\n' +
          dedent`\
            Note: to remember more specific memories, use the \`queryMemories\` action.
          ` 
          }
        </Prompt>
      )}
      <Defer>
        <EveryNMessages n={10}>{({
          signal,
        }: {
          signal: AbortSignal,
        }) => {
          refreshRecentMemories({
            signal,
          });
        }}</EveryNMessages>
        <EveryNMessages n={1}>{({
          signal,
        }: {
          signal: AbortSignal,
        }) => {
          refreshEmbeddedMemories({
            signal,
          });
        }}</EveryNMessages>
      </Defer>
    </>
  );
};
const DefaultMemories = () => {
  return (
    <Conversation>
      <DefaultMemoriesInternal />
    </Conversation>
  );
};
const MemoryWatcher = ({
  memoryQueries,
}: {
  memoryQueries: MemoryQuery[],
}) => {
  const agent = useAgent();
  const [memoryWatchers, setMemoryWatchers] = useState(() => new Map<string, MemoryWatcherObject>());
  const [memoryEpoch, setMemoryEpoch] = useState(0);

  const allMemoryWatchers = Array.from(memoryWatchers.values());

  // listen to the queries and start/stop the watchers
  useEffect(() => {
    // console.log('got memory queries update', structuredClone(memoryQueries));

    // remove old watchers
    for (const [query, watcher] of Array.from(memoryWatchers.entries())) {
      if (!memoryQueries.some(memoryQuery => memoryQuery.query === query)) {
        // console.log('remove old watcher', { query });
        memoryWatchers.delete(query);
        watcher.destroy();
      }
    }
    // add new watchers
    for (const memoryQuery of memoryQueries) {
      const { query } = memoryQuery;
      if (!memoryWatchers.has(query)) {
        const watcher = new MemoryWatcherObject(query, {
          agent,
        });
        // console.log('add new watcher', { query });
        // trigger re-render when the watched value updates
        watcher.addEventListener('update', () => {
          // console.log('watcher update', {
          //   query,
          //   value: watcher.value,
          // });
          setMemoryEpoch(e => e + 1);
        });
        memoryWatchers.set(query, watcher);
      }
    }
  }, [JSON.stringify(memoryQueries)]);
  
  return allMemoryWatchers.length > 0 && (
    <Conversation>
      {/* Memory prompt injection */}
      <Prompt>
        {dedent`\
          # Memory Watchers
          Here are the memory watchers that are currently active, along with the results.
          \`\`\`
        ` + '\n' +
        JSON.stringify(allMemoryWatchers.map(watcher => watcher.getQa()), null, 2) + '\n' +
        dedent`\
          \`\`\`
        `}
      </Prompt>
      <Defer>
        {/* trigger memory watcher refresh */}
        {allMemoryWatchers.map((memoryWatcher, index) => {
          return (
            <EveryNMessages n={1} key={memoryWatcher.query}>{() => {
              memoryWatcher.refresh();
            }}</EveryNMessages>
          );
        })}
      </Defer>
    </Conversation>
  );
};

//

type MemoryQuery = {
  query: string;
};
class MemoryWatcherObject extends EventTarget {
  query: string = '';
  value: string[] | undefined = [];
  agent: ActiveAgentObject;
  constructor(query: string, opts?: any) {
    super();

    const {
      agent,
    }: {
      agent: any,
    } = opts ?? {};

    this.query = query;
    this.agent = agent;
  }
  async refresh() {
    const { agent } = this;
    const memories = await agent.getMemory(this.query, {
      matchCount: maxMemoryQueryValues,
    });
    this.value = memories.map(memory => memory.text);

    this.dispatchEvent(new MessageEvent('update', {
      data: {
        value: this.value,
      },
    }));
  }
  getQa() {
    return {
      q: this.query,
      a: this.value,
    };
  }
  destroy() {
    // nothing
  }
};
const AddMemoryAction = () => {
  const agent = useAgent();
  return (
    <Action
      name="addMemory"
      description={dedent`\
        Save a memory to the database in the form of a question and answer.
        Use this whenever there there is a new fact or detail that you want to remember.
      `}
      schema={
        z.object({
          query: z.string(),
          answer: z.string(),
        })
      }
      examples={[
        {
          query: 'What time did we schedule the karaoke night?',
          answer: '7pm, but bring glitter.',
        },
        {
          query: 'What was the secret password to enter the speakeasy?',
          answer: 'Flamingo hats unite!',
        },
        {
          query: 'Who is the lead singer of our virtual rock band?',
          answer: 'Captain Zed the Time Traveler.',
        },
        {
          query: 'What was the last pizza topping we debated?',
          answer: 'Pineapple, and it got heated.',
        },
        {
          query: 'What is my character\'s mission in this quirky reality show?',
          answer: 'Win the golden avocado.',
        },
        {
          query: 'When are we supposed to launch the confetti cannon?',
          answer: 'Right after the CEO’s dance-off.',
        },
        {
          query: 'What’s the name of our team’s pet mascot?',
          answer: 'Sir Fluffington the Third.',
        },
        {
          query: 'What’s the theme of this week\'s office party?',
          answer: 'Space pirates with neon lights.',
        },
      ]}
      handler={async (e: PendingActionEvent) => {
        const { query, answer } = e.data.message.args as {
          query: string,
          answer: string,
        };
        const text = `${query}\n${answer}`;
        const content = {
          query,
          answer,
        };
        await agent.addMemory(text, content);
        await e.commit();
      }}
    />
  );
};
const QueryMemoriesAction = ({
  memoryQueries,
  setMemoryQueries,
}) => {
  return (
    <Action
      name="queryMemories"
      description={
        dedent`\
          This action lets you remember specific details better by focusing your attention on a question.
          Using this whenever the topic of conversation changes. It will significantly boost your ability to recall information.
          For example, "What are the plans to meet up?" will help us remember the details of the meet-up.

          We are already querying the following:
        ` + '\n' +
        JSON.stringify(memoryQueries, null, 2)
      }
      schema={
        z.object({
          query: z.string(),
        })
      }
      examples={[
        {
          query: 'What pizza toppings does everyone like for the next movie marathon?',
        },
        {
          query: 'When is the CEO’s karaoke battle scheduled again?',
        },
        {
          query: 'Which team member is in charge of the surprise flash mob?',
        },
        {
          query: 'What wild idea did we brainstorm for the company’s anniversary?',
        },
        {
          query: 'Who volunteered to handle the laser light show at the next event?',
        },
      ]}
      handler={async (e: PendingActionEvent) => {
        const { query } = e.data.message.args as {
          query: string,
        };
        setMemoryQueries((queries = []) => {
          const o = shuffle([
            ...queries,
            {
              query,
            },
          ]).slice(-maxMemoryQueries);
          return o;
        });
        await e.commit();
      }}
    />
  );
};
const MemoryQueriesInternal = () => {
  const conversation = useConversation();
  const kv = useKv();
  const [memoryQueries, setMemoryQueries] = kv.use<MemoryQuery[]>(`memoryQueries-${conversation.getKey()}`, () => []);

  return (
    <>
      <QueryMemoriesAction memoryQueries={memoryQueries} setMemoryQueries={setMemoryQueries} />
      <MemoryWatcher memoryQueries={memoryQueries} />
    </>
  );
};
const MemoryQueries = () => {
  return (
    <Conversation>
      <MemoryQueriesInternal />
    </Conversation>
  );
};
const RAGMemory = () => {
  return (
    <>
      <AddMemoryAction />
      <DefaultMemories />
      <MemoryQueries />
    </>
  );
};

/**
 * Renders the default actions components.
 * @returns The JSX elements representing the default actions components.
 */
export const DefaultActions = () => {
  return (
    <>
      <ChatActions />
      <SocialMediaActions />
      <StoreActions />
    </>
  );
};

// prompts

/**
 * Renders the default prompts components.
 * @returns The JSX elements representing the default prompts components.
 */
export const DefaultPrompts = () => {
  return (
    <>
      <DefaultHeaderPrompt />
      <ConversationEnvironmentPrompt />
      <ActionsPrompt />
      <StorePrompt />
      <ConversationMessagesPrompt />
      <InstructionsPrompt />
    </>
  );
};
export const DefaultHeaderPrompt = () => {
  return (
    <Prompt>
      {dedent`
        Role-play as a character in a chat given the current state.
        Respond with a JSON object specifying the action method and arguments.
      `}
    </Prompt>
  );
};
export const ConversationEnvironmentPrompt = () => {
  return (
    <Conversation>
      <ScenePrompt />
      <CharactersPrompt />
    </Conversation>
  );
};
export const ScenePrompt = () => {
  const conversation = useConversation();
  const scene = conversation.getScene();
  return (
    <Prompt>
      {scene && dedent`
        # Scene
        ${scene.description}
      `}
    </Prompt>
  );
};
const formatAgent = (agent: any) => {
  return [
    `Name: ${agent.name}`,
    `UserId: ${agent.id}`,
    `Bio: ${agent.bio}`,
  ].join('\n');
};
export const CharactersPrompt = () => {
  const conversation = useConversation();
  const agents = conversation.getAgents();
  const name = useName();
  const bio = usePersonality();
  const currentAgentSpec = {
    name,
    // id,
    bio,
  };
  const agentSpecs = agents.map((agent) => agent.getPlayerSpec());

  return (
    <Prompt>
      {dedent`
        # Your Character
      ` +
        '\n\n' +
        formatAgent(currentAgentSpec) +
        (agents.length > 0
          ? (
            '\n\n' +
            dedent`
              # Other Characters
            ` +
            '\n\n' +
            agentSpecs
              .map(formatAgent)
              .join('\n\n')
          )
          : ''
        )
      }
    </Prompt>
  );
};
const ActionsPromptInternal = () => {
  const actions = useActions();
  const uniforms = useUniforms();
  const formatters = useFormatters();
  const conversation = useConversation();

  let s = '';
  if (actions.length > 0 && formatters.length > 0) {
    const formatter = formatters[0];
    s = dedent`
      # Response format
    ` +
    '\n\n' +
    formatter.formatFn(Array.from(actions.values()), uniforms, conversation);
  }
  return (
    <Prompt>{s}</Prompt>
  );
};
export const ActionsPrompt = () => {
  return (
    <Conversation>
      <ActionsPromptInternal />
    </Conversation>
  );
};
const StoreItemsPrompt = () => {
  const agent = useAgent();
  const storeItems = useStoreItems();
  return !!agent.stripeConnectAccountId && storeItems.length > 0 && (
    <Prompt>
      {dedent`\
        # Store
        Here are the store items available for purchase.
        Amount in cents (e.g. 100 = $1).
        \`\`\`
      ` + '\n' +
      JSON.stringify(storeItems, null, 2) + '\n' +
      dedent`\
        \`\`\`
      `}
    </Prompt>
  );
};
const PurchasesPrompt = () => {
  const conversation = useConversation();
  const purchases = usePurchases();

  const conversationUserIds = Array.from(conversation.agentsMap.keys());
  const userPurchases = purchases.filter(purchase => {
    return conversationUserIds.includes(purchase.buyerUserId);
  });

  return (
    <Prompt>
      {purchases.length > 0 && dedent`\
        # Purchases
        Here are the purchases made so far:
        \`\`\`
      ` + '\n' +
      JSON.stringify(userPurchases, null, 2) + '\n' +
      dedent`\
        \`\`\`
      `}
    </Prompt>
  )
};
export const StorePrompt = () => {
  return (
    <>
      <StoreItemsPrompt />
      <Conversation>
        <PurchasesPrompt />
      </Conversation>
    </>
  );
};

//

export const ConversationMessagesPrompt = () => {
  return (
    <Conversation>
      <CachedMessagesPrompt />
    </Conversation>
  );
}
export const CachedMessagesPrompt = () => {
  const cachedMessages = useCachedMessages();

  const formatAttachments = (attachments?: Attachment[]) => {
    if (attachments?.length > 0) {
      return attachments.map((attachment) => formatAttachment(attachment));
    } else {
      return undefined;
    }
  };
  const formatAttachment = (attachment: Attachment): FormattedAttachment => {
    const {
      id,
      type,
      // alt,
    } = attachment;
    return {
      id,
      type,
      // alt,
    };
  };

  return (
    <Prompt>
      {dedent`
        # Message history
        ${
          cachedMessages.length > 0
            ? dedent`
              Here is the chat so far:
            ` +
              '\n' +
              '```' +
              '\n' +
              cachedMessages
                .map((action) => {
                  const { /*userId,*/ name, method, args, attachments = [], timestamp } = action;
                  const j = {
                    // userId,
                    name,
                    method,
                    args,
                    attachments: formatAttachments(attachments),
                  };
                  return JSON.stringify(j) + ' ' + timeAgo(new Date(timestamp));
                })
                .join('\n') +
              '\n' +
              dedent`
                <end of message history, continue from here>
              ` +
              '\n' +
              '```'
            : 'No messages have been sent or received yet. This is the beginning of the conversation.'
        }
      `}
    </Prompt>
  );
};
export const InstructionsPrompt = () => {
  const agent = useAgent();

  return (
    <Prompt>
      {dedent`
        # Instructions
        Respond with the next action taken by your character: ${agent.name}
        The method/args of your response must match one of the allowed actions.
      `}
    </Prompt>
  );
};

// formatters
export const DefaultFormatters = () => {
  return <JsonFormatter />;
};
export const JsonFormatter = () => {
  const isAllowedAction = (action: ActionPropsAux, conversation?: ConversationObject, thinkOpts?: AgentThinkOptions) => {
    const forceAction = thinkOpts?.forceAction ?? null;
    const excludeActions = thinkOpts?.excludeActions ?? [];
    return (!action.conversation || action.conversation === conversation) &&
      (forceAction === null || action.name === forceAction) &&
      !excludeActions.includes(action.name);
  };
  const getFilteredActions = (actions: ActionPropsAux[], conversation?: ConversationObject, thinkOpts?: AgentThinkOptions) => {
    return actions.filter(action => isAllowedAction(action, conversation, thinkOpts));
  };
  return (
    <Formatter
      /* actions to zod schema */
      schemaFn={(actions: ActionPropsAux[], uniforms: UniformPropsAux[], conversation?: ConversationObject, thinkOpts?: AgentThinkOptions) => {
        const makeActionSchema = (method: string, args: z.ZodType<object> = z.object({})) => {
          return z.object({
            method: z.literal(method),
            args,
          });
        };
        const makeUnionSchema = (actions: ActionPropsAux[]) => {
          const actionSchemas: ZodTypeAny[] = getFilteredActions(actions, conversation, thinkOpts)
            .map(action => makeActionSchema(action.name, action.schema));
          if (actionSchemas.length >= 2) {
            return z.union(
              actionSchemas as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]
            );
          } else if (actionSchemas.length === 1) {
            return actionSchemas[0];
          } else {
            return null;
          }
        };
        const makeObjectSchema = (uniforms: ActionPropsAux[]) => {
          const filteredUniforms = getFilteredActions(uniforms, conversation, thinkOpts);
          if (filteredUniforms.length > 0) {
            const o = {};
            for (const uniform of filteredUniforms) {
              o[uniform.name] = uniform.schema;
              // console.log('set uniform', uniform.name, printNode(zodToTs(uniform.schema).node));
            }
            return z.object(o);
          } else {
            return null;
          }
        };
        const actionSchema = makeUnionSchema(actions);
        const uniformsSchema = makeObjectSchema(uniforms);
        const o = {};
        if (actionSchema) {
          o['action'] = actionSchema;
        }
        if (uniformsSchema) {
          o['uniforms'] = uniformsSchema;
        }
        return z.object(o);
      }}
      /* actions to instruction prompt */
      formatFn={(actions: ActionPropsAux[], uniforms: UniformPropsAux[], conversation?: ConversationObject, thinkOpts?: AgentThinkOptions) => {
        const formatAction = (action: ActionPropsAux) => {
          const {
            name,
            description,
            state,
            examples,
          } = action;

          const examplesJsonString = (examples ?? []).map((args) => {
            return JSON.stringify(
              {
                method: name,
                args,
              }
            );
          }).join('\n');

          return (
            name ? (
              dedent`
                * ${name}
              ` +
              '\n'
            ) : ''
          ) +
          (description ? (description + '\n') : '') +
          (state ? (state + '\n') : '') +
          (examplesJsonString
            ? (
              dedent`
                Examples:
                \`\`\`
              ` +
              '\n' +
              examplesJsonString +
              '\n' +
              dedent`
                \`\`\`
              `
            )
            : ''
          );
        };
        
        const actionsString = getFilteredActions(actions, conversation, thinkOpts)
          .map(formatAction)
          .join('\n\n');
        const uniformsString = getFilteredActions(uniforms, conversation, thinkOpts)
          .map(formatAction)
          .join('\n\n');
        return [
          actionsString && (dedent`\
            ## Actions
            Here are the available actions you can take:
          ` + '\n\n' +
          actionsString),
          uniformsString && (dedent`\
            ## Uniforms
            Each action must also include the following additional keys (uniforms):
          ` + '\n\n' +
          uniformsString),
        ].filter(Boolean).join('\n\n');
      }}
    />
  );
};

// perceptions

/**
 * Renders the default perceptions components.
 * @returns The JSX elements representing the default perceptions components.
 */
export const DefaultPerceptions = () => {
  // const agent = useAgent();

  return (
    <>
      <Perception
        type="say"
        handler={async (e) => {
          await e.data.targetAgent.think();
        }}
      />
      <Perception
        type="nudge"
        handler={async (e) => {
          const { message } = e.data;
          const {
            args,
          } = message;
          const targetUserId = (args as any)?.targetUserId;
          // if the nudge is for us
          if (targetUserId === e.data.targetAgent.agent.id) {
            await e.data.targetAgent.think();
          }
        }}
      />
    </>
  );
};

// uniforms

export const LiveModeInner = (props) => {
  const agent = useAgent();
  const conversation = useConversation();
  const timeouts = agent.liveManager.useTimeouts(conversation);

  return (
    <Uniform
      name="nextActionTime"
      description={dedent`\
        Optionally wait before continuing with your next action.
        Use this to pause the job/conversation until a later time. The delay can be short (e.g. 1 second pause) or long (like a calendar date).
        Specify a delay time, a Date (ISO 8601) string, or use null to indicate nothing to add.
      `}
      state={[
        dedent`\
          Next action schedule:
        ` + '\n' + (
          timeouts.length > 0 ?
            timeouts.map((timestamp) => {
              const date = new Date(timestamp);
              return dedent`\
                - ${date.toISOString()} (${timeAgo(date)})
              `;
            }).join('\n')
          :
            'None'
        ),
      ].join('\n')}
      schema={
        z.union([
          z.object({
            delayTime: z.object({
              unit: z.enum(['seconds', 'minutes', 'hours', 'days']),
              value: z.number(),
            }),
          }),
          z.object({
            waitUntilDateISOString: z.string(),
          }),
          z.null(),
        ])
      }
      examples={[
        {
          delayTime: {
            unit: 'seconds',
            value: 10,
          },
        },
        {
          waitUntilDateISOString: `2021-01-30T01:23:45.678Z`,
        },
        null,
      ]}
      handler={async (e: ActionEvent) => {
        const {
          agent,
          message: {
            args: nextMessageWaitArgs,
          },
        } = e.data;
        const timeout = (() => {
          if (nextMessageWaitArgs === null) {
            return Date.now();
          } else if ('delayTime' in nextMessageWaitArgs) {
            const { delayTime } = nextMessageWaitArgs as {
              delayTime: {
                unit: string,
                value: number,
              },
            };
            const { unit, value } = delayTime;
            const delay = (() => {
              switch (unit) {
                case 'seconds': return value * 1000;
                case 'minutes': return value * 1000 * 60;
                case 'hours': return value * 1000 * 60 * 60;
                case 'days': return value * 1000 * 60 * 60 * 24;
                default: return 0;
              }
            })();
            const now = Date.now();
            return now + delay;
          } else if ('waitUntilDateISOString' in nextMessageWaitArgs) {
            const { waitUntilDateISOString } = nextMessageWaitArgs as {
              waitUntilDateISOString: string,
            };
            return Date.parse(waitUntilDateISOString);
          } else {
            throw new Error('Invalid nextMessageWaitArgs: ' + JSON.stringify(nextMessageWaitArgs));
          }
        })();
        console.log('got next action time: ', nextMessageWaitArgs, timeout - Date.now());
        const nextAction = async () => {
          console.log('live action 1');
          await agent.think();
          console.log('live action 2');
        };
        agent.agent.liveManager.setTimeout(nextAction, conversation, timeout);
      }}
    />
  );
};
export const LiveMode = (props) => {
  return (
    <Conversation>
      <LiveModeInner {...props} />
    </Conversation>
  );
};

// generators

const mediaGeneratorSpecs = [
  {
    types: ['image/jpeg+image'],
    ext: 'jpg',
    optionsSchema: z.object({
      image_size: z.enum(imageSizes as any).optional(),
    }).optional(),
    async generate({
      prompt,
      options,
    }: {
      prompt: string,
      options?: {
        image_size?: string,
      },
    }, {
      jwt,
    }) {
      const blob = await fetchImageGeneration(prompt, options, {
        jwt,
      });
      const blob2 = new Blob([blob], {
        type: this.types[0],
      });
      return blob2;
    },
  },
  {
    types: ['audio/mpeg+sound-effect'],
    ext: 'mp3',
    // optionsSchema: z.object({
    //   image_size: z.enum(imageSizes as any).optional(),
    // }).optional(),
    async generate({
      prompt,
      // options,
    }: {
      prompt: string,
      // options?: {
      //   image_size?: string,
      // },
    }, {
      jwt,
    }) {
      const blob = await generateSound(prompt, undefined, {
        jwt,
      });
      const blob2 = new Blob([blob], {
        type: this.types[0],
      });
      return blob2;
    },
  },
  {
    types: ['model/gltf-binary+3d-model'],
    ext: 'glb',
    async generate({
      prompt,
    }: {
      prompt: string,
    }, {
      jwt,
    }) {
      const imageBlob = await fetchImageGeneration(prompt, {
        image_size: imageSizes[0],
      }, {
        jwt,
      });
      const blob = await generateModel(imageBlob, {
        jwt,
      });
      const blob2 = new Blob([blob], {
        type: this.types[0],
      });
      return blob2;
    }
  },
  {
    types: ['model/video/mp4+video'],
    ext: 'mp4',
    async generate({
      prompt,
    }: {
      prompt: string,
    }, {
      jwt,
    }) {
      const imageBlob = await fetchImageGeneration(prompt, {
        image_size: imageSizes[0],
      }, {
        jwt,
      });
      const videoBlob = await generateVideo(imageBlob, {
        jwt,
      });
      return videoBlob;
    }
  },
];
const MediaGenerator = () => {
  const authToken = useAuthToken();
  const types = mediaGeneratorSpecs.flatMap(spec => spec.types) as [string, ...string[]];
  const generationSchemas = mediaGeneratorSpecs.map(spec => {
    const o = {
      type: z.enum(spec.types as any),
      prompt: z.string(),
      chatText: z.string().optional(),
    };
    if (spec.optionsSchema) {
      (o as any).options = spec.optionsSchema;
    }
    return z.object(o);
  });
  const generationSchemasUnion = generationSchemas.length >= 2 ? z.union(generationSchemas as any) : generationSchemas[0];

  return (
    <>
      <Action
        name="sendMedia"
        description={dedent`\
          Send simulated multimedia content as a media attachment.

          Prompt will be used for generating the media.
          Optional chat text message will be sent with the media.

          The available content types are:
          \`\`\`
        ` + '\n' +
        JSON.stringify(types, null, 2) + '\n' +
        dedent`\
          \`\`\`
        `}
        schema={generationSchemasUnion}
        examples={[
          {
            type: 'image/jpeg',
            prompt: `girl wearing a dress and a hat selling flowers in a Zelda-inspired market`,
            options: {
              image_size: imageSizes[0],
            },
            chatText: "Guess where I am? ;)",
          },
          {
            type: 'audio/mp3',
            prompt: `a mechanical button beep, 16 bit`,
            // options: {
            //   image_size: imageSizes[0],
            // },
            chatText: "Beep!",
          },
        ]}
        handler={async (e: PendingActionEvent) => {
          const {
            agent,
            message: {
              args: generationArgs,
            },
          } = e.data;
          const {
            type,
            prompt,
            options,
            chatText,
          } = generationArgs as {
            type: string,
            prompt: string,
            options?: {
              image_size?: string,
            },
            chatText?: string,
          };
          // console.log('send media args', e.data.message.args);

          const retry = () => {
            agent.think();
          };

          const mediaGeneratorSpec = mediaGeneratorSpecs.find(spec => spec.types.includes(type));
          if (mediaGeneratorSpec) {
            try {
              const blob = await mediaGeneratorSpec.generate({
                prompt,
                options,
              }, {
                jwt: authToken,
              });
              // console.log('got blob', blob);

              // upload to r2
              const guid = crypto.randomUUID();
              const keyPath = ['assets', guid, `media.${mediaGeneratorSpec.ext}`].join('/');
              const u = `${r2EndpointUrl}/${keyPath}`;
              try {
                const res = await fetch(u, {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${authToken}`,
                  },
                  body: blob,
                });
                if (res.ok) {
                  const mediaUrl = await res.json();
                  const m = {
                    method: 'say',
                    args: {
                      text: chatText ?? '',
                    },
                    attachments: [
                      {
                        id: guid,
                        type: blob.type,
                        url: mediaUrl,
                      },
                    ],
                  };
                  // console.log('add message', m);
                  await agent.addMessage(m);
                } else {
                  const text = await res.text();
                  throw new Error(`could not upload media file: ${blob.type}: ${text}`);
                }
              } catch (err) {
                throw new Error('failed to put voice: ' + u + ': ' + err.stack);
              }
            } catch (err) {
              const monologueString = dedent`\
                The following error occurred while generating the media:
              ` + '\n\n' + JSON.stringify(generationArgs) + '\n\n'+ err.stack;
              console.log('generating monologue for', {
                monologueString,
              });
              await agent.monologue(monologueString);
            }
          } else {
            console.warn('warning: no media generator spec found for type', {
              type,
              mediaGeneratorSpecs,
            });
            retry();
          }
        }}
      />
    </>
  );
};
export const DefaultGenerators = () => {
  return (
    <MediaGenerator />
  );
};

// senses

const mediaPerceptionSpecs = [
  {
    types: ['image/jpeg', 'image/png', 'image/webp'],
    describe: async ({
      // blob,
      url,
      questions,
      agent,
    }: {
      // blob: Blob,
      url: string,
      questions: string[],
      agent: AgentObject,
    }, {
      jwt,
    }) => {
      const answersFormat = z.object({
        answers: z.array(z.string()),
      });
      const answersObject = await describeJson(url, dedent`\
        Respond as if you are role playing the following character:
        Name: ${agent.name}
        Bio: ${agent.bio}

        Answer the following questions about the image, as JSON array.
        Each question string in the input array should be answered with a string in the output array.
      ` + JSON.stringify({
        questions,
      }, null, 2), answersFormat, {
        jwt,
      });
      const { answers } = answersObject;
      return answers;
    },
  },
];
const supportedMediaPerceptionTypes = mediaPerceptionSpecs.flatMap(mediaPerceptionSpec => mediaPerceptionSpec.types);
const collectAttachments = (messages: ActionMessage[]) => {
  const result = [];
  for (const message of messages) {
    if (message.attachments) {
      result.push(...message.attachments);
    }
  }
  return result;
};
export const MultimediaSense = () => {
  const conversation = useConversation();
  const authToken = useAuthToken();
  const randomId = useMemo(getRandomId, []);

  // XXX be able to query media other than that from the current conversation
  const messages = conversation.messageCache.getMessages();
  const attachments = collectAttachments(messages)
    .filter(attachment => {
      const typeClean = attachment.type.replace(/\+[\s\S]*$/, '');
      return supportedMediaPerceptionTypes.includes(typeClean);
    });

  return attachments.length > 0 && (
    <Action
      name="mediaPerception"
      description={
        dedent`\
          Query multimedia content using natural language questions + answers.
          The questions should be short and specific.
          Use this whenever you need to know more information about a piece of media, like an image attachment.

          The available media are:
          \`\`\`
        ` + '\n' +
        JSON.stringify(attachments, null, 2) + '\n' +
        dedent`\
          \`\`\`
        `
      }
      schema={
        z.object({
          // type: z.enum(types),
          id: z.string(),
          questions: z.array(z.string()),
        })
      }
      examples={[
        {
          // type: 'image/jpeg',
          id: randomId,
          questions: [
            'Describe the image.',
          ],
        },
        {
          // type: 'image/jpeg',
          id: randomId,
          questions: [
            `What are the dimensions of the subject, in meters?`,
          ],
        },
        {
          // type: 'image/jpeg',
          id: randomId,
          questions: [
            `Describe the people in the image.`,
            `What's the mood/aesthetic?`,
          ],
        },
      ]}
      handler={async (e: PendingActionEvent) => {
        // console.log('mediaPerception handler 1', e.data);
        const {
          agent,
          message: {
            args: {
              id: attachmentId,
              questions,
            },
          },
        } = e.data;
        const retry = () => {
          agent.think();
        };
        const makeQa = (questions: string[], answers: string[]) => {
          return questions.map((q, index) => {
            const a = answers[index];
            return {
              q,
              a,
            };
          });
        };

        const attachments = [];
        const attachmentsToMessagesMap = new WeakMap();
        const messages = conversation.messageCache.getMessages();
        for (const message of messages) {
          if (message.attachments) {
            for (const attachment of message.attachments) {
              attachments.push(attachment);
              attachmentsToMessagesMap.set(attachment, message);
            }
          }
        }

        const attachment = attachments.find(attachment => attachment.id === attachmentId);
        // console.log('mediaPerception handler 2', {
        //   attachmentId,
        //   attachments,
        //   attachment,
        //   questions,
        //   agent,
        //   conversation,
        // });
        if (attachment) {
          const {
            type,
            url,
          } = attachment;
          if (url) {
            // const res = await fetch(url);
            // const blob = await res.blob();
            // console.log('querying!', {
            //   blob,
            //   questions,
            //   agent,
            // });
            const mediaPerceptionSpec = mediaPerceptionSpecs.find(spec => spec.types.includes(type));
            if (mediaPerceptionSpec) {
              const answers = await mediaPerceptionSpec.describe({
                // blob,
                url,
                questions,
                agent: agent.agent,
              }, {
                jwt: authToken,
              });
              // const alt = makeQa(questions, answers);
              console.log('media perception qa', {
                questions,
                answers,
                // alt,
              });
              const qa = makeQa(questions, answers);
              (e.data.message.args as any).queries = qa;
              // console.log('commit 1', e.data.message);
              await e.commit();

              // console.log('commit 2', e.data.message, alt);
              agent.think(
                dedent`\
                  Your character looked at an attachment and discovered the following:
                ` + '\n' +
                  JSON.stringify({
                    attachmentId: attachment.id,
                    ...qa,
                  }, null, 2),
                {
                  excludeActions: ['mediaPerception'],
                },
              );
            } else {
              console.warn('warning: no media perception spec found for type', {
                type,
                mediaPerceptionSpecs,
              });
              retry();
            }
          } else {
            console.warn('warning: attachment has no url', {
              attachmentId,
              attachments,
              attachment,
            });
            retry();
          }
        } else {
          console.warn('warning: model generated invalid id, retrying', {
            attachmentId,
            attachments,
            attachment,
          });
          retry();
        }
      }}
    />
  )
};
export const DefaultSenses = () => {
  return (
    <>
      <Conversation>
        <MultimediaSense />
      </Conversation>
      <WebBrowser />
    </>
  );
};
export const TelnyxDriver = () => {
  const agent = useAgent();
  const [telnyxEnabled, setTelnyxEnabled] = useState(false);

  const { telnyxManager } = agent;
  useEffect(() => {
    const updateTelnyxEnabled = () => {
      const telnyxBots = telnyxManager.getTelnyxBots();
      setTelnyxEnabled(telnyxBots.length > 0);
    };
    const botadd = (e: any) => {
      updateTelnyxEnabled();
    };
    const botremove = (e: any) => {
      updateTelnyxEnabled();
    };
    telnyxManager.addEventListener('botadd', botadd);
    telnyxManager.addEventListener('botremove', botremove);
    return () => {
      telnyxManager.removeEventListener('botadd', botadd);
      telnyxManager.removeEventListener('botremove', botremove);
    };
  }, [telnyxManager]);

  return telnyxEnabled && (
    <>
      <Action
        name="callPhone"
        description={
          dedent`\
            Start a phone call with a phone number.
            The phone number must be in +E.164 format. If the country code is not known, you can assume +1.
          `
        }
        schema={
          z.object({
            phoneNumber: z.string(),
          })
        }
        examples={[
          {
            phoneNumber: '+15551234567',
          },
        ]}
        handler={async (e: PendingActionEvent) => {
          const {
            agent,
            message: {
              args,
            },
          } = e.data;
          const {
            phoneNumber: toPhoneNumber,
          } = args as {
            phoneNumber: string;
          };
          const telnyxBots = agent.agent.telnyxManager.getTelnyxBots();
          const telnyxBot = telnyxBots[0];
          if (telnyxBot) {
            const fromPhoneNumber = telnyxBot.getPhoneNumber();
            if (fromPhoneNumber) {
              await telnyxBot.call({
                fromPhoneNumber,
                toPhoneNumber,
              });

              (e.data.message.args as any).result = 'ok';

              await e.commit();
            } else {
              console.warn('no local phone number found');
              (e.data.message.args as any).error = `no local phone number found`;
              await e.commit();
            }
          } else {
            console.warn('no telnyx bot found');
            (e.data.message.args as any).error = `no telnyx bot found`;
            await e.commit();
          }
        }}
      />
      <Action
        name="textPhone"
        description={
          dedent`\
            Text message (SMS/MMS) a phone number.
            The phone number must be in +E.164 format.
          `
        }
        schema={
          z.object({
            phoneNumber: z.string(),
            text: z.string(),
          })
        }
        examples={[
          {
            phoneNumber: '+15551234567',
            text: `Hey what's up?`
          },
        ]}
        handler={async (e: PendingActionEvent) => {
          const {
            agent,
            message: {
              args,
            },
          } = e.data;
          const {
            phoneNumber: toPhoneNumber,
            text,
          } = args as {
            phoneNumber: string;
            text: string;
          };
          const telnyxBots = agent.agent.telnyxManager.getTelnyxBots();
          const telnyxBot = telnyxBots[0];
          if (telnyxBot) {
            const fromPhoneNumber = telnyxBot.getPhoneNumber();
            if (fromPhoneNumber) {
              await telnyxBot.text(text, undefined, {
                fromPhoneNumber,
                toPhoneNumber,
              });

              (e.data.message.args as any).result = 'ok';

              await e.commit();
            } else {
              console.warn('no local phone number found');
              (e.data.message.args as any).error = `no local phone number found`;
              await e.commit();
            }
          }
        }}
      />
    </>
  );
};
export const DefaultDrivers = () => {
  return (
    <TelnyxDriver />
  );
};

// server

/**
 * Renders the default server components.
 * @returns The JSX elements representing the default server components.
 */
export const DefaultServers = () => {
  return <StaticServer />;
};

// const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const printRequest = (request: Request) => {
  const { method, url } = request;
  return `${method} ${url}`;
};
// const generateWebServerCode = async (
//   request: Request,
//   prompt: string,
//   context: AppContextValue,
// ) => {
//   const messages = [
//     {
//       role: 'system',
//       content: dedent`
//         You are an programmatic web server.
//         Take the user's specifcation of an in-flight web Request and write the Typescript code to generate a Response.
//         i.e. your task is to write a JavaScript function with the following signature:
//         \`\`\`
//         handle: (request: Request) => Promise<Response>;
//         \`\`\`

//         Do not write any comments, only the code. Use JavaScript, not TypeScript. Wrap your response on triple backticks.
//         e.g.
//         \`\`\`js
//         async function handle(request) {
//           return new Response('Hello, world!', { status: 200 });
//         }
//         \`\`\`

//         The APIs available to you are as follows:

//         /**
//          * Generate fully functional HTML page source from the given prompt.
//          * @param {string} prompt - The user prompt to generate the HTML page source from.
//          * @returns {Response} - Response that resolves to the HTML page source.
//          * @example
//          * const googleHtmlRes = await generateHtml('A fake version of the simple Google web page. It should include the classig Google header image, the search bar, and the two buttons "Search" and "I'm Feeling Lucky".');
//          * const googleHtml = await googleHtmlRes.text();
//          */
//         generateHtml: (prompt: string) => Promise<Response>;
//         \`\`\`

//         /**
//          * Generate a JSON response to a request.
//          * @param {string} prompt - The prompt to generate the JSON response from.
//          * @returns {Promise<Response>} - Response that resolves to the JSON response.
//          * @example
//          * const searchResultsRes = await generateJson(\`
//          * Object representing search results for the query "cats". It should match the schema:
//          * { results: [{ name: string, description: string, imgUrl: string }] }');
//          * \`);
//          * const searchResults = await searchResultsRes.json();
//          */
//         generateJson: (prompt: string) => Promise<Response>;

//         /**
//          * Generate an image response to a request.
//          * @param {string} prompt - The prompt to generate the image response from.
//          * @returns {Promise<Response>} - Response that resolves to the image data.
//          * @example
//          * const catImageRes = await generateImage('A cute cat image.');
//          * const catImageBlob = await catImageRes.blob();
//          */
//         generateImage: (prompt: string) => Promise<Response>;
//       `,
//     },
//     {
//       role: 'user',
//       content: dedent`
//         HTTP request being handled:
//         \`\`\`
//         ${printRequest(request)}
//         \`\`\`
//         Generate code to do the following:
//         ${prompt}
//       `,
//     },
//   ];
//   const newMessage = await context.subtleAi.complete(messages);
//   const responseString = newMessage.content;
//   const codeBlock = parseCodeBlock(responseString);
//   return new Response(codeBlock, {
//     status: 200,
//     headers: {
//       'Content-Type': 'application/javascript',
//     },
//   });
// };
const generateHtml = async (prompt: string, context: AppContextValue) => {
  // const { method, url } = request;
  // const headers = Array.from(request.headers.entries())
  //   .map(([k, v]) => `${capitalize(k)}: ${v}`)
  //   .join('\n');
  const messages = [
    {
      role: 'system',
      content: dedent`
        You are an HTML page generator.
        Take the user's specifcation of a web page and generate the HTML source for it.
        When referencing images from the local server, use relative paths instead of absolute.

        Wrap your response on triple backticks.
        e.g.
        Prompt: A simple hello world web page with a header, an image, a heading, a paragraph, and a form with a textarea and a submit button.
        Response:
        \`\`\`html
        <html>
          <head>
            <title>Hello, world!</title>
          </head>
          <body>
            <img src="/banner.png">
            <h1>Hi there</h1>
            <p>Welcome to my web page!</p>
            <form>
              <textarea id="textarea"></textarea>
              <input type="submit">
            </form>
          </body>
        </html>
        \`\`\`
      `,
    },
    {
      role: 'user',
      content: dedent`
        Generate an HTML page to do the following:
        ${prompt}
      `,
    },
  ];
  const newMessage = await context.subtleAi.complete(messages);
  const responseString = newMessage.content;
  const codeBlock = parseCodeBlock(responseString);
  return new Response(codeBlock, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });
};
const generateJson = async (prompt: string, context: AppContextValue) => {
  // const { method, url } = request;
  // const headers = Array.from(request.headers.entries())
  //   .map(([k, v]) => `${capitalize(k)}: ${v}`)
  //   .join('\n');
  const messages = [
    {
      role: 'system',
      content: dedent`
        You are a JSON data API simulator.
        Take the user's specifcation of a JSON data specification to return and return it.

        Do not write any comments, only the JSON. Wrap your response on triple backticks.
        e.g.
        Prompt: Object representing search results for the query 'cats'. It should match the schema: { results: [{ name: string, description: string, imgUrl: string }] }
        Response:
        \`\`\`json
        {
          "results": [
            { "name": "Fluffy", "description": "A fluffy cat", "imgUrl": "/images/cats/fluffy.jpg" },
            { "name": "Whiskers", "description": "A cat with whiskers", "imgUrl": "/images/cats/whiskers.jpg" }
          ]
        }
        \`\`\`
      `,
    },
    {
      role: 'user',
      content: dedent`
        Generate an HTML page to do the following:
        ${prompt}
      `,
    },
  ];
  const newMessage = await context.subtleAi.complete(messages);
  const responseString = newMessage.content as string;
  return new Response(responseString, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
const generateImage = async (prompt: string, context: AppContextValue) => {
  const arrayBuffer = await context.subtleAi.generateImage(prompt);
  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
    },
  });
};
type Route = string | RegExp | null;
type Routes = Array<Route>;
type HandlerType = (
  this: GenerativeFetchHandler,
  request: Request,
  context: AppContextValue,
) => Promise<Response>;
class GenerativeFetchHandler {
  method: string | null;
  route: Route | Routes;
  prompt: string;
  handler: HandlerType;

  constructor({
    method,
    route,
    prompt,
    handler,
  }: {
    method: string | null;
    route: Route | Routes;
    prompt: string;
    handler: HandlerType;
  }) {
    this.method = method;
    this.route = route;
    this.prompt = prompt;
    this.handler = handler;
  }
  matches(request: Request) {
    const u = new URL(request.url);
    const routes = Array.isArray(this.route) ? this.route : [this.route];
    return routes.every((route) => {
      /* console.log('match route', {
        method: this.method,
        route,
        prompt: this.prompt,
        handler: this.handler.toString(),
        pathname: u.pathname,
        methodMatch: this.method === null || request.method === this.method,
        routeMatch:
          route === null ||
          (typeof route === 'string' && minimatch(u.pathname, route)) ||
          (route instanceof RegExp && route.test(u.pathname)),
        fullMatch:
          (this.method === null || request.method === this.method) &&
          (route === null ||
            (typeof route === 'string' && minimatch(u.pathname, route)) ||
            (route instanceof RegExp && route.test(u.pathname)))
      }); */
      return (
        (this.method === null || request.method === this.method) &&
        (route === null ||
          (typeof route === 'string' && minimatch(u.pathname, route)) ||
          (route instanceof RegExp && route.test(u.pathname)))
      );
    });
  }
  async handle(request: Request, appContextValue: AppContextValue) {
    return await this.handler.call(this, request, appContextValue);
  }
}

class GenerativeFetchHandlerHook {
  cachedHandlers: Array<GenerativeFetchHandler>;
  handler: HandlerType;

  constructor({
    cachedHandlers,
    handler,
  }: {
    cachedHandlers: Array<GenerativeFetchHandler>;
    handler: HandlerType;
  }) {
    this.handler = handler;
    this.cachedHandlers = cachedHandlers;
  }

  private hookFn(method: string | null, route: Route | Routes, prompt: string) {
    const handler = new GenerativeFetchHandler({
      method,
      route,
      prompt,
      handler: this.handler,
    });
    // console.log('add handler', {
    //   method,
    //   route,
    //   prompt,
    //   handler: this.handler,
    // });
    this.cachedHandlers.push(handler);
  }
  getHookFn() {
    return this.hookFn.bind(this);
  }
}
const cachedGenerativeHandlers = [];
const getCachedGenerativeHandlers = () => cachedGenerativeHandlers;
const clearCachedGenerativeHandlers = () => {
  cachedGenerativeHandlers.length = 0;
};
// const generativeFetchHandlerHook = new GenerativeFetchHandlerHook({
//   cachedHandlers: cachedGenerativeHandlers,
//   async handler(
//     this: GenerativeFetchHandler,
//     request: Request,
//     context: AppContextValue,
//   ) {
//     let codeString = null;
//     let error = null;
//     try {
//       const webServerCodeRes = await generateWebServerCode(
//         request,
//         this.prompt,
//         context,
//       );
//       codeString = await webServerCodeRes.text();
//     } catch (err) {
//       error = err;
//     }

//     if (!error) {
//       if (!error) {
//         const text = '';
//         const newRes = new Response(text, {
//           status: 200,
//           headers: {
//             'Content-Type': 'application/javascript',
//           },
//         });
//         return newRes;
//       } else {
//         return new Response(
//           JSON.stringify({
//             error,
//           }),
//           {
//             status: 500,
//             headers: {
//               'Content-Type': 'application/json',
//             },
//           },
//         );
//       }
//     } else {
//       return new Response(
//         JSON.stringify({
//           error: 'failed to parse LLM output: ' + error,
//         }),
//         {
//           status: 500,
//           headers: {
//             'Content-Type': 'application/json',
//           },
//         },
//       );
//     }
//   },
// });
const generativeHtmlFetchHandlerHook = new GenerativeFetchHandlerHook({
  cachedHandlers: cachedGenerativeHandlers,
  async handler(
    this: GenerativeFetchHandler,
    request: Request,
    context: AppContextValue,
  ) {
    let htmlString = null;
    let error = null;
    try {
      const webServerCodeRes = await generateHtml(this.prompt, context);
      htmlString = await webServerCodeRes.text();
    } catch (err) {
      error = err;
    }

    if (!error) {
      if (!error) {
        const newRes = new Response(htmlString, {
          status: 200,
          headers: {
            'Content-Type': 'application/javascript',
          },
        });
        return newRes;
      } else {
        return new Response(
          JSON.stringify({
            error,
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      }
    } else {
      return new Response(
        JSON.stringify({
          error: 'failed to parse LLM output: ' + error,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  },
});
const generativeJsonFetchHandlerHook = new GenerativeFetchHandlerHook({
  cachedHandlers: cachedGenerativeHandlers,
  async handler(
    this: GenerativeFetchHandler,
    request: Request,
    context: AppContextValue,
  ) {
    const jsonRes = await generateJson(
      dedent`
        HTTP request being handled:
        \`\`\`
        ${printRequest(request)}
        \`\`\`
        Generate JSON for do the following:
        ${this.prompt}
      `,
      context,
    );
    return jsonRes;
  },
});
const generativeImageFetchHandlerHook = new GenerativeFetchHandlerHook({
  cachedHandlers: cachedGenerativeHandlers,
  async handler(
    this: GenerativeFetchHandler,
    request: Request,
    context: AppContextValue,
  ) {
    const messages = [
      {
        role: 'system',
        content: dedent`
          You are an assistant that writes image prompts for a generative AI system.
          Take the user's specifcation of an in-flight web Request and and a prompt, and write an 1-3 sentence image prompt for it.

          Wrap your response on triple backticks.
          e.g.
          Prompt:
          Write an appropriate image prompt for the following web request:
          GET /images/anime/cats/miko.png
          The image should be set in a fantasy isekai background.
          Response:
          \`\`\`txt
          A fantasy isekai landscape featuring a cute anime-style cat named Miko. The scene is vibrant and magical, with a lush forest in the background, mystical floating islands above, and a clear blue sky. The cat, Miko, has large expressive eyes, fluffy fur, and wears a small red cloak. The overall atmosphere is enchanting and whimsical, perfectly suited for an isekai setting.
          \`\`\`
        `,
      },
      {
        role: 'user',
        content: dedent`
          HTTP request being handled:
          \`\`\`
          ${printRequest(request)}
          \`\`\`
          Generate an image prompt for the following:
          ${this.prompt}
        `,
      },
    ];
    // console.log('generate image 1', {
    //   messages,
    // });
    const newMessage = await context.subtleAi.complete(messages);
    const imagePrompt = newMessage.content;

    // console.log('generate image 2', {
    //   imagePrompt,
    // });
    const imageRes = await generateImage(imagePrompt, context);
    const json = await imageRes.json();
    // console.log('generate image 3', {
    //   json: JSON.stringify(json, null, 2),
    // });
    const url = json.data[0].url;
    // console.log('generate image 4', {
    //   url,
    // });
    const proxyRes = await fetch(url);
    if (proxyRes.ok) {
      return new Response(proxyRes.body, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
        },
      });
    } else {
      return new Response(proxyRes.body, {
        status: proxyRes.status,
      });
    }
  },
});
const generativeFarcasterFrameFetchHandlerHook = new GenerativeFetchHandlerHook(
  {
    cachedHandlers: cachedGenerativeHandlers,
    async handler(
      this: GenerativeFetchHandler,
      request: Request,
      context: AppContextValue,
    ) {
      const imageUrl = `https://picsum.photos/300`;
      const frameHtml = dedent`
        <html>
          <head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${imageUrl}" />
            <meta property="og:image" content="${imageUrl}" />

            <meta property="fc:frame:button:1" content="Green" />
            <meta property="fc:frame:button:2" content="Purple" />
            <meta property="fc:frame:button:3" content="Red" />
            <meta property="fc:frame:button:4" content="Blue" />
          </head>
          <body>
            <h1>Frame test</h1>
            <p>Hello, world</p>
          </body>
        </html>
      `;
      return new Response(frameHtml);
      /* const messages = [
        {
          role: 'system',
          content: dedent`
            You are an assistant that writes image prompts for a generative AI system.
            Take the user's specifcation of an in-flight web Request and and a prompt, and write an 1-3 sentence image prompt for it.

            Wrap your response on triple backticks.
            e.g.
            Prompt:
            Write an appropriate image prompt for the following web request:
            GET /images/anime/cats/miko.png
            The image should be set in a fantasy isekai background.
            Response:
            \`\`\`txt
            A fantasy isekai landscape featuring a cute anime-style cat named Miko. The scene is vibrant and magical, with a lush forest in the background, mystical floating islands above, and a clear blue sky. The cat, Miko, has large expressive eyes, fluffy fur, and wears a small red cloak. The overall atmosphere is enchanting and whimsical, perfectly suited for an isekai setting.
            \`\`\`
          `,
        },
        {
          role: 'user',
          content: dedent`
            HTTP request being handled:
            \`\`\`
            ${printRequest(request)}
            \`\`\`
            Generate an image prompt for the following:
            ${this.prompt}
          `,
        },
      ];
      // console.log('generate image 1', {
      //   messages,
      // });
      const newMessage = await context.subtleAi.complete(messages);
      const imagePrompt = newMessage.content;

      // console.log('generate image 2', {
      //   imagePrompt,
      // });
      const imageRes = await generateImage(imagePrompt, context);
      const json = await imageRes.json();
      // console.log('generate image 3', {
      //   json: JSON.stringify(json, null, 2),
      // });
      const url = json.data[0].url;
      console.log('generate image 4', {
        url,
      });
      const proxyRes = await fetch(url);
      if (proxyRes.ok) {
        return new Response(proxyRes.body, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
          },
        });
      } else {
        return new Response(proxyRes.body, {
          status: proxyRes.status,
        });
      } */
    },
  },
);
// export const generativeFetchHandler = generativeFetchHandlerHook.getHookFn();
export const generativeHtmlFetchHandler =
  generativeHtmlFetchHandlerHook.getHookFn();
export const generativeJsonFetchHandler =
  generativeJsonFetchHandlerHook.getHookFn();
export const generativeImageFetchHandler =
  generativeImageFetchHandlerHook.getHookFn();
export const generativeFarcasterFrameFetchHandler =
  generativeFarcasterFrameFetchHandlerHook.getHookFn();

// XXX support serving the public directory
// XXX support rendering custom react UIs
// XXX support API perception endpoints
export const StaticServer = () => {
  return (
    <Server>
      {() => {
        return {
          async fetch(request: Request, env: object) {
            const u = new URL(request.url);
            const { pathname } = u;
            // XXX finish this to serve the agent's public directory
            if (pathname === '/agent.npc') {
              const s = (env as any).AGENT_JSON as string;
              console.log('returning agent json', { s, env });
              return new Response(s);
            } else {
              return null;
            }
          },
        };
      }}
    </Server>
  );
};
export const GenerativeServer = ({
  children,
}: {
  children: React.ReactNode | (() => void);
}) => {
  const appContextValue = useContext(AppContext);

  const childFn = children as () => void;
  if (typeof childFn === 'function') {
    // XXX this should be cleared at the beginning of the render pass, not each time GenerativeServer is declared
    clearCachedGenerativeHandlers();
    childFn();
  } else {
    console.warn(
      'GenerativeServer children must be a function: ' + typeof childFn,
    );
    return null;
  }
  const handlers = getCachedGenerativeHandlers();

  return (
    <Server>
      {() => {
        return {
          async fetch(request: Request, env: object) {
            const handler = handlers.find((handler) =>
              handler.matches(request),
            );
            if (handler) {
              return await handler.handle(request, appContextValue);
            } else {
              return null;
            }
          },
        };
      }}
    </Server>
  );
};

//

type AgentBrowser = Browser & {
  // sessionId: string;
  context: BrowserContext,
  destroy: () => Promise<void>;
};

export type WebBrowserProps = {
  hint?: string;
  // maxSteps: number;
  // navigationTimeout: number;
};
class BrowserState {
  // sessionId: string;
  browser: AgentBrowser;
  destroySession: () => Promise<void>;
  pages = new Map<string, Page>();
  constructor({
    // sessionId,
    browser,
    destroySession,
  }: {
    // sessionId: string;
    browser: any;
    destroySession: () => Promise<void>;
  }) {
    // this.sessionId = sessionId;
    this.browser = browser;
    this.destroySession = destroySession;
  }
  toJSON() {
    return {
      pages: Array.from(this.pages.keys()),
    };
  }
  async destroy() {
    await this.destroySession();
  }
}
type WebBrowserActionHandlerOptions = {
  args: any;
  agent?: GenerativeAgentObject;
  authToken?: string;
  ensureBrowserState: () => Promise<BrowserState>;
  browserState: BrowserState;
  browserStatePromise: React.MutableRefObject<Promise<BrowserState>>;
};
type WebBrowserActionSpec = {
  method: string;
  description: string;
  schema: ZodTypeAny,
  schemaDefault: () => object,
  handle: (opts: WebBrowserActionHandlerOptions) => Promise<string>;
  toText: (opts: any) => string;
};
type WebBrowserActionObject = {
  method: string;
  args: any;
};
export const webbrowserActions: WebBrowserActionSpec[] = [
  {
    method: 'createPage',
    description: 'Create a new browser page.',
    schema: z.object({}),
    schemaDefault: () => ({}),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const browserState = await opts.ensureBrowserState();
      const guid = crypto.randomUUID();
      const contexts = browserState.browser.contexts();
      const context = contexts[0];
      const page = await context.newPage();
      browserState.pages.set(guid, page);
      return JSON.stringify({
        ok: true,
        pageId: guid,
      });
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'createPage')?.toText,
  },
  {
    method: 'pageGoto',
    description: 'Navigate to a URL on a page.',
    schema: z.object({
      pageId: z.string(),
      url: z.string(),
    }),
    // schemaDefault: () => z.object({
    //   pageId: z.string().default(crypto.randomUUID()),
    //   url: z.string().default('https://example.com'),
    // }),
    schemaDefault: () => ({
      pageId: crypto.randomUUID(),
      url: 'https://example.com',
    }),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        args,
        agent,
      } = opts;
      const {
        pageId,
        url,
      } = args as {
        pageId: string;
        url: string;
      };
      const browserState = await opts.ensureBrowserState();
      const page = browserState.pages.get(pageId);
      if (!page) {
        throw new Error(`Page with guid ${pageId} not found.`);
      }
      await page.goto(url);

      return JSON.stringify({
        ok: true,
      });
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'pageGoto')?.toText,
  },
  {
    method: 'elementClick',
    description: 'Click on an element with the given text on a page.',
    schema: z.object({
      pageId: z.string(),
      text: z.string(),
    }),
    // schemaDefault: () => z.object({
    //   pageId: z.string().default(crypto.randomUUID()),
    //   text: z.string().default('Next'),
    // }),
    schemaDefault: () => ({
      pageId: crypto.randomUUID(),
      text: 'Next',
    }),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        args,
        agent,
      } = opts;
      const {
        pageId,
        text,
      } = args as {
        pageId: string;
        text: string;
      };
      const browserState = await opts.ensureBrowserState();
      const page = browserState.pages.get(pageId);
      if (!page) {
        throw new Error(`Page with guid ${pageId} not found.`);
      }
      const element = await page.getByText(text);
      if (!element) {
        throw new Error(`Element with text ${text} not found.`);
      }
      await element.click();

      return JSON.stringify({
        ok: true,
      });
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'elementClick')?.toText,
  },
  {
    method: 'pageScreenshot',
    description: 'Screenshot a page and send it as a message attachment.',
    schema: z.object({
      pageId: z.string(),
    }),
    // schemaDefault: () => z.object({
    //   pageId: z.string().default(crypto.randomUUID()),
    // }),
    schemaDefault: () => ({
      pageId: crypto.randomUUID(),
    }),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        args,
        agent,
        authToken,
      } = opts;
      const {
        pageId,
      } = args as {
        pageId: string;
      };
      const browserState = await opts.ensureBrowserState();
      const page = browserState.pages.get(pageId);
      if (!page) {
        throw new Error(`Page with guid ${pageId} not found.`);
      }
      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 70,
      });
      console.log('got screenshot', screenshot);
      const blob = new Blob([screenshot], {
        type: 'image/jpeg',
      });

      const guid = crypto.randomUUID();
      const guid2 = crypto.randomUUID();
      const keyPath = ['assets', guid, `screenshot.jpeg`].join('/');
      const u = `${r2EndpointUrl}/${keyPath}`;
      try {
        const res = await fetch(u, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
          body: blob,
        });
        if (res.ok) {
          const screenshotUrl = await res.json();

          const m = {
            method: 'say',
            args: {
              text: '',
            },
            attachments: [
              {
                id: guid2,
                type: blob.type,
                url: screenshotUrl,
              },
            ],
          };
          // console.log('add message', m);
          await agent.addMessage(m);

          return JSON.stringify({
            ok: true,
            screenshotUrl,
          });
        } else {
          const text = await res.text();
          throw new Error(`could not upload media file: ${blob.type}: ${text}`);
        }
      } catch (err) {
        throw new Error('failed to put voice: ' + u + ': ' + err.stack);
      }
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'pageScreenshot')?.toText,
  },
  {
    method: 'pageClose',
    description: 'Close a page.',
    schema: z.object({
      pageId: z.string(),
    }),
    // schemaDefault: () => z.object({
    //   pageId: z.string().default(crypto.randomUUID()),
    // }),
    schemaDefault: () => ({
      pageId: crypto.randomUUID(),
    }),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        args,
        agent,
      } = opts;
      const {
        pageId,
      } = args as {
        pageId: string;
      };
      const browserState = await opts.ensureBrowserState();
      const page = browserState.pages.get(pageId);
      if (!page) {
        throw new Error(`Page with guid ${pageId} not found.`);
      }
      await page.close();
      browserState.pages.delete(pageId);

      return JSON.stringify({
        ok: true,
      });
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'pageClose')?.toText,
  },
  /* {
    method: 'downloadUrl',
    description: 'Download a file via the browser.',
    schema: z.object({
      url: z.string(),
    }),
    // schemaDefault: () => z.object({
    //   url: z.string().default('https://example.com'),
    // }),
    schemaDefault: () => ({
      url: 'https://example.com',
    }),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        args,
        agent,
      } = opts;
      const {
        url,
      } = args as {
        url: string;
      };
      console.log('download url', {
        url,
      });
      // const browserState = await ensureBrowserState();
      // const page = await browserState.browser.newPage();
      // await page.goto(url);
      // const download = await page.waitForEvent('download');
      // await download.saveAs(download.suggestedFilename);
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'downloadUrl')?.toText,
  }, */
  {
    method: 'cleanup',
    description: 'Close the browser and clean up resources. Perform this as a courtesy when you are done.',
    schema: z.object({}),
    schemaDefault: () => ({}),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        // args,
        // agent,
        browserState,
        browserStatePromise,
      } = opts;
      // const browserState = await opts.ensureBrowserState();
      if (browserState) {
        browserState.destroy();
        browserStatePromise.current = null;
      }

      return JSON.stringify({
        ok: true,
      });
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'cleanup')?.toText,
  },
];
const SocialMediaActions = () => {
  return (
    <Conversation>
      <StatusUpdateAction />
    </Conversation>
  );
};
export type StatusUpdateActionProps = {
  // nothing
};
export const StatusUpdateAction: React.FC<StatusUpdateActionProps> = (props: StatusUpdateActionProps) => {
  const conversation = useConversation();
  const randomId = useMemo(() => crypto.randomUUID(), []);

  // XXX come up with a better way to fetch available attachments from all messages, not just the cache
  const messages = conversation.messageCache.getMessages();
  const attachments = collectAttachments(messages);

  return (
    <Action
      name="statusUpdate"
      description={
        dedent`\
          Post to social media about what interesting things you are up to.
          Optionally attach media to your post.
        ` + '\n' + 
        (
          attachments.length > 0 ?
            dedent`\
              If included, the attachment must be one of the following:
              \`\`\`
            ` + '\n' +
            JSON.stringify(attachments, null, 2) + '\n' +
            dedent`\
              \`\`\`
            `
          :
            dedent`\
              However, there are no available media to attach.
            `
        )
      }
      schema={
        z.object({
          text: z.string(),
          attachments: z.array(z.object({
            attachmentId: z.string(),
          })),
        })
      }
      examples={[
        {
          text: `Just setting up my account`,
        },
        {
          text: `Guess where I am?`,
          attachments: [
            {
              attachmentId: randomId,
            },
          ],
        },
      ]}
      handler={async (e: PendingActionEvent) => {
        const { agent, message } = e.data;
        const agentId = agent.agent.id;
        const { text, attachments } = message.args as {
          text: string;
          attachments: Array<{ attachmentId: string }>;
        };

        // post status update to the database
        const _postStatusUpdate = async () => {
          const supabase = agent.agent.useSupabase();
          const update = {
            agent_id: agentId,
            text,
            attachments,
          };
          const result = await supabase.from('status_updates')
            .insert(update);
          const { error } = result;
          if (!error) {
            // nothing
          } else {
            throw new Error('Failed to post status update: ' + error.message);
          }
        };
        await _postStatusUpdate();

        // commit the message to chat history, so the agent knows it has been sent
        await e.commit();
      }}
    />
  );
};
export const WebBrowser: React.FC<WebBrowserProps> = (props: WebBrowserProps) => {
  // const agent = useAgent();
  const authToken = useAuthToken();
  const hint = props.hint ?? '';

  const [browserState, setBrowserState] = useState<BrowserState | null>(null);
  const browserStatePromise = useRef<Promise<BrowserState>>(null);
  // const randomId = useMemo(() => crypto.randomUUID(), []);

  const actionTypeUnion = z.union(webbrowserActions.map((action) => {
    return z.object({
      method: z.literal(action.method),
      args: action.schema,
    });
  }) as any);
  const examples = webbrowserActions.map((action) => {
    return {
      method: action.method,
      args: action.schemaDefault,
    };
  });

  const ensureBrowserState = async () => {
    if (!browserStatePromise.current) {
      const localPromise = (async () => {
        // console.log('create browser with jwt', authToken);
        const browserResult = await createBrowser(undefined, {
          jwt: authToken,
        });
        const {
          sessionId,
          url,
          browser,
          destroySession,
        } = browserResult;
        if (localPromise === browserStatePromise.current) {
          // if we are still the current browser state promise, latch the state
          const browserState = new BrowserState({
            // sessionId: browser.sessionId,
            browser,
            destroySession,
          });
          setBrowserState(browserState);
          return browserState;
        } else {
          // else if we are not the current browser state promise, clean up
          // browser.destroy();
          destroySession();
        }
      })();
      browserStatePromise.current = localPromise;
    }
    return await browserStatePromise.current;
  };

  // latch cleanup
  useEffect(() => {
    if (browserState) {
      return () => {
        browserState.destroy();
      };
    }
  }, [browserState]);

  const browserAction = 'browserAction';
  return (
    <Action
      name={browserAction}
      description={
        dedent`\
          Perform a web browsing action.
        ` + '\n\n' +
        (
          browserState ? (
            dedent`\
              The current browser state is:
              \`\`\`
            ` + '\n' +
            JSON.stringify(browserState, null, 2) + '\n' +
            dedent`\
              \`\`\`
            ` + '\n\n'
          ) : (
            dedent`\
              There are no active browser sessions.
            `
          )
        ) +
        dedent`\
          The allowed methods are:
        ` + '\n\n' +
        JSON.stringify(webbrowserActions.map((action) => {
          return {
            method: action.method,
            description: action.description,
            schema: printNode(zodToTs(action.schema).node),
          };
        }), null, 2) + '\n\n' +
        hint
      }
      schema={actionTypeUnion}
      examples={examples}
      handler={async (e: PendingActionEvent) => {
        const { agent, message } = e.data;
        const webBrowserActionArgs = message.args as WebBrowserActionObject;
        const { method, args } = webBrowserActionArgs;

        const retry = () => {
          agent.think();
        };

        const webbrowserAction = webbrowserActions.find((action) => action.method === method);
        if (webbrowserAction) {
          try {
            let result: any = null;
            let error: (string | undefined) = undefined;
            try {
              const opts = {
                args,
                agent,
                authToken,
                ensureBrowserState,
                browserState,
                browserStatePromise,
              };
              console.log('execute browser action 1', {
                method,
                args,
                opts,
              });
              result = await webbrowserAction.handle(opts);
              console.log('execute browser action 2', {
                method,
                args,
                opts,
                result,
              });
            } catch (err) {
              console.log('got web browser action result', {
                result,
                err,
              }, err.stack);
              error = err.stack;
            }

            /* (async () => {
              console.log('browser test 1');
              const result = await testBrowser({
                jwt: authToken,
              });
              console.log('browser test 2', {
                result,
              });
            })(); */

            // error = 'Web browser functionality is not implemented. Do not retry, it will not work..';

            const m = {
              method: browserAction,
              args: {
                method,
                args,
                error,
                result,
              },
              // attachments?: Attachment[],
            };
            // console.log('add browser action message 1', m);
            await agent.addMessage(m);

            // XXX
            return;

            // console.log('add browser action message 2', m);
            agent.think();
          } catch (err) {
            console.warn('Failed to perform web browser action: ' + err);
            retry();
          }
        } else {
          console.warn('Unknown web browser action method: ' + method);
          retry();
        }
      }}
    />
  )
};

export type RateLimitProps = {
  maxUserMessages: number;
  maxUserMessagesTime: number;
  message: string;
};
type UserMessageTimestamp = {
  timestamp: number;
};
export const RateLimit: React.FC<RateLimitProps> = (props: RateLimitProps) => {
  const maxUserMessages = props?.maxUserMessages ?? 5;
  const maxUserMessagesTime = props?.maxUserMessagesTime ?? 60 * 60 * 24 * 1000; // 1 day
  const rateLimitMessage = props?.message || 'You are sending messages too quickly. Please wait a moment before sending another message.';

  const rateLimitMessageSent = useRef(false);
  const kv = useKv();

  return (
    <PerceptionModifier
      type="say"
      handler={async (e: AbortablePerceptionEvent) => {
        const rateLimitingEnabled =
          maxUserMessages !== 0 &&
          isFinite(maxUserMessages) &&
          maxUserMessagesTime !== 0 &&
          isFinite(maxUserMessagesTime);
        const isOwner = e.data.sourceAgent.id === e.data.targetAgent.agent.ownerId;
        if (rateLimitingEnabled && !isOwner) {
          // if rate limiting is enabled
          const { /*message, */sourceAgent, targetAgent } = e.data;
          // fetch old timestamps
          const key = `userMessageTimestamps.${sourceAgent.id}`;
          let userMessageTimestamps = await kv.get<UserMessageTimestamp[]>(key) ?? [];
          // filter out old timestamps
          const now = Date.now();
          userMessageTimestamps = userMessageTimestamps.filter((t) => now - t.timestamp < maxUserMessagesTime);
          if (userMessageTimestamps.length < maxUserMessages) {
            // if we have room for more timestamps
            // add new timestamp
            userMessageTimestamps.push({
              timestamp: now,
            });
            // save state
            (async () => {
              await kv.set(key, userMessageTimestamps);
            })().catch((err) => {
              console.warn('failed to set user message timestamps', err);
            });
            // flag the success
            rateLimitMessageSent.current = false;
            // continue normal handling
          } else {
            // else if we have hit the rate limit
            // abort the perception event
            e.abort();

            // once per limit, send a message to the user
            if (!rateLimitMessageSent.current) {
              rateLimitMessageSent.current = true;

              // send rate limit blocker message
              (async () => {
                await targetAgent.say(rateLimitMessage);
              })().catch((err) => {
                console.warn('failed to send rate limit message', err);
              });
            }
          }
        }
      }}
      priority={-defaultPriorityOffset}
    />
  );
};

export type TTSProps = {
  voiceEndpoint?: string; // voice to use
};
export const TTS: React.FC<TTSProps> = (props: TTSProps) => {
  const voiceEndpoint = props?.voiceEndpoint;

  const tts = useTts({
    voiceEndpoint,
  });

  return (
    <ActionModifier
      name="say"
      handler={async (e: AbortableActionEvent) => {
        const { message, agent } = e.data;
        const args = message.args as any;
        const text = (args as any).text as string;

        const readableAudioStream = tts.getVoiceStream(text);
        const { type } = readableAudioStream;
        const playableAudioStream = readableAudioStream as PlayableAudioStream;
        playableAudioStream.id = crypto.randomUUID();
        agent.addAudioStream(playableAudioStream);

        if (!message.attachments) {
          message.attachments = [];
        }
        message.attachments.push({
          id: playableAudioStream.id,
          type: `${type}+voice`,
        });
      }}
    />
  );
};
export const DiscordBot: React.FC<DiscordBotProps> = (props: DiscordBotProps) => {
  const {
    token,
    channels,
    dms,
    userWhitelist,
  } = props;
  const agent = useAgent();

  useEffect(() => {
    const args: DiscordBotArgs = {
      token,
      channels: channels ? (Array.isArray(channels) ? channels : [channels]) : [],
      dms: dms ? (Array.isArray(dms) ? dms : [dms]) : [],
      userWhitelist,
      agent,
    };
    const discordBot = agent.discordManager.addDiscordBot(args);
    return () => {
      agent.discordManager.removeDiscordBot(discordBot);
    };
  }, [
    token,
    JSON.stringify(channels),
    JSON.stringify(dms),
    JSON.stringify(userWhitelist),
  ]);

  return null;
};
// https://github.com/xdevplatform/twitter-api-typescript-sdk
// twurl authorize --consumer-key XXX --consumer-secret XXX
// less ~/.twurlrc
export const TwitterBot: React.FC<TwitterBotProps> = (props: TwitterBotProps) => {
  const {
    token,
  } = props;
  // const agent = useAgent();

  useEffect(() => {
    (async () => {
      if (token) {
        // console.log('twitter client 1', token);
        // const client = new TwitterClient(token, {
        //   endpoint: `https://ai.upstreet.ai/api/twitter`,
        // });
        // console.log('twitter client 2', client);

        // const tweet = await client.tweets.findTweetById('20');
        // console.log('tweet', tweet);

        /* // Tell typescript it's a readonly app
        const readOnlyClient = twitterClient.readOnly;

        // Play with the built in methods
        const user = await readOnlyClient.v2.userByUsername('plhery');
        await twitterClient.v2.tweet('Hello, this is a test.');
        // You can upload media easily!
        // await twitterClient.v1.uploadMedia('./big-buck-bunny.mp4');

        console.log('twitter client 2', twitterClient);

        try {
          await twitterClient.v2.tweet('Hello, this is a test.');

          console.log('Tweet sent successfully');
        } catch (error) {
          console.error('Error sending tweet:', error);
        } */
      }
    })();
  }, [token]);

  return null;
};
export const Telnyx: React.FC<TelnyxProps> = (props: TelnyxProps) => {
  const {
    apiKey,
    phoneNumber,
    message,
    voice,
  } = props;
  const agent = useAgent();

  useEffect(() => {
    const args: TelnyxBotArgs = {
      apiKey,
      phoneNumber,
      message,
      voice,
      agent,
    };
    const telnyxBot = agent.telnyxManager.addTelnyxBot(args);
    return () => {
      agent.telnyxManager.removeTelnyxBot(telnyxBot);
    };
  }, [
    apiKey,
    phoneNumber,
    message,
    voice,
  ]);

  return null;
};