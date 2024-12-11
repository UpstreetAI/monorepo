import React, { useContext, useMemo, useEffect } from 'react';
import type {
  NameProps,
} from '../../types';
import { AgentContext, AgentRegistryContext } from '../../context';

export const Name = /*memo(*/(props: NameProps) => {
  const agent = useContext(AgentContext);
  const agentRegistry = useContext(AgentRegistryContext).agentRegistry;
  const symbol = useMemo(Symbol, []);

  const deps = [
    props.children,
  ];

  useEffect(() => {
    agentRegistry.registerName(symbol, props);
    return () => {
      agentRegistry.unregisterName(symbol);
    };
  }, deps);

  agent.useEpoch(deps);

  // return <name value={props} />;
  return null;
}//);