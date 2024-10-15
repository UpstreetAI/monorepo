'use client'

import * as React from 'react'
import Textarea from 'react-textarea-autosize'

import { Button } from '@/components/ui/button'
import { IconPlus, IconImage, IconDocument, IconAudio, IconCapture, IconTriangleDown, IconTriangleSmallDown, IconUpstreet } from '@/components/ui/icons'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useMultiplayerActions } from '@/components/ui/multiplayer-actions'
import { cn } from '@/lib/utils'
import type { PlayableAudioStream } from 'react-agents/types';
import { shuffle } from 'react-agents/util/util.mjs';
import { Icon } from 'ucom';
import { createPcmF32MicrophoneSource } from '@upstreet/multiplayer/public/audio/audio-client.mjs';
import { ensureAudioContext } from '@/lib/audio/audio-context-output';
// import { consoleImageWidth } from 'react-agents/constants.mjs'

export function PromptForm({
  input,
  setInput
}: {
  input: string
  setInput: (value: string) => void
}) {
  const [mediaPickerOpen, setMediaPickerOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const { connected, playersMap, typingMap, sendNudgeMessage, sendChatMessage, sendMediaMessage, addAudioSource, removeAudioSource } = useMultiplayerActions()
  const [typing, setTyping] = React.useState('');
  const [microphoneSource, setMicrophoneSource] = React.useState<any>(null);

  React.useEffect(() => {
    // typing
    if (typingMap) {
      // console.log('bind typing map' + typingMap);
      const typingchange = (e: any) => {
        // console.log('typingchange 1', e);

        const tm = typingMap.getMap();
        const specs = Array.from(tm.values()).filter((spec) => spec.typing);
        if (specs.length > 0) {
          const s = specs.map((spec) => spec.name).join(', ');
          setTyping(`${s} ${specs.length > 1 ? 'are' : 'is'} typing...`);
        } else {
          setTyping('');
        }

        // console.log('typingchange 2', specs);
      };
      typingMap.addEventListener('typingchange', typingchange);
      return () => {
        typingMap.removeEventListener('typingchange', typingchange);
      };
    }
  }, [typingMap]);

  // can continue if there is a non-human agent who is not typing
  const botAgents = Array.from(playersMap.values())
    .map((player) => player.playerSpec)
    .filter((playerSpec) => !playerSpec.capabilities?.includes('human'));
  const nonTypingBotAgents = botAgents.filter((player) => !typingMap.getMap().get(player.id)?.typing);
  const canContinue = nonTypingBotAgents.length > 0;

  const toggleMediaPicker = () => {
    setMediaPickerOpen(open => !open)
  };

  const submitMessage = () => {
    const value = input.trim();
    setInput('');
    if (value) {
      // setMessages(currentMessages => [...currentMessages, responseMessage])
      console.log('submit chat message', value);
      sendChatMessage(value);
    } else if (canContinue) {
      nudgeContinue();
    }
  };
  const nudgeContinue = () => {
    const randomBotAgent = shuffle(botAgents.slice())[0];
    sendNudgeMessage(randomBotAgent.id);
  };

  const onKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      // formRef.current?.requestSubmit()
      event.preventDefault();
  
      // Blur focus on mobile
      if (window.innerWidth < 600) {
        const target = event.target as HTMLTextAreaElement;
        target.blur();
      }
  
      submitMessage();
    }
  };

  return (
    <form
      // ref={formRef}
      onSubmit={async (e: any) => {
        e.preventDefault()
        // submitMessage()
      }}
    >
      <div className="relative flex max-h-60 w-full grow flex-col px-8 bg-slate-100 sm:border sm:px-12">
        {/* // XXX abstract this out to a component */}
        {mediaPickerOpen && (
          <div className="absolute left-0 bottom-16 py-2 flex flex-col border rounded">
            <div className="mx-4 my-2 text-xs text-muted-foreground">Add media...</div>
            <Button
              variant="secondary"
              className="flex justify-start relative rounded bg-background mx-2 p-2 overflow-hidden"
            >
              <input className="absolute -top-12 bottom-0 -left-12 right-0 cursor-pointer" type="file" onChange={e => {
                const files: File[] = Array.from((e.target as any).files);
                const file = files[0];
                // console.log('image file', file.type, file);
                sendMediaMessage(file);

                toggleMediaPicker();
                (e.target as any).value = null;
              }} />
              <IconImage className="mr-2" />
              <div>Image</div>
            </Button>
            {/* <Button
              variant="secondary"
              className="flex justify-start relative rounded bg-background mx-2 p-2 overflow-hidden"
              onClick={() => {
                console.log('click document');
              }}
            >
              <IconDocument className="mr-2" />
              <div>Document</div>
            </Button> */}
            <Button
              variant="secondary"
              className={cn("flex justify-start relative rounded bg-background mx-2 p-2 overflow-hidden")}
              onClick={async () => {
                if (!microphoneSource) {
                  // console.log('click audio');
                  const audioContext = await ensureAudioContext();

                  // list the available mics
                  const devices = await navigator.mediaDevices.enumerateDevices();
                  // console.log('got devices', devices);
                  const audioInputDevices = devices.filter((device) => device.kind === 'audioinput');
                  const micAudioInputDevices = audioInputDevices.filter((device) => /mic/i.test(device.label));
                  const otherAudioInputDevices = audioInputDevices.filter((device) => !/mic/i.test(device.label));
                  const audioInputDevice = micAudioInputDevices[0] || otherAudioInputDevices[0] || null;
                  if (audioInputDevice) {
                    const mediaStream = await navigator.mediaDevices.getUserMedia({
                      audio: {
                        deviceId: audioInputDevice.deviceId,
                      },
                    });
                    // console.log('got media stream', mediaStream);
                    const microphoneSource = createPcmF32MicrophoneSource({
                      mediaStream,
                      audioContext,
                    });
                    setMicrophoneSource(microphoneSource);

                    const audioStream = new ReadableStream({
                      start(controller) {
                        microphoneSource.output.addEventListener('data', (e: any) => {
                          controller.enqueue(e.data);
                        });
                        microphoneSource.output.addEventListener('end', (e: any) => {
                          controller.close();
                        });
                      },
                    }) as PlayableAudioStream;
                    audioStream.id = crypto.randomUUID();
                    audioStream.type = 'audio/pcm-f32-48000';
                    audioStream.disposition = 'text';
          
                    (async () => {
                      console.log('start streaming');
                      const {
                        waitForFinish,
                      } = addAudioSource(audioStream);
                      await waitForFinish();
                      removeAudioSource(audioStream);
                    })();
                  } else {
                    console.warn('no audio input device found');
                  }
                } else {
                  microphoneSource.close();
                  setMicrophoneSource(null);
                }
              }}
            >
              <IconAudio className="mr-2" />
              <div>Audio</div>
            </Button>
            {/* <Button
              variant="secondary"
              className="flex justify-start relative rounded bg-background mx-2 p-2 overflow-hidden"
              onClick={() => {
                console.log('click capture');
              }}
            >
              <IconCapture className="mr-2" />
              <div>Capture</div>
            </Button> */}
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(`absolute left-0 md:left-4 top-[14px] size-8 rounded-full p-0`, mediaPickerOpen && `bg-slate-900 text-slate-100`)}
              onClick={() => {
                toggleMediaPicker();
              }}
            >
              <Icon icon='Plus' />
              <span className="sr-only">Add Media</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Media</TooltipContent>
        </Tooltip>
        {typing && (
          <div className="absolute -top-12 text-slate-900 left-0 text-muted-foreground text-sm">{typing}</div>
        )}
        {canContinue && (
          <div
            className="absolute -top-12 right-7 text-sm cursor-pointer animate-[blink_1s_steps(1)_infinite]"
            onClick={e => {
              nudgeContinue();
            }}
          >
            <IconTriangleSmallDown />
          </div>
        )}
        <Textarea
          ref={inputRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          placeholder="Send a message"
          className="min-h-[60px] w-full resize-none bg-transparent px-4 pl-4 py-[1.3rem] focus-within:outline-none sm:text-sm"
          // autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          name="message"
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={!connected}
        />
        <div className="absolute right-0 top-[13px] sm:right-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="submit" size="icon" className='shadow-none text-xl bg-transparent' disabled={input === ''}>
                <Icon icon="Send" />
                <span className="sr-only">Send message</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send message</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </form>
  )
}