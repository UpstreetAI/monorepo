import React, { useState, useEffect } from 'react';
import dedent from 'dedent';
import {
  Memory,
} from '../../types';
import { Prompt } from '../core/prompt';
import { useCachedMessages, useAgent, useConversation } from '../../hooks';
import { EveryNMessages } from '../util/message-utils';
import { QueueManager } from 'queue-manager';

const memoryPriority = -1;
const maxDefaultMemoryValues = 8;
const defaultChunkMessages = 4;

type RAGMemoryProps = {
  chunkMessages: number;
};

export const RAGMemory = (props: RAGMemoryProps) => {
  const chunkMessages = props.chunkMessages ?? defaultChunkMessages;

  const agent = useAgent();
  const conversation = useConversation();
  const [generativeAgent, setGenerativeAgent] = useState(() => agent.generative({
    conversation,
  }));
  const [memories, setMemories] = useState<Memory[]>([]);
  const [queueManager, setQueueManager] = useState(() => new QueueManager());

  return (
    <>
      {memories.length > 0 && (
        <Prompt>
          {dedent`\
            # Memories
            You remember the following:
            \`\`\`
          ` + '\n' +
          JSON.stringify(memories, null, 2) + '\n' +
          dedent`\
            \`\`\`
          `
          }
        </Prompt>
      )}
      {/* read memories synchronously */}
      <EveryNMessages n={1} priority={memoryPriority}>{async (e) => {
        const embeddingString = conversation.getEmbeddingString();
        // const embedding = await agent.appContextValue.embed(embeddingString);

        const memories = await agent.getMemory(embeddingString, {
          matchCount: maxDefaultMemoryValues,
          // signal,
        });
        // console.log('load memories', memories);
        setMemories(memories);
      }}</EveryNMessages>
      {/* write memories asynchronously */}
      <EveryNMessages n={chunkMessages} priority={memoryPriority} firstCallback={false}>{(e) => {
        (async () => {
          await queueManager.waitForTurn(async () => {
            const cachedMessages = conversation.messageCache.getMessages();
            const memories = cachedMessages.map(m => {
              const {
                name,
                method,
                args,
              } = m;
              return {
                name,
                method,
                args,
              };
            });

            const lastMessages = memories.slice(-(maxDefaultMemoryValues + chunkMessages));
            const oldContextMessages = lastMessages.slice(0, -chunkMessages);
            const newContextMessages = lastMessages.slice(-chunkMessages);

            const summary = await generativeAgent.complete([
              {
                role: 'user',
                content: dedent`\
                  # Old message history
                  Here is the old message history, for context:
                  \`\`\`
                ` + '\n' +
                JSON.stringify(oldContextMessages, null, 2) + '\n' +
                dedent`\
                  \`\`\`

                  # New messages
                  And here are the new messages we are addding:
                  \`\`\`
                ` + '\n' +
                JSON.stringify(newContextMessages, null, 2) + '\n' +
                dedent`\
                  \`\`\`

                  Summarize the new messages in a sentence or few. Include in your summary the interesting information that occurs in the new messages list above.
                `,
              },
            ], {
              model: generativeAgent.agent.smallModel,
            });

            // console.log('memorize', {
            //   oldContextMessages,
            //   newContextMessages,
            //   summary,
            // });
            const text = summary.content as string;
            await agent.addMemory(text);
          });
        })();
      }}</EveryNMessages>
    </>
  );
};