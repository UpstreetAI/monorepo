import React, { useState, useMemo, useEffect, useContext, forwardRef, useImperativeHandle, memo } from 'react';
import type {
  DeferProps,
  ConversationProps,
  ConversationInstanceProps,
} from '../../types';
import {
  AppContext,
  AgentContext,
  ConversationContext,
  ConversationsContext,
  AgentRegistryContext,
} from '../../context';

const ConversationInstance = (props: ConversationInstanceProps) => {
  const {
    conversation,
  } = props;

  return (
    <ConversationContext.Provider value={{conversation}}>
      {props.children}
    </ConversationContext.Provider>
  );
};
export const ConversationProvider = (props: ConversationProps) => {
  const agent = useContext(AgentContext);
  const conversations = useContext(ConversationsContext).conversations;
  return conversations.map((conversation) => {
    return (
      <ConversationInstance
        agent={agent}
        conversation={conversation}
        key={conversation !== null ? conversation.getKey() : 'null'}
      >
        {props.children}
      </ConversationInstance>
    );
  });
};
// use this to defer rendering until the conversation is actually used
export const DeferConversation = (props: DeferProps) => {
  const appContextValue = useContext(AppContext);
  const conversationManager = appContextValue.useConversationManager();
  const agentRegistry = useContext(AgentRegistryContext).agentRegistry;
  const conversation = useContext(ConversationContext).conversation;
  if (!conversation) {
    throw new Error('DeferConversation can only be used within a conversation');
  }
  const symbol = useMemo(Symbol, []);
  const deferRender = conversationManager.useDeferRender(conversation);

  useEffect(() => {
    const props2 = {
      ...props,
      conversation,
    };
    agentRegistry.registerDefer(symbol, props2);
    return () => {
      agentRegistry.unregisterDefer(symbol);
    };
  }, []);

  return deferRender && props.children;
};