'use client';

import Link from 'next/link';
import { routes } from '@/routes';
import { IconPlus } from '@/components/ui/icons';
import Dev from '../../development';
import { isValidUrl } from '@/lib/utils';
import { Icon, IconButton } from 'ucom';

export interface AccountButtonProps {
  user: any
  credits: number
}
export function AccountButton({ user, credits }: AccountButtonProps) {
  return (
    <div className='flex mr-4 h-12 -mt-6'>

      <Dev>
        <div className='mt-1 mr-2'>
          <IconButton href="/new" icon="Plus" variant='ghost' />
        </div>
      </Dev>

      <div className='mr-6 flex items-center font-bold text-xl'>
        <Icon icon='Credits' className="size-8" /> {Math.round(credits)}
      </div>

      <Link
        className="flex flex-row items-right p-2 h-full rounded text-sm cursor-pointer"
        href={routes.account}
      >
        <div className="-mt-2 size-[52px] min-w-[52px] bg-gray-100 p-1 overflow-hidden flex items-center justify-center border-2 border-gray-900">
          <div
            className="w-full h-full bg-cover bg-top"
            style={{
              backgroundImage: isValidUrl(user.preview_url) ? `url(${user.preview_url})` : 'none',
              backgroundColor: isValidUrl(user.preview_url) ? 'transparent' : '#ccc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#fff',
            }}
          >
            {!isValidUrl(user.preview_url) && user.name.charAt(0)}
          </div>
        </div>

        <div className="flex items-center max-w-16">
          <div className='bg-gray-100 text-black px-2 py-1 pr-6 font-bold'>
            {user.name}
          </div>
        </div>
      </Link>
    </div>
  )
}
