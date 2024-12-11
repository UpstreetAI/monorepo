import React, { useState, useMemo, useEffect, useContext, forwardRef, useImperativeHandle, memo } from 'react';
import type {
  UniformProps,
} from '../../types';
import {
  AgentContext,
  ConversationContext,
  AgentRegistryContext,
} from '../../context';
import {
  printZodSchema,
} from '../../util/util.mjs';

//

export const Uniform = (props: UniformProps) => {
  const agent = useContext(AgentContext);
  const agentRegistry = useContext(AgentRegistryContext).agentRegistry;
  const symbol = useMemo(Symbol, []);
  const conversation = useContext(ConversationContext).conversation;

  const deps = [
    props.type,
    props.description,
    printZodSchema(props.schema),
    JSON.stringify(props.examples),
    props.priority ?? null,
    props.handler?.toString() ?? '',
    conversation,
  ];

  useEffect(() => {
    const props2 = {
      ...props,
      conversation,
    };
    agentRegistry.registerUniform(symbol, props2);
    return () => {
      agentRegistry.unregisterUniform(symbol);
    };
  }, deps);

  agent.useEpoch(deps);

  return null;
};