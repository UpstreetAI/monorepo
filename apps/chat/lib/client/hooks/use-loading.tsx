'use client'

import { useGlobalState } from '@/contexts/GlobalContext'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { usePathname } from 'next/navigation'
import * as React from 'react'

interface LoadingContext {
  isAgentLoading: boolean
  setIsAgentLoading: React.Dispatch<React.SetStateAction<boolean>>
}

const LoadingContext = React.createContext<LoadingContext | undefined>(
  undefined
)

export function useLoading() {
  const context = React.useContext(LoadingContext)
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}

interface LoadingProviderProps {
  children: React.ReactNode
}

export function LoadingProvider({ children }: LoadingProviderProps) {

  const [isAgentLoading, setIsAgentLoading] = React.useState(false)

  const [globalState, setGlobalState] = useGlobalState();

  const pathname = usePathname();

  React.useEffect(() => {
    if (pathname.startsWith('/desktop')) {
      setGlobalState({ ...globalState, mode: { name: 'desktop', mainBackgroundClass: '' } });
    } else if (pathname.startsWith('/embed')) {
      setGlobalState({ ...globalState, mode: { name: 'embed', mainBackgroundClass: 'bg-[url("/images/backgrounds/main-background.jpg")] bg-center bg-cover' } });
    } else {
      setGlobalState({ ...globalState, mode: { name: 'web', mainBackgroundClass: 'bg-[url("/images/backgrounds/main-background.jpg")] bg-center bg-cover' } });
    }
  }, [pathname]);

  return (
    <LoadingContext.Provider
      value={{ isAgentLoading, setIsAgentLoading }}
    >
      {children}
    </LoadingContext.Provider>
  )
}
