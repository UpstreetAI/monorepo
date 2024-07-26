'use client'

import * as React from 'react'

// const LOCAL_STORAGE_KEY = 'sidebar'

interface SidebarContext {
  isLeftSidebarOpen: boolean
  toggleLeftSidebar: () => void
  isRightSidebarOpen: boolean
  toggleRightSidebar: () => void
  // isLoading: boolean
}

const SidebarContext = React.createContext<SidebarContext | undefined>(
  undefined
)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebarContext must be used within a SidebarProvider')
  }
  return context
}

interface SidebarProviderProps {
  children: React.ReactNode
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  const [isLeftSidebarOpen, setLeftSidebarOpen] = React.useState(false)
  const [isRightSidebarOpen, setRightSidebarOpen] = React.useState(false)
  // const [isLoading, setLoading] = React.useState(true)

  /* React.useEffect(() => {
    const value = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (value) {
      setLeftSidebarOpen(JSON.parse(value))
    }
    setLoading(false)
  }, []) */

  const toggleLeftSidebar = () => {
    setLeftSidebarOpen(value => {
      const newState = !value
      // localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState))
      return newState
    })
  }
  const toggleRightSidebar = () => {
    setRightSidebarOpen(value => {
      const newState = !value
      // localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState))
      return newState
    })
  }

  // if (isLoading) {
  //   return null
  // }

  return (
    <SidebarContext.Provider
      value={{ isLeftSidebarOpen, toggleLeftSidebar, isRightSidebarOpen, toggleRightSidebar/*, isLoading*/ }}
    >
      {children}
    </SidebarContext.Provider>
  )
}
