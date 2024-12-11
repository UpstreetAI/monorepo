import React, { useMemo } from 'react';
import { useConversation, useAuthToken } from 'react-agents';
import { z } from 'zod';
import dedent from 'dedent';
import {
  ActionMessage,
  Attachment,
  VideoPerceptionProps,
  PendingActionEvent,
} from '../../types';
import { AgentObject } from '../../classes/agent-object';
import { Action } from '../core/action';
import { describeJson } from '../../util/vision.mjs';
import { collectAttachments } from '../util/message-utils';

const getRandomId = () => crypto.randomUUID(); // used for schema substitutions

const videoPerceptionSpecs = [
  {
    types: ['image/jpeg', 'image/png', 'image/webp'],
    describe: async ({
      // blob,
      url,
      questions,
      agent,
    }: {
      // blob: Blob,
      url: string,
      questions: string[],
      agent: AgentObject,
    }, {
      jwt,
    }) => {
      const answersFormat = z.object({
        answers: z.array(z.string()),
      });
      const answersObject = await describeJson(url, dedent`\
        Respond as if you are role playing the following character:
        Name: ${agent.name}
        Bio: ${agent.bio}

        Answer the following questions about the image, as JSON array.
        Each question string in the input array should be answered with a string in the output array.
      ` + JSON.stringify({
        questions,
      }, null, 2), answersFormat, {
        jwt,
      });
      const { answers } = answersObject;
      return answers;
    },
  },
];
const supportedVideoPerceptionTypes = videoPerceptionSpecs.flatMap(mediaPerceptionSpec => mediaPerceptionSpec.types);
export const VideoPerception = (props: VideoPerceptionProps) => {
  return (
    <VideoPerceptionInner {...props} />
  );
};
const VideoPerceptionInner = (props: VideoPerceptionProps) => {
  const conversation = useConversation();
  const authToken = useAuthToken();
  const randomId = useMemo(getRandomId, []);

  if (conversation) {
    // XXX be able to query media other than that from the current conversation
    const messages = conversation.messageCache.getMessages();
    const attachments = collectAttachments(messages)
      .filter(attachment => {
        const typeClean = attachment.type.replace(/\+[\s\S]*$/, '');
        return supportedVideoPerceptionTypes.includes(typeClean);
      });

    return attachments.length > 0 && (
      <Action
        type="mediaPerception"
        description={
          dedent`\
            Query multimedia content using natural language questions + answers.
            The questions should be short and specific.
            Use this whenever you need to know more information about a piece of media, like an image attachment.

            The available media are:
            \`\`\`
          ` + '\n' +
          JSON.stringify(attachments, null, 2) + '\n' +
          dedent`\
            \`\`\`
          `
        }
        schema={
          z.object({
            // type: z.enum(types),
            id: z.string(),
            questions: z.array(z.string()),
          })
        }
        examples={[
          {
            // type: 'image/jpeg',
            id: randomId,
            questions: [
              'Describe the image.',
            ],
          },
          {
            // type: 'image/jpeg',
            id: randomId,
            questions: [
              `What are the dimensions of the subject, in meters?`,
            ],
          },
          {
            // type: 'image/jpeg',
            id: randomId,
            questions: [
              `Describe the people in the image.`,
              `What's the mood/aesthetic?`,
            ],
          },
        ]}
        handler={async (e: PendingActionEvent) => {
          // console.log('mediaPerception handler 1', e.data);
          const {
            agent,
            message: {
              args: {
                id: attachmentId,
                questions,
              },
            },
          } = e.data;
          const retry = () => {
            agent.act();
          };
          const makeQa = (questions: string[], answers: string[]) => {
            return questions.map((q, index) => {
              const a = answers[index];
              return {
                q,
                a,
              };
            });
          };

          const attachments: Attachment[] = [];
          const attachmentsToMessagesMap = new WeakMap();
          const messages = conversation.messageCache.getMessages();
          for (const message of messages) {
            if (message.attachments) {
              for (const attachment of message.attachments) {
                attachments.push(attachment);
                attachmentsToMessagesMap.set(attachment, message);
              }
            }
          }

          const attachment = attachments.find(attachment => attachment.id === attachmentId);
          // console.log('mediaPerception handler 2', {
          //   attachmentId,
          //   attachments,
          //   attachment,
          //   questions,
          //   agent,
          //   conversation,
          // });
          if (attachment) {
            const {
              type,
              url,
            } = attachment;
            if (url) {
              // const res = await fetch(url);
              // const blob = await res.blob();
              // console.log('querying!', {
              //   blob,
              //   questions,
              //   agent,
              // });
              const mediaPerceptionSpec = videoPerceptionSpecs.find(spec => spec.types.includes(type));
              if (mediaPerceptionSpec) {
                const answers = await mediaPerceptionSpec.describe({
                  // blob,
                  url,
                  questions,
                  agent: agent.agent,
                }, {
                  jwt: authToken,
                });
                // const alt = makeQa(questions, answers);
                console.log('media perception qa', {
                  questions,
                  answers,
                  // alt,
                });
                const qa = makeQa(questions, answers);
                (e.data.message.args as any).queries = qa;
                // console.log('commit 1', e.data.message);
                await e.commit();

                // console.log('commit 2', e.data.message, alt);
                agent.act(
                  dedent`\
                    Your character looked at an attachment and discovered the following:
                  ` + '\n' +
                    JSON.stringify({
                      attachmentId: attachment.id,
                      ...qa,
                    }, null, 2),
                  {
                    excludeActions: ['mediaPerception'],
                  },
                );
              } else {
                console.warn('warning: no media perception spec found for type', {
                  type,
                  mediaPerceptionSpecs: videoPerceptionSpecs,
                });
                retry();
              }
            } else {
              console.warn('warning: attachment has no url', {
                attachmentId,
                attachments,
                attachment,
              });
              retry();
            }
          } else {
            console.warn('warning: model generated invalid id, retrying', {
              attachmentId,
              attachments,
              attachment,
            });
            retry();
          }
        }}
      />
    );
  }
};