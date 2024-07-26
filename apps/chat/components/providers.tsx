'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ThemeProviderProps } from 'next-themes/dist/types'
import { SidebarProvider } from '@/lib/client/hooks/use-sidebar'
import { SupabaseProvider } from '@/lib/hooks/use-supabase'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ActionsProvider } from '@/components/ui/actions'
import { MultiplayerActionsProvider } from '@/components/ui/multiplayer-actions'
import { DirectMessageActionsProvider } from '@/components/ui/direct-message-actions'


export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <SupabaseProvider>
        <SidebarProvider>
          <TooltipProvider>
            <ActionsProvider>
              <MultiplayerActionsProvider>
                <DirectMessageActionsProvider>
                  {children}
                </DirectMessageActionsProvider>
              </MultiplayerActionsProvider>
            </ActionsProvider>
          </TooltipProvider>
        </SidebarProvider>
      </SupabaseProvider>
    </NextThemesProvider>
  )
}
