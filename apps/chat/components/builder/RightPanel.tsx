'use client'

import * as React from 'react'
import { Output } from '@/components/builder/Output'
import { Chat } from '@/components/chat/new/chat'


export type RightPanelProps = {
  agent: any
  user: any
}


const
  Tab = 'border-b-4 border-b-gray-800 py-2 px-3',
  ActiveTab = `bg-gray-700 border-b-4 border-b-gray-600 py-2 px-3`


const deployedAgentMessages = [
  {

  }
]


export function RightPanel({
  agent,
  user,
}: RightPanelProps ) {
  const deployedAgentRoomName = crypto.randomUUID()

  return (
    <div className={'flex flex-col'}>
      <div className="flex flex-row">
        <div className={Tab}>Agent</div>
        <div className={Tab}>Components</div>
        <div className={ActiveTab}>Code</div>
      </div>
      <Output/>
      {/*{agent && <Chat user={user} room={deployedAgentRoomName} messages={deployedAgentMessages}/>}*/}
    </div>
  )
}
