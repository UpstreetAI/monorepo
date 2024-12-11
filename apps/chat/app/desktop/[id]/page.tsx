import React from 'react';
import { DesktopChat } from '@/components/chat/desktop-chat';

type Params = {
  params: {
    id: string;
  };
};

export default async function DesktopPage({ params }: Params) {
  const room = decodeURIComponent(params.id);

  return <DesktopChat room={room} />;
}
