import React, { useContext } from 'react';
import type {
  PromptProps,
} from '../../types';
import {
  ConversationContext,
} from '../../context';

export const Prompt = /*memo(*/(props: PromptProps) => {
  // const agent = useContext(AgentContext);
  const conversation = useContext(ConversationContext).conversation;

  // const deps = [
  //   props.children,
  // ];
  // agent.useEpoch(deps);

  return <prompt value={{
    ...props,
    conversation,
  }} />;
}//);