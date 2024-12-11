import React from 'react';
import { useAgent, useConversation } from 'react-agents';
import dedent from 'dedent';
import { z } from 'zod';
import {
  ActionEvent,
} from '../../types';
import { Uniform } from '../core/uniform';

export const LiveModeInner = (props) => {
  const agent = useAgent();
  const conversation = useConversation();
  const timeouts = agent.liveManager.useTimeouts(conversation);

  return (
    <Uniform
      name="nextActionTime"
      description={dedent`\
        Optionally wait before continuing with your next action.
        Use this to pause the job/conversation until a later time. The delay can be short (e.g. 1 second pause) or long (like a calendar date).
        Specify a delay time, a Date (ISO 8601) string, or use null to indicate nothing to add.
      `}
      state={[
        dedent`\
          Next action schedule:
        ` + '\n' + (
          timeouts.length > 0 ?
            timeouts.map((timestamp) => {
              const date = new Date(timestamp);
              return dedent`\
                - ${date.toISOString()} (${timeAgo(date)})
              `;
            }).join('\n')
          :
            'None'
        ),
      ].join('\n')}
      schema={
        z.union([
          z.object({
            delayTime: z.object({
              unit: z.enum(['seconds', 'minutes', 'hours', 'days']),
              value: z.number(),
            }),
          }),
          z.object({
            waitUntilDateISOString: z.string(),
          }),
          z.null(),
        ])
      }
      examples={[
        {
          delayTime: {
            unit: 'seconds',
            value: 10,
          },
        },
        {
          waitUntilDateISOString: `2021-01-30T01:23:45.678Z`,
        },
        null,
      ]}
      handler={async (e: ActionEvent) => {
        const {
          agent,
          message: {
            args: nextMessageWaitArgs,
          },
        } = e.data;
        const timeout = (() => {
          if (nextMessageWaitArgs === null) {
            return Date.now();
          } else if ('delayTime' in nextMessageWaitArgs) {
            const { delayTime } = nextMessageWaitArgs as {
              delayTime: {
                unit: string,
                value: number,
              },
            };
            const { unit, value } = delayTime;
            const delay = (() => {
              switch (unit) {
                case 'seconds': return value * 1000;
                case 'minutes': return value * 1000 * 60;
                case 'hours': return value * 1000 * 60 * 60;
                case 'days': return value * 1000 * 60 * 60 * 24;
                default: return 0;
              }
            })();
            const now = Date.now();
            return now + delay;
          } else if ('waitUntilDateISOString' in nextMessageWaitArgs) {
            const { waitUntilDateISOString } = nextMessageWaitArgs as {
              waitUntilDateISOString: string,
            };
            return Date.parse(waitUntilDateISOString);
          } else {
            throw new Error('Invalid nextMessageWaitArgs: ' + JSON.stringify(nextMessageWaitArgs));
          }
        })();
        console.log('got next action time: ', nextMessageWaitArgs, timeout - Date.now());
        const nextAction = async () => {
          console.log('live action 1');
          await agent.act();
          console.log('live action 2');
        };
        agent.agent.liveManager.setTimeout(nextAction, conversation, timeout);
      }}
    />
  );
};
export const LiveMode = (props) => {
  return (
    <LiveModeInner {...props} />
  );
};