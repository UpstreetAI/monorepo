import React from 'react';
// import { z } from 'zod';
// import dedent from 'dedent';
import { TTS } from '../components/plugins/tts';
import { RateLimit } from '../components/plugins/rate-limit';
import { Discord } from '../components/plugins/discord';
import { Twitter } from '../components/plugins/twitter';
import { Telnyx } from '../components/plugins/telnyx';
// import { currencies, intervals } from '../constants.mjs';

// export const paymentPropsType = z.object({
//   name: z.string(),
//   description: z.string().optional(),
//   amount: z.number().int(),
//   currency: z.enum(currencies),
// });
// export const paymentItemType = z.object({
//   type: z.literal('payment'),
//   props: paymentPropsType,
// });
// export const subscriptionPropsType = z.object({
//   name: z.string(),
//   description: z.string().optional(),
//   amount: z.number().int(),
//   currency: z.enum(currencies),
//   interval: z.enum(intervals),
//   intervalCount: z.number(),
// });
// export const subscriptionItemType = z.object({
//   type: z.literal('subscription'),
//   props: subscriptionPropsType,
// });
// export const storeItemType = z.union([
//   paymentItemType,
//   subscriptionItemType,
// ]);

//

/* export const featureSpecs = [
  {
    name: 'tts',
    description: dedent`\
      Text to speech.
      Available voice endpoints:
    ` + '\n'
    + defaultVoices.map(v => `* ${JSON.stringify(v.name)}: ${v.voiceEndpoint}`).join('\n'),
    schema: z.union([
      z.object({
        voiceEndpoint: z.enum(defaultVoices.map(v => v.voiceEndpoint)),
      }),
      z.null(),
    ]),
    examples: [{voiceEndpoint: defaultVoices[0].voiceEndpoint},],
    imports: () => [
      'TTS',
    ],
    components: ({
      voiceEndpoint,
    }) => [
      dedent`
        <TTS voiceEndpoint=${JSON.stringify(voiceEndpoint)} />
      `,
    ],
  },
  {
    name: 'rateLimit',
    description: dedent`\
      Agent is publicly available.
      The rate limit is \`maxUserMessages\` messages per \`maxUserMessagesTime\` milliseconds.
      When the rate limit is exceeded, the agent will respond with the static \`message\`.
      If either \`maxUserMessages\` or \`maxUserMessagesTime\` is not provided or zero, the rate limit is disabled.
    ` + '\n'
    + defaultVoices.map(v => `* ${JSON.stringify(v.name)}: ${v.voiceEndpoint}`).join('\n'),
    schema: z.union([
      z.object({
        maxUserMessages: z.number().optional(),
        maxUserMessagesTime: z.number().optional(),
        message: z.string().optional(),
      }),
      z.null(),
    ]),
    examples: [{ maxUserMessages: 5, maxUserMessagesTime: 60000, message: "Whoa there! Take a moment.", }],
    imports: () => [
      'RateLimit',
    ],
    components: ({
      maxUserMessages,
      maxUserMessagesTime,
      message,
    }) => [
      dedent`
        <RateLimit ${maxUserMessages ? `maxUserMessages={${JSON.stringify(maxUserMessages)}} ` : ''}${maxUserMessagesTime ? `maxUserMessagesTime={${JSON.stringify(maxUserMessagesTime)}} ` : ''}${message ? `message={${JSON.stringify(message)}} ` : ''}/>
      `,
    ],
  },
  {
    name: 'discord',
    description: dedent`\
      Add Discord integration to the agent. Add this feature only when the user explicitly requests it and provides a bot token.

      The user should follow these instructions to set up their bot (you can instruct them to do this):
      - Create a bot application at https://discord.com/developers/applications and note the CLIENT_ID (also called "application id")
      - Enable Privileged Gateway Intents at https://discord.com/developers/applications/CLIENT_ID/bot
      - Add the bot to your server at https://discord.com/oauth2/authorize/?permissions=-2080908480&scope=bot&client_id=CLIENT_ID
      - Get the bot token at https://discord.com/developers/applications/CLIENT_ID/bot
      The token is required and must be provided.

      \`channels\` is a list of channel names (text or voice) that the agent should join.
    `,
    schema: z.union([
      z.object({
        token: z.string(),
        channels: z.array(z.string()),
      }),
      z.null(),
    ]),
    examples: [{ token: 'YOUR_DISCORD_BOT_TOKEN', channels: ['general', 'voice'], }],
    imports: (discord) => {
      if (discord.token) {
        return ['Discord'];
      } else {
        return [];
      }
    },
    components: (discord) => {
      const channels = formatDiscordBotChannels(discord.channels);
      if (discord.token && channels.length > 0) {
        return [
          dedent`
            <Discord
              token=${JSON.stringify(discord.token)}
              ${discord.channels ? `channels={${JSON.stringify(channels)}}` : ''}
            />
          `,
        ];
      } else {
        return [];
      }
    },
  },
  {
    name: 'twitterBot',
    description: dedent`\
      Add a Twitter bot to the agent.

      The API token is required.
    `,
    schema: z.union([
      z.object({
        token: z.string(),
      }),
      z.null(),
    ]),
    examples: [{ token: 'YOUR_TWITTER_BOT_TOKEN', }],
    imports: (twitterBot) => {
      if (twitterBot.token) {
        return ['TwitterBot'];
      } else {
        return [];
      }
    },
    components: (twitterBot) => {
      if (twitterBot.token) {
        return [
          dedent`
            <TwitterBot
              token=${JSON.stringify(twitterBot.token)}
            />
          `,
        ];
      } else {
        return [];
      }
    },
  },
  {
    name: 'telnyx',
    description: dedent`\
      Add Telnyx phone call/SMS support to the agent. Add this feature only when the user explicitly requests it and provides an api key.

      Phone number is optional, but if provided must be in +E.164 format (e.g. +14151234567).
    `,
    schema: z.union([
      z.object({
        apiKey: z.string(),
        phoneNumber: z.string().optional(),
        message: z.boolean(),
        voice: z.boolean(),
      }),
      z.null(),
    ]),
    examples: [{ apiKey: 'YOUR_TELNYX_API_KEY', phoneNumber: '+14151234567', message: true, voice: true, }],
    imports: (telnyx) => {
      if (telnyx.apiKey) {
        return ['Telnyx'];
      } else {
        return [];
      }
    },
    components: (telnyx) => {
      if (telnyx.apiKey) {
        return [
          dedent`
            <Telnyx
              apiKey=${JSON.stringify(telnyx.apiKey)}
              ${telnyx.phoneNumber ? `phoneNumber=${JSON.stringify(telnyx.phoneNumber)}` : ''}
              ${telnyx.message ? `message` : ''}
              ${telnyx.voice ? `voice` : ''}
            />
          `,
        ];
      } else {
        return [];
      }
    },
  },
  {
    name: 'storeItems',
    description: dedent`\
      List of items that can be purchased from the agent, with associated prices.
      \`amount\` in cents (e.g. 100 = $1).
    `,
    schema: z.union([
      z.array(storeItemType),
      z.null(),
    ]),
    examples: [{type: 'payment', props: { name: 'Art', description: 'An art piece', amount: 499, currency: 'usd',},},],
    imports: (storeItems) => {
      const isValidStoreItem = (storeItem) =>
        !!storeItem.props.name && !!storeItem.props.amount && !!storeItem.props.currency;

      const result = [];
      if (storeItems.some((storeItem) => storeItem.type === 'payment' && isValidStoreItem(storeItem))) {
        result.push('Payment');
      }
      if (storeItems.some((storeItem) => storeItem.type === 'subscription' && isValidStoreItem(storeItem))) {
        result.push('Subscription');
      }
      return result;
    },
    components: (storeItems) => {
      return storeItems.map((storeItem) => {
        if (storeItem.type === 'payment') {
          if (!!storeItem.props.name && !!storeItem.props.amount && !!storeItem.props.currency) {
            return dedent`
              <Payment
                name={${JSON.stringify(storeItem.props.name)}}
                ${storeItem.props.description ? `description={${JSON.stringify(storeItem.props.description)}}` : ''}
                amount={${JSON.stringify(storeItem.props.amount)}}
                currency={${JSON.stringify(storeItem.props.currency)}}
              />
            `;
          } else {
            return '';
          }
        } else if (storeItem.type === 'subscription') {
          if (!!storeItem.props.name && !!storeItem.props.amount && !!storeItem.props.currency) {
            return dedent`
              <Subscription
                name={${JSON.stringify(storeItem.props.name)}}
                ${storeItem.props.description ? `description={${JSON.stringify(storeItem.props.description)}}` : ''}
                amount={${JSON.stringify(storeItem.props.amount)}}
                currency={${JSON.stringify(storeItem.props.currency)}}
                interval={${JSON.stringify(storeItem.props.interval)}}
                intervalCount={${JSON.stringify(storeItem.props.intervalCount)}}
              />
            `;
          } else {
            return '';
          }
        } else {
          throw new Error(`unexpected store item type: ${storeItem.type}`);
        }
      });
    },
  },
]; */
export const featureRenderers = {
  tts: ({voiceEndpoint}) => {
    return (
      <TTS voiceEndpoint={voiceEndpoint} />
    );
  },
  rateLimit: ({maxUserMessages, maxUserMessagesTime, message}) => {
    return (
      <RateLimit maxUserMessages={maxUserMessages} maxUserMessagesTime={maxUserMessagesTime} message={message} />
    );
  },
  discord: ({channels}) => {
    if (channels) {
      channels = channels && channels.map((c: string) => c.trim()).filter(Boolean);
      return (
        <Discord channels={channels} />
      );
    } else {
      return null;
    }
  },
  twitterBot: ({token}) => {
    if (token) {
      return (
        <Twitter token={token} />
      );
    } else {
      return null;
    }
  },
  telnyx: ({apiKey, phoneNumber, message, voice}) => {
    if (apiKey) {
      return (
        <Telnyx apiKey={apiKey} phoneNumber={phoneNumber} message={message} voice={voice} />
      );
    } else {
      return null;
    }
  },
}
