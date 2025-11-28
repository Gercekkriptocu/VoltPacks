'use client'

import { createWeb3Modal } from '@web3modal/wagmi/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode, ReactElement } from 'react'
import { WagmiProvider } from 'wagmi'
import { base } from 'wagmi/chains'
import { http, createConfig } from 'wagmi'
import { coinbaseWallet, walletConnect, injected } from 'wagmi/connectors'

// 0. Setup queryClient
const queryClient = new QueryClient()

// 1. Get projectId from https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

// 2. Create wagmiConfig
const metadata = {
  name: 'Stranger Packs',
  description: 'Unlock mysterious Stranger Things cards',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://strangerpacks.app',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http()
  },
  connectors: [
    walletConnect({ projectId, metadata, showQrModal: true }),
    coinbaseWallet({
      appName: metadata.name,
      appLogoUrl: metadata.icons[0]
    }),
    injected({ shimDisconnect: true })
  ]
})

// 3. Create modal with singleton pattern to prevent double initialization
// Use global window object to track initialization across HMR reloads
if (typeof window !== 'undefined') {
  // @ts-ignore - Adding custom property to window
  if (!window.__web3modal_initialized__) {
    createWeb3Modal({
      wagmiConfig: config,
      projectId,
      enableAnalytics: false,
      enableOnramp: true,
      themeMode: 'dark',
      themeVariables: {
        '--w3m-color-mix': '#E71D36',
        '--w3m-accent': '#E71D36'
      }
    })
    // @ts-ignore
    window.__web3modal_initialized__ = true;
  }
}

export function AppKitProvider({ children, initialState }: { children: ReactNode; initialState?: any }): ReactElement {
  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
