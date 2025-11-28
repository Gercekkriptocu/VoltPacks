import { sdk } from '@farcaster/miniapp-sdk'
import { useEffect, useRef, useState } from 'react'
import { useAccount, useConnect, useReconnect } from 'wagmi'
import { toast } from 'sonner'
import type { Address } from 'viem'

interface UserData {
  fid: number
  displayName: string
  username: string
  pfpUrl?: string
  primaryAddress?: string
}

interface QuickAuthResult {
  isAuthenticated: boolean
  farcasterAddress: Address | null
  userData: UserData | null
}

export function useQuickAuth(isInFarcaster: boolean): QuickAuthResult {
  const hasAuthenticated = useRef(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [farcasterAddress, setFarcasterAddress] = useState<Address | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  
  const { isConnected, address } = useAccount()
  const { connectors, connect } = useConnect()
  const { reconnect } = useReconnect()

  useEffect(() => {
    const authenticateUser = async (): Promise<void> => {
      try {
        if (!isInFarcaster) return
        
        if (hasAuthenticated.current) return
        hasAuthenticated.current = true
        
        console.log('🎯 Farcaster detected - Starting Quick Auth...')
        
        const response: Response = await sdk.quickAuth.fetch('/api/me')
        
        if (response.ok) {
          const data: UserData = await response.json()
          setUserData(data)
          setIsAuthenticated(true)
          
          console.log('✅ Quick Auth successful:', data)
          
          // Auto-connect wallet if Farcaster address is available
          if (data.primaryAddress) {
            const farcasterAddr = data.primaryAddress as Address
            setFarcasterAddress(farcasterAddr)
            
            // If not already connected or connected to different address
            if (!isConnected || address?.toLowerCase() !== farcasterAddr.toLowerCase()) {
              console.log('🔗 Auto-connecting Farcaster wallet...', farcasterAddr)
              
              // Wait a bit for connectors to be ready
              await new Promise(resolve => setTimeout(resolve, 500))
              
              // Strategy 1: Try reconnect first (silent)
              try {
                await reconnect()
                console.log('✅ Wallet reconnected successfully')
                
                // Wait a bit to verify connection
                await new Promise(resolve => setTimeout(resolve, 300))
                
                toast.success('🔗 Wallet Auto-Connected!', {
                  description: 'Your Farcaster wallet is now connected',
                  duration: 2000,
                })
                return
              } catch (err) {
                console.log('⚠️ Reconnect failed, trying direct connect...')
              }
              
              // Strategy 2: Try connectors in priority order
              const priorityConnectors = [
                connectors.find(c => c.id === 'coinbaseWalletSDK' || c.name === 'Coinbase Wallet'),
                connectors.find(c => c.id === 'walletConnect'),
                connectors.find(c => c.id === 'injected' || c.type === 'injected'),
                ...connectors
              ].filter((c, idx, arr) => c && arr.findIndex(x => x?.id === c.id) === idx)
              
              for (const connector of priorityConnectors) {
                if (!connector) continue
                
                try {
                  console.log(`🔌 Trying ${connector.name} (${connector.id})...`)
                  await connect({ connector })
                  
                  // Wait a bit to verify connection
                  await new Promise(resolve => setTimeout(resolve, 300))
                  
                  console.log(`✅ Connected via ${connector.name}!`)
                  
                  toast.success('🔗 Wallet Auto-Connected!', {
                    description: `Connected via ${connector.name}`,
                    duration: 2000,
                  })
                  break
                } catch (err) {
                  console.log(`⚠️ ${connector.name} failed:`, err)
                  continue
                }
              }
            } else {
              console.log('✅ Wallet already connected with correct address')
            }
          }
          
          toast.success('🎯 Farcaster Identity Linked!', {
            description: (
              <div className="flex flex-col gap-2 mt-2 text-black">
                <div className="flex items-center gap-3">
                  {data.pfpUrl && (
                    <img 
                      src={data.pfpUrl} 
                      alt="Profile" 
                      className="w-12 h-12 rounded-full border-2 border-black"
                    />
                  )}
                  <div>
                    <div className="font-semibold text-black">{data.displayName}</div>
                    <div className="text-sm text-black/70">@{data.username}</div>
                  </div>
                </div>
                <div className="text-sm space-y-1 text-black">
                  <div><span className="font-medium">FID:</span> {data.fid}</div>
                  {data.primaryAddress && (
                    <div>
                      <span className="font-medium">Address:</span>{' '}
                      {data.primaryAddress.slice(0, 6)}...{data.primaryAddress.slice(-4)}
                    </div>
                  )}
                </div>
              </div>
            ),
            duration: 3000,
            className: 'border-2 border-black',
            style: {
              borderColor: '#000000',
              borderWidth: '2px',
            },
          })
        } else {
          console.error('❌ Quick Auth failed:', response.status)
          toast.error('Authentication failed', {
            description: 'Unable to verify your Farcaster identity',
            className: 'border-2 border-black text-black',
            style: {
              borderColor: '#000000',
              borderWidth: '2px',
            },
          })
        }
      } catch (error) {
        console.error('❌ Quick Auth error:', error)
        toast.error('Authentication error', {
          description: error instanceof Error ? error.message : 'An unexpected error occurred',
          className: 'border-2 border-black text-black',
          style: {
            borderColor: '#000000',
            borderWidth: '2px',
          },
        })
      }
    }

    authenticateUser()
  }, [isInFarcaster, isConnected, address, connectors, connect])
  
  return { isAuthenticated, farcasterAddress, userData }
}
