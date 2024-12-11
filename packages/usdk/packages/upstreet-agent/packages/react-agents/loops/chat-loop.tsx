import React, { useState } from 'react';
import { useAgent } from '../hooks';
import { Perception } from '../components/core/perception';
import { LoopProps } from '../types';
import { BasicEvaluator } from '../evaluators/basic-evaluator';

export const ChatLoop = (props: LoopProps) => {
  if (props.evaluator && (props.hint || props.actOpts)) {
    throw new Error('Cannot provide both evaluator and hint/actOpts');
  }

  const agent = useAgent();
  const hint = props.hint;
  const actOpts = props.actOpts;
  const debugOpts = {
    debug: agent.appContextValue.useDebug(),
  };
  const [evaluator, setEvaluator] = useState(() => props.evaluator ?? new BasicEvaluator({
    hint,
    actOpts,
    debugOpts,
  }));

  return (
    <>
      <Perception
        type="say"
        handler={async (e) => {
          const { targetAgent } = e.data;

          (async () => {
            const abortController = new AbortController();
            const { signal } = abortController;
            
            await targetAgent.evaluate(evaluator, {
              signal,
            });
          })();
        }}
        priority={-1}
      />
      <Perception
        type="nudge"
        handler={async (e) => {
          const { targetAgent, message } = e.data;
          const {
            args,
          } = message;
          const targetUserId = (args as any)?.targetUserId;
          // if the nudge is for us
          if (targetUserId === e.data.targetAgent.agent.id) {
            (async () => {
              const abortController = new AbortController();
              const { signal } = abortController;

              await targetAgent.evaluate(evaluator, {
                signal,
              });
            })();
          }
        }}
      />
    </>
  );
};