import React from 'react';
import { Chat } from '@/components/chat/chat';
import { LoginRedirect } from '@/components/login-redirect';
import { SidebarDesktopLeft, SidebarDesktopRight } from '@/components/sidebar-desktop';
// import { LeftSidebarToggle, RightSidebarToggle } from '@/components/sidebar-toggle';
// import { AI } from '@/lib/chat/actions'
// import { getSupabase } from '@/lib/hooks/use-supabase'

// import { type Metadata } from 'next';
// import { Room } from '@/components/room';
// import { createClient } from '@/utils/supabase/server';

type Params = {
  params: {
    id: string;
  };
  searchParams: {
    desktop?: string;
  };
};

/* export async function generateMetadata({
  params
}: Params): Promise<Metadata> {

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // decode the uri for usernames that have spaces in them
  const agentName = decodeURIComponent(params.agent)

  const { data: agentData } = await supabase
    .from('assets')
    .select('*')
    .eq('name', agentName)
    .single();

  const meta = {
    title: agentData?.name ?? 'Agent not found!',
    description: agentData?.description ?? '',
    cardImage: agentData?.preview_image ?? '',
    robots: 'follow, index',
    favicon: '/favicon.ico',
    url: `https://chat.upstreet.ai/`
  };

  return {
    title: meta.title,
    description: meta.description,
    referrer: 'origin-when-cross-origin',
    keywords: ['AI', 'SDK', 'Upstreet', 'Agents'],
    authors: [{ name: 'Upstreet', url: 'https://upstreet.ai/' }],
    creator: 'upstreetai',
    publisher: 'upstreetai',
    robots: meta.robots,
    icons: { icon: meta.favicon },
    metadataBase: new URL(meta.url),
    openGraph: {
      url: meta.url,
      title: meta.title,
      description: meta.description,
      images: [meta.cardImage],
      type: 'website',
      siteName: meta.title
    },
    twitter: {
      card: 'summary_large_image',
      site: '@upstreetai',
      creator: '@upstreetai',
      title: meta.title,
      description: meta.description,
      images: [meta.cardImage]
    }
  }
} */

export default async function RoomPage({ params, searchParams }: Params) {
  const roomName = decodeURIComponent(params.id);
  const desktop = searchParams.desktop === '1';

  return (
    // <AI initialAIState={{ chatId: id, messages: [] }}>
    <div className="w-full relative flex h-screen overflow-hidden">

      <LoginRedirect />

      <SidebarDesktopLeft />
      
      <Chat
        room={roomName}
        desktop={desktop}
      />

      <SidebarDesktopRight />
    </div>
    // </AI>
  );
}
