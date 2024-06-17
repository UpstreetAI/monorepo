'use client'

import { ConfirmNewAgentMessage } from '@/components/builder/messages/ConfirmNewAgentMessage/index'
import { type User } from '@supabase/supabase-js';
import React from 'react'
import { CreateAgentMessage } from '@/components/builder/messages/CreateAgentMessage'
import { ChatInput } from '@/components/chat/new/chat-input'
import { ChatMessage } from '@/components/chat/chat-message'
import { ChatMessageOld } from '@/components/chat/chat-message-old'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ChatList } from '@/components/chat/chat-list'
import { EmptyScreen } from '@/components/empty-screen'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
// import { useAIState } from 'ai/rsc'
// import { Message } from '@/lib/types'
import { usePathname, useRouter } from 'next/navigation'
import { useScrollAnchor } from '@/lib/hooks/use-scroll-anchor'
import { UIState } from '@/lib/chat/actions'
import { PlayerSpec, Player, useMultiplayerActions } from '@/components/ui/multiplayer-actions'
import { Button } from '@/components/ui/button'

import type { Message } from '@/types'


const messageComponents = {
  confirmCreatedAgent: ({ message }) => <ConfirmNewAgentMessage message={message}/>,

  creatingAgent: ({ message }) => (
    <CreateAgentMessage message={message}/>
  ),

  join: ({ message }) => (
    <div className="opacity-60">
      { message.name } joined the room.
    </div>
  ),

  say: ({ message, playersCache, room, user }) => {
    const player = playersCache.get(message.userId);

    let media = null;

    if(message.args.audio) media = { type: 'audio', url: message.args.audio };
    if(message.args.video) media = { type: 'video', url: message.args.video };
    if(message.args.image) media = { type: 'image', url: message.args.image };

    // TEST MESSAGE COMPONENTS START, REMOVE WHEN MEDIA ARGS ARE IMPLEMENTED, THE ABOVE WILL WORK
    // Usage:
    // test audio [AUDIO_URL]
    // test video [VIDEO_URL]
    // test image [IMAGE_URL]
    const match = message.args.text.match(/\[([^\]]+)\]/);
    const url = match && match[1]
    if(message.args.text.startsWith('test audio')) media = { type: 'audio', url: url };
    if(message.args.text.startsWith('test video')) media = { type: 'video', url: url };
    if(message.args.text.startsWith('test image')) media = { type: 'image', url: url };
    // TEST MESSAGE COMPONENTS END

    return (
      <ChatMessage
        content={message.args.text}
        name={ message.name }
        media={ media }
        player={player}
        room={room}
        timestamp={message.timestamp}
        user={user}
      />
    )
  }
}


export interface ChatProps extends React.ComponentProps<'div'> {
  initialMessages?: Message[]
  messages?: Message[]
  room: string
  user: User|null
}

export function Chat({ className, messages, room, user }: ChatProps) {
  const router = useRouter()
  const path = usePathname()
  const [input, setInput] = useState('')
  // const [messages] = useUIState()
  // const [aiState] = useAIState()

  const {
    playersCache,
    messages: rawMessages,
    setMultiplayerConnectionParameters,
    sendRawMessage,
    sendChatMessage,
  } = useMultiplayerActions()

  const _messages = (messages || rawMessages).map((message: any, index: number) => ({
    id: index,
    display: messageComponents[message.method]?.({ message, playersCache, room, user }),
  }))

  /*useEffect(() => {
    if (user) {
      if (!path.includes('chat') && messages.length === 1) {
        window.history.replaceState({}, '', `/chat/${id}`)
      }
    }
  }, [id, path, user, messages])*/

  /*useEffect(() => {
    const messagesLength = aiState.messages?.length
    if (messagesLength === 2) {
      router.refresh()
    }
  }, [aiState.messages, router])*/

  // useEffect(() => {
  //   missingKeys.map(key => {
  //     toast.error(`Missing ${key} environment variable!`)
  //   })
  // }, [missingKeys])

  useEffect(() => {
    if (room && user) {
      const localPlayerSpec: PlayerSpec = {
        id: user.id,
        name: user.user_metadata.full_name,
        previewUrl: user.user_metadata.avatar_url,
      };
      setMultiplayerConnectionParameters({
        room,
        localPlayerSpec,
      });
    }
  }, [room, user, setMultiplayerConnectionParameters]);

  const { messagesRef, scrollRef, visibilityRef, isAtBottom, scrollToBottom } =
    useScrollAnchor()

  return (
    <div
      className="flex flex-col w-full h-full overflow-auto pl-0 peer-[[data-state=open]]:lg: peer-[[data-state=open]]:xl:pl-[300px]"
      ref={scrollRef}
    >
      {/*{ room }*/}
      <div
        className={cn('flex-1 pt-4 md:pt-10', className)}
        ref={messagesRef}
      >
        {room ? (
          _messages.length ? (
            <ChatList messages={_messages} /*isShared={false} user={user}*/ />
          ) : (
            null
          )
        ) : <EmptyScreen />}

        {/*<div className="w-full h-px" ref={visibilityRef} />*/}
      </div>
      <ChatInput
        input={input}
        setInput={setInput}
        isAtBottom={isAtBottom}
        scrollToBottom={scrollToBottom}
        room={room}
        messages={_messages}
        sendChatMessage={sendChatMessage}
      />
    </div>
  )
}

function getMessageComponent(room: string, user: User|null, message: Message, playersCache: Map<string, Player>, sendRawMessage: (method: string, opts: object) => void) {
  return messageComponents[message.method]?.({ message, playersCache, room, user })
  /*switch (message.method) {

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

    case 'createAgent':

    case 'paymentRequest': {
      const player = playersCache.get(message.userId);
      let media = null;

      return (
        <ChatMessage
          content={
            <>
              <div className="rounded bg-zinc-950 text-zinc-300 p-4 border">
                <div className="text-zinc-700 text-sm mb-2 font-bold">[payment request]</div>
                <div className="mb-4">{(message.args as any).description}</div>
                <Button onClick={e => {
                  sendRawMessage('paymentResponse', {
                    description: 'Payment accepted',
                    amount: (message.args as any).amount,
                    currency: (message.args as any).currency,
                  });
                }}>Pay {(message.args as any).amount / 100} {(message.args as any).currency}</Button>
              </div>
            </>
          }
          name={ message.name }
          media={ media }
          player={player}
          room={room}
          timestamp={message.timestamp}
          user={user}
        />
      )
    }

    case 'paymentResponse': {
      const player = playersCache.get(message.userId);
      let media = null;

      return (
        <ChatMessage
          content={
            <>
              <div className="rounded bg-zinc-950 text-zinc-300 p-4 border">
                <div className="text-zinc-700 text-sm mb-2 font-bold">[payment response]</div>
                <div>{(message.args as any).description}</div>
              </div>
            </>
          }
          name={ message.name }
          media={ media }
          player={player}
          room={room}
          timestamp={message.timestamp}
          user={user}
        />
      )
    }

    default: return null
  }*/
}
