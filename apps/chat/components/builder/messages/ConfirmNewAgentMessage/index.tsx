import { Button } from '@/components/ui/button'
import { IconMessage, IconOpenAI, IconUpstreet, IconUser } from '@/components/ui/icons'
import type { Component, Message } from '@/types'
import React from 'react'
import { ComponentList } from '@/components/builder/messages/CreateAgentMessage/ComponentList'


export type ConfirmNewAgentMessageProps = {
  message: Message<{
    args: {
      components: Component[]
    }
  }>
}

export function ConfirmNewAgentMessage({ message }: ConfirmNewAgentMessageProps) {
  return (
    <>
      <div className="bg-gray-600 mb-3 p-3 rounded-lg">
        <div className="flex items-center  font-bold mb-1">
          <IconUpstreet className="mr-2"/>
          Homework Helper
        </div>
        <div className="mb-2">
          Create an agent with the following components?
        </div>
        <ComponentList components={message.args.components}/>
      </div>

      {/* Actions */}
      <div className="flex flex-row gap-2 justify-center">
        <button className="flex-[0.3] p-2 ghost bg-gray-600">Regenerate</button>
        {/*<button className="flex-[0.3] p-2 bg-red-400">Cancel</button>*/}
        <button className="flex-1 p-2 bg-gray-200 text-gray-800 w-full">Confirm</button>
      </div>
    </>
  )
}
