import React, { useMemo, useRef, useEffect } from 'react';
import {
  useNumMessages,
} from '../hooks';
import type {
  Attachment,
  ActionMessage,
} from '../types';

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
  signal: AbortSignal,
};
export const EveryNMessages = ({
  n,
  firstCallback = true,
  children,
}: {
  n: number,
  firstCallback?: boolean,
  children: (opts: EveryNMessagesOptions) => void,
}) => {
  const numMessages = useNumMessages();
  const startNumMessages = useMemo(() => numMessages, []);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const diff = numMessages - startNumMessages;
    if (diff % n === 0 && (diff > 0 || firstCallback)) {
      if (!abortControllerRef.current) {
        abortControllerRef.current = new AbortController();
      }
      const { signal } = abortControllerRef.current;

      const fn = children;
      fn({
        signal,
      });

      return () => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
      };
    }
  }, [numMessages, startNumMessages, n]);

  return null;
};