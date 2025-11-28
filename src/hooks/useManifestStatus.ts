'use client'

import { useState, useEffect, useCallback } from 'react'
import { isManifestSigned, getManifestStatus } from '@/utils/manifestStatus'
import type { AccountAssociation } from '@/utils/manifestStatus'

interface UseManifestStatusReturn {
  isSigned: boolean
  isLoading: boolean
  accountAssociation?: AccountAssociation
  error?: string
  refetch: () => Promise<void>
}

/**
 * Custom hook to check and monitor Farcaster manifest signing status
 */
export const useManifestStatus = (): UseManifestStatusReturn => {
  const [isSigned, setIsSigned] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [accountAssociation, setAccountAssociation] = useState<AccountAssociation>()
  const [error, setError] = useState<string>()

  const checkStatus = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true)
      setError(undefined)
      
      const status = await getManifestStatus()
      
      setIsSigned(status.isSigned)
      setAccountAssociation(status.accountAssociation)
      if (status.error) {
        setError(status.error)
      }
    } catch (err) {
      console.error('Error checking manifest status:', err)
      setError(err instanceof Error ? err.message : 'Failed to check manifest status')
      setIsSigned(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Check status on mount
  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  return {
    isSigned,
    isLoading,
    accountAssociation,
    error,
    refetch: checkStatus
  }
}

/**
 * Simplified hook that just returns the signing status
 */
export const useIsManifestSigned = (): { isSigned: boolean; isLoading: boolean } => {
  const [isSigned, setIsSigned] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const checkSigned = async (): Promise<void> => {
      try {
        const signed = await isManifestSigned()
        setIsSigned(signed)
      } catch (error) {
        console.error('Error checking if manifest is signed:', error)
        setIsSigned(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkSigned()
  }, [])

  return { isSigned, isLoading }
}