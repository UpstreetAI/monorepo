import { RightPanel } from '@/components/builder/RightPanel'
import * as React from 'react'
import { Output } from '@/components/builder/Output'
import { Chat } from '@/components/chat/new/chat'
import { getUser } from '@/utils/supabase/server'
// import { Chat } from '@/components/chat/chat'
// import { AI } from '@/lib/chat/actions'
// import { nanoid } from '@/lib/utils'
// import { getMissingKeys } from '@/app/actions'
// import { getUser } from '@/utils/supabase/server'



const
  Main = '',
  BuilderAgent = '',
  DeployedAgent = ''

const userID = crypto.randomUUID()
const builderAgentID = crypto.randomUUID()

const builderMessages = [
  {
    userId: userID,
    name: 'User',
    method: 'say',
    timestamp: Date.now(),

    args: {
      text: 'Please make a bot that can help me with my math homework.'
    }
  },
  {
    userId: builderAgentID,
    name: 'Builder',
    method: 'say',
    timestamp: Date.now(),

    args: {
      text: 'You got it!'
    },
  },
  /*{
    userId: builderAgentID,
    name: 'Builder',
    method: 'creatingAgent',
    timestamp: Date.now(),

    args: {
      name: 'Homework Helper'
    },
  },*/
  {
    userId: builderAgentID,
    name: 'Builder',
    method: 'confirmCreatedAgent',
    timestamp: Date.now(),

    args: {
      components: [
        {
          name: 'Input',
          id: crypto.randomUUID,
          components: [
            {
              name: 'Text',
              id: crypto.randomUUID,
              enabled: true,
            },
            {
              name: 'Images',
              id: crypto.randomUUID,
              enabled: true,
            },
            {
              name: 'Audio',
              id: crypto.randomUUID,
              enabled: true,
            },
            {
              name: 'Videos',
              id: crypto.randomUUID,
              enabled: false,
            }
          ]
        },
        {
          name: 'Actions',
          id: crypto.randomUUID,
          components: [
            {
              name: 'Example Action A',
              id: crypto.randomUUID,
              enabled: true,
            },
            {
              name: 'Example Action B',
              id: crypto.randomUUID,
              enabled: false,
            },
          ]
        },
        {
          name: 'Outputs',
          id: crypto.randomUUID,
          components: [
            {
              name: 'Text',
              id: crypto.randomUUID,
              enabled: true,
            },
            {
              name: 'Images',
              id: crypto.randomUUID,
              enabled: true,
            },
            {
              name: 'Audio',
              id: crypto.randomUUID,
              enabled: false,
            },
          ]
        }
      ]
    }
  }
]


export default async function IndexPage() {
  const builderRoomName = crypto.randomUUID()
  const user = await getUser()
  const agent = {}

  return (
    <div className={'grid grid-cols-2 w-full'}>

      {/* BuilderAgent */}
      <div className={'bg-gray-800'}>
        <Chat user={user} room={builderRoomName} messages={builderMessages}/>
      </div>

      <RightPanel agent={agent} user={user} />
    </div>
  )
}
