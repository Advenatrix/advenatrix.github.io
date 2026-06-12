import { useState, useCallback, useEffect } from 'react'

export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    return fetcher()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, deps)

  useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
}
