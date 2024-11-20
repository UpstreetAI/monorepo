import React from 'react';
import { EmbedChat } from '@/components/chat/embed-chat';
import { makeAnonymousClient } from '@/utils/supabase/supabase-client';
import { env } from '@/lib/env';
import { decrypt } from '@/utils/crypto/cryptouUtils';

type Params = {
  params: {
    id: string;
  };
};

async function getAgentData(supabase: any, identifier: string) {
  // First try to find by ID
  let result = await supabase
    .from('assets')
    .select('*, author: accounts ( id, name )')
    .eq('id', identifier)
    .single();

  // If not found by ID, try to find by username
  if (!result.data) {
    result = await supabase
      .from('assets')
      .select('*, author: accounts ( id, name )')
      .eq('name', identifier)
      .single();
  }

  return result;
}

const getIpAddress = async () => {
  const response = await fetch('https://api.ipify.org?format=json');
  const data = await response.json();
  return data.ip;
};

export default async function EmbedPage({ params }: Params) {
  const embedToken = decodeURIComponent(params.id)

  const token = JSON.parse(decrypt(embedToken));

  console.log(token)

  const supabase = makeAnonymousClient(env);
  const identifier = decodeURIComponent(token.agentId);

  const result = await getAgentData(supabase, identifier);
  const agentData = result.data as any;

  const ip = await getIpAddress()

  console.log(ip)

  return (
    <div className="w-full relative flex h-screen overflow-hidden">
      <EmbedChat id={agentData.id} room="221a406b-0674-4c30-b072-9503226ac8b4" />
    </div>
  );
}
