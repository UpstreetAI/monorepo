'use client';

import React, { useState } from 'react';
import { isValidUrl } from "@/utils/helpers/urls";
import { AgentJoin } from "@/components/cta";
import { AgentDelete } from "@/components/cta/AgentDelete";
import { getJWT } from '@/lib/jwt';
import { deployEndpointUrl } from '@/utils/const/endpoints';
import { DeleteAgentDialog } from '@/components/delete-agent-dialog';

export interface AgentListProps {
  agent: any
  user: any
  author: string
  onDelete: (agentId: number) => void;
}

export function AgentRow({ agent, user, author, onDelete }: AgentListProps) {
  const [open, setOpen] = useState(false);

  const updateOpenState = () => {
    setOpen(!open);
  }

  const deleteAgent = async () => {
    try {
      const jwt = await getJWT();
      const res = await fetch(`${deployEndpointUrl}/agent`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ guid: agent.id }),
      });

      if (!res.ok) {
        console.warn(`Invalid status code: ${res.status}`);
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  }
  const handleDelete = async () => {
    updateOpenState();
    await deleteAgent();
    onDelete(agent.id);
  };

  const handleDeleteClick = () => {
    updateOpenState();
  }

  return (
    <div className="bg-gray-100 border p-4 text-black">
      <div className="flex">
        <div className="mr-4 size-[120px] min-w-[120px] md:size-[160px] md:min-w-[160px] flex items-center justify-center">
          <div
            className="w-full h-full bg-cover bg-top"
            style={{
              backgroundImage: isValidUrl(agent.preview_url)
                ? `url(${agent.preview_url})`
                : 'none',
              backgroundColor: isValidUrl(agent.preview_url) ? 'transparent' : '#ccc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#fff',
            }}
          >
            {!isValidUrl(agent.preview_url) && agent.name.charAt(0)}
          </div>
        </div>
        <div className="min-w-40 text-md capitalize w-full relative">
          <a href={`/agents/${agent.id}`} className="block hover:underline">
            <div className="font-bold text-lg line-clamp-1 uppercase">{agent.name}</div>
            <div className="font-italic text-sm">Created by: <span className="font-bold underline">{user ? `You` : `@${author}`}</span></div>
            <div className="line-clamp-2">{agent.description}</div>
          </a>
          <div className="flex absolute bottom-0 right-0">
            <AgentJoin agent={agent} />
          </div>

          {user && (
            <div className="flex absolute top-0 right-0">
              <DeleteAgentDialog agent={agent} onDelete={handleDelete} open={open} onCancel={() => setOpen(false)}>
                <AgentDelete handleClick={handleDeleteClick} />
              </DeleteAgentDialog>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SkeletonAgentRow() {
  return (
    <div className="bg-gray-100 border p-4 text-black">
      <div className="flex">
        <div className="mr-4 size-[160px] min-w-[160px] flex items-center justify-center bg-cover">
          <div className="h-full w-full bg-gray-300"></div>
        </div>
        <div className="min-w-40 text-md capitalize w-full relative">
          <div className="bg-gray-300 rounded h-6 mb-4 w-3/4"></div>
          <div className="bg-gray-300 rounded h-4 mb-2 w-full"></div>
          <div className="bg-gray-300 rounded h-4 mb-2 w-full"></div>
          <div className="bg-gray-300 rounded h-4 mb-2 w-full"></div>
          <div className="text-center ml-6 absolute bottom-0 right-0">
            <div className="bg-gray-300 rounded h-3 w-10" />
          </div>
        </div>
      </div>
    </div>
  );
}