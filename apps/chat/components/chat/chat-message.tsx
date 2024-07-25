import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
import Image from 'next/image'
import { getAgentUrl, getAgentPreviewImageUrl, resolveRelativeUrl } from '@/lib/utils'
import Link from 'next/link'
import { isValidUrl } from '@/utils/helpers/urls'
import { useDirectMessageActions } from '@/components/ui/direct-message-actions'
import { IconChat, IconShare } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { WindupChildren } from "windups";

// import type { User } from '@supabase/supabase-js'


TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')


export interface ChatMessageProps {
  id: string
  content: React.ReactNode
  media: any
  name: string
  player: any
  room: string
  timestamp: Date
  // user: User | null
}

export function ChatMessage({
  id,
  content,
  media,
  name,
  player,
  // room,
  timestamp,
  // user,
}: ChatMessageProps) {
  if (!player) {
    throw new Error('Player is required')
  }

  const playerSpec = player.getPlayerSpec();
  const agentUrl = getAgentUrl(playerSpec);
  const avatarURL = getAgentPreviewImageUrl(playerSpec);

  const { popoverMessageId, togglePopoverMessageId, dmsOpen, toggleOpenDm } = useDirectMessageActions(); 
  
  return (
    <div>
      <div className={'relative grid grid-cols-message bt-0'}>
        {(popoverMessageId === id) && (
          <div className="absolute top-6 left-16 z-10 p-2 flex flex-col bg-background border rounded">
            <Link
              className="flex flex-col w-full"
              href={`/agents/${playerSpec.id}`}
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
        <Link href={agentUrl} className="mr-4 size-12 min-w-12 bg-[rgba(0,0,0,0.1)] overflow-hidden dark:bg-[rgba(255,255,255,0.1)] rounded-[8px] flex items-center justify-center">

          {avatarURL && isValidUrl(avatarURL) ? (
            <Image src={resolveRelativeUrl(avatarURL)} alt="" className="s-300" width={48} height={48} />
          ) : (
            <div className='uppercase text-lg font-bold'>{name.charAt(0)}</div>
          )}
        </Link>
        <div className="">
          {/* <Link href={agentUrl} className="font-bold mr-2 hover:underline">
            {name}
          </Link> */}
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
          <span className="opacity-75 text-xs font-medium">
            {timestamp ? timeAgo.format(timestamp) : null}
          </span>
          <br />

          <WindupChildren>
          {media?.type === 'image' && (<ChatMessageImage url={media.url} timestamp={timestamp} />)}
          {media?.type === 'audio' && (<ChatMessageAudio url={media.url} timestamp={timestamp} />)}
          {media?.type === 'video' && (<ChatMessageVideo url={media.url} timestamp={timestamp} />)}
          {!media && (<div>{content}</div>)}
          </WindupChildren>

        </div>
      </div>
    </div>
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
    <div className="bg-[rgba(0,0,0,0.1)] dark:bg-[rgba(255,255,255,0.1)] rounded-[16px] p-4 shadow-lg mt-2">
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
    <div className="bg-[rgba(0,0,0,0.1)] dark:bg-[rgba(255,255,255,0.1)] rounded-[16px] p-4 shadow-lg mt-2">
      <video id={`videoPlayer-${timestamp}`} controls className="w-full rounded-[8px] h-auto outline-none">
        <source src={url} type="video/mp4" />
          Your browser does not support the video tag.
      </video>
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
    <div className="bg-[rgba(0,0,0,0.1)] dark:bg-[rgba(255,255,255,0.1)] rounded-[16px] p-4 shadow-lg mt-2">
      <img id={`image-${timestamp}`} className='rounded-[8px] w-full' src={url} alt='' />
    </div>
  )
}


