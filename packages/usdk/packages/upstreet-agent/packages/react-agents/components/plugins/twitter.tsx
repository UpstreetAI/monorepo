import React, { useContext, useRef, useEffect } from 'react';
import type {
  TwitterProps,
  TwitterArgs,
} from '../../types';
import {
  useAgent,
  useKv,
  useAuthToken,
  useConversation,
} from '../../hooks';
import {
  AppContext,
} from '../../context';

// https://twitter-oauth.upstreet.ai/
export const Twitter: React.FC<TwitterProps> = (props: TwitterProps) => {
  const {
    token,
  } = props;
  const agent = useAgent();
  const kv = useKv();
  const conversation = useConversation();
  const appContextValue = useContext(AppContext);
  const codecs = appContextValue.useCodecs();
  const authToken = useAuthToken();
  const ref = useRef(false);

  useEffect(() => {
    if (!conversation) {
      if (ref.current) {
        return;
      }
      ref.current = true;

      (async () => {
        if (token) {
          const args: TwitterArgs = {
            token,
            agent,
            kv,
            codecs,
            jwt: authToken,
          };
          const twitter = agent.twitterManager.addTwitterBot(args);
          return () => {
            agent.twitterManager.removeTwitterBot(twitter);
          };
        }
      })();
    }
  }, [
    token,
    conversation,
  ]);

  return null;
};