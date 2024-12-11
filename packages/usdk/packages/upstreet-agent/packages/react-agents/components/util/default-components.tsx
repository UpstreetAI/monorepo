import React, { useRef, useState, useEffect, useMemo, useContext } from 'react';
import dedent from 'dedent';
import type {
  Attachment,
  FormattedAttachment,
} from '../../types';
import {
  useAgent,
  useActions,
  useUniforms,
  useName,
  usePersonality,
  useStoreItems,
  usePurchases,
  useConversation,
  useCachedMessages,
} from '../../hooks';
import { Prompt } from '../core/prompt';
import { ChatLoop } from '../../loops/chat-loop';
// import { ActionLoop } from '../../loops/action-loop';
import { ChatActions } from '../core/chat';
import {
  ConversationProvider,
} from '../core/conversation';
import {
  formatActionsPrompt,
} from '../../util/format-schema';
import { timeAgo } from '../../util/time-ago.mjs';

// defaults

/**
 * Renders the default agent components.
 * @returns The JSX elements representing the default agent components.
 */
export const DefaultAgentComponents = () => {
  return (
    <>
      <ConversationProvider>
        <DefaultActions />
        <DefaultPrompts />
      </ConversationProvider>
      <ChatLoop />
    </>
  );
};

/**
 * Renders the default actions components.
 * @returns The JSX elements representing the default actions components.
 */
const DefaultActions = () => {
  return (
    <>
      <ChatActions />
      {/* <SocialMediaActions />
      <StoreActions /> */}
    </>
  );
};

/**
 * Renders the default prompts components.
 * @returns The JSX elements representing the default prompts components.
 */
const DefaultPrompts = () => {
  return (
    <>
      <DefaultHeaderPrompt />
      <ConversationEnvironmentPrompt />
      <ActionsPrompt />
      <StorePrompt />
      <ConversationMessagesPrompt />
      <InstructionsPrompt />
      <DefaultCommunicationGuidelinesPrompt />
    </>
  );
};
const DefaultHeaderPrompt = () => {
  return (
    <Prompt>
      {dedent`
        Role-play as a character in a chat given the current state.
        Respond with a JSON object specifying the action method and arguments.
      `}
    </Prompt>
  );
};
const ConversationEnvironmentPrompt = () => {
  return (
    <>
      <ScenePrompt />
      <CharactersPrompt />
    </>
  );
};
const ScenePrompt = () => {
  const conversation = useConversation();
  if (conversation) {
    const scene = conversation.getScene();
    return (
      <Prompt>
        {scene && dedent`
          # Scene
          ${scene.description}
        `}
      </Prompt>
    );
  } else {
    return null;
  }
};
const CharactersPrompt = () => {
  const conversation = useConversation();
  const agent = useAgent();
  const name = useName();
  const bio = usePersonality();
  if (conversation) {
    const agents = conversation.getAgents();
    const currentAgentSpec = {
      id: agent.id,
      name,
      bio,
    };
    const agentSpecs = agents.map((agent) => agent.getPlayerSpec());

    const formatAgent = (agent: any) => {
      return [
        `Name: ${agent.name}`,
        `UserId: ${agent.id}`,
        `Bio: ${agent.bio}`,
      ].join('\n');
    };

    return (
      <Prompt>
        {dedent`
          # Your Character
        ` +
          '\n\n' +
          formatAgent(currentAgentSpec) +
          (agents.length > 0
            ? (
              '\n\n' +
              dedent`
                # Other Characters
              ` +
              '\n\n' +
              agentSpecs
                .map(formatAgent)
                .join('\n\n')
            )
            : ''
          )
        }
      </Prompt>
    );
  } else {
    return null;
  }
};
const ActionsPromptInternal = () => {
  const actions = useActions();
  const uniforms = useUniforms();
  const conversation = useConversation();

  let s = '';
  if (actions.length > 0) {
    s = dedent`\
      # Response format
    ` +
    '\n\n' +
    formatActionsPrompt(Array.from(actions.values()), uniforms, conversation);
  }
  return (
    <Prompt>{s}</Prompt>
  );
};
const ActionsPrompt = () => {
  return (
    <ActionsPromptInternal />
  );
};
const StoreItemsPrompt = () => {
  const agent = useAgent();
  const storeItems = useStoreItems();
  return !!agent.stripeConnectAccountId && storeItems.length > 0 && (
    <Prompt>
      {dedent`\
        # Store
        Here are the store items available for purchase.
        Amount in cents (e.g. 100 = $1).
        \`\`\`
      ` + '\n' +
      JSON.stringify(storeItems, null, 2) + '\n' +
      dedent`\
        \`\`\`
      `}
    </Prompt>
  );
};
const PurchasesPrompt = () => {
  const conversation = useConversation();
  const purchases = usePurchases();

  if (conversation) {
    const conversationUserIds = Array.from(conversation.agentsMap.keys());
    const userPurchases = purchases.filter(purchase => {
      return conversationUserIds.includes(purchase.buyerUserId);
    });

    return (
      <Prompt>
        {purchases.length > 0 && dedent`\
          # Purchases
          Here are the purchases made so far:
          \`\`\`
        ` + '\n' +
        JSON.stringify(userPurchases, null, 2) + '\n' +
        dedent`\
          \`\`\`
        `}
      </Prompt>
    );
  } else {
    return null;
  }
};
const StorePrompt = () => {
  return (
    <>
      <StoreItemsPrompt />
      <PurchasesPrompt />
    </>
  );
};
const ConversationMessagesPrompt = () => {
  return (
    <CachedMessagesPrompt />
  );
}
const CachedMessagesPrompt = () => {
  const cachedMessages = useCachedMessages();

  const formatAttachments = (attachments?: Attachment[]) => {
    if (attachments?.length > 0) {
      return attachments.map((attachment) => formatAttachment(attachment));
    } else {
      return undefined;
    }
  };
  const formatAttachment = (attachment: Attachment): FormattedAttachment => {
    const {
      id,
      type,
      // alt,
    } = attachment;
    return {
      id,
      type,
      // alt,
    };
  };

  return (
    <Prompt>
      {dedent`
        # Message history
        ${
          cachedMessages.length > 0
            ? dedent`
              Here is the chat so far:
            ` +
              '\n' +
              '```' +
              '\n' +
              cachedMessages
                .map((action) => {
                  const { /*userId,*/ name, method, args, attachments = [], timestamp } = action;
                  const j = {
                    // userId,
                    name,
                    method,
                    args,
                    attachments: formatAttachments(attachments),
                  };
                  return JSON.stringify(j) + ' ' + timeAgo(new Date(timestamp));
                })
                .join('\n') +
              '\n' +
              dedent`
                <end of message history, continue from here>
              ` +
              '\n' +
              '```'
            : 'No messages have been sent or received yet. This is the beginning of the conversation.'
        }
      `}
    </Prompt>
  );
};
const InstructionsPrompt = () => {
  const agent = useAgent();

  return (
    <Prompt>
      {dedent`
        # Instructions
        Respond with the next action taken by your character: ${agent.name}
        The method/args of your response must match one of the allowed actions.

        Before choosing an action, decide if you should respond at all:
        - Return null (no action) if:
          * Message is clearly meant for others (unless you have crucial information)
          * Your input wouldn't add value to the conversation
          * The conversation is naturally concluding
          * You've already responded frequently in the last few messages (2-3 messages max)
          * Multiple other agents are already actively participating
      `}
    </Prompt>
  );
};
const DefaultCommunicationGuidelinesPrompt = () => {
  return (
    <Prompt>
      {dedent`
        Prioritize responding when:
          - You're directly mentioned or addressed
          - It's a group discussion where you can contribute meaningfully
          - Your personality traits are relevant to the topic

        Communication guidelines:
          - Avoid using names in every message - only use them when:
            * Directly responding to someone for the first time
            * Clarifying who you're addressing in a group
            * There's potential confusion about who you're talking to
          - If you've been very active in the last few messages, wrap up your participation naturally
            * Use phrases like "I'll let you all discuss" or simply stop responding
            * Don't feel obligated to respond to every message
          - Keep responses concise and natural
          - Let conversations breathe - not every message needs a response
          - If multiple agents are responding to the same person, step back and let others take the lead
      `}
    </Prompt>
  );
};