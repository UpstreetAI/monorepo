'use client';

import React, { useState } from 'react';
import { Agents } from './agents';
import { Voices } from './voices';
import { Profile } from './profile';
import { Credits } from './credits';
import { AccountSubscriptions } from './subscriptions';
import { Monetization } from './monetization';
import { TopUp } from './topup';
import useHash from '@/lib/hooks/use-hash';


export interface TabsProps {
  user: any;
  agents: object[];
  voices: object[];
  creditsUsageHistory: object[] | null;
  userIsCurrentUser: boolean;
  userPrivate: any;
}

export function Tabs({ user, agents: agentsInit, voices: voicesInit, creditsUsageHistory, userIsCurrentUser, userPrivate }: TabsProps) {

  const [ tab, setTab ] = useHash('profile'); // Default to 'profile'
  const [agents, setAgents] = useState(() => agentsInit);
  const [voices, setVoices] = useState(() => voicesInit);

  creditsUsageHistory = creditsUsageHistory ?? [];

  const activeClass = 'text-purple-600 hover:text-purple-600 dark:text-purple-500 dark:hover:text-purple-500 border-purple-600 dark:border-purple-500';
  const inactiveClass = 'hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300 cursor-pointer';

  return (
    <div className='pb-16'>
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700 max-w-4xl w-full">
        <ul className="flex overflow-x-scroll md:overflow-x-auto md:flex-wrap whitespace-nowrap -mb-px text-sm font-medium text-center" role="tablist">
          <li className="me-2" role="presentation">
            <button onClick={() => { setTab('profile'); }} className={`inline-block p-4 border-b-2 rounded-t-lg ${tab === 'profile' ? activeClass : inactiveClass}`}>Profile</button>
          </li>
          <li className="me-2" role="presentation">
            <button onClick={() => { setTab('agents'); }} className={`inline-block p-4 border-b-2 rounded-t-lg ${tab === 'agents' ? activeClass : inactiveClass}`}>Agents</button>
          </li>
          <li>
            <button onClick={() => { setTab('voices'); }} className={`inline-block p-4 border-b-2 rounded-t-lg ${tab === 'voices' ? activeClass : inactiveClass}`}>Voices</button>
          </li>
          <li className="me-2" role="presentation">
            <button onClick={() => { setTab('credits'); }} className={`inline-block p-4 border-b-2 rounded-t-lg ${tab === 'credits' ? activeClass : inactiveClass}`}>Credits</button>
          </li>
          <li>
            <button onClick={() => { setTab('subscriptions'); }} className={`inline-block p-4 border-b-2 rounded-t-lg ${tab === 'subscriptions' ? activeClass : inactiveClass}`}>Subscription</button>
          </li>
          <li>
            <button onClick={() => { setTab('monetization'); }} className={`inline-block p-4 border-b-2 rounded-t-lg ${tab === 'monetization' ? activeClass : inactiveClass}`}>Monetization</button>
          </li>
          <li>
            <button onClick={() => { setTab('top-up'); }} className={`inline-block p-4 border-b-2 rounded-t-lg ${tab === 'top-up' ? activeClass : inactiveClass}`}>Top Up</button>
          </li>
        </ul>
      </div>
      <div className='w-full md:w-4xl max-w-4xl'>
        <div className={tab === 'profile' ? 'block w-full' : 'hidden'}>
          <Profile user={user} userIsCurrentUser={userIsCurrentUser} />
        </div>
        <div className={tab === 'agents' ? 'block w-full' : 'hidden'}>
          <Agents agents={agents} userIsCurrentUser={userIsCurrentUser} />
        </div>
        <div className={tab === 'voices' ? 'block w-full' : 'hidden'}>
          <Voices voices={voices} userIsCurrentUser={userIsCurrentUser} />
        </div>
        <div className={tab === 'credits' ? 'block w-full' : 'hidden'}>
          <Credits creditsUsageHistory={creditsUsageHistory} />
        </div>
        <div className={tab === 'subscriptions' ? 'block w-full' : 'hidden'}>
          <AccountSubscriptions user={user} userPrivate={userPrivate} />
        </div>
        <div className={tab === 'monetization' ? 'block w-full' : 'hidden'}>
          <Monetization userPrivate={userPrivate} />
        </div>
        <div className={tab === 'top-up' ? 'block w-full' : 'hidden'}>
          <TopUp/>
        </div>
      </div>
    </div>
  );
}
