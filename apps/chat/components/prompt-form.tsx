'use client'

import * as React from 'react'
import Textarea from 'react-textarea-autosize'
import { Button } from '@/components/ui/button'
import { IconPlus, IconImage, IconAudio, IconVideo, IconCapture, IconShare, IconTriangleSmallDown } from '@/components/ui/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMultiplayerActions } from '@/components/ui/multiplayer-actions'
import { cn } from '@/lib/utils'
import type { PlayableAudioStream, PlayableVideoStream } from 'react-agents/types'
import { shuffle } from 'react-agents/util/util.mjs'
import { createPcmF32MicrophoneSource } from 'codecs/audio-client.mjs'
import { createVideoSource } from '@upstreet/multiplayer/public/video/video-client.mjs'
import { ensureAudioContext } from '@/lib/audio/audio-context-output'
import { Icon, IconButton } from 'ucom'

export function PromptForm({
  input,
  embed,
  desktop,
  mode,
  scrollToBottom,
  setInput
}: {
  input: string
  embed?: boolean
  desktop?: boolean
  mode?: "web" | "desktop" | "embed"
  scrollToBottom: () => void
  setInput: (value: string) => void
}) {
  const [mediaPickerOpen, setMediaPickerOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const { connected, playersMap, typingMap, sendNudgeMessage, sendChatMessage, sendMediaMessage, addAudioSource, removeAudioSource, addVideoSource, removeVideoSource } = useMultiplayerActions()
  const [typing, setTyping] = React.useState('')
  const [microphoneSource, setMicrophoneSource] = React.useState<any>(null)
  const [cameraSource, setCameraSource] = React.useState<any>(null)
  const [screenSource, setScreenSource] = React.useState<any>(null)

  React.useEffect(() => {
    if (typingMap) {
      const typingchange = (e: any) => {
        const tm = typingMap.getMap()
        const specs = Array.from(tm.values()).filter((spec) => spec.typing)
        if (specs.length > 0) {
          const s = specs.map((spec) => spec.name).join(', ')
          setTyping(`${s} ${specs.length > 1 ? 'are' : 'is'} typing...`)
        } else {
          setTyping('')
        }
      }
      typingMap.addEventListener('typingchange', typingchange)
      return () => {
        typingMap.removeEventListener('typingchange', typingchange)
      }
    }
  }, [typingMap])

  const botAgents = Array.from(playersMap.getMap().values())
    .map((player) => player.getPlayerSpec())
    .filter((playerSpec) => !playerSpec.capabilities?.includes('human'))
  const nonTypingBotAgents = botAgents.filter((player) => !typingMap.getMap().get(player.id)?.typing)
  const canContinue = nonTypingBotAgents.length > 0

  const toggleMediaPicker = () => {
    setMediaPickerOpen(open => !open)
  }

  const submitMessage = () => {
    const value = input.trim()
    setInput('')
    if (value) {
      sendChatMessage(value)
      scrollToBottom()
    } else if (canContinue) {
      nudgeContinue()
    }
  }

  const nudgeContinue = () => {
    const randomBotAgent = shuffle(botAgents.slice())[0]
    sendNudgeMessage(randomBotAgent.id)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (window.innerWidth < 600) {
        const target = event.target as HTMLTextAreaElement
        target.blur()
      }
      submitMessage()
    }
  }

  const buttonClass = cn("flex justify-start relative border rounded-none border-1 mb-1 bg-zinc-100 text-zinc-900 hover:text-zinc-200 hover:bg-zinc-950 overflow-hidden")

  return (
    <form onSubmit={async (e: any) => {
      e.preventDefault()
    }}>
      <div className="flex w-full">
      <div className="relative flex max-h-60 w-full grow flex-col px-8 bg-slate-100 sm:border sm:px-12">
        {mediaPickerOpen && (
          <div className="absolute left-0 bottom-full flex flex-col bg-background p-1 pb-0">
            <Button
              variant="secondary"
              className={buttonClass}
            >
              <input className="absolute -top-12 bottom-0 -left-12 right-0 cursor-pointer" type="file" onChange={e => {
                const files: File[] = Array.from((e.target as any).files);
                const file = files[0];
                sendMediaMessage(file);
                toggleMediaPicker();
                (e.target as any).value = null;
              }} />
              <IconImage className="mr-2" />
              <div>Image</div>
            </Button>
            <Button
              variant="secondary"
              className={buttonClass}
              onClick={async () => {
                if (!microphoneSource) {
                  const audioContext = await ensureAudioContext()
                  const devices = await navigator.mediaDevices.enumerateDevices()
                  const audioInputDevices = devices.filter((device) => device.kind === 'audioinput')
                  const micAudioInputDevices = audioInputDevices.filter((device) => /mic/i.test(device.label))
                  const otherAudioInputDevices = audioInputDevices.filter((device) => !/mic/i.test(device.label))
                  const audioInputDevice = micAudioInputDevices[0] || otherAudioInputDevices[0] || null
                  if (audioInputDevice) {
                    const mediaStream = await navigator.mediaDevices.getUserMedia({
                      audio: {
                        deviceId: audioInputDevice.deviceId,
                      },
                    })
                    const microphoneSource = createPcmF32MicrophoneSource({
                      mediaStream,
                      audioContext,
                    })
                    setMicrophoneSource(microphoneSource)

                    const audioStream = new ReadableStream({
                      start(controller) {
                        microphoneSource.output.addEventListener('data', (e: any) => {
                          controller.enqueue(e.data)
                        })
                        microphoneSource.output.addEventListener('end', (e: any) => {
                          controller.close()
                        })
                      },
                    }) as PlayableAudioStream
                    audioStream.id = crypto.randomUUID()
                    audioStream.type = 'audio/pcm-f32-48000'
                    audioStream.disposition = 'text'

                    ;(async () => {
                      const { waitForFinish } = addAudioSource(audioStream)
                      await waitForFinish()
                      removeAudioSource(audioStream)
                    })()
                  } else {
                    console.warn('no audio input device found')
                  }
                } else {
                  microphoneSource.close()
                  setMicrophoneSource(null)
                }
              }}
            >
              <IconAudio className="mr-2" />
              <div>Audio</div>
            </Button>
            <Button
              variant="secondary"
              className={buttonClass}
              onClick={async () => {
                if (!cameraSource) {
                  const devices = await navigator.mediaDevices.enumerateDevices()
                  const videoInputDevices = devices.filter((device) => device.kind === 'videoinput')
                  const videoInputDevice = videoInputDevices[0] || null
                  if (videoInputDevice) {
                    const mediaStream = await navigator.mediaDevices.getUserMedia({
                      video: {
                        deviceId: videoInputDevice.deviceId,
                      },
                    })
                    const cameraSource = createVideoSource({
                      mediaStream,
                    })
                    setCameraSource(cameraSource)

                    const videoStream = new ReadableStream({
                      start(controller) {
                        cameraSource.output.addEventListener('data', (e: any) => {
                          controller.enqueue(e.data)
                        })
                        cameraSource.output.addEventListener('end', (e: any) => {
                          controller.close()
                        })
                      },
                    }) as PlayableVideoStream
                    videoStream.id = crypto.randomUUID()
                    videoStream.type = 'image/webp'
                    videoStream.disposition = 'text'

                    ;(async () => {
                      const { waitForFinish } = addVideoSource(videoStream)
                      await waitForFinish()
                      removeVideoSource(videoStream)
                    })()
                  } else {
                    console.warn('no video input device found')
                  }
                } else {
                  cameraSource.close()
                  setCameraSource(null)
                }
              }}
            >
              <IconVideo className="mr-2" />
              <div>Camera</div>
            </Button>
            <Button
              variant="secondary"
              className={buttonClass}
              onClick={async () => {
                if (!screenSource) {
                  const mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false,
                  })
                  const screenSource = createVideoSource({
                    mediaStream,
                  })
                  setScreenSource(screenSource)

                  const videoStream = new ReadableStream({
                    start(controller) {
                      screenSource.output.addEventListener('data', (e: any) => {
                        controller.enqueue(e.data)
                      })
                      screenSource.output.addEventListener('end', (e: any) => {
                        controller.close()
                      })
                    },
                  }) as PlayableVideoStream
                  videoStream.id = crypto.randomUUID()
                  videoStream.type = 'image/webp'
                  videoStream.disposition = 'text'

                  ;(async () => {
                    const { waitForFinish } = addVideoSource(videoStream)
                    await waitForFinish()
                    removeVideoSource(videoStream)
                  })()
                } else {
                  screenSource.close()
                  setScreenSource(null)
                }
              }}
            >
              <IconCapture className="mr-2" />
              <div>Screen</div>
            </Button>
            {desktop && <Button
              variant="secondary"
              className={buttonClass}
              onClick={async () => {
                console.log('control click')
              }}
            >
              <IconShare className="mr-2" />
              <div>Control</div>
            </Button>}
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(`absolute left-0 md:left-4 top-[4px] size-8 rounded-full p-0`, mediaPickerOpen && `bg-slate-900 text-slate-100`)}
              onClick={toggleMediaPicker}
            >
              <Icon icon="Plus" />
              <span className="sr-only">Add Media</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Media</TooltipContent>
        </Tooltip>
        {typing && (
          <div className="absolute bottom-full left-0 text-muted-foreground text-sm bg-[rgba(0,0,0,0.5)] text-zinc-100 py-1 px-2">{typing}</div>
        )}
        <div className="mt-2 px-2 w-full">
          <Textarea
            ref={inputRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            placeholder="Send a message"
            className="min-h-[26px] w-full resize-none bg-transparent focus-within:outline-none"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            name="message"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={!connected}
          />
        </div>
        <div className="absolute right-0 top-[2px] sm:right-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" className='shadow-none text-xl bg-transparent cursor-pointer' onClick={input !== '' ? submitMessage : nudgeContinue}>
                <Icon icon={ input !== '' ? "Send" : "Nudge" } />
                <span className="sr-only">{ input !== '' ? "Send Message" : "Nudge to Continue" }</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{ input !== '' ? "Send Message" : "Nudge to Continue" }</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className={cn("p-[12px] cursor-pointer", mode === "desktop" && "bg-zinc-900")}>
        <Icon icon="Headset" className={cn("size-[18px]", mode === "desktop" && "text-white")} />
      </div>
      </div>
    </form>
  )
}