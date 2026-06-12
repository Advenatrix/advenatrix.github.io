import { useEffect, useRef } from 'react'

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = useRef<T>(fn)
  fnRef.current = fn

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  return (...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current)
    return new Promise<Awaited<ReturnType<T>>>((resolve) => {
      timer.current = setTimeout(async () => {
        const result = await fnRef.current(...args)
        resolve(result)
      }, delay)
    })
  }
}
