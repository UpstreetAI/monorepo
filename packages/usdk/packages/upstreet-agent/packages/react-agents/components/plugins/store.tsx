import React, { useEffect, useContext, useMemo } from 'react';
import dedent from 'dedent';
import {
  PaymentProps,
  SubscriptionProps,
  PendingActionEvent,
} from '../../types';
import {
  useAgent,
  useStoreItems,
} from '../../hooks';
import { Action } from '../core/action';
import {
  AgentContext,
  AgentRegistryContext,
} from '../../context';
import {
  storeItemType,
} from '../../util/agent-features.mjs';
import {
  currencies,
  intervals,
} from '../../constants.mjs';

export const Payment = (props: PaymentProps) => {
  const agent = useContext(AgentContext);
  const agentRegistry = useContext(AgentRegistryContext).agentRegistry;
  const symbol = useMemo(Symbol, []);

  const deps = [
    props.amount,
    props.currency,
    props.name,
    props.description,
    props.previewUrl,
  ];

  useEffect(() => {
    agentRegistry.registerPayment(symbol, props);
    return () => {
      agentRegistry.unregisterPayment(symbol);
    };
  }, deps);

  agent.useEpoch(deps);

  return null;
};
export const Subscription = (props: SubscriptionProps) => {
  const agent = useContext(AgentContext);
  const agentRegistry = useContext(AgentRegistryContext).agentRegistry;
  const symbol = useMemo(Symbol, []);

  const deps = [
    props.amount,
    props.currency,
    props.name,
    props.description,
    props.previewUrl,
  ];

  useEffect(() => {
    agentRegistry.registerSubscription(symbol, props);
    return () => {
      agentRegistry.unregisterSubscription(symbol);
    };
  }, deps);

  agent.useEpoch(deps);

  return null;
};

// XXX this needs to be run whenever there is a store item
const StoreActions = () => {
  const agent = useAgent();
  const storeItems = useStoreItems();
  return (
    <>
      {!!agent.stripeConnectAccountId && storeItems.length > 0 && (
        <Action
          type="paymentRequest"
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