import { useEffect, useState } from 'react';
import { useAgent, useConversation } from '../hooks';
import { LoopProps } from './types';
import { ReACTEvaluator } from '../evaluators/react-evaluator';
// import { PerceptionEvent } from '../classes/perception-event';
import { ConversationObject } from '../classes/conversation-object';

export const InfiniteLoop = (props: LoopProps) => {
  if (props.evaluator && (props.hint || props.actOpts)) {
    throw new Error('Cannot provide both evaluator and hint/actOpts');
  }

  const agent = useAgent();
  const hint = props.hint;
  const actOpts = props.actOpts;
  const debugOpts = {
    debug: agent.appContextValue.useDebug(),
  };
  const [evaluator, setEvaluator] = useState(() => props.evaluator ?? new ReACTEvaluator({
    hint,
    actOpts,
    debugOpts
  }));
  const contextConversation = useConversation();
  const [conversation, setConversation] = useState(() => {
    if (contextConversation) {
      return contextConversation;
    } else {
      const conversationId = crypto.randomUUID();
      return new ConversationObject({
        agent,
        getHash: () => conversationId,
      });
    }
  });
  const [generativeAgent, setGenerativeAgent] = useState(() => agent.generative({
    conversation,
  }));

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    const recurse = async () => {
      console.log('infinite loop tick 1');
      await generativeAgent.evaluate(evaluator, {
        signal,
      });
      console.log('infinite loop tick 2');

      await recurse();
    };
    recurse();

    return () => {
      abortController.abort();
    };
  }, []);

  return null;
};