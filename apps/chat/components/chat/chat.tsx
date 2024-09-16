'use client'

import React from 'react';
import { useEffect, useState } from 'react';
// import Link from 'next/link';
import { ChatMessage } from '@/components/chat/chat-message';
// import { ChatMessageOld } from '@/components/chat/chat-message-old'
// import { type User } from '@supabase/supabase-js';
// import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ChatList } from '@/components/chat/chat-list'
import { ChatPanel } from '@/components/chat/chat-panel'
import { EmptyScreen } from '@/components/empty-screen'
// import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { defaultUserPreviewUrl } from 'react-agents/defaults.mjs';
// import { useAIState } from 'ai/rsc'
// import { Message } from '@/lib/types'
// import { usePathname, useRouter } from 'next/navigation'
import { useScrollAnchor } from '@/lib/hooks/use-scroll-anchor';
// import { UIState } from '@/lib/chat/actions'
// import { resolveRelativeUrl } from '@/lib/utils'
// import { aiHost } from '@/utils/const/endpoints';
import { getJWT } from '@/lib/jwt';
import { useSupabase, type User } from '@/lib/hooks/use-supabase';
import { PlayerSpec, Player, useMultiplayerActions } from '@/components/ui/multiplayer-actions';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/lib/client/hooks/use-sidebar';
import { PaymentItem, SubscriptionProps } from 'react-agents/types';
import { createSession } from 'react-agents/util/stripe-utils.mjs';
import { webbrowserActionsToText } from 'react-agents/util/browser-action-utils.mjs';
import { currencies, intervals } from 'react-agents/constants.mjs';


//

const openInNewPage = (url: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  // a.rel = 'noopener noreferrer';
  a.click();
};

//

type Alt = {
  q: string
  a: string
}
type FormattedAttachment = {
  id: string
  type: string
  alt?: Alt[]
}
type Attachment = FormattedAttachment &{
  url?: string
}
type Message = {
  method: string
  args: {
    text?: string
  }
  attachments: Attachment[]
  name: string
  timestamp: Date
  userId: string
}

//

export interface ChatProps extends React.ComponentProps<'div'> {
  id?: string
  room: string
  onConnect?: (connected: boolean) => void
}
export function Chat({ className, /* user, missingKeys, */ room, onConnect }: ChatProps) {
  const [input, setInput] = useState('')
  const { user } = useSupabase()

  const {
    connected,
    playersCache,
    messages: rawMessages,
    setMultiplayerConnectionParameters,
  } = useMultiplayerActions();

  useEffect(() => {
    onConnect && onConnect(connected);
  }, [connected]);

  const messages = rawMessages.map((rawMessage: any, index: number) => {
    const message = {
      ...rawMessage,
      timestamp: rawMessage.timestamp ? new Date(rawMessage.timestamp) : new Date(),
    };
    return {
      id: index,
      display: getMessageComponent(room, message, index + '', playersCache, user),
    };
  })as any[];

  useEffect(() => {
    if (room && user) {
      const localPlayerSpec: PlayerSpec = {
        id: (user as any).id as string,
        name: (user as any).name as string,
        previewUrl: (user as any).preview_url as string || defaultUserPreviewUrl,
        capabilities: [
          'human',
        ],
      };
      setMultiplayerConnectionParameters({
        room,
        localPlayerSpec,
      });
    }
  }, [room, user, setMultiplayerConnectionParameters]);

  const { messagesRef, scrollRef, visibilityRef, isAtBottom, scrollToBottom } =
    useScrollAnchor();

  const { isLeftSidebarOpen, isRightSidebarOpen } = useSidebar();
  
  return (
    <div
      className={`group w-full duration-300 ease-in-out animate-in overflow-auto ${isLeftSidebarOpen ? "lg:pl-[250px] xl:pl-[300px]" : ""} ${isRightSidebarOpen ? "lg:pr-[250px] xl:pr-[300px]" : ""} `}
      ref={scrollRef}
    >
      <div
        className={cn('pb-[200px] pt-4 md:pt-10', className)}
        ref={messagesRef}
      >
        {room ? (
          messages.length ? (
            <ChatList messages={messages} />
          ) : (
            null
          )
        ) : <EmptyScreen />}

        <div className="w-full h-px" ref={visibilityRef} />
      </div>
      <ChatPanel
        input={input}
        setInput={setInput}
        isAtBottom={isAtBottom}
        scrollToBottom={scrollToBottom}
        room={room}
        messages={messages}
      />
    </div>
  )
}

/* const formatAttachment = (attachment?: Attachment): (FormattedAttachment | undefined) => {
  if (attachment) {
    const {
      id,
      type,
      alt,
    } = attachment;
    return {
      id,
      type,
      alt,
    };
  } else {
    return attachment;
  }
}; */
function getMessageComponent(room: string, message: Message, id: string, playersCache: Map<string, Player>, user: User | null) {
  switch (message.method) {

    // TODO Move the typing logic to form component, over send message?
    case 'typing': return null;

    case 'join': return (
      <div className="opacity-60">
        { message.name } joined the room.
      </div>
    )

    case 'leave': return (
      <div className="opacity-60">
        { message.name } left the room.
      </div>
    )
    
    case 'say': {
      const player = playersCache.get(message.userId);
      const media = (message.attachments ?? []).filter(a => !!a.url)[0] ?? null;

      return (
        <ChatMessage
          id={id}
          name={ message.name }
          content={message.args.text}
          media={media}
          player={player}
          room={room}
          timestamp={message.timestamp}
        />
      )
    }

    case 'addMemory': {
      // const player = playersCache.get(message.userId);
      // const media = (message.attachments ?? [])[0] ?? null;

      return (
        <div className="opacity-60 text-xs">{message.name} will rememeber that</div>
      );
    }
    case 'queryMemories': {
      // const player = playersCache.get(message.userId);
      // const media = (message.attachments ?? [])[0] ?? null;

      return (
        <div className="opacity-60 text-xs">{message.name} is trying to remember</div>
      );
    }

    case 'mediaPerception': {
      // const player = playersCache.get(message.userId);
      // const media = (message.attachments ?? [])[0] ?? null;

      return (
        <div className="opacity-60 text-xs">{message.name} checked an attachment</div>
      );
    }

    case 'browserAction': {
      const player = playersCache.get(message.userId);
      // const media = (message.attachments ?? [])[0] ?? null;
      
      const {
        // agent:,
        // method,
        args: messageArgs,
        // result,
        // error,
      } = message;
      const {
        method,
        args,
        result,
        error,
      } = messageArgs as {
        method: string;
        args: any;
        result: any;
        error: any;
      };
      const spec = webbrowserActionsToText.find((spec) => spec.method === method);
      if (spec) {
        const agent = player?.getPlayerSpec();
        const o = {
          agent,
          method,
          args,
          result,
          error,
        };
        // console.log('get text 1', o);
        const text = spec.toText(o);
        // console.log('get text 2', o, { text });
        return (
          <div className="opacity-60 text-xs">{text}</div>
        );
      } else {
        return null;
      }
    }

    case 'paymentRequest': {
      const agentId = message.userId;
      const player = playersCache.get(agentId);

      let media = null;

      const {
        args,
      } = message;
      const {
        type,
        props,
        stripeConnectAccountId,
      } = args as PaymentItem;
      const {
        name = '',
        description = '',
        amount = 0,
        currency = currencies[0],
        interval = intervals[0],
        intervalCount = 1,
      } = props as SubscriptionProps;

      const checkout = async (e: any) => {
        if (user) {
          const targetUserId = user.id;

          const jwt = await getJWT();
          if (!jwt) {
            throw new Error('No jwt:' + jwt);
          }

          // create the checkout session
          const success_url = location.href;
          const stripe_connect_account_id = stripeConnectAccountId;
          const opts = {
            args: {
              mode: type,
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    product_data: {
                      name,
                      description,
                    },
                    unit_amount: amount,
                    currency,
                    recurring: type === 'subscription' ? {
                      interval,
                      interval_count: intervalCount,
                    } : undefined,
                  },
                },
              ],
              success_url,
              metadata: {
                name,
                description,
                targetUserId,
                agentId,
              },
            },
            stripe_connect_account_id,
          };
          const j = await createSession(opts, {
            jwt,
          });
          const {
            // id,
            url,
          } = j;

          // redirect to the checkout page
          openInNewPage(url);
        } else {
          throw new Error('No user:' + user);
        }
      };

      const price = (() => {
        const v = amount / 100;
        if (currency === 'usd') {
          return `$${v}`;
        } else {
          return `${v} ${(currency + '').toUpperCase()}`;
        }
      })();
      const subscriptionText = type === 'subscription' ? ` per ${interval}${intervalCount !== 1 ? 's' : ''}` : '';

      return (
        <ChatMessage
          id={id}
          content={
            <div className="rounded bg-zinc-950 text-zinc-300 p-4 border">
              <div className="text-zinc-700 text-sm mb-2 font-bold">[payment request]</div>
              <div className="mb-4">{name}: {description}</div>
              <div className="mb-4">{price}{subscriptionText}</div>
              <Button onClick={checkout}>Checkout</Button>
            </div>
          }
          name={ message.name }
          media={ media }
          player={player}
          room={room}
          timestamp={message.timestamp}
        />
      )
    }

    default: return null
  }
}
