import { useCallback } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

export const useAddMiniApp = () => {
  const addMiniApp = useCallback(async () => {
    try {
      await sdk.actions.addMiniApp()
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('RejectedByUser')) {
          const rejectedError = new Error('RejectedByUser')
          rejectedError.cause = error
          throw rejectedError
        }
        if (error.message.includes('InvalidDomainManifestJson')) {
          const manifestError = new Error('InvalidDomainManifestJson')
          manifestError.cause = error
          throw manifestError
        }
      }
      throw error
    }
  }, [])

  return { addMiniApp }
}
