import { useCallback, useEffect, useRef, useState, useMemo } from 'react'

export const useScrollAnchor = () => {
  const messagesRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const visibilityRef = useRef<HTMLDivElement>(null)

  const [isAtBottom, setIsAtBottom] = useState(true)
  const [isVisible, setIsVisible] = useState(false)

  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollIntoView({
        block: 'end',
        behavior: 'smooth'
      })
    }
  }, [])

  useEffect(() => {
    if (messagesRef.current && isAtBottom && !isVisible) {
      messagesRef.current.scrollIntoView({
        block: 'end'
      })
    }
  }, [isAtBottom, isVisible])

  useEffect(() => {
    const { current } = scrollRef

    if (current) {
      const handleScroll = (event: Event) => {
        const target = event.target as HTMLDivElement
        const offset = 80
        const isAtBottom =
          target.scrollTop + target.clientHeight >= target.scrollHeight - offset

        setIsAtBottom(isAtBottom)
      }

      current.addEventListener('scroll', handleScroll, {
        passive: true
      })

      return () => {
        current.removeEventListener('scroll', handleScroll)
      }
    }
  }, [])

  const observer = useMemo(() => {
    return new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          setIsVisible(entry.isIntersecting)
        })
      },
      {
        rootMargin: '0px 0px -80px 0px'
      }
    )
  }, []);

  useEffect(() => {
    if (visibilityRef.current) {
      observer.observe(visibilityRef.current)

      return () => {
        observer.disconnect()
      }
    }
  }, [observer])

  return {
    messagesRef,
    scrollRef,
    visibilityRef,
    scrollToBottom,
    isAtBottom,
    isVisible
  }
}
