import { Banner } from 'fumadocs-ui/components/banner';
import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import Link from 'next/link';

const myFont = localFont({ src: '../lib/Aller_Std_Bd.ttf', variable: '--my-font' });

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={myFont.variable} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>
          <Banner>The Upstreet Agents SDK is now in public beta 🎉&nbsp;<Link className='underline font-bold' href="https://docs.upstreet.ai/install">Get started →</Link></Banner>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
