'use client';

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { cn, resolveRelativeUrl } from '@/lib/utils'
import { useActions } from '@/components/ui/actions'
import { useMultiplayerActions } from '@/components/ui/multiplayer-actions'
import { createClient } from '@/utils/supabase/client';
import { buttonVariants } from '@/components/ui/button'

import {
  IconClose,
  IconSearch,
  IconPlus,
} from '@/components/ui/icons'

import { lembed } from '@/utils/ai/embedding';
import { getJWT } from '@/lib/getJWT';

async function search(query: string, opts: { signal: AbortSignal; }) {
  const { signal } = opts;

  const jwt = await getJWT();
  if (jwt) {
    const supabase = createClient();
    const embedding = await lembed(query, {
      signal,
    });
    const rpc = supabase.rpc.bind(supabase) as any;

    const result = await rpc('match_assets', {
      embedding,
      match_threshold: 0.2,
      match_count: 10,
    });

    const { error, data } = result;
    if (!error) {
      return data;
    } else {
      throw new Error(JSON.stringify(error));
    }
  } else {
    return [];
  }
}

//

const getAgentName = (guid: string) => `user-agent-${guid}`;
const getAgentHost = (guid: string) => `https://${getAgentName(guid)}.isekaichat.workers.dev`;
const connectAgentWs = (guid: string) =>
  new Promise((accept, reject) => {
    const agentHost = getAgentHost(guid);
    // console.log('got agent host', guidOrDevPathIndex, agentHost);
    const u = `${agentHost.replace(/^http/, 'ws')}/ws`;
    // console.log('handle websocket', u);
    // await pause();
    const ws = new WebSocket(u);
    ws.addEventListener('open', () => {
      accept(ws);
    });
    ws.addEventListener('message', (e) => {
      // const message = e.data;
      // console.log('got ws message', guid, message);
    });
    ws.addEventListener('error', (err) => {
      console.warn('unhandled ws rejection', err);
      reject(err);
    });
    // ws.addEventListener('message', (e) => {
    //   console.log('got ws message', e);
    // });
  });
const joinAgent = async ({
  room,
  guid,
}: {
  room: string;
  guid: string;
}) => {
  // cause the agent to join the room
  const agentHost = getAgentHost(guid);
  // console.log('get agent host', {
  //   guidOrDevPathIndex,
  //   agentHost,
  // });
  const u = `${agentHost}/join`;
  // console.log('join 1', u);
  const headers = {};
  // if (!dev) {
  // const jwt = await getLoginJwt();
  const jwt = localStorage.getItem('jwt');
  (headers as any).Authorization = `Bearer ${jwt}`;
  // }
  const joinReq = await fetch(u, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      room,
    }),
  });
  if (joinReq.ok) {
    const joinJson = await joinReq.json();
    // console.log('join 2', joinJson);

    const ws = await connectAgentWs(guid);
    return ws;
  } else {
    const text = await joinReq.text();
    console.warn(
      'failed to join, status code: ' + joinReq.status + ': ' + text,
    );
  }
};

//

type AgentObject = {
  id: string;
  name: string;
  description: string;
  preview_url: string;
};

function AgentLink(props: any) {
  const { name } = props;
  return (
    <Link href={`/agents/${encodeURIComponent(name)}`} onMouseDown={e => {
      e.preventDefault();
      e.stopPropagation();

      // open the link in the current window
      location.href = e.currentTarget.href;
    }} {...props} />
  )
}

export function SearchBar() {

  const [value, setValue] = React.useState('');
  const [focus, setFocus] = React.useState(false);
  const [results, setResults] = React.useState<AgentObject[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { isSearchOpen, toggleSearch } = useActions();
  const { getRoom } = useMultiplayerActions();

  // focus search
  React.useEffect(() => {
    if (isSearchOpen) {
      inputRef.current?.focus()
    }
  }, [isSearchOpen])

  const user = true;

  // updates
  React.useEffect(() => {
    if (value) {
      const abortController = new AbortController();
      const { signal } = abortController;

      (async () => {
        try {
          const agents = await search(value, {
            signal,
          });
          setResults(agents);
        } catch (err) {
          console.warn(err);
        }
      })();

      return () => {
        abortController.abort('cancelled');
      };
    } else {
      setResults([]);
    }
  }, [value])

  return (
    <div className={cn("flex flex-1 flex-col h-full inset-0 pointer-events-none", isSearchOpen && 'block')} onFocus={e => {
      setFocus(true);
    }} onBlur={e => {
      setFocus(false);
    }} tabIndex={-1}>
      <div className="relative flex flex-col m-auto md:translate-x-[-74px] size-full px-4 py-2 sm:max-w-2xl sm:px-4 pointer-events-auto">
        <div className={cn("absolute px-8 items-center inset-y-0 right-0 flex md:hidden")} onClick={e => {
          toggleSearch();
        }}>
          <IconClose />
        </div>
        <input
          type="text"
          disabled={user ? false : true}
          className={cn("size-full rounded-lg px-2")}
          value={value}
          placeholder={user ? "Find an agent..." : "Login to find an agent..."}
          onChange={e => {
            setValue(e.target.value);
          }}
          ref={inputRef}
        />
        <div className={cn("fixed md:absolute left-0 top-16 px-0 h-[calc(100vh-64px)] md:max-h-[calc(100vh-64px)] md:h-auto md:px-4 w-full sm:max-w-2xl", !focus && 'hidden', !user && "hidden")}>
          <div className="md:rounded-lg border bg-zinc-900 h-full overflow-y-scroll">
            {results.map((agent, i) => (
              <div className={`flex p-4 border-b`} key={i}>
                <AgentLink name={agent.name}>
                  <div className="mr-4 size-20 min-w-12 bg-[rgba(0,0,0,0.1)] overflow-hidden dark:bg-[rgba(255,255,255,0.1)] rounded-[8px] flex items-center justify-center">
                    {agent.preview_url ? (
                      <Image src={resolveRelativeUrl(agent.preview_url)} alt="" className="w-full" width={48} height={48} />
                    ) : (
                      <div className='uppercase text-lg font-bold'>{agent.name.charAt(0)}</div>
                    )}
                  </div>
                </AgentLink>
                <div className="flex flex-col flex-1">
                  <AgentLink name={agent.name} className="text-lg line-clamp-1 font-bold hover:underline">{agent.name}</AgentLink>
                  <div className="text-base line-clamp-2">{agent.description}</div>
                  <div className="hidden md:block text-sm text-zinc-600">{agent.id}</div>
                </div>
                <div className="flex flex-col">
                  <Link href="#" className={cn(buttonVariants({ variant: 'outline' }), "block bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.05)] size-18 p-6 ml-2")} onMouseDown={async e => {
                    e.preventDefault();
                    e.stopPropagation();

                    // console.log('join agent', agent.id);

                    const oldRoom = getRoom();
                    const room = oldRoom || crypto.randomUUID();
                    const guid = agent.id;
                    await joinAgent({
                      room,
                      guid,
                    });
                    setFocus(false);
                    if (!/\/rooms\//.test(location.pathname)) {
                      location.href = `/rooms/${room}`;
                    }
                  }}>
                    <IconPlus className='size-8 opacity-[0.4]' />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
