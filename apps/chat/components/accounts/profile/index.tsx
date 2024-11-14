'use client';

import { isValidUrl } from '@/lib/utils';
import { AgentRow } from '@/components/agents/list/AgentRow';
import HeaderMaskFrame from '@/components/masks/HeaderMaskFrame';

interface AgentImage {
  url: string;
}

interface Agent {
  id: number;
  name: string;
  images: AgentImage[];
}

interface Account {
  images: AgentImage[];
  name: string;
  id: string;
  preview_url: string;
  agents: Agent[];
}

interface AccountProps {
  account: Account;
}

export function AccountProfile({ account }: AccountProps) {
  const origin = window.location.origin;
  const agentUrl = `${origin}/accounts/${account.id}`;
  const randomAgentImage = account.agents[Math.floor(Math.random() * account.agents.length)]?.images[0].url;

  const onDelete = (agentId: number) => {
    account.agents = account.agents.filter((agent) => agent.id !== agentId);
  };

  return (
    <div className="w-full mx-auto">
      <HeaderMaskFrame background={randomAgentImage} wrapperClass="bg-blue-500" backgroundOpacity={0.2}>
        <div className="w-full max-w-6xl mx-auto h-60 pt-28 relative px-4">
          <div className="flex">
            <div className="mr-4 size-20 min-w-20 md:size-40 md:min-w-40 bg-gray-100 p-4 overflow-hidden flex items-center justify-center border-2 border-gray-900">
              <div
                className="w-full h-full bg-cover bg-top"
                style={{
                  backgroundImage: isValidUrl(account.preview_url) ? `url(${account.preview_url})` : 'none',
                  backgroundColor: isValidUrl(account.preview_url) ? 'transparent' : '#ccc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: '#fff',
                }}
              >
                {!isValidUrl(account.preview_url) && account.name.charAt(0)}
              </div>
            </div>
            <div>
              <h2 className="text-lg md:text-4xl uppercase text-stroke font-bold">{account.name}</h2>
              <div className="px-2 py-1 bg-black bg-opacity-60">{agentUrl}</div>
            </div>
          </div>
        </div>
      </HeaderMaskFrame>
      <div className="w-full max-w-6xl mx-auto relative px-4 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-8">
          {account.agents.map((agent) => (
            <AgentRow key={agent.id} agent={agent} author={account.name} user={null} onDelete={onDelete}/>
          ))}
        </div>
      </div>
    </div>
  );
}
