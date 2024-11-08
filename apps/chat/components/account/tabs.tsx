'use client';

import React, { useState } from 'react';
import { Voices } from './voices';
import { Profile } from './profile';
import { CreditsUsageHistory } from './credits-usage-history';
import { AccountSubscriptions } from './subscriptions';
import { Monetization } from './monetization';
import useHash from '@/lib/hooks/use-hash';
import HeaderMaskFrame from '../masks/HeaderMaskFrame';
import { isValidUrl } from '@/lib/utils';
import { IconButton } from 'ucom';
import Dev from '../development';
import { logout } from '@/lib/logout';
import { UserAgents } from '../agents/list';
import { Credits } from '../credits';
import { AgentProvider } from '@/contexts/AgentContext';

export interface TabsProps {
  user: any;
  agents: any;
  voices: object[];
  creditsUsageHistory: object[] | null;
  userIsCurrentUser: boolean;
  userPrivate: any;
}

export function Tabs({ user, agents: agentsInit, voices: voicesInit, creditsUsageHistory, userIsCurrentUser, userPrivate }: TabsProps) {

  const [tab, setTab] = useHash('profile'); // Default to 'profile'
  const [agents, setAgents] = useState(() => agentsInit);
  const [voices, setVoices] = useState(() => voicesInit);

  creditsUsageHistory = creditsUsageHistory ?? [];

  const origin = window.location.origin;
  const accountUrl = `${origin}/accounts/${user.id}`;
  const randomAgentImage = agents[Math.floor(Math.random() * agents.length)]?.images[0].url;

  return (
    <AgentProvider>
      <div className='w-full'>
        <HeaderMaskFrame background={randomAgentImage} wrapperClass="bg-blue-500" backgroundOpacity={0.2}>
          <div className='absolute z-[100] left-8 top-8'>
            <IconButton href={"/"} icon={'BackArrow'} />
          </div>
          <div className="w-full max-w-6xl mx-auto h-60 pt-28 relative px-4">
            <div className="flex">
              <div className="mr-4 size-18 min-w-18 md:size-[150px] md:min-w-[150px] bg-gray-100 p-4 overflow-hidden flex items-center justify-center border-2 border-gray-900">
                <div
                  className="w-full h-full bg-cover bg-top"
                  style={{
                    backgroundImage: isValidUrl(user.preview_url) ? `url(${user.preview_url})` : 'none',
                    backgroundColor: isValidUrl(user.preview_url) ? 'transparent' : '#ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: '#fff',
                  }}
                >
                  {!isValidUrl(user.preview_url) && user.name.charAt(0)}
                </div>
              </div>
              <div className='w-full'>
                <div className='flex items-center relative w-full mb-1'>
                  <h2 className="text-lg md:text-4xl uppercase text-stroke font-bold">{user.name}</h2>
                  <IconButton
                    onClick={logout}
                    variant='ghost'
                    icon="Logout"
                    target={'_blank'}
                    className='ml-4'
                  />
                  <div className='absolute right-0'>
                    <Credits user={user} />
                  </div>
                </div>
                <div className="px-2 py-1 bg-black bg-opacity-60 inline-block">{accountUrl}</div>
                <div className='flex gap-4 mt-4'>
                  <IconButton
                    onClick={() => { setTab('profile'); }}
                    icon="Head"
                    label="Account"
                    active={tab === 'profile'}
                    target={undefined}
                    size="large"
                  />
                  <IconButton
                    onClick={() => { setTab('agents'); }}
                    icon="Users"
                    label="Agents"
                    active={tab === 'agents'}
                    target={undefined}
                    size="large"
                  />
                  <IconButton
                    onClick={() => { setTab('credits'); }}
                    icon="Credits"
                    label="Credits"
                    active={tab === 'credits'}
                    target={undefined}
                    size="large"
                  />
                  <IconButton
                    onClick={() => { setTab('subscriptions'); }}
                    icon="Subscriptions"
                    label="Subscription"
                    active={tab === 'subscriptions'}
                    target={undefined}
                    size="large"
                  />
                  <Dev>
                    <IconButton
                      onClick={() => { setTab('voices'); }}
                      icon="Voices"
                      label="Voices"
                      active={tab === 'voices'}
                      target={undefined}
                      size="large"
                    />
                    <IconButton
                      onClick={() => { setTab('monetization'); }}
                      icon="Payments"
                      label="Monetization"
                      active={tab === 'monetization'}
                      target={undefined}
                      size="large"
                    />
                  </Dev>
                </div>
              </div>
            </div>
          </div>
        </HeaderMaskFrame>
        <div className='w-full md:w-4xl max-w-6xl px-4 mx-auto mt-14'>
          <div className={tab === 'profile' ? 'block w-full' : 'hidden'}>
            <h1 className="text-2xl font-extrabold text-[#90A0B2] pb-2 border-b">
              Account Information
            </h1>
            <Profile user={user} userIsCurrentUser={userIsCurrentUser} />
          </div>
          <div className={tab === 'agents' ? 'block w-full' : 'hidden'}>
            <h1 className="text-2xl font-extrabold text-[#90A0B2] pb-2 border-b mb-8">
              My Agents <span className="text-gray-700">{agents.length}</span>
            </h1>
            <UserAgents userAgents={agents} loadmore={false} search range={12} row={false} user={user} />
          </div>
          <div className={tab === 'voices' ? 'block w-full' : 'hidden'}>
            <Voices voices={voices} userIsCurrentUser={userIsCurrentUser} />
          </div>
          <div className={tab === 'credits' ? 'block w-full' : 'hidden'}>
            <h1 className="text-2xl font-extrabold text-[#90A0B2] pb-2 border-b mb-8">
              Credits Expanditure
            </h1>
            <CreditsUsageHistory creditsUsageHistory={creditsUsageHistory} agents={agents} />
          </div>
          <div className={tab === 'subscriptions' ? 'block w-full' : 'hidden'}>
            <h1 className="text-2xl font-extrabold text-[#90A0B2] pb-2 border-b">
              Manage Subscriptions
            </h1>
            <AccountSubscriptions user={user} userPrivate={userPrivate} />
          </div>
          <div className={tab === 'monetization' ? 'block w-full' : 'hidden'}>
            <Monetization userPrivate={userPrivate} />
          </div>
        </div>
      </div>
    </AgentProvider>
  );
}
