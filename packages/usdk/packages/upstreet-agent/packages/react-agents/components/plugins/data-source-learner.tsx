import React from 'react';
import { Action } from '../core/action';
import { Prompt } from '../core/prompt';
import { useAgent } from '../../hooks';
import { z } from 'zod';
import dedent from 'dedent';
import type { PendingActionEvent } from '../../types';
import { AutoTask } from './auto-task';

export const DataSourceLearner: React.FC = () => {
  const agent = useAgent();

  return (
    <>
      <Prompt>
        {dedent`\
          # Data Source Learning System
          
          You can learn from available data sources and store the knowledge in your memory.
          Use the queryAndLearn action when you need to:
          - Gather new information about a topic
          - Verify or update your existing knowledge
          - Get real-time data for user queries
          
          Available data sources:
          ${agent.dataSourceManager.getAllDataSources().map(source => dedent`
            - ${source.name} (ID: ${source.id})
              ${source.description}
          `).join('\n')}
        `}
      </Prompt>
      <AutoTask hint="You are provided with data sources to help you learn and obtain knowledge. Use the data sources to learn and use the knowledge to answer the user's question." />

      <Action
        type="queryAndLearn"
        description={dedent`\
          Query a data source and store the learned information in memory.
          Use this to expand your knowledge base with data from available sources.
        `}
        schema={
          z.object({
            sourceId: z.string(),
            args: z.object({}),
            reason: z.string(),
          })
        }
        examples={[
          {
            sourceId: "weather-api",
            args: {
              q: "London"
            },
            reason: "Learning about current weather conditions in London to provide accurate weather information",
          }
        ]}
        handler={async (e: PendingActionEvent) => {
          const { message, agent } = e.data;
          const { args } = message;

          try {
            // Query the data source
            const data = await agent.agent.dataSourceManager.pullFromDataSource(
              args.sourceId, 
              args.args
            );

            console.log('data: ', data);

            // Analyze and summarize the data
            const dataSummary = await agent.complete([
              {
                role: 'user',
                content: dedent`\
                  Analyze and summarize the following data from ${args.sourceId}:
                  \`\`\`
                  ${JSON.stringify(data, null, 2)}
                  \`\`\`

                  Context for why this data was queried: ${args.reason}
                  
                  Provide a concise summary focusing on the most relevant and interesting information.
                `,
              },
            ], {
              model: agent.agent.smallModel,
            });

            console.log('data summary: ', dataSummary);
            // Store the learned information in memory
            await agent.agent.addMemory(
              `Learned from ${args.sourceId}: ${dataSummary.content}`,
              {
                sourceId: args.sourceId,
                query: args.args,
                rawData: data,
                summary: dataSummary.content,
                timestamp: Date.now(),
                reason: args.reason
              }
            );

            await e.commit();
          } catch (error) {
            console.error('Error in queryAndLearn:', error);
            throw error;
          }
        }}
      />
    </>
  );
};