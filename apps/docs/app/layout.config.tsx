import Logo from '@/components/logo'
import { RootToggle } from 'fumadocs-ui/layouts/docs.client'
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import pkgJson from 'usdk/package.json'
import Image from 'next/image'
import Link from 'next/link'
import GitHubRepoCard from '@/components/github-repo-card'

/**
 * Shared layout configurations
 *
 * you can configure layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions = {
  nav: {
    title: <Logo className="h-10" />,
    children: (
      <div className="flex w-full justify-end items-end">
        <RootToggle
          defaultValue={0}
          options={[
            {
              title: `v${pkgJson.version}`,
              description: 'Latest',
              url: '',
              props: {
                // @ts-expect-error
                href: 'https://www.npmjs.com/package/usdk'
              }
            }
            // {
            //   title: 'Folder 2',
            //   description: 'Pages in folder 2',
            //   url: '/path/to/page-tree-2',
            // },
          ]}
        />
      </div>
    )
  },
  sidebar: {
    footer: (
      <div className='relative w-full h-fit'>
        <Image alt="bg-pattern" className='dark:invert select-none pointer-events-none -z-1' width={200} height={500} style={{objectFit:'contain', width: '100%', transform:'scale(1, -1)', position: 'absolute', bottom: 0, left: 0}} src="/images/general/bg_pattern_lightMode.png" />
        <GitHubRepoCard repo={"upstreetAI/upstreet-core"} />
      </div>
    ),
    banner: (
      <RootToggle
        defaultValue={0}
        defaultChecked={true}
        options={[
          {
            title: 'Scillia',
            description: 'Your personal assistant',
            url: '/scillia',
            icon: (
              <Image
                alt="product logo"
                src="/images/general/Scillia_Logo.png"
                width={30}
                height={30}
                className="rounded-md"
              />
            )
          },
          {
            title: 'Platform',
            description: 'The Agent Platform',
            url: '/platform',
            icon: (
              <Image
                alt="product logo"
                src="/images/general/Platform_Logo.png"
                width={30}
                height={30}
                className="rounded-md"
              />
            )
          },
          {
            title: 'USDK',
            description: 'Upstreet Agents SDK',
            url: '',
            icon: (
              <Image
                alt="product logo"
                src="/images/general/USDK_Logo.png"
                width={30}
                height={30}
                className="rounded-md"
              />
            ),
            props: {
              // @ts-expect-error
              href: '/'
            }
          }
        ]}
      />
    )
  }
  // links: [
  //   {
  //     text: 'Documentation',
  //     url: '/docs',
  //     active: 'nested-url',
  //   },
  // ],
}
