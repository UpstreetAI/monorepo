'use client';

import { AgentRow, SkeletonAgentRow } from "./AgentRow";

export interface AgentListProps {
  agents: object[]
  loading: boolean
  range: number
  user: any
}

export function AgentList({ agents, loading, range, user }: AgentListProps) {

  if (loading) return (
    <>
      {Array.from({ length: range }).map((_, index) => (
        <SkeletonAgentRow key={index} />
      ))}
    </>
  );

  if (!agents.length) return 'No agents found.';
  return agents.map((agent: any, index: number) => <AgentRow user={user} agent={agent} key={index} author={agent?.author?.name} />);
}
