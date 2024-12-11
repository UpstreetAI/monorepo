import React, { useContext, useRef, useEffect } from 'react';
import type {
  TwitterSpacesProps,
  TwitterSpacesArgs,
} from '../../types';
import {
  useAgent,
  useAuthToken,
} from '../../hooks';
import {
  AppContext,
} from '../../context';

export const TwitterSpaces: React.FC<TwitterSpacesProps> = (props: TwitterSpacesProps) => {
  const {
    token,
    url,
  } = props;
  const agent = useAgent();
  const appContextValue = useContext(AppContext);
  const codecs = appContextValue.useCodecs();
  const authToken = useAuthToken();
  const ref = useRef(false);

  useEffect(() => {
    if (ref.current) {
      return;
    }
    ref.current = true;

    (async () => {
      if (token) {
        const args: TwitterSpacesArgs = {
          token,
          url,
          agent,
          codecs,
          jwt: authToken,
        };
        const twitter = agent.twitterSpacesManager.addTwitterSpacesBot(args);
        return () => {
          agent.twitterSpacesManager.removeTwitterSpacesBot(twitter);
        };
      }
    })();
  }, [token]);

  return null;
};