'use client'

import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { useIsManifestSigned } from '@/hooks/useManifestStatus'

interface ManifestResult {
  header: string
  payload: string
  signature: string
}

interface FarcasterAutoManifestSignerProps {
  domain?: string
  onSuccess?: (result: ManifestResult) => void
  onError?: (error: string, errorType: string) => void
}

export default function FarcasterManifestSigner({ 
  domain = 'saddle-possible-632.app.ohara.ai',
  onSuccess,
  onError
}: FarcasterAutoManifestSignerProps): ReactElement | null {
  const [isMiniApp, setIsMiniApp] = useState<boolean>(false)
  const [isCheckingEnvironment, setIsCheckingEnvironment] = useState<boolean>(true)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [manifestResult, setManifestResult] = useState<ManifestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<string | null>(null)

  // Check if manifest is already signed
  const { isSigned: isAlreadySigned, isLoading: isCheckingSignedStatus } = useIsManifestSigned()

  useEffect(() => {
    const checkAndSignManifest = async (): Promise<void> => {
      try {
        // Wait for both mini-app context and signed status checks to complete
        if (isCheckingSignedStatus) return

        await new Promise(resolve => setTimeout(resolve, 200))
        const isInMiniAppContext: boolean = await sdk.isInMiniApp()
        setIsMiniApp(isInMiniAppContext)

        // Only sign if in mini-app context AND manifest is not already signed
        if (isInMiniAppContext && !isAlreadySigned) {
          setIsProcessing(true)
          await signManifest()
        } else if (isAlreadySigned) {
          console.log('Manifest already signed, skipping signature process')
        }
      } catch (error) {
        console.error('Error checking Mini App context:', error)
        setIsMiniApp(false)
      } finally {
        setIsCheckingEnvironment(false)
      }
    }

    checkAndSignManifest()
  }, [isAlreadySigned, isCheckingSignedStatus])

  const signManifest = async (): Promise<void> => {
    setError(null)
    setErrorType(null)
    setManifestResult(null)

    try {
      const result = await sdk.experimental.signManifest({
        domain: domain
      })
      setManifestResult(result)
      if (onSuccess) onSuccess(result)
    } catch (error: unknown) {
      let errorMessage = ''
      let errorCategory = 'unknown'

      if (error && typeof error === 'object') {
        const sdkErrors = (sdk as any)?.errors ?? {}
        const RejectedByUser = sdkErrors?.RejectedByUser
        const InvalidDomain = sdkErrors?.InvalidDomain
        const GenericError = sdkErrors?.GenericError

        const errObj = error as any
        const errorCode = errObj?.code ?? errObj?.errCode ?? null
        const messageFromError = errObj?.message ?? 'Unknown error occurred'

        if (RejectedByUser && error instanceof RejectedByUser) {
          errorCategory = 'user_rejected'
          errorMessage = 'User declined to sign the manifest'
        } else if (InvalidDomain && error instanceof InvalidDomain) {
          errorCategory = 'invalid_domain'
          errorMessage = 'Invalid domain format'
        } else if (GenericError && error instanceof GenericError) {
          errorCategory = 'generic_error'
          errorMessage = 'Signing failed: ' + messageFromError
        } else if (errorCode === 'USER_REJECTED') {
          errorCategory = 'user_rejected'
          errorMessage = 'User declined to sign the manifest'
        } else if (errorCode === 'INVALID_DOMAIN') {
          errorCategory = 'invalid_domain'
          errorMessage = 'Invalid domain format'
        } else if (errorCode === 'GENERIC_ERROR' || errorCode === 'SIGNING_FAILED') {
          errorCategory = 'generic_error'
          errorMessage = 'Signing failed: ' + messageFromError
        } else {
          const msg = String(messageFromError).toLowerCase()
          if (msg.includes('rejected') || msg.includes('declined')) {
            errorCategory = 'user_rejected'
            errorMessage = 'User declined to sign the manifest'
          } else if (msg.includes('invalid domain') || msg.includes('malformed')) {
            errorCategory = 'invalid_domain'
            errorMessage = 'Invalid domain format'
          } else if (msg.includes('signing failed') || msg.includes('host restriction')) {
            errorCategory = 'generic_error'
            errorMessage = 'Signing failed: ' + (errObj?.message ?? 'Generic signing failure')
          } else {
            errorCategory = 'unknown'
            errorMessage = 'Manifest signing failed: ' + (errObj?.message ?? 'Unknown error occurred')
          }
        }
      } else if (error instanceof Error) {
        if (error.message.includes('rejected') || error.message.includes('declined')) {
          errorCategory = 'user_rejected'
          errorMessage = 'User declined to sign the manifest'
        } else if (error.message.includes('invalid domain') || error.message.includes('malformed')) {
          errorCategory = 'invalid_domain'
          errorMessage = 'Invalid domain format'
        } else if (error.message.includes('signing failed') || error.message.includes('host restriction')) {
          errorCategory = 'generic_error'
          errorMessage = 'Signing failed: ' + error.message
        } else {
          errorCategory = 'unknown'
          errorMessage = 'Manifest signing failed: ' + error.message
        }
      } else {
        errorCategory = 'unknown'
        errorMessage = 'An unexpected error occurred during manifest signing'
      }

      setErrorType(errorCategory)
      setError(errorMessage)
      if (onError) onError(errorMessage, errorCategory)
    } finally {
      setIsProcessing(false)
    }
  }

  return null
}

export type { ManifestResult }
