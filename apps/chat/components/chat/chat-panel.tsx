import * as React from 'react';
// import { type KeyboardEvent } from 'react';

// import { shareChat } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { PromptForm } from '@/components/prompt-form';
import { DirectMessages } from '@/components/direct-message-form';
import { ButtonScrollToBottom } from '@/components/button-scroll-to-bottom';
import { IconShare } from '@/components/ui/icons';
// import { FooterText } from '@/components/footer';
import { useSidebar } from '@/lib/client/hooks/use-sidebar';

export interface ChatPanelProps {
  // id?: string
  title?: string
  input: string
  setInput: (value: string) => void
  isAtBottom: boolean
  scrollToBottom: () => void
  room?: string
  desktop?: boolean
  messages: Array<{ id: string; display: React.ReactNode }>
  // sendChatMessage: (message: string) => void
}

export function ChatPanel({
  // id,
  title,
  input,
  setInput,
  isAtBottom,
  scrollToBottom,
  room,
  desktop,
  messages,
  // sendChatMessage,
}: ChatPanelProps) {
  // const [aiState] = useAIState()
  // const [messages, setMessages] = useUIState<typeof AI>()
  // const { submitUserMessage } = useActions()
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false)

  // function joinRoom() {
  //   location.href = `/rooms/${crypto.randomUUID()}`;
  // }

  /*const exampleMessages = [
    {
      heading: 'Hi there!',
      subheading: 'What is your name?',
      message: `Hi there! What is your name?`
    },
    {
      heading: 'Can you help me',
      subheading: `find some friends?`,
      message: `Can you help me find some friends?`
    }
  ]*/

  const { isLeftSidebarOpen, isRightSidebarOpen } = useSidebar();

  return (
    <div className={`absolute inset-x-0 bottom-0 w-full duration-300 ease-in-out animate-in ${isLeftSidebarOpen ? "lg:pl-[250px] xl:pl-[300px]" : ""} ${isRightSidebarOpen ? "lg:pr-[250px] xl:pr-[300px]" : ""}`}>
      
      <ButtonScrollToBottom
        isAtBottom={isAtBottom}
        scrollToBottom={scrollToBottom}
      />

      <div className="relative mx-auto border-t bg-gray-300 sm:px-4">
        {room && (<>
          {/*<div className="mb-4 grid grid-cols-2 gap-2 px-4 sm:px-0">
            {messages.length === 0 &&
              exampleMessages.map((example, index) => (
                <div
                  key={example.heading}
                  className={`cursor-pointer rounded-lg border bg-white p-4 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 ${
                    index > 1 && 'hidden md:block'
                  }`}
                  onClick={async () => {
                    sendChatMessage(example.message);

                    // setMessages(currentMessages => [
                    //   ...currentMessages,
                    //   {
                    //     id: nanoid(),
                    //     display: <UserMessage>{example.message}</UserMessage>
                    //   }
                    // ])

                    // const responseMessage = await submitUserMessage(
                    //   example.message
                    // )

                    // setMessages(currentMessages => [
                    //   ...currentMessages,
                    //   responseMessage
                    // ])
                  }}
                >
                  <div className="text-sm font-semibold">{example.heading}</div>
                  <div className="text-sm text-zinc-600">
                    {example.subheading}
                  </div>
                </div>
              ))}
          </div>*/}

          {/* messages?.length >= 2 ? (
            <div className="flex h-12 items-center justify-center">
              <div className="flex space-x-2">
                {title ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShareDialogOpen(true)}
                    >
                      <IconShare className="mr-2" />
                      Share
                    </Button>
                    {/*<ChatShareDialog
                      open={shareDialogOpen}
                      onOpenChange={setShareDialogOpen}
                      onCopy={() => setShareDialogOpen(false)}
                      shareChat={shareChat}
                      chat={{
                        id,
                        title,
                        messages: aiState.messages
                      }}
                    />}
                  </>
                ) : null}
              </div>
            </div>
          ) : null */}

          <div className="space-y-4 px-4 py-2 sm:max-w-2xl mx-auto md:py-3 relative">
            <PromptForm
              input={input}
              setInput={setInput}
              desktop={desktop}
            />
            {/* <FooterText className="hidden sm:block" /> */}
          </div>

          <DirectMessages />
        </>)}
      </div>
    </div>
  );
}
