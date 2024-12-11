import React, { useRef } from 'react';
import type { AbortablePerceptionEvent } from '../../types';
import { useKv } from '../../hooks';
import { Perception } from '../core/perception';

const defaultPriorityOffset = -100;

export type RateLimitProps = {
  maxUserMessages: number;
  maxUserMessagesTime: number;
  message: string;
};
type UserMessageTimestamp = {
  timestamp: number;
};
export const RateLimit: React.FC<RateLimitProps> = (props: RateLimitProps) => {
  const maxUserMessages = props?.maxUserMessages ?? 5;
  const maxUserMessagesTime = props?.maxUserMessagesTime ?? 60 * 60 * 24 * 1000; // 1 day
  const rateLimitMessage = props?.message || 'You are sending messages too quickly. Please wait a moment before sending another message.';

  const rateLimitMessageSent = useRef(false);
  const kv = useKv();

  return (
    <Perception
      type="say"
      handler={async (e: AbortablePerceptionEvent) => {
        const rateLimitingEnabled =
          maxUserMessages !== 0 &&
          isFinite(maxUserMessages) &&
          maxUserMessagesTime !== 0 &&
          isFinite(maxUserMessagesTime);
        const isOwner = e.data.sourceAgent.id === e.data.targetAgent.agent.ownerId;
        if (rateLimitingEnabled && !isOwner) {
          // if rate limiting is enabled
          const { /*message, */sourceAgent, targetAgent } = e.data;
          // fetch old timestamps
          const key = `userMessageTimestamps.${sourceAgent.id}`;
          let userMessageTimestamps = await kv.get<UserMessageTimestamp[]>(key) ?? [];
          // filter out old timestamps
          const now = Date.now();
          userMessageTimestamps = userMessageTimestamps.filter((t) => now - t.timestamp < maxUserMessagesTime);
          if (userMessageTimestamps.length < maxUserMessages) {
            // if we have room for more timestamps
            // add new timestamp
            userMessageTimestamps.push({
              timestamp: now,
            });
            // save state
            (async () => {
              await kv.set(key, userMessageTimestamps);
            })().catch((err) => {
              console.warn('failed to set user message timestamps', err);
            });
            // flag the success
            rateLimitMessageSent.current = false;
            // continue normal handling
          } else {
            // else if we have hit the rate limit
            // abort the perception event
            e.abort();

            // once per limit, send a message to the user
            if (!rateLimitMessageSent.current) {
              rateLimitMessageSent.current = true;

              // send rate limit blocker message
              (async () => {
                await targetAgent.say(rateLimitMessage);
              })().catch((err) => {
                console.warn('failed to send rate limit message', err);
              });
            }
          }
        }
      }}
      priority={defaultPriorityOffset}
    />
  );
};