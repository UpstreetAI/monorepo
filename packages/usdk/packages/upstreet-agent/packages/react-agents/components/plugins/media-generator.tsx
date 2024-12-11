import React, { useRef, useState, useEffect, useMemo, useContext } from 'react';
import dedent from 'dedent';
import { z } from 'zod';
// import { printNode, zodToTs } from 'zod-to-ts';
// import type { Browser, BrowserContext, Page } from 'playwright-core-lite';
// import { minimatch } from 'minimatch';
// import { timeAgo } from 'react-agents/util/time-ago.mjs';

import type {
  // AppContextValue,
  // AgentProps,
  // ActionProps,
  // ActionPropsAux,
  // UniformPropsAux,
  // PromptProps,
  // FormatterProps,
  // ParserProps,
  // PerceptionProps,
  // SchedulerProps,
  // ServerProps,
  // SceneObject,
  // AgentObject,
  // ActiveAgentObject,
  // ConversationObject,
  PendingActionEvent,
  // ActionEvent,
  // ActionMessage,
  // PlayableAudioStream,
  // Attachment,
  // FormattedAttachment,
  // GenerativeAgentObject,
  // DiscordRoomSpec,
  // DiscordRoomSpecs,
  // DiscordProps,
  // DiscordArgs,
  // TwitterProps,
  // TwitterArgs,
  // TwitterSpacesProps,
  // TwitterSpacesArgs,
  // TelnyxProps,
  // TelnyxBotArgs,
  // TelnyxBot,
  // VideoPerceptionProps,
  // Evaluator,
  // LoopProps,
  // ActOpts,
} from '../../types';
// import {
//   AppContext,
// } from '../context';
// import {
//   PerceptionModifier,
//   Server,
// } from './base-components';
// import {
//   AbortableActionEvent,
// } from '../classes/abortable-action-event';
// import {
//   AbortablePerceptionEvent,
// } from '../classes/abortable-perception-event';
import {
  // useAgent,
  useAuthToken,
  // useActions,
  // useUniforms,
  // useName,
  // usePersonality,
  // useStoreItems,
  // usePurchases,
  // useKv,
  // useTts,
  // useConversation,
  // useCachedMessages,
  // useNumMessages,
} from '../../hooks';
// import { shuffle, parseCodeBlock } from '../util/util.mjs';
// import {
//   storeItemType,
// } from '../util/agent-features.mjs';
// import {
//   currencies,
//   intervals,
// } from '../constants.mjs';
// import {
//   // describe,
//   describeJson,
// } from '../util/vision.mjs';
import {
  imageSizes,
  fetchImageGeneration,
} from '../../util/generate-image.mjs';
import {
  generateSound,
} from '../../util/generate-sound.mjs';
import {
  generateModel,
} from '../../util/generate-model.mjs';
import {
  generateVideo,
} from '../../util/generate-video.mjs';
// import { Prompt } from './prompt';
import { r2EndpointUrl } from '../../util/endpoints.mjs';
// import { ChatLoop } from '../loops/chat-loop.tsx';
// import { webbrowserActionsToText } from '../util/browser-action-utils.mjs';
// import { createBrowser/*, testBrowser*/ } from '../util/create-browser.mjs';
// import {
//   formatActionsPrompt,
// } from '../util/format-schema';
import { Action } from '../core/action';

//

const mediaGeneratorSpecs = [
  {
    types: ['image/jpeg+image'],
    ext: 'jpg',
    optionsSchema: z.object({
      image_size: z.enum(imageSizes as any).optional(),
    }).optional(),
    async generate({
      prompt,
      options,
    }: {
      prompt: string,
      options?: {
        image_size?: string,
      },
    }, {
      jwt,
    }) {
      const blob = await fetchImageGeneration(prompt, options, {
        jwt,
      });
      const blob2 = new Blob([blob], {
        type: this.types[0],
      });
      return blob2;
    },
  },
  {
    types: ['audio/mpeg+sound-effect'],
    ext: 'mp3',
    // optionsSchema: z.object({
    //   image_size: z.enum(imageSizes as any).optional(),
    // }).optional(),
    async generate({
      prompt,
      // options,
    }: {
      prompt: string,
      // options?: {
      //   image_size?: string,
      // },
    }, {
      jwt,
    }) {
      const blob = await generateSound(prompt, undefined, {
        jwt,
      });
      const blob2 = new Blob([blob], {
        type: this.types[0],
      });
      return blob2;
    },
  },
  {
    types: ['model/gltf-binary+3d-model'],
    ext: 'glb',
    async generate({
      prompt,
    }: {
      prompt: string,
    }, {
      jwt,
    }) {
      const imageBlob = await fetchImageGeneration(prompt, {
        image_size: imageSizes[0],
      }, {
        jwt,
      });
      const blob = await generateModel(imageBlob, {
        jwt,
      });
      const blob2 = new Blob([blob], {
        type: this.types[0],
      });
      return blob2;
    }
  },
  {
    types: ['model/video/mp4+video'],
    ext: 'mp4',
    async generate({
      prompt,
    }: {
      prompt: string,
    }, {
      jwt,
    }) {
      const imageBlob = await fetchImageGeneration(prompt, {
        image_size: imageSizes[0],
      }, {
        jwt,
      });
      const videoBlob = await generateVideo(imageBlob, {
        jwt,
      });
      return videoBlob;
    }
  },
];
export const MediaGenerator = () => {
  const authToken = useAuthToken();
  const types = mediaGeneratorSpecs.flatMap(spec => spec.types) as [string, ...string[]];
  const generationSchemas = mediaGeneratorSpecs.map(spec => {
    const o = {
      type: z.enum(spec.types as any),
      prompt: z.string(),
      chatText: z.string().optional(),
    };
    if (spec.optionsSchema) {
      (o as any).options = spec.optionsSchema;
    }
    return z.object(o);
  });
  const generationSchemasUnion = generationSchemas.length >= 2 ? z.union(generationSchemas as any) : generationSchemas[0];

  return (
    <>
      <Action
        type="sendMedia"
        description={dedent`\
          Send simulated multimedia content as a media attachment.

          Prompt will be used for generating the media.
          Optional chat text message will be sent with the media.

          The available content types are:
          \`\`\`
        ` + '\n' +
        JSON.stringify(types, null, 2) + '\n' +
        dedent`\
          \`\`\`
        `}
        schema={generationSchemasUnion}
        examples={[
          {
            type: 'image/jpeg',
            prompt: `girl wearing a dress and a hat selling flowers in a Zelda-inspired market`,
            options: {
              image_size: imageSizes[0],
            },
            chatText: "Guess where I am? ;)",
          },
          {
            type: 'audio/mp3',
            prompt: `a mechanical button beep, 16 bit`,
            // options: {
            //   image_size: imageSizes[0],
            // },
            chatText: "Beep!",
          },
        ]}
        handler={async (e: PendingActionEvent) => {
          const {
            agent,
            message: {
              args: generationArgs,
            },
          } = e.data;
          const {
            type,
            prompt,
            options,
            chatText,
          } = generationArgs as {
            type: string,
            prompt: string,
            options?: {
              image_size?: string,
            },
            chatText?: string,
          };
          // console.log('send media args', e.data.message.args);

          const retry = () => {
            agent.act();
          };

          const mediaGeneratorSpec = mediaGeneratorSpecs.find(spec => spec.types.includes(type));
          if (mediaGeneratorSpec) {
            try {
              const blob = await mediaGeneratorSpec.generate({
                prompt,
                options,
              }, {
                jwt: authToken,
              });
              // console.log('got blob', blob);

              // upload to r2
              const guid = crypto.randomUUID();
              const keyPath = ['assets', guid, `media.${mediaGeneratorSpec.ext}`].join('/');
              const u = `${r2EndpointUrl}/${keyPath}`;
              try {
                const res = await fetch(u, {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${authToken}`,
                  },
                  body: blob,
                });
                if (res.ok) {
                  const mediaUrl = await res.json();
                  const m = {
                    method: 'say',
                    args: {
                      text: chatText ?? '',
                    },
                    attachments: [
                      {
                        id: guid,
                        type: blob.type,
                        url: mediaUrl,
                      },
                    ],
                  };
                  // console.log('add message', m);
                  await agent.addMessage(m);
                } else {
                  const text = await res.text();
                  throw new Error(`could not upload media file: ${blob.type}: ${text}`);
                }
              } catch (err) {
                throw new Error('failed to put voice: ' + u + ': ' + err.stack);
              }
            } catch (err) {
              const monologueString = dedent`\
                The following error occurred while generating the media:
              ` + '\n\n' + JSON.stringify(generationArgs) + '\n\n'+ err.stack;
              console.log('generating monologue for', {
                monologueString,
              });
              await agent.monologue(monologueString);
            }
          } else {
            console.warn('warning: no media generator spec found for type', {
              type,
              mediaGeneratorSpecs,
            });
            retry();
          }
        }}
      />
    </>
  );
};