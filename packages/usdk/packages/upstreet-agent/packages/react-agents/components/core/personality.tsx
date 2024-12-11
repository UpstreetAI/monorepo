import React, { useContext, useEffect, useMemo } from 'react';
import { AgentContext, AgentRegistryContext } from '../../context';
import type {
  PersonalityProps,
} from '../../types';

export const Personality = /*memo(*/(props: PersonalityProps) => {
  const agent = useContext(AgentContext);
  const agentRegistry = useContext(AgentRegistryContext).agentRegistry;
  const symbol = useMemo(Symbol, []);

  const deps = [
    props.children,
  ];

  useEffect(() => {
    agentRegistry.registerPersonality(symbol, props);
    return () => {
      agentRegistry.unregisterPersonality(symbol);
    };
  }, deps);

  agent.useEpoch(deps);

  // return <personality value={props} />;
  return null;
}//);