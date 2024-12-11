import { useState, useMemo, useContext, useEffect } from 'react';
import Stripe from 'stripe';
import memoizeOne from 'memoize-one';
import {
  SceneObject,
  AgentObject,
  ActiveAgentObject,
  ActionProps,
  ActionPropsAux,
  UniformPropsAux,
  NameProps,
  PersonalityProps,
  ActionMessage,
  ActionHistoryQuery,
  ChatArgs,
  KvArgs,
  TtsArgs,
  Tts,
  StoreItem,
  MessageCacheUpdateArgs,
} from './types';
import {
  AppContext,
  AgentContext,
  AgentRegistryContext,
  ConversationsContext,
  ConversationContext,
} from './context';
import { ExtendableMessageEvent } from './util/extendable-message-event';
import {
  supabaseSubscribe,
} from './util/supabase-client.mjs';
import {
  QueueManager,
} from 'queue-manager';
import {
  aiProxyHost,
} from './util/endpoints.mjs';
import { getStripeDevSuffix } from 'react-agents/util/stripe-utils.mjs';
import {
  FetchHttpClient,
} from './util/stripe/net/FetchHttpClient';

//

// get the .env.txt content (parsed as an object)
// note: this contains keys and must not be exposed to the user (such as by including it in prompts)
export const useEnv: () => object = () => {
  const appContextValue = useContext(AppContext);
  return appContextValue.useEnv();
};
// get the 'development' or 'production' environment variable
// not to be confused with useEnv()
export const useEnvironment: () => string = () => {
  const appContextValue = useContext(AppContext);
  return appContextValue.useEnvironment();
};
// get the agent's authentication token
// note: this contains keys and must not be exposed to the user (such as by including it in prompts)
// not to be confused with useEnv()
export const useAuthToken: () => string = () => {
  const appContextValue = useContext(AppContext);
  return appContextValue.useAuthToken();
};
// get the passed-down agent initialization json
export const useInit: () => any = () => {
  const appContextValue = useContext(AppContext);
  return appContextValue.useInit();
};
// get the passed-down agent debug flag
export const useDebug: () => number = () => {
  const appContextValue = useContext(AppContext);
  return appContextValue.useDebug();
};

//

export const useAgent = () => {
  const agentContextValue = useContext(AgentContext);
  return agentContextValue;
};
export const useSupabase = () => {
  const agentContextValue = useContext(AgentContext);
  return agentContextValue.appContextValue.useSupabase();
};
export const useConversations = () => {
  const conversationsContext = useContext(ConversationsContext);
  return conversationsContext.conversations;
};
export const useConversation = () => {
  const conversationContextValue = useContext(ConversationContext);
  const { conversation } = conversationContextValue;
  // if (conversation === null) {
  //   throw new Error('useConversation() can only be used within a conversation context');
  // }
  return conversation;
};

export const useActions: () => ActionPropsAux[] = () => {
  const agentRegistryValue = useContext(AgentRegistryContext).agentRegistry;
  return agentRegistryValue.actions;
};
export const useUniforms: () => Array<UniformPropsAux> = () => {
  const agentRegistryValue = useContext(AgentRegistryContext).agentRegistry;
  return agentRegistryValue.uniforms;
};

export const useName: () => string = () => {
  const agent = useContext(AgentContext);
  const agentRegistryValue = useContext(AgentRegistryContext).agentRegistry;
  const names = agentRegistryValue.names;
  return names.length > 0 ? names[0].children : agent.name;
};
export const usePersonality: () => string = () => {
  const agent = useContext(AgentContext);
  const agentRegistryValue = useContext(AgentRegistryContext).agentRegistry;
  const personalities = agentRegistryValue.personalities;
  return personalities.length > 0 ? personalities[0].children : agent.bio;
};

export const useCachedMessages = (opts?: ActionHistoryQuery) => {
  const agent = useAgent();
  const conversation = useConversation();
  const [cachedMessagesEpoch, setCachedMessagesEpoch] = useState(0);

  if (!conversation) {
    throw new Error('useCachedMessages() can only be used within a conversation context');
  }

  // trigger the load
  useEffect(() => {
    (async () => {
      await conversation.messageCache.waitForLoad();
    })().catch((err) => {
      console.warn('message cache wait for load error', err);
    });
  }, [conversation]);

  useEffect(() => {
    if (conversation) {
      const update = (e: ExtendableMessageEvent<MessageCacheUpdateArgs>) => {
        setCachedMessagesEpoch(cachedMessagesEpoch => cachedMessagesEpoch + 1);
    
        // wait for re-render before returning from the handler
        e.waitUntil((async () => {
          const renderRegistry = agent.appContextValue.useRegistry();
          await renderRegistry.waitForUpdate();
        })());
      };
      conversation.messageCache.addEventListener('update', update);
      return () => {
        conversation.messageCache.removeEventListener('update', update);
      };
    }
  }, [conversation]);

  const messages = conversation.getCachedMessages(opts?.filter);
  return messages;
};
export const useNumMessages = () => {
  const cachedMessages = useCachedMessages();
  return cachedMessages.length;
};
export const useMessageFetch = (opts?: ActionHistoryQuery) => {
  // XXX finish this
  throw new Error('not implemented');

  /* const agent = useAgent();
  const supabase = agent.useSupabase();
  const conversation = useConversation();
  const optsString = JSON.stringify(opts);
  const messagesPromise = useMemo<any>(makePromise, [conversation, optsString]);
  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;
    (async () => {
      try {
        const messages = await conversation.fetchMessages(opts?.filter, {
          supabase,
          signal,
        });
        messagesPromise.resolve(messages);
      } catch (err) {
        if (err === abortError) {
          // nothing
        } else {
          messagesPromise.reject(err);
        }
      }
    })();

    return () => {
      abortController.abort(abortError);
    };
  }, [conversation, optsString]);
  use(messagesPromise); // XXX don't use this
  return messagesPromise; */
};

export const useKv = (opts?: KvArgs) => {
  const appContextValue = useContext(AppContext);
  return appContextValue.useKv(opts);
};

export const useTts: (opts?: TtsArgs) => Tts = (opts) => {
  return memoizeOne((voiceEndpoint?: string, sampleRate?: number) => {
    const appContextValue = useContext(AppContext);
    return appContextValue.useTts(opts);
  })(opts?.voiceEndpoint, opts?.sampleRate);
};

export const useStripe = () => {
  const { stripeConnectAccountId } = useAgent();
  const environment = useEnvironment();
  const authToken = useAuthToken();

  const customFetchFn = async (url: string, options: any) => {
    const u = new URL(url);
    // redirect to the ai proxy host
    u.host = aiProxyHost;
    // prefix the path with /api/stripe
    const stripeDevSuffix = getStripeDevSuffix(environment);
    u.pathname = `/api/stripe${stripeDevSuffix}${u.pathname}`;
    return fetch(u.toString(), {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${authToken}`,
      },
    });
  };
  const httpClient = new FetchHttpClient(customFetchFn);
  const stripe = new Stripe(stripeConnectAccountId, {
    httpClient: httpClient as any,
    stripeAccount: stripeConnectAccountId,
  });
  return stripe;
};

export const useStoreItems: () => StoreItem[] = () => {
  // const agent = useContext(AgentContext);
  const agentRegistryValue = useContext(AgentRegistryContext).agentRegistry;
  const storeItems = agentRegistryValue.storeItems;
  return storeItems;
};
type AgentWebhook = {
  id: string,
  buyerUserId: string,
  type: 'payment' | 'subscription',
  event: any,
};
type AgentWebhooksState = {
  webhooks: AgentWebhook[],
  lastUpdateTimestamp: number,
};
const makeAgentWebhooksState = (): AgentWebhooksState => ({
  webhooks: [],
  lastUpdateTimestamp: 0,
});

const agentWebhooksStateKey = 'agentWebhooksState';
export const usePurchases = () => {
  const agent = useAgent();
  const agentId = agent.id;
  const ownerId = agent.ownerId;
  const supabase = agent.useSupabase();
  const kv = useKv();
  const stripe = useStripe();
  const queueManager = useMemo(() => new QueueManager(), []);
  const [agentWebhooksState, setAgentWebhooksState] = kv.use<AgentWebhooksState>(agentWebhooksStateKey, makeAgentWebhooksState);

  const handleWebhook = async (webhook: any) => {
    const { data: event, created_at } = webhook;
    const createdAt = +new Date(created_at);
    const agentWebhooksState = await kv.get<AgentWebhooksState>(agentWebhooksStateKey, makeAgentWebhooksState);

    if (createdAt >= agentWebhooksState.lastUpdateTimestamp && !agentWebhooksState.webhooks.some((w) => w.id === webhook.id)) {
      const object = event.data?.object;
      // console.log('handle webhook', event.type, webhook);
      switch (event.type) {
        case 'checkout.session.completed': {
          const webhookOwnerId = webhook.user_id;
          const {
            // name: webhookName,
            // description: webhookDescription,
            agentId: webhookAgentId,
            targetUserId: webhookBuyerUserId,
          } = object.metadata;
          if (
            // typeof webhookName === 'string' &&
            // typeof webhookDescription === 'string' &&
            typeof webhookAgentId === 'string' &&
            typeof webhookBuyerUserId === 'string'
          ) {
            if (webhookOwnerId === ownerId && webhookAgentId === agentId) {
              // if it's the correct owner and agent, handle the webhook
              const {
                mode, // 'payment' | 'subscription'
                payment_intent,
                subscription,
              } = object;
              // console.log('parse object', object);
              if (mode === 'payment') {
                const paymentIntentObject = await stripe.paymentIntents.retrieve(payment_intent);
                // console.log('got payment intent', paymentIntentObject);
                await kv.set<AgentWebhooksState>(agentWebhooksStateKey, {
                  webhooks: [
                    ...agentWebhooksState.webhooks,
                    {
                      id: webhook.id,
                      buyerUserId: webhookBuyerUserId,
                      type: 'payment',
                      event: {
                        ...object,
                        payment_intent: paymentIntentObject,
                      },
                    },
                  ],
                  lastUpdateTimestamp: createdAt,
                });
              } else if (mode === 'subscription') {
                // load the subscription
                const subscriptionObject = await stripe.subscriptions.retrieve(subscription);
                // console.log('got subscription', subscriptionObject);

                // // load the products
                // const products = await Promise.all(subscriptionObject.items.data.map(async (item) => {
                //   const productId = item.plan.product as string;
                //   const product = await stripe.products.retrieve(productId);
                //   return product;
                // }));
                // console.log('got products', products);

                const agentWebhook: AgentWebhook = {
                  id: webhook.id,
                  buyerUserId: webhookBuyerUserId,
                  type: 'subscription',
                  event: {
                    ...object,
                    subscription: subscriptionObject,
                    // subscription: {
                    //   ...subscriptionObject,
                    //   products,
                    // },
                  },
                };

                await kv.set<AgentWebhooksState>(agentWebhooksStateKey, {
                  webhooks: [
                    ...agentWebhooksState.webhooks,
                    agentWebhook,
                  ],
                  lastUpdateTimestamp: createdAt,
                });
              } else {
                // unknown mode; ignore
              }
            } else {
              // else if it's the wrong owner or agent, ignore the webhook
              // nothing
            }
          } else {
            console.warn('checkout.session.completed event missing metadata', event);
          }
          break;
        }
      }
    }
  };

  // get initial webhooks
  useEffect(() => {
    let live = true;

    (async () => {
      await queueManager.waitForTurn(async () => {
        const agentWebhooksState = await kv.get<AgentWebhooksState>(agentWebhooksStateKey, makeAgentWebhooksState);
        if (!live) return;

        const result = await supabase
          .from('webhooks')
          .select('*')
          .eq('user_id', ownerId)
          .gte('created_at', new Date(agentWebhooksState.lastUpdateTimestamp).toISOString())
          .order('created_at', { ascending: true });
        if (!live) return;

        const { error, data } = result;
        if (!error) {
          for (const webhook of data) {
            await handleWebhook(webhook);
           }
        } else {
          console.error(error);
        }
      });
    })();

    return () => {
      live = false;
    };
  }, []);
  // subscribe to webhooks
  useEffect(() => {
    const channel = supabaseSubscribe({
      supabase,
      table: 'webhooks',
      userId: ownerId,
    }, (payload: any) => {
      // console.log('subscription payload', payload);
      const webhook = payload.new;
      queueManager.waitForTurn(async () => {
        await handleWebhook(webhook);
      });
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const purchases = agentWebhooksState.webhooks.map((webhook) => {
    const {
      buyerUserId,
      type,
      event,
    } = webhook;
    switch (type) {
      case 'payment': {
        const {
          payment_intent,
          metadata,
        } = event;
        const {
          amount,
          currency,
        } = payment_intent;
        const {
          name,
          description,
        } = metadata;
        return {
          type: 'payment',
          buyerUserId,
          amount,
          currency,
          name,
          description,
        };
      }
      case 'subscription': {
        const {
          subscription,
          metadata,
        } = event;

        let amount = 0;
        let currency = '';
        for (let i = 0; i < subscription.items.length; i++) {
          const item = subscription.items.data[i];
          const {
            plan,
          } = item;
          amount += plan.amount;
          if (!currency) {
            currency = plan.currency;
          }
        }
        const {
          name,
          description,
        } = metadata;

        return {
          type: 'subscription',
          buyerUserId,
          amount,
          currency,
          name,
          description,
        };
      }
      default: {
        console.warn('unknown agent webhook type', {
          webhook,
        });
        return null;
      }
    }
  }).filter((purchase) => purchase !== null);
  return purchases;
};