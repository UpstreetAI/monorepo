import React, { useMemo } from 'react';
import dedent from 'dedent';
import { z } from 'zod';
import type {
  PendingActionEvent,
} from '../../types';
import { Action } from '../core/action';
import { useConversation } from '../../hooks';
import { collectAttachments } from '../util/message-utils';

export const StatusUpdates = () => {
  return (
    <StatusUpdateAction />
  );
};
export type StatusUpdateActionProps = {
  // nothing
};
export const StatusUpdateAction: React.FC<StatusUpdateActionProps> = (props: StatusUpdateActionProps) => {
  const conversation = useConversation();
  const randomId = useMemo(() => crypto.randomUUID(), []);

  // XXX come up with a better way to fetch available attachments from all messages, not just the cache
  const messages = conversation.messageCache.getMessages();
  const attachments = collectAttachments(messages);

  return (
    <Action
      type="statusUpdate"
      description={
        dedent`\
          Post to social media about what interesting things you are up to.
          Optionally attach media to your post.
        ` + '\n' + 
        (
          attachments.length > 0 ?
            dedent`\
              If included, the attachment must be one of the following:
              \`\`\`
            ` + '\n' +
            JSON.stringify(attachments, null, 2) + '\n' +
            dedent`\
              \`\`\`
            `
          :
            dedent`\
              However, there are no available media to attach.
            `
        )
      }
      schema={
        z.object({
          text: z.string(),
          attachments: z.array(z.object({
            attachmentId: z.string(),
          })),
        })
      }
      examples={[
        {
          text: `Just setting up my account`,
        },
        {
          text: `Guess where I am?`,
          attachments: [
            {
              attachmentId: randomId,
            },
          ],
        },
      ]}
      handler={async (e: PendingActionEvent) => {
        const { agent, message } = e.data;
        const agentId = agent.agent.id;
        const { text, attachments } = message.args as {
          text: string;
          attachments: Array<{ attachmentId: string }>;
        };

        // post status update to the database
        const _postStatusUpdate = async () => {
          const supabase = agent.agent.useSupabase();
          const update = {
            agent_id: agentId,
            text,
            attachments,
          };
          const result = await supabase.from('status_updates')
            .insert(update);
          const { error } = result;
          if (!error) {
            // nothing
          } else {
            throw new Error('Failed to post status update: ' + error.message);
          }
        };
        await _postStatusUpdate();

        // commit the message to chat history, so the agent knows it has been sent
        await e.commit();
      }}
    />
  );
};