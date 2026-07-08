import { useEffect, useState } from 'react'

const EXPIRES_IN     = 3600 // 1 hour
const REFRESH_MARGIN = 60   // refresh 60s before expiry

export function useSignedUrl(path, client) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!path) { setUrl(null); return }
    let cancelled = false
    let timer

    async function fetchSignedUrl() {
      const { data, error } = await client.storage
        .from('task-photos')
        .createSignedUrl(path, EXPIRES_IN)
      if (cancelled) return
      if (error || !data) { setUrl(null); return }
      setUrl(data.signedUrl)
      timer = setTimeout(fetchSignedUrl, (EXPIRES_IN - REFRESH_MARGIN) * 1000)
    }

    fetchSignedUrl()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [path, client])

  return url
}
