'use client';

import React, { useEffect, useState } from 'react';
import { AgentList } from './AgentList';
import { useSupabase } from '@/lib/hooks/use-supabase';
import { Button } from 'ucom';

export interface Agent {
  id: number;
  name: string;
}

export interface AgentsProps {
  loadmore: boolean;
  search: boolean;
  range: number;
  row: boolean;
}

export interface UserAgentsProps {
  loadmore: boolean;
  search: boolean;
  range: number;
  row: boolean;
  agents: Agent[];
  user: any;
}

export function Agents({ loadmore = false, search = true, range = 5, row = false }: AgentsProps) {
  const { supabase } = useSupabase();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeFrom, setRangeFrom] = useState(0);
  const [rangeTo, setRangeTo] = useState(range);
  const [showLoadMore, setShowLoadMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  const fetchData = async (
    reset = false,
    customRangeFrom = rangeFrom,
    customRangeTo = rangeTo
  ) => {

    if (searchTerm !== '') {
      setLoading(true);
    }

    const { data, error } = await supabase
      .from('assets')
      .select('*, author: accounts ( id, name )')
      .eq('origin', 'sdk')
      .ilike('name', `%${debouncedSearchTerm}%`)
      .range(customRangeFrom, customRangeTo - 1)
      .order('created_at', { ascending: false });

    if (!error) {
      if (reset) {
        setAgents(data);
      } else {
        setAgents((prevAgents) => [...prevAgents, ...data]);
      }

      if (data.length < range) {
        setShowLoadMore(false);
      } else {
        setShowLoadMore(true);
      }

      setLoading(false);
      setLoadingMore(false);
    } else {
      console.error(error);
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  useEffect(() => {
    setRangeFrom(0);
    setRangeTo(range);
    fetchData(true, 0, range);
  }, [debouncedSearchTerm]);

  const handleLoadMore = () => {
    const newRangeFrom = rangeTo;
    const newRangeTo = rangeTo + range;

    setRangeFrom(newRangeFrom);
    setRangeTo(newRangeTo);

    setLoadingMore(true);
    fetchData(false, newRangeFrom, newRangeTo);
  };

  const handleAgentDelete = (deletedAgentId: number) => {
    setAgents(agents => agents.filter(agent => agent.id !== deletedAgentId));
  };

  return (
    <>
      {search && (
        <div className='flex mt-4'>
          <h1 className="text-2xl font-extrabold text-[#90A0B2] pb-2 border-b mb-8 w-full">
            Agents <span className="text-zinc-950 ml-3">{agents.length}{showLoadMore && "+"}</span>
            <div className='float-right'>
              <input
              type='text'
              placeholder='Search agents...'
              value={searchTerm}
              className='w-60 -mt-2 px-4 py-2 bg-[#E4E8EF] border-2 border-[#475461] text-gray-900 text-sm'
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
            />
            </div>
          </h1>
        </div>
      )}

      <div className={`grid ${row ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-4`}>
        <AgentList agents={agents} loading={loading} range={range} user={null} onAgentDelete={handleAgentDelete}/>
      </div>
      {loadmore && (
        <div className='text-center pt-8'>
          {agents.length > 0 && showLoadMore && (
            <Button
              size='large'
              onClick={handleLoadMore}
            >
              {loadingMore ? 'Loading agents...' : 'Load More'}
            </Button>
          )}
        </div>
      )}
    </>
  );
}

export function UserAgents({ agents = [], user, range = 5, row = false }: UserAgentsProps) {
  const [userAgents, setUserAgents] = useState<Agent[]>(agents);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleUserAgentDelete = (deletedAgentId: number) => {
    setUserAgents(userAgents => userAgents.filter(agent => agent.id !== deletedAgentId));
  };

  return (
    <>
      <div className={`grid ${row ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4`}>
        <AgentList agents={userAgents} loading={loading} range={range} user={user} onAgentDelete={handleUserAgentDelete} />
      </div>
    </>
  );
}
