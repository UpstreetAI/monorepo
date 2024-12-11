import React, { useContext, useEffect, useState } from 'react';
import { Action, useAgent, useAuthToken } from 'react-agents';
import dedent from 'dedent';
import { z } from 'zod';
import type {
  DiscordArgs,
  DiscordProps,
  AutoTaskProps,
  PendingActionEvent,
} from '../../types';
// import {
//   AppContext,
// } from '../../context';
import {
  Prompt,
} from '../core/prompt';
import {
  ActionLoop,
} from '../../loops/action-loop';

//

class Task {
  id: string;
  goal: string;
  steps: string[];
  constructor({
    id,
    goal,
    steps,
  }: {
    id: string;
    goal: string;
    steps: string[];
  }) {
    this.id = id;
    this.goal = goal;
    this.steps = steps;
  }
}

//

export const AutoTask: React.FC<AutoTaskProps> = (props: AutoTaskProps) => {
  const hint = props.hint;

  const [uuid, setUuid] = useState(() => crypto.randomUUID());
  const [tasks, setTasks] = useState(new Map<string, Task>());

  return (
    <>
      {/* tasks */}
      {Array.from(tasks.values()).map(task => (
        <ActionLoop
          hint={
            dedent`\
              Perform work on the following task:
              \`\`\`
            ` + '\n' +
            JSON.stringify(task, null, 2) + '\n' +
            dedent`\
              \`\`\`
            `
          }
          key={task.id}
        />
      ))}
      {/* prompts */}
      <Prompt>
        {
          dedent`\
            # Active Tasks

            You are currently managing the following tasks:

          ` + '\n' +
          JSON.stringify(tasks, null, 2) + '\n' +
          (
            hint ?
              dedent`\
                When managing tasks, it is important to follow the user-provided hint:
              ` + '\n' +
              hint
            :
              ''
          )
        }
      </Prompt>
      {/* actions */}
      <Action
        type="startTask"
        description={dedent`\
          Start performing a new task.
          To do this, you must start with a goal and a step by step plan.
          The plan should be in a markdown list format. You will check off each step as you complete it.
        `}
        schema={
          z.object({
            goal: z.string(),
            steps: z.array(z.string()),
          })
        }
        examples={[
          {
            goal: 'Hack the CIA',
            steps: dedent`\
              - [ ] Find the DNS server
              - [ ] Find the IP address
              - [ ] Port scan the IP address
              - [ ] Exploit the server with a known vulnerability
            `,
          },
        ]}
        handler={async (e: PendingActionEvent) => {
          // console.log('startTask', e.data);
          const { message } = e.data;
          const { args } = message;
          const task = new Task({
            id: crypto.randomUUID(),
            goal: args.goal,
            steps: args.steps,
          });
          setTasks(tasks => new Map([...tasks, [task.id, task]]));

          await e.commit();
        }}
      />
      <Action
        type="updateTask"
        description={dedent`\
          Update tan existing task.
          Use this to update the goal or steps of a task.
        `}
        schema={
          z.object({
            taskId: z.string(),
            goal: z.string(),
            steps: z.array(z.string()),
          })
        }
        examples={[
          {
            taskId: uuid,
            reasoning: 'I found the DNS server',
            steps: dedent`\
              - [x] Find the DNS server
              - [ ] Find the IP address
              - [ ] Port scan the IP address
              - [ ] Exploit the server with a known vulnerability
            `,
          },
        ]}
        handler={async (e: PendingActionEvent) => {
          // console.log('updateTask', e.data);
          const { message } = e.data;
          const { args } = message;
          setTasks(tasks => {
            const newTasks = new Map(tasks);
            const task = newTasks.get(e.data.taskId);
            if (task) {
              task.goal = args.goal;
              task.steps = args.steps;
            }
            return newTasks;
          });

          await e.commit();
        }}
      />
      <Action
        type="endTask"
        description={dedent`\
          End an existing task and retire it from the task list.
          Use this when there is nothing more to be done, either because you have completed all the steps or because there was an error and you have decided to abandon the task.
        `}
        schema={
          z.object({
            taskId: z.string(),
            thought: z.string(),
            success: z.boolean(),
          })
        }
        examples={[
          {
            taskId: uuid,
            thought: 'I found the DNS server',
            success: true,
          },
          {
            taskId: uuid,
            thought: `I tried 5 different approaches and I couldn't get the command to work...`,
            success: false,
          },
        ]}
        handler={async (e: PendingActionEvent) => {
          // console.log('endTask', e.data);
          const { message } = e.data;
          const { args } = message;
          setTasks(tasks => {
            const newTasks = new Map(tasks);
            newTasks.delete(args.taskId);
            return newTasks;
          });

          await e.commit();
        }}
      />
    </>
  );
};