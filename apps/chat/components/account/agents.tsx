'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { getJWT } from '@/lib/jwt';
// import { ProfileImage } from '@/components/account/profile-image';
import { Button } from '@/components/ui/button';
import { IconDots } from '@/components/ui/icons';
import { deployEndpointUrl } from '@/utils/const/endpoints';
import { isValidUrl } from '@/utils/helpers/urls';
import { useMultiplayerActions } from '@/components/ui/multiplayer-actions';
import { useRouter } from 'next/navigation';

import { SparkLineChart } from '@mui/x-charts/SparkLineChart';

export interface AgentsProps {
  agents: object[];
  userIsCurrentUser: boolean;
}

export interface ActionsProps {
  id: string;
  i: number;
}

export function Agents({ agents: agentsInit, userIsCurrentUser }: AgentsProps) {
  const router = useRouter();
  const [agents, setAgents] = useState(() => agentsInit);
  const [openAgentIndex, setOpenAgentIndex] = useState(-1);

  const { agentJoin } = useMultiplayerActions();

  // Agent row actions
  const RowActions = ({ id, i }: ActionsProps) => {
    return (
      <>
        <div
          className="w-8 text-center flex flex-col px-2 py-1 mb-auto cursor-pointer rounded border bg-primary/10 hover:bg-primary/20 active:bg-primary/30"
          onClick={(e) => {
            setOpenAgentIndex(
              i === openAgentIndex ? -1 : i
            );
          }}
        >
          <IconDots />
        </div>
        {i === openAgentIndex && (
          <div className="absolute flex flex-col top-0 right-10 p-2 rounded border cursor-auto bg-primary/10">
            <Button
              variant="outline"
              className="text-xs mb-1"
              onClick={(e) => {
                setOpenAgentIndex(-1);

                (async () => {
                  await agentJoin(id);
                })();
              }}
            >
              Chat
            </Button>
            <Button
              variant="outline"
              className="text-xs mb-1"
              onClick={(e) => {
                setOpenAgentIndex(-1);

                router.push(`/agents/${id}/logs`);
              }}
            >
              Logs
            </Button>
            <Button
              variant="destructive"
              className="text-xs"
              onClick={(e) => {
                setOpenAgentIndex(-1);

                (async () => {
                  const jwt = await getJWT();
                  const res = await fetch(
                    `${deployEndpointUrl}/agent`,
                    {
                      method: 'DELETE',
                      body: JSON.stringify({
                        guid: id,
                      }),
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${jwt}`,
                      },
                    }
                  );
                  if (res.ok) {
                    await res.blob();

                    setAgents((agents: object[]) => {
                      return agents.filter(
                        (agent: any) =>
                          agent.id !== id
                      );
                    });
                  } else {
                    console.warn(
                      `invalid status code: ${res.status}`
                    );
                  }
                })();
              }}
            >
              Delete
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="m-auto w-full max-w-4xl">
      <div className="w-full m-auto my-4 border rounded-md p border-zinc-700">
        <div className="px-5 py-4">
          <div className="w-full">
            {/* Desktop View */}
            <div className="hidden md:block relative shadow-md sm:rounded-lg">
              <table className="w-full text-sm text-left text-gray-400">
                <thead className="text-xs text-gray-50 uppercase bg-border">
                  <tr>
                    <th scope="col" className="px-6 w-[60px] py-3 text-[rgba(255,255,255,0.6)]">PFP</th>
                    <th scope="col" className="px-2 md:px-6 min-w-40 py-3 text-[rgba(255,255,255,0.6)]">Agent Info</th>
                    <th scope="col" className="px-6 py-3 text-[rgba(255,255,255,0.6)] text-center">Credits Used</th>
                    <th scope="col" className="px-6 py-3 text-[rgba(255,255,255,0.6)]">Chart</th>
                    <th scope="col" className="px-6 py-3 text-[rgba(255,255,255,0.6)] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent: object, i: number) => {
                    const {
                      id,
                      name,
                      description,
                      start_url,
                      preview_url,
                      version,
                      credits_usage,
                    } = agent as any;

                    const sparklineData =
                      credits_usage?.reduce((acc: any, credit: any) => {
                        const amount = credit.amount;
                        if (amount >= 0.1) acc.push(amount);
                        return acc;
                      }, []) || [];

                    const overallCreditsUsed =
                      credits_usage?.reduce(
                        (total: any, credit: any) =>
                          total + credit.amount,
                        0
                      ) || 0;

                    return (
                      <tr
                        className="w-full hover:bg-border text-white bg-[rgba(255,255,255,0.1)] mt-1"
                        key={i}
                      >
                        <td className="px-2 md:px-6 w-[60px] pr-0 py-4 text-md capitalize align-top">
                          <div className="mr-4 mb-4 size-[60px] min-w-12 bg-[rgba(255,255,255,0.1)] rounded-[8px] flex items-center justify-center overflow-hidden">
                            {preview_url && isValidUrl(preview_url) ? (
                              <Image
                                className="flex h-full"
                                width={60}
                                height={60}
                                src={preview_url}
                                alt="Profile picture"
                              />
                            ) : (
                              <div className="uppercase text-lg font-bold">
                                {name.charAt(0)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-2 md:px-6 min-w-40 py-4 text-md capitalize align-top">
                          <a href={`/agents/${id}`} className="block hover:underline">
                            <div className="font-bold line-clamp-1">{name}</div>
                            <div className="w-full line-clamp-1">
                              {description}
                            </div>
                          </a>
                          <div className="mt-1 text-gray-400 font-bold">
                            Version: {version}
                          </div>
                        </td>
                        <td className="px-2 md:px-6 py-4 text-md capitalize text-2xl align-middle text-center">
                          {Math.round(overallCreditsUsed)}
                        </td>
                        <td className="px-2 md:px-6 py-4 text-md capitalize align-top">
                          <SparkLineChart
                            data={sparklineData}
                            colors={['#a855f7']}
                            height={50}
                            width={100}
                          />
                        </td>
                        <td className="relative px-2 md:px-6 py-4 text-md capitalize align-middle text-right">
                          <div className="relative inline-block w-8">
                            {userIsCurrentUser && <RowActions id={id} i={i} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden block space-y-4">
              {agents.map((agent: object, i: number) => {
                const {
                  id,
                  name,
                  description,
                  start_url,
                  preview_url,
                  version,
                  credits_usage,
                } = agent as any;

                const sparklineData =
                  credits_usage?.reduce((acc: any, credit: any) => {
                    const amount = credit.amount;
                    if (amount >= 0.1) acc.push(amount);
                    return acc;
                  }, []) || [];

                const overallCreditsUsed =
                  credits_usage?.reduce(
                    (total: any, credit: any) =>
                      total + credit.amount,
                    0
                  ) || 0;

                return (
                  <div
                    className="bg-[rgba(255,255,255,0.1)] rounded-lg p-4 relative"
                    key={i}
                  >
                    <div className="flex items-center">
                      <div className="flex-1">
                        <div className='flex'>
                          <div className="mr-4 mb-4 size-[48px] min-w-[48px] bg-[rgba(255,255,255,0.1)] rounded-[8px] flex items-center justify-center">
                            {preview_url && isValidUrl(preview_url) ? (
                              <Image
                                className="flex"
                                width={60}
                                height={60}
                                src={preview_url}
                                alt="Profile picture"
                              />
                            ) : (
                              <div className="uppercase text-lg font-bold">
                                {name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="font-bold text-white line-clamp-2">{name}</div>
                          <div className="relative inline-block w-8 ml-2">
                            {userIsCurrentUser && <RowActions id={id} i={i} />}
                          </div>
                        </div>
                        <div className="text-gray-400 line-clamp-1">{description}</div>
                        <div className='flex mt-2'>
                          <div className="mt-1 w-full mr-8 text-2xl font-bold">
                            <div className='text-sm text-gray-400'>Credits used:</div>
                            {Math.round(overallCreditsUsed)}
                          </div>
                          <div className="mt-2 w-full">
                            <SparkLineChart
                              data={sparklineData}
                              colors={['#a855f7']}
                              height={50}
                              width={100}
                            />
                          </div>
                          <div className="mt-2 text-gray-400 text-center font-bold">
                            <div className='text-sm'>Version:</div>
                            {version}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
