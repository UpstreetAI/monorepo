import React from 'react';
// import dedent from 'dedent';
// import ethers from 'upstreet-sdk/ethers';
// const { Contract } = ethers;
import {
  useAgents,
  useCurrentAgent,
  // useActions,
  // AgentEvent,
  ActionEvent,
  PerceptionEvent,
  PendingActionEvent,
  // AgentObject,
  ActionMessage,
  // Scene,
  Agent,
  Action,
  Perception,
  AgentAppProps,
  DefaultAgentComponents,
  DefaultActions,
  DefaultPrompts,
  DefaultParsers,
  DefaultPerceptions,
  DefaultSchedulers,
/* IMPORTS REGEX HOOK */
} from 'react-agents';

//

const AddMemoryAction = () => {
  return (
    <Action
      name="add_memory"
      description={`Add the given memory string to the embedded database. Always use this whenever the user requests it.`}
      args={{
        content: 'Some string to remember, which could be a sentence or a few. It should be concise, but still include all of the relevant details.',
      }}
      handler={async (e: PendingActionEvent) => {
        const { agent, message, conversation } = e.data;
        const args = message.args as any;

        if (typeof args === 'object' && typeof args?.content === 'string') {
          console.log('remember handler 1', new Error().stack);
          await agent.addMemory(args.content, message);
          console.log('remember handler 2');
          await agent.addAction(message, {
            conversation,
          });
          console.log('remember handler 3');
          await agent.monologue(`Remembered: ${JSON.stringify(args.content)}`);
          console.log('remember handler 4');
        } else {
          throw new Error('Invalid args');
        }
      }}
    />
  );
};
const GetMemoryAction = () => {
  return (
    <Action
      name="get_memory"
      description={`Get a memory that was previously stored in the embedded database, based on the query string. Always use this whenever the user requests it.`}
      args={{
        query: 'Query string to search for a memory.',
      }}
      handler={async (e: PendingActionEvent) => {
        const { agent, message, conversation } = e.data;
        const args = message.args as any;

        if (typeof args === 'object' && typeof args?.query === 'string') {
          const memories = await agent.getMemory(args.query, {
            matchThreshold: 0.2,
            matchCount: 10,
          });
          if (memories.length > 0) {
            const memory = memories[0];
            const newMessage = {
              ...message,
              args: {
                ...message.args,
                value: memory,
              },
            };
            await agent.addAction(newMessage, {
              conversation,
            });
            console.log('got memory', memory);
            await agent.monologue(
              `Remembered: ${JSON.stringify(args.query)} -> ${JSON.stringify(memory.text)}`,
            );
          } else {
            await agent.monologue(
              `Could not remember: ${JSON.stringify(args.query)}`,
            );
          }
        } else {
          throw new Error('Invalid args');
        }
      }}
    />
  );
};
const MemoryActions = () => {
  return (
    <>
      <AddMemoryAction />
      <GetMemoryAction />
    </>
  );
};

export default function MyAgent() {
  return (
    <Agent>
      <MemoryActions />
{/* JSX REGEX HOOK */}
    </Agent>
  );
}
