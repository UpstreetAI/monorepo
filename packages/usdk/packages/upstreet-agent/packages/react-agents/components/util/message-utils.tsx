import React, { useMemo, useRef, useEffect } from 'react';
import type {
  Attachment,
  ActionMessage,
} from '../../types';
// import { Action } from '../core/action';
import { Perception } from '../core/perception';
import { ActionModifier } from '../core/action';

export const collectAttachments = (messages: ActionMessage[]) => {
  const result: Attachment[] = [];
  for (const message of messages) {
    if (message.attachments) {
      result.push(...message.attachments);
    }
  }
  return result;
};

type EveryNMessagesOptions = {
  // signal: AbortSignal,
  abort: () => void,
};
export const EveryNMessages = ({
  n,
  firstCallback = true,
  priority = 1,
  children,
}: {
  n: number,
  firstCallback?: boolean,
  priority?: number,
  children: ((opts: EveryNMessagesOptions) => void) | ((opts: EveryNMessagesOptions) => Promise<void>),
}) => {
  // const numMessages = useNumMessages();
  // const startNumMessages = useMemo(() => numMessages, []);
  // const abortControllerRef = useRef<AbortController | null>(null);

  // useEffect(() => {
  //   const diff = numMessages - startNumMessages;
  //   if (diff % n === 0 && (diff > 0 || firstCallback)) {
  //     if (!abortControllerRef.current) {
  //       abortControllerRef.current = new AbortController();
  //     }
  //     const { signal } = abortControllerRef.current;

  //     const fn = children;
  //     fn({
  //       signal,
  //     });

  //     return () => {
  //       abortControllerRef.current?.abort();
  //       abortControllerRef.current = null;
  //     };
  //   }
  // }, [numMessages, startNumMessages, n]);

  return (
    <>
      <Perception
        type="*"
        handler={async (e) => {
          // const { targetAgent } = e.data;

          // const abortController = new AbortController();
          // const { signal } = abortController;
          
          // await targetAgent.evaluate(evaluator, {
          //   signal,
          // });

          // const abortController = new AbortController();
          // const { signal } = abortController;

          await children(e);
        }}
        priority={priority}
      />
      <ActionModifier
        type="*"
        handler={async (e) => {
          // const { targetAgent } = e.data;

          // const abortController = new AbortController();
          // const { signal } = abortController;
          
          // await targetAgent.evaluate(evaluator, {
          //   signal,
          // });

          // const abortController = new AbortController();
          // const { signal } = abortController;

          await children(e);
        }}
        priority={priority}
      />
    </>
  );
};