import React, { useState, useMemo, useEffect, useContext, forwardRef, useImperativeHandle, memo } from 'react';
import type {
  ActionProps,
  ActionModifierProps,
  PendingActionEvent,
} from '../../types';
import {
  AgentContext,
  ConversationContext,
  AgentRegistryContext,
} from '../../context';
import {
  printZodSchema,
} from '../../util/util.mjs';

export const Action = /*memo(*/(props: ActionProps) => {
  const agent = useContext(AgentContext);
  const agentRegistry = useContext(AgentRegistryContext).agentRegistry;
  const symbol = useMemo(Symbol, []);
  const conversation = useContext(ConversationContext).conversation;

  // default handler just commits the event
  const handler = props.handler ?? (async (e: PendingActionEvent) => {
    e.commit();
  });

  const deps = [
    props.type,
    props.description,
    printZodSchema(props.schema),
    JSON.stringify(props.examples),
    handler?.toString() ?? '',
    conversation,
  ];

  useEffect(() => {
    const props2 = {
      ...props,
      conversation,
      handler,
    };
    agentRegistry.registerAction(symbol, props2);
    return () => {
      agentRegistry.unregisterAction(symbol);
    };
  }, deps);

  // console.log('action use epoch', props, new Error().stack);
  agent.useEpoch(deps);

  // return <action value={props} />;
  return null;
}//);
export const ActionModifier = /*memo(*/(props: ActionModifierProps) => {
  const agent = useContext(AgentContext);
  const agentRegistry = useContext(AgentRegistryContext).agentRegistry;
  const symbol = useMemo(Symbol, []);
  const conversation = useContext(ConversationContext).conversation;

  const deps = [
    props.type,
    props.handler.toString(),
    props.priority ?? null,
  ];

  useEffect(() => {
    const props2 = {
      ...props,
      conversation,
    };
    agentRegistry.registerActionModifier(symbol, props2);
    return () => {
      agentRegistry.unregisterActionModifier(symbol);
    };
  }, deps);

  // console.log('action use epoch', props, new Error().stack);
  agent.useEpoch(deps);

  // return <action value={props} />;
  return null;
}//);