import * as React from 'react'
import Link from 'next/link'

import { IconUpstreetChat } from '@/components/ui/icons'
import { UserOrLogin } from '@/components/user-or-login'
import { SearchBar } from '@/components/searchbar'



export function Header() {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between w-full h-16 px-4 border-b shrink-0 bg-gradient-to-b from-background/10 via-background/50 to-background/80 backdrop-blur-xl">
      <div className="flex items-center">
        <Link href="/" rel="nofollow">
          <IconUpstreetChat className="mr-2 fill-black size-9 w-auto dark:hidden" inverted/>
          <IconUpstreetChat className="hidden mr-2 fill-white size-9 w-auto dark:block"/>
        </Link>
      </div>
      <SearchBar/>
      <React.Suspense fallback={<div className="flex-1 overflow-auto"/>}>
        <UserOrLogin/>
      </React.Suspense>
    </header>
  )
}
