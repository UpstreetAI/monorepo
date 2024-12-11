import React from 'react'
import { IconSpinner } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { useGlobalState } from '@/contexts/GlobalContext';

export function Loading() {

  const [globalState] = useGlobalState();

  return globalState.mode && (
    <div className={cn("flex items-center justify-center h-screen", globalState.mode.loadingWrappeClass)}>
      <IconSpinner className="h-[50px] w-[50px]" />
    </div>
  )
}
