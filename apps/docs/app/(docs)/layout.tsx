import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import { source } from '@/lib/source';
import Image from 'next/image';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={{
      ...source.pageTree,
    }} {...baseOptions}>
      <Image alt="bg-pattern" className='dark:invert select-none pointer-events-none -z-1' width={1000} height={200} style={{objectFit:'contain', position: 'absolute', top: 0, right: 0}} src="/images/general/bg_pattern_lightMode.png" />
      {children}
    </DocsLayout>
  );
}
