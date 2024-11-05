import Image from 'next/image'
import { getAgentUrl, getAgentPreviewImageUrl } from '@/lib/utils'
import Link from 'next/link'
import { isValidUrl } from '@/utils/helpers/urls'
import { useDirectMessageActions } from '@/components/ui/direct-message-actions'
import { IconChat, IconDownload, IconShare } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { isImageType, isAudioType, isVideoType, isModelType } from '@/utils/helpers/media-types'
import { Model } from '../model'
import ReactMarkdown from 'react-markdown'
import { timeAgo } from 'react-agents/util/time-ago.mjs';

// import type { User } from '@supabase/supabase-js'

export interface ChatMessageProps {
  id: string
  content: any
  media: any
  name: string
  player: any
  room: string
  timestamp: Date
  isOwnMessage: any
  profileUrl: string
  // user: User | null
}

export function ChatMessage({
  id,
  content,
  media,
  name,
  player,
  timestamp,
  isOwnMessage,
  profileUrl
}: ChatMessageProps) {
  if (!player) {
    throw new Error('Player is required')
  }

  const playerSpec = player.getPlayerSpec();
  // const agentUrl = getAgentUrl(playerSpec);
  const avatarURL = getAgentPreviewImageUrl(playerSpec);

  const { popoverMessageId, togglePopoverMessageId, dmsOpen, toggleOpenDm } = useDirectMessageActions();

  return (
    <div>
      <div className={`relative bt-0 mt-2 ${isOwnMessage ? 'pl-14' : 'pr-14'}`}>
        {(popoverMessageId === id && !isOwnMessage) && (
          <div className="absolute top-6 left-16 z-10 p-2 flex flex-col bg-background border rounded">
            <Link
              className="flex flex-col w-full"
              href={profileUrl}
              onClick={e => {
                togglePopoverMessageId('');
              }}
            >
              <Button
                variant="secondary"
                className="flex justify-start relative rounded bg-background p-2 overflow-hidden"
              >
                <IconShare className="mr-2" />
                <div>Profile</div>
              </Button>
            </Link>
            <Button
              variant="secondary"
              className="flex justify-start relative rounded bg-background p-2 overflow-hidden"
              onClick={(e) => {
                toggleOpenDm(playerSpec.id);
                togglePopoverMessageId('');
              }}
            >
              <IconChat className="mr-2" />
              <div>Direct message</div>
            </Button>
          </div>
        )}

        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
          {!isOwnMessage && (
            <ChatMessageAvatar name={name} avatarURL={avatarURL} profileUrl={profileUrl} />
          )}

          <div className={`bg-slate-100 py-[11px] px-4 w-fit border border-gray-400 text-black ${isOwnMessage ? 'mr-2 bg-green-50' : 'ml-2'}`}>
            {!isOwnMessage && (
              <span
                className="font-bold mr-2 cursor-pointer hover:underline"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();

                  togglePopoverMessageId(id);
                }}
              >
                {name}
              </span>
            )}

            {(() => {
              if (isImageType(media?.type)) {
                return (<ChatMessageImage url={media.url} timestamp={timestamp} />);
              }
              if (isAudioType(media?.type)) {
                return (<ChatMessageAudio url={media.url} timestamp={timestamp} />);
              }
              if (isVideoType(media?.type)) {
                return (<ChatMessageVideo url={media.url} timestamp={timestamp} />);
              }
              if (isModelType(media?.type)) {
                return (<ChatMessageModel url={media.url} timestamp={timestamp} />);
              }
              return null;
            })()}
            {content && (
              <div className="relative">
                <div className={`float-left mr-2`}>
                  <ReactMarkdown className='chat-markdown'>
                    {content}
                  </ReactMarkdown>
                </div>
                <div className="float-right text-md text-right text-gray-400">
                  {timeAgo(timestamp)}
                </div>
              </div>
            )}
          </div>

          {isOwnMessage && (
            <ChatMessageAvatar name={name} avatarURL={avatarURL} profileUrl={profileUrl} />
          )}
        </div>

      </div>
    </div>
  )
}

// CHAT MESSAGE AVATAR

export interface ChatMessageAvatarProps {
  name: string
  avatarURL: string
  profileUrl: string
}

export function ChatMessageAvatar({
  name,
  avatarURL,
  profileUrl
}: ChatMessageAvatarProps) {
  return (
    <Link href={profileUrl}>
      <div
        className="w-12 h-12 bg-cover bg-top border border-gray-400"
        style={{
          backgroundImage: isValidUrl(avatarURL)
            ? `url(${avatarURL})`
            : 'none',
          backgroundColor: isValidUrl(avatarURL) ? 'transparent' : '#ccc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#fff',
        }}
      >
        {!isValidUrl(avatarURL) && name.charAt(0)}
      </div>
    </Link>
  )
}

// MEDIA AUDIO

export interface ChatMessageAudioProps {
  url: string
  timestamp: Date
}

export function ChatMessageAudio({
  url,
  timestamp
}: ChatMessageAudioProps) {
  return (
    <div className="bg-[rgba(255,255,255,0.1)] rounded-[16px] p-4 shadow-lg mt-2">
      <audio id={`audioPlayer-${timestamp}`} controls className="w-full h-10 outline-none">
        <source src={url} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  )
}

// MEDIA: VIDEO

export interface ChatMessageVideoProps {
  url: string
  timestamp: Date
}

export function ChatMessageVideo({
  url,
  timestamp
}: ChatMessageVideoProps) {
  return (
    <div className="bg-[rgba(255,255,255,0.1)] rounded-[16px] p-4 shadow-lg mt-2">
      <video id={`videoPlayer-${timestamp}`} controls className="w-full rounded-[8px] h-auto outline-none">
        <source src={url} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  )
}

// MEDIA: MODEL

export interface ChatMessageModelProps {
  url: string
  timestamp: Date
}

export function ChatMessageModel({
  url,
  timestamp
}: ChatMessageModelProps) {
  return (
    <div className="bg-[rgba(255,255,255,0.1)] rounded-[16px] p-4 shadow-lg mt-2">
      <Model src={url} />
      <Button
        variant="secondary"
        onClick={e => {
          const a = document.createElement('a');
          a.href = url;
          a.download = url;
          a.click();
        }}
      >
        <IconDownload className="mr-2" />
        <div>Download</div>
      </Button>
    </div>
  )
}

// MEDIA: IMAGE

export interface ChatMessageImageProps {
  url: string
  timestamp: Date
}

export function ChatMessageImage({
  url,
  timestamp
}: ChatMessageImageProps) {
  return (
    <div className="bg-[rgba(255,255,255,0.1)] mt-2 mb-2">
      <img id={`image-${timestamp}`} className='w-full' src={url} alt='' />
    </div>
  )
}


