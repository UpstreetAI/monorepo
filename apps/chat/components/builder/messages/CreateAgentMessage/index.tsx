import React from 'react'
import { ComponentList } from '@/components/builder/messages/CreateAgentMessage/ComponentList'
import { IconUpstreet } from '@/components/ui/icons'
import type { Message } from '@/types'


export type CreateAgentMessageProps = {
  message: Message<{
    args: {
      name: string
    }
  }>
}


export function CreateAgentMessage({ message }: CreateAgentMessageProps) {
  return (
    <div className="flex flex-row rounded-md bg-gray-600 p-2">
      <IconUpstreet className="mr-2 mt-1"/>
      <div>
        <span className="font-bold mb-3">Creating agent...</span>
      </div>
    </div>
  )
}
