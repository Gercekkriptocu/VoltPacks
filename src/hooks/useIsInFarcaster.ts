import { sdk } from '@farcaster/miniapp-sdk'
import { useEffect, useState } from 'react'

export function useIsInFarcaster(): boolean {
  const [isInFarcaster, setIsInFarcaster] = useState<boolean>(false)

  useEffect(() => {
    const checkFarcasterContext = async (): Promise<void> => {
      try {
        const context = await sdk.context
        setIsInFarcaster(!!context)
      } catch {
        setIsInFarcaster(false)
      }
    }

    checkFarcasterContext()
  }, [])

  return isInFarcaster
}
