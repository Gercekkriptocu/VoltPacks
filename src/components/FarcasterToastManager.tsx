'use client'

// Mini App ID: 66423ff7-95c5-49dd-9e05-3bace3b9749e

import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { useManifestStatus } from '@/hooks/useManifestStatus'
import { useRef, useEffect, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'

interface ManifestResult {
  header: string
  payload: string
  signature: string
}

interface FarcasterToastManagerProps {
  children: (handlers: {
    onManifestSuccess: (result: ManifestResult) => void
    onManifestError: (errorMessage: string, errorType: string) => void
  }) => ReactNode
}

export default function FarcasterToastManager({ children }: FarcasterToastManagerProps): ReactElement {
  const { isSigned, isLoading, refetch } = useManifestStatus()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [copySucceeded, setCopySucceeded] = useState(false)
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  const copyAllAsJSON = async (result: ManifestResult, showToast: boolean = true): Promise<boolean> => {
    try {
      const fieldsOnly = {
        header: result.header,
        payload: result.payload,
        signature: result.signature,
      }
      const textToCopy = JSON.stringify(fieldsOnly, null, 2)
      await navigator.clipboard.writeText(textToCopy)
      if (showToast) {
        toast.success('Account Association JSON copied to clipboard! 📋', {
          duration: 2000,
        })
      }
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      if (showToast) {
        toast.error('Failed to copy to clipboard', {
          duration: 2000,
        })
      }
      return false
    }
  }

  const handleManifestSuccess = (result: ManifestResult): void => {
    // Refresh the manifest status after successful signing
    refetch()
    
    // Only show toast if manifest wasn't already signed
    if (isSigned && !isLoading) {
      console.log('Manifest was already signed, skipping success toast')
      return
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    ;(async () => {
      const success = await copyAllAsJSON(result, false)
      setCopySucceeded(success)
    })()
    
    toast.success('Manifest Signed Successfully! 🎉', {
      description: `Domain: saddle-possible-632.app.ohara.ai`,
      duration: 3000,
    })
    
    timeoutRef.current = setTimeout(() => {
      toast.info('Account Association Ready', {
        description: (
          <div className="text-xs space-y-3 text-black">
            <div className="text-center text-gray-600 mb-3">
              {copySucceeded 
                ? 'Your account association JSON has been copied to clipboard automatically.'
                : 'Failed to copy automatically. Please use the button below.'}
            </div>
            
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => copyAllAsJSON(result, true)}
                className="bg-black hover:bg-gray-800 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
              >
                Copy Again
              </button>
              
              <button
                onClick={() => {
                  window.open('https://ohara.ai/mini-apps/66423ff7-95c5-49dd-9e05-3bace3b9749e/build', '_blank')
                }}
                className="bg-black hover:bg-gray-800 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
              >
                Back to Base App
              </button>
            </div>
          </div>
        ),
        duration: 15000,
      })
    }, 1000)
  }

  const handleManifestError = (errorMessage: string, errorType: string): void => {
    // Only show error toast if manifest wasn't already signed
    if (isSigned && !isLoading) {
      console.log('Manifest was already signed, skipping error toast')
      return
    }
    
    toast.error('Manifest Signing Failed', {
      description: errorType.toUpperCase() + ': ' + errorMessage,
      duration: 6000,
    })
  }

  return (
    <>
      <Toaster />
      {children({
        onManifestSuccess: handleManifestSuccess,
        onManifestError: handleManifestError,
      })}
    </>
  )
}

export type { ManifestResult }
