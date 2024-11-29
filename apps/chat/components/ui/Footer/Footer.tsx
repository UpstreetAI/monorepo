'use client'

import { IconUpstreet } from '@/components/ui/icons';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Footer() {

  const pathname = usePathname();

  // HIDE FOOTER WHEN USER IS ON CHAT PAGE
  if(pathname.startsWith('/room') || pathname.startsWith('/new') || pathname.startsWith('/agents/') || pathname.startsWith('/embed') || pathname === '/') return null;

  return (
    <footer className="mx-auto px-6 bg-[#000000]">
      <div className="grid grid-cols-1 gap-8 py-12 text-white transition-colors duration-150 border-b lg:grid-cols-12 border-zinc-600">
        <div className="col-span-1 lg:col-span-2">
          <Link
            href="/"
            className="flex items-center flex-initial font-bold md:mr-24"
          >
            <span className="mr-4">
              <IconUpstreet className='size-14' />
            </span>
          </Link>
        </div>
        <div className="col-span-1 lg:col-span-2">
          <ul className="flex flex-col flex-initial md:flex-1">
          <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/pricing"
                className="text-white transition duration-150 ease-in-out hover:text-zinc-200"
              >
                Pricing
              </Link>
            </li>
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/new"
                className="text-white transition duration-150 ease-in-out hover:text-zinc-200"
              >
                Chat
              </Link>
            </li>
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="https://docs.upstreet.ai"
                target='_blank'
                className="text-white transition duration-150 ease-in-out hover:text-zinc-200"
              >
                SDK
              </Link>
            </li>
          </ul>
        </div>
        <div className="col-span-1 lg:col-span-2">
          <ul className="flex flex-col flex-initial md:flex-1">
            <li className="py-3 md:py-0 md:pb-4">
              <p className="font-bold text-white transition duration-150 ease-in-out hover:text-zinc-200">
                LEGAL
              </p>
            </li>
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/company/terms"
                className="text-white transition duration-150 ease-in-out hover:text-zinc-200"
              >
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="text-center py-8 space-y-4 md:flex-row">
        &copy; {new Date().getFullYear()} Upstreet, Inc. All rights reserved.
      </div>
    </footer>
  );
}
