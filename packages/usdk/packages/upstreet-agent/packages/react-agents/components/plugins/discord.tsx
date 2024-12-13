import { useContext, useEffect } from 'react';
import { useAgent, useAuthToken, useConversation, useEnv } from 'react-agents';
import type {
  DiscordArgs,
  DiscordProps,
} from '../../types';
import {
  AppContext,
} from '../../context';

export const Discord: React.FC<DiscordProps> = (props: DiscordProps) => {
  const {
    channels,
    dms,
    userWhitelist,
  } = props;
  const agent = useAgent();
  const conversation = useConversation();
  const appContextValue = useContext(AppContext);
  const codecs = appContextValue.useCodecs();
  const authToken = useAuthToken();
  const env = useEnv();

  useEffect(() => {
    if (!conversation) {
      const token = (env as { DISCORD_BOT_TOKEN: string }).DISCORD_BOT_TOKEN;

      if (!token) {
        throw new Error('DISCORD_BOT_TOKEN is not set in env.txt');
      }

      const args: DiscordArgs = {
        token,
        channels: channels ? (Array.isArray(channels) ? channels : [channels]) : [],
        dms: dms ? (Array.isArray(dms) ? dms : [dms]) : [],
        userWhitelist,
        agent,
        codecs,
        jwt: authToken,
      };
      const discordBot = agent.discordManager.addDiscordBot(args);
      return () => {
        agent.discordManager.removeDiscordBot(discordBot);
      };
    }
  }, [
    (env as { DISCORD_BOT_TOKEN: string }).DISCORD_BOT_TOKEN,
    JSON.stringify(channels),
    JSON.stringify(dms),
    JSON.stringify(userWhitelist),
    conversation,
  ]);

  return null;
};