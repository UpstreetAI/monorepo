'use client';

import * as React from 'react';
import { AccountOrLogin } from './account-or-login';
import { HeaderMenu } from './header-menu';
import { usePathname } from 'next/navigation';

export interface HeaderNavigationProps {
  user: any
}

export function HeaderNavigation({ user }: HeaderNavigationProps) {

  const pathname = usePathname();
  // HIDE NAVIGATION WHEN USER IS ON FOLLOWING PAGES
  if(pathname.startsWith('/new') || pathname.startsWith('/rooms/') || pathname.startsWith('/embed') || pathname === '/account') return null;

  return (
    <header className="sticky top-0 z-[10] flex items-center justify-between h-12 pt-6 shrink-0 bg-zinc-950">
      <HeaderMenu />
      <React.Suspense fallback={<div className="flex-1 overflow-auto" />}>
        <AccountOrLogin user={user} />
      </React.Suspense>
    </header>
  )
}
