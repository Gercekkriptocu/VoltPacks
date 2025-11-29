'use client'
import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useConnect } from 'wagmi';
import { parseUnits, type Address, type Log, decodeEventLog } from 'viem';
import PackOpening from '@/components/PackOpening';
import MusicPanel from '@/components/MusicPanel';
import SoundCloudPlayer from '@/components/SoundCloudPlayer';
import SplashScreen from '@/components/SplashScreen';
import { sdk } from "@farcaster/miniapp-sdk";
import { useAddMiniApp } from "@/hooks/useAddMiniApp";
import { useQuickAuth } from "@/hooks/useQuickAuth";
import { useIsInFarcaster } from "@/hooks/useIsInFarcaster";

// ========================
// CONFIGURATION
// ========================
// Base Mainnet USDC Address
const USDC_ADDRESS: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NFT_CONTRACT_ADDRESS: Address = "0xFaCEEc3C8c67eC27c9F2afc8A4ca4a3E1e1263bC" as Address;
// IMPORTANT: Replace this with your actual IPFS CID where your NFT images are stored
// Example: If your images are at ipfs://QmXXX/1.png, ipfs://QmXXX/2.png, etc.
// Then IPFS_CID should be "QmXXX"
const IPFS_CID = "bafybeialq34226ps5rvdvuwsbsjynvgvxttfr5ek3mitihnlfr4u4tkkdy"; // ✅ Real IPFS CID
const PACK_PRICE = "0.3"; 
const TOTAL_ART_COUNT = 116;

// ========================
// HELPER FUNCTIONS
// ========================
// Convert IPFS URI to HTTP gateway URL
// Using Cloudflare IPFS gateway for better performance and bandwidth
const ipfsToHttp = (uri: string): string => {
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
  }
  return uri;
};

// ========================
// ABI DEFINITIONS
// ========================
const USDC_ABI = [
  { constant: false, inputs: [{ name: "_spender", type: "address" }, { name: "_value", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], type: "function" },
  { constant: true, inputs: [{ name: "_owner", type: "address" }, { name: "_spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function" }
] as const;

const NFT_ABI = [
  { 
    inputs: [
      { internalType: "uint256", name: "count", type: "uint256" },
      { internalType: "string", name: "fid", type: "string" }
    ], 
    name: "openPacks", 
    outputs: [], 
    stateMutability: "nonpayable", 
    type: "function" 
  },
  { 
    inputs: [], 
    name: "totalSupply", 
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }], 
    stateMutability: "view", 
    type: "function" 
  },
  { 
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }], 
    name: "tokenArtIds", 
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }], 
    stateMutability: "view", 
    type: "function" 
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "buyer", type: "address" },
      { indexed: false, internalType: "uint256", name: "tokenId", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "artId", type: "uint256" },
      { indexed: false, internalType: "string", name: "fid", type: "string" }
    ],
    name: "PackOpened",
    type: "event"
  }
] as const;

// ========================
// TYPES
// ========================
type MintStage = 'idle' | 'approving' | 'approved' | 'minting' | 'animating' | 'revealed';

interface RevealedCard { tokenURI: string; number: number; tokenId: number; }
interface MintedNFT { id: string; image: string; tokenId?: string; artId?: number; }

// ========================
// ATMOSPHERE COMPONENTS
// ========================

// 🎄 Joyce's Lights Component
const ChristmasLights = () => {
  const [activeSequence, setActiveSequence] = useState<number>(0);
  
  // Tüm alfabeyi rastgele dağıt (26 harf) - R, U, N için
  const shuffledLetters = useMemo(() => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    // Fisher-Yates shuffle
    const shuffled = [...alphabet];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Swap R ↔ U
    const rIndex = shuffled.indexOf('R');
    const uIndex = shuffled.indexOf('U');
    [shuffled[rIndex], shuffled[uIndex]] = [shuffled[uIndex], shuffled[rIndex]];
    
    // Swap N ↔ C
    const nIndex = shuffled.indexOf('N');
    const cIndex = shuffled.indexOf('C');
    [shuffled[nIndex], shuffled[cIndex]] = [shuffled[cIndex], shuffled[nIndex]];
    
    return shuffled;
  }, []);
  
  // R, U, N harflerinin indekslerini bul
  const runIndices = useMemo(() => [
    shuffledLetters.indexOf('R'),
    shuffledLetters.indexOf('U'),
    shuffledLetters.indexOf('N')
  ], [shuffledLetters]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSequence(prev => (prev + 1) % 3); // 0, 1, 2 döngüsü (R, U, N)
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-0 left-0 w-full h-20 z-50 flex justify-between px-2 md:px-3 overflow-visible pointer-events-none">
      <div className="absolute top-4 left-0 w-full h-1 bg-gray-800/50 -rotate-1"></div>
      {shuffledLetters.map((letter: string, i: number) => {
        const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
        const color = colors[i % 4];
        const isRUNActive = runIndices[activeSequence] === i;
        
        return (
          <div key={i} className="relative group flex flex-col items-center">
             <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full ${color} ${isRUNActive ? 'opacity-100 shadow-[0_0_20px_currentColor] scale-125' : 'opacity-30'} transition-all duration-300 transform translate-y-2`}></div>
             <div className="w-1 h-2 md:h-3 bg-gray-900 mx-auto -mt-1"></div>
             <span className={`text-[13px] md:text-[16px] font-mono mt-1 ${isRUNActive ? 'text-white font-bold' : 'text-white/50'} transition-all duration-300`}>
               {letter}
             </span>
          </div>
        );
      })}
    </div>
  );
};

// 🌿 Creeping Vines & Atmospheric Spores
const CreepingVines = () => (
  <div className="absolute inset-0 pointer-events-none z-10 overflow-visible">
    {/* Left Side Vines */}
    <svg className="absolute -bottom-10 -left-10 w-96 h-96 opacity-60 text-red-900/40 animate-pulse-slow" viewBox="0 0 100 100">
      <path d="M0,100 C30,90 40,60 20,40 C10,30 50,10 60,0" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M10,100 C40,80 30,50 60,60 C80,70 90,30 100,20" stroke="currentColor" strokeWidth="3" fill="none" />
      <path d="M-10,90 C20,80 50,80 40,50" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
    
    {/* Right Side Vines */}
    <svg className="absolute -top-10 -right-10 w-96 h-96 opacity-60 text-red-900/40 animate-pulse-slow rotate-180" viewBox="0 0 100 100">
      <path d="M0,100 C30,90 40,60 20,40 C10,30 50,10 60,0" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M10,100 C40,80 30,50 60,60 C80,70 90,30 100,20" stroke="currentColor" strokeWidth="3" fill="none" />
    </svg>
    
    {/* Left Middle Vines */}
    <svg className="absolute top-1/2 -left-10 w-80 h-80 opacity-50 text-red-800/30 animate-pulse-slow" viewBox="0 0 100 100" style={{animationDelay: '1s'}}>
      <path d="M0,50 Q20,30 40,50 T80,50" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M0,60 Q15,40 30,60 T60,60" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
    
    {/* Right Middle Vines */}
    <svg className="absolute top-1/3 -right-10 w-80 h-80 opacity-50 text-red-800/30 animate-pulse-slow" viewBox="0 0 100 100" style={{animationDelay: '1.5s'}}>
      <path d="M100,50 Q80,30 60,50 T20,50" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M100,40 Q85,20 70,40 T40,40" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
    
    {/* Atmospheric Spores - Left Side */}
    {[...Array(15)].map((_, i) => (
      <div
        key={`left-spore-${i}`}
        className="absolute rounded-full bg-red-500/20 blur-sm animate-float-side-spore"
        style={{
          left: `${Math.random() * 20}%`,
          top: `${Math.random() * 100}%`,
          width: `${Math.random() * 8 + 3}px`,
          height: `${Math.random() * 8 + 3}px`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${8 + Math.random() * 6}s`
        }}
      />
    ))}
    
    {/* Atmospheric Spores - Right Side */}
    {[...Array(15)].map((_, i) => (
      <div
        key={`right-spore-${i}`}
        className="absolute rounded-full bg-red-500/20 blur-sm animate-float-side-spore"
        style={{
          right: `${Math.random() * 20}%`,
          top: `${Math.random() * 100}%`,
          width: `${Math.random() * 8 + 3}px`,
          height: `${Math.random() * 8 + 3}px`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${8 + Math.random() * 6}s`
        }}
      />
    ))}
  </div>
);

// ========================
// MAIN COMPONENT
// ========================
export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { addMiniApp } = useAddMiniApp();
  const isInFarcaster = useIsInFarcaster();
  const { isAuthenticated, farcasterAddress, userData } = useQuickAuth(isInFarcaster);
  const publicClient = usePublicClient();
  
  useEffect(() => {
    const tryAddMiniApp = async (): Promise<void> => {
      try {
        await addMiniApp();
      } catch (error) {
        console.error('Failed to add mini app:', error);
      }
    };
    tryAddMiniApp();
  }, [addMiniApp]);
  
  useEffect(() => {
    const initializeFarcaster = async (): Promise<void> => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (document.readyState !== 'complete') {
          await new Promise<void>(resolve => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              window.addEventListener('load', () => resolve(), { once: true });
            }
          });
        }
        
        await sdk.actions.ready();
        console.log('✅ Farcaster SDK initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Farcaster SDK:', error);
        
        setTimeout(async () => {
          try {
            await sdk.actions.ready();
            console.log('Farcaster SDK initialized on retry');
          } catch (retryError) {
            console.error('Farcaster SDK retry failed:', retryError);
          }
        }, 1000);
      }
    };
    
    initializeFarcaster();
  }, []);

  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  
  // Auto-connect wallet ONLY when in Farcaster and authenticated
  useEffect(() => {
    const autoConnect = async (): Promise<void> => {
      // Only auto-connect in Farcaster
      if (!isInFarcaster) return;
      
      if (isAuthenticated && farcasterAddress && !isConnected) {
        console.log('🔄 Auto-connecting Farcaster wallet...', {
          isInFarcaster,
          isAuthenticated,
          farcasterAddress: farcasterAddress.slice(0, 6) + '...' + farcasterAddress.slice(-4),
          isConnected
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          // In Farcaster, use injected connector (Farcaster provides window.ethereum)
          const injectedConnector = connectors.find(
            (c) => c.id === 'injected' || c.type === 'injected'
          );
          
          if (injectedConnector) {
            console.log('✅ Found Farcaster injected connector, auto-connecting...');
            await connect({ connector: injectedConnector });
            console.log('✅ Farcaster wallet auto-connected successfully!');
          } else {
            console.log('⚠️ Injected connector not found in Farcaster');
          }
        } catch (error) {
          console.error('❌ Auto-connect failed:', error);
          // Silent fail - user can still connect manually
        }
      }
    };
    
    autoConnect();
  }, [isInFarcaster, isAuthenticated, farcasterAddress, isConnected, connect, connectors]);

  // State
  const [packCount, setPackCount] = useState<number>(1);
  const [stage, setStage] = useState<MintStage>('idle');
  const [revealedCards, setRevealedCards] = useState<RevealedCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [userMintedNFTs, setUserMintedNFTs] = useState<MintedNFT[]>([]);
  const [communityNFTs, setCommunityNFTs] = useState<MintedNFT[]>([]);
  
  // Mouse/Touch Effect State - Initialize to center of screen
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ 
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, 
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 
  });

  // Web3 Hooks
  const { data: usdcBalance } = useReadContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'balanceOf', args: address ? [address] : undefined });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'allowance', args: address ? [address, NFT_CONTRACT_ADDRESS] : undefined });
  const { data: totalSupply } = useReadContract({ address: NFT_CONTRACT_ADDRESS, abi: NFT_ABI, functionName: 'totalSupply' });
  const { data: approveHash, isPending: isApprovePending, writeContract: approveWrite, error: approveError } = useWriteContract();
  const { data: mintHash, isPending: isMintPending, writeContract: mintWrite, error: mintError } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed, error: approveReceiptError } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isMintConfirming, isSuccess: isMintConfirmed, data: mintReceipt, error: mintReceiptError } = useWaitForTransactionReceipt({ hash: mintHash });

  // Computed
  const totalCost = useMemo(() => parseUnits((parseFloat(PACK_PRICE) * packCount).toString(), 6), [packCount]);
  const hasEnoughBalance = useMemo(() => usdcBalance ? (usdcBalance as bigint) >= totalCost : false, [usdcBalance, totalCost]);
  const needsApproval = useMemo(() => allowance ? (allowance as bigint) < totalCost : true, [allowance, totalCost]);

  // Effects
  
  // Flashlight effect - Mouse and Touch support
  useEffect(() => {
    // Set initial position to center on mount
    setMousePos({ 
      x: window.innerWidth / 2, 
      y: window.innerHeight / 2 
    });

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent): void => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    // Touch move handler for mobile
    const handleTouchMove = (e: TouchEvent): void => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        setMousePos({ x: touch.clientX, y: touch.clientY });
      }
    };

    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    
    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  useEffect(() => {
    if (address) {
      const stored = localStorage.getItem(`nfts_${address}`);
      if (stored) {
        try {
          setUserMintedNFTs(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse stored NFTs', e);
        }
      }
    }
  }, [address]);

  // 🔥 Fetch REAL minted NFTs from contract PackOpened events
  // Added debounce to reduce unnecessary fetches
  useEffect(() => {
    const fetchRecentMints = async (): Promise<void> => {
      if (!publicClient || !totalSupply || typeof totalSupply !== 'bigint') return;
      
      try {
        const supply = Number(totalSupply);
        if (supply === 0) return;
        
        console.log('📦 Fetching recent mints from contract events...');
        
        // Fetch PackOpened events from the last 1,000 blocks (optimized for bandwidth)
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - BigInt(1000);
        
        const logs = await publicClient.getLogs({
          address: NFT_CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'PackOpened',
            inputs: [
              { indexed: true, name: 'buyer', type: 'address' },
              { indexed: false, name: 'tokenId', type: 'uint256' },
              { indexed: false, name: 'artId', type: 'uint256' },
              { indexed: false, name: 'fid', type: 'string' }
            ]
          },
          fromBlock,
          toBlock: 'latest'
        });
        
        console.log(`✅ Found ${logs.length} PackOpened events`);
        
        if (logs.length === 0) {
          // Fallback: If no events found in recent blocks, show last 10 tokens with placeholder art
          const nfts: MintedNFT[] = [];
          const startId = Math.max(1, supply - 9); // Last 10 NFTs
          for (let i = supply; i >= startId; i--) {
            nfts.push({ 
              id: `community-${i}`, 
              image: `ipfs://${IPFS_CID}/${(i % TOTAL_ART_COUNT) || TOTAL_ART_COUNT}.png`, 
              tokenId: i.toString() 
            });
          }
          setCommunityNFTs(nfts);
          return;
        }
        
        // Decode events and extract artIds
        const mintedNFTs = logs
          .map((log) => {
            try {
              const decoded = decodeEventLog({
                abi: NFT_ABI,
                data: log.data,
                topics: log.topics
              });
              const args = decoded.args as { buyer: Address; tokenId: bigint; artId: bigint; fid: string };
              
              return {
                id: `community-${args.tokenId}`,
                image: `ipfs://${IPFS_CID}/${args.artId}.png`,
                tokenId: args.tokenId.toString(),
                artId: Number(args.artId)
              };
            } catch (error) {
              console.error('Failed to decode log:', error);
              return null;
            }
          })
          .filter((nft) => nft !== null)
          .reverse() // Show newest first
          .slice(0, 10); // Show last 10 mints (optimized for bandwidth)
        
        console.log(`🎨 Displaying ${mintedNFTs.length} recent NFTs with real artIds`);
        
        // If we got less than 10, fetch the remaining from totalSupply
        if (mintedNFTs.length < 10 && supply > 0) {
          const remaining = 10 - mintedNFTs.length;
          const fallbackNFTs: MintedNFT[] = [];
          const startId = Math.max(1, supply - remaining + 1);
          
          for (let i = supply; i >= startId && fallbackNFTs.length < remaining; i--) {
            // Skip if already in mintedNFTs
            if (!mintedNFTs.find(nft => nft.tokenId === i.toString())) {
              fallbackNFTs.push({ 
                id: `community-${i}`, 
                image: `ipfs://${IPFS_CID}/${(i % TOTAL_ART_COUNT) || TOTAL_ART_COUNT}.png`, 
                tokenId: i.toString() 
              });
            }
          }
          
          setCommunityNFTs([...mintedNFTs, ...fallbackNFTs].slice(0, 10));
        } else {
          setCommunityNFTs(mintedNFTs);
        }
        
      } catch (error) {
        console.error('❌ Error fetching recent mints:', error);
        
        // Fallback to showing last 10 token IDs with placeholder art
        const supply = Number(totalSupply);
        const nfts: MintedNFT[] = [];
        const startId = Math.max(1, supply - 9); // Last 10 NFTs
        for (let i = supply; i >= startId; i--) {
          nfts.push({ 
            id: `community-${i}`, 
            image: `ipfs://${IPFS_CID}/${(i % TOTAL_ART_COUNT) || TOTAL_ART_COUNT}.png`, 
            tokenId: i.toString() 
          });
        }
        setCommunityNFTs(nfts);
      }
    };
    
    // Debounce: Wait 2 seconds before fetching to avoid excessive requests
    const timer = setTimeout(() => {
      fetchRecentMints();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [totalSupply, publicClient]);

  // Track approval hash creation
  useEffect(() => {
    if (approveHash) {
      console.log('✅ Approval transaction submitted!', {
        hash: approveHash,
        explorer: `https://basescan.org/tx/${approveHash}`
      });
    }
  }, [approveHash]);

  // Track approval confirmation
  useEffect(() => {
    if (isApproveConfirmed && stage === 'approving') {
      console.log('✅ Approval confirmed! Proceeding to mint...');
      setStage('approved');
      refetchAllowance();
      
      // Automatically proceed to mint after approval
      setTimeout(() => {
        handleMint();
      }, 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproveConfirmed, stage, refetchAllowance]);

  // Handle approval errors
  useEffect(() => {
    if (approveError && stage === 'approving') {
      console.error('❌ Approval error:', approveError);
      setStage('idle');
    }
  }, [approveError, stage]);

  // Handle approval receipt errors
  useEffect(() => {
    if (approveReceiptError && stage === 'approving') {
      console.error('❌ Approval receipt error:', approveReceiptError);
      setStage('idle');
    }
  }, [approveReceiptError, stage]);

  // Track mint hash creation
  useEffect(() => {
    if (mintHash) {
      console.log('✅ Mint transaction submitted!', {
        hash: mintHash,
        explorer: `https://basescan.org/tx/${mintHash}`
      });
    }
  }, [mintHash]);

  // Handle mint errors
  useEffect(() => {
    if (mintError && stage === 'minting') {
      console.error('❌ Mint error:', mintError);
      setStage('idle');
    }
  }, [mintError, stage]);

  // Handle mint receipt errors
  useEffect(() => {
    if (mintReceiptError && stage === 'minting') {
      console.error('❌ Mint receipt error:', mintReceiptError);
      setStage('idle');
    }
  }, [mintReceiptError, stage]);

  // 🔥 CRITICAL FIX: Listen to PackOpened events and get REAL artIds from contract
  useEffect(() => {
    if (isMintConfirmed && mintReceipt && stage === 'minting' && address) {
      console.log('✅ Mint confirmed! Reading PackOpened events from transaction...');
      
      const processEvents = async (): Promise<void> => {
        try {
          // Filter PackOpened events from transaction logs
          const packOpenedEvents = mintReceipt.logs
            .filter((log: Log) => {
              try {
                const decoded = decodeEventLog({
                  abi: NFT_ABI,
                  data: log.data,
                  topics: log.topics,
                });
                return decoded.eventName === 'PackOpened';
              } catch {
                return false;
              }
            })
            .map((log: Log) => {
              const decoded = decodeEventLog({
                abi: NFT_ABI,
                data: log.data,
                topics: log.topics,
              });
              return decoded.args as { buyer: Address; tokenId: bigint; artId: bigint; fid: string };
            });

          console.log('📦 PackOpened events found:', packOpenedEvents);

          if (packOpenedEvents.length === 0) {
            console.error('⚠️ No PackOpened events found in transaction');
            setStage('idle');
            return;
          }

          // Create revealed cards using REAL artIds from contract events
          const cards: RevealedCard[] = packOpenedEvents.map((event) => {
            const artId = Number(event.artId);
            const tokenId = Number(event.tokenId);
            console.log(`🎨 Token #${tokenId} -> Art ID #${artId}`);
            
            return {
              tokenURI: `ipfs://${IPFS_CID}/${artId}.png`,
              number: artId,
              tokenId: tokenId
            };
          });

          setRevealedCards(cards);
          setCurrentCardIndex(0);
          setStage('animating');

          // Store NFTs in localStorage with correct artIds
          const newNFTs: MintedNFT[] = cards.map((card) => ({ 
            id: `${card.tokenId}`, 
            image: card.tokenURI,
            tokenId: card.tokenId.toString()
          }));

          const stored = localStorage.getItem(`nfts_${address}`);
          const existing: MintedNFT[] = stored ? JSON.parse(stored) : [];
          const updated = [...newNFTs, ...existing];
          localStorage.setItem(`nfts_${address}`, JSON.stringify(updated));
          setUserMintedNFTs(updated);

          console.log(`🎉 ${packOpenedEvents.length} NFT${packOpenedEvents.length > 1 ? 's' : ''} minted successfully!`);
        } catch (error) {
          console.error('❌ Error processing PackOpened events:', error);
          setStage('idle');
        }
      };

      processEvents();
    }
  }, [isMintConfirmed, mintReceipt, stage, address]);

  // Handlers
  const handleApprove = (): void => {
    if (!isConnected || !address) {
      console.error('❌ Wallet not connected in handleApprove');
      return;
    }
    
    if (!hasEnoughBalance) {
      console.error('❌ Insufficient USDC balance');
      return;
    }
    
    console.log('✅ Starting approval transaction...', {
      from: address,
      spender: NFT_CONTRACT_ADDRESS,
      amount: totalCost.toString(),
      amountUSDC: (parseFloat(PACK_PRICE) * packCount).toFixed(2)
    });
    
    setStage('approving');
    
    // This will trigger the wallet popup
    approveWrite({ 
      address: USDC_ADDRESS, 
      abi: USDC_ABI, 
      functionName: 'approve', 
      args: [NFT_CONTRACT_ADDRESS, totalCost] 
    });
    
    console.log('🔄 Approval request sent to wallet - waiting for user confirmation...');
  };

  const handleMint = (): void => {
    if (!isConnected || !address) {
      console.error('❌ Wallet not connected in handleMint');
      return;
    }
    
    // Get Farcaster ID if available, otherwise use wallet address
    const fid: string = userData?.fid?.toString() || address.slice(2, 10);
    
    console.log('🎨 Starting mint with openPacks...', { 
      packCount,
      fid,
      contract: NFT_CONTRACT_ADDRESS,
      from: address
    });
    
    setStage('minting');
    
    // Call openPacks with count and fid (contract generates random artIds internally)
    mintWrite({ 
      address: NFT_CONTRACT_ADDRESS, 
      abi: NFT_ABI, 
      functionName: 'openPacks', 
      args: [BigInt(packCount), fid] 
    });
    
    console.log('✅ openPacks transaction initiated', {
      method: 'openPacks',
      args: { count: packCount, fid }
    });
  };

  const handleOpenPack = async (): Promise<void> => {
    // Prevent multiple calls if already processing
    if (stage !== 'idle' && stage !== 'approved') {
      console.log('⏸️ Operation already in progress, stage:', stage);
      return;
    }
    
    // Step 1: Check wallet connection
    if (!isConnected || !address) {
      console.log('🔌 Wallet not connected...');
      
      // In Farcaster: show helpful message (wallet should auto-connect)
      if (isInFarcaster) {
        console.log('⚠️ In Farcaster but wallet not connected - waiting for auto-connect');
        return;
      }
      
      // Outside Farcaster: use coinbaseWallet connector
      try {
        console.log('🔌 Connecting wallet outside Farcaster...');
        const coinbaseConnector = connectors.find(
          (c) => c.id === 'coinbaseWalletSDK' || c.name.toLowerCase().includes('coinbase')
        );
        
        if (coinbaseConnector) {
          console.log('✅ Found Coinbase Wallet connector, connecting...');
          await connect({ connector: coinbaseConnector });
          console.log('✅ Wallet connected successfully!');
        } else {
          console.error('❌ Coinbase Wallet connector not found');
        }
        return;
      } catch (error) {
        console.error('❌ Failed to connect wallet:', error);
        return;
      }
    }
    
    console.log('📦 Opening pack...', { 
      stage, 
      needsApproval, 
      allowance: allowance?.toString(),
      totalCost: totalCost.toString(),
      packCount,
      isInFarcaster,
      farcasterAddress
    });
    
    // Step 2: Check if approval is needed
    if (needsApproval) {
      console.log('🔐 Approval needed, calling handleApprove...');
      handleApprove();
    } else {
      console.log('✅ Already approved, calling handleMint...');
      handleMint();
    }
  };

  const handleAnimationComplete = (): void => {
    if (currentCardIndex < revealedCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    } else {
      setStage('revealed');
    }
  };

  const handleContinue = (): void => {
    setStage('idle');
    setRevealedCards([]);
    setCurrentCardIndex(0);
    setPackCount(1);
  };

  const handleSkipToReveal = (): void => {
    console.log('⏭️ Skipping all animations - jumping to reveal');
    setStage('revealed');
  };

  // ========================
  // RENDER LOGIC
  // ========================

  if (stage === 'animating' && revealedCards[currentCardIndex]) {
    return <PackOpening cardImage={revealedCards[currentCardIndex].tokenURI} cardNumber={currentCardIndex + 1} totalCards={revealedCards.length} onAnimationComplete={handleAnimationComplete} onSkip={handleSkipToReveal} />;
  }

  // ==========================================
  // 🩸 REVEALED SCREEN (HAWKINS GALLERY UI)
  // ==========================================
  if (stage === 'revealed') {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center font-sans relative overflow-x-hidden selection:bg-red-500 selection:text-black">
        
        {/* --- KATMAN 1: ATMOSFER (Sabit Arka Plan) --- */}
        <div className="fixed inset-0 pointer-events-none z-0">
            {/* Kırmızı Upside Down Gökyüzü */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#4a0000_0%,#000000_70%)] opacity-80"></div>
            
            {/* Hareketli Sis (CSS Animasyonu ile) */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20 mix-blend-overlay"></div>
            
            {/* Kırmızı Şimşek Çakmaları (Rastgele) */}
            <div className="absolute inset-0 bg-red-600/5 animate-pulse-slow mix-blend-color-dodge"></div>
        </div>

        {/* --- KATMAN 2: İÇERİK (Scroll Edilebilir) --- */}
        <div className="relative z-10 w-full max-w-6xl px-3 pt-10 md:pt-12 pb-24 md:pb-32 flex flex-col items-center">
           
           {/* 🎬 SİNEMATİK BAŞLIK */}
           <div className="relative mb-10 md:mb-16 group text-center">
              <div className="absolute -inset-5 md:-inset-8 bg-red-600/30 blur-[32px] md:blur-[48px] opacity-50 group-hover:opacity-100 transition duration-1000"></div>
              <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-[#ff0000] via-[#aa0000] to-black tracking-tighter scale-y-90 drop-shadow-[0_3px_8px_rgba(255,0,0,0.8)] px-3" 
                  style={{ fontFamily: 'ITC Benguiat, serif', WebkitTextStroke: '1px #ff0000' }}>
                Welcome To<br/>Hawkins
              </h1>
              <div className="w-full h-[2px] bg-red-600/50 mt-2 md:mt-3 shadow-[0_0_16px_red]"></div>
              <p className="text-red-400 font-mono text-[8px] sm:text-[10px] tracking-[0.4em] sm:tracking-[0.6em] md:tracking-[0.8em] uppercase mt-2 md:mt-3 opacity-80 animate-pulse">
                Artifacts Recovered
              </p>
           </div>

           {/* 🃏 KART IZGARASI */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10 w-full perspective-grid">
            {revealedCards.map((card: RevealedCard, idx: number) => (
              <div key={idx} 
                   className="group relative flex flex-col items-center"
                   style={{ animation: `fade-in-up 0.8s ease-out ${idx * 0.15}s backwards` }}>
                
                {/* Kart Container */}
                <div className="relative w-full max-w-[280px] mx-auto h-[350px] sm:h-[380px] md:h-[420px] transition-all duration-500 transform-style-3d group-hover:rotate-x-6 group-hover:rotate-y-6 group-hover:scale-105">
                  
                  {/* Neon Glow (Hover'da aktifleşir) */}
                  <div className="absolute -inset-[2px] bg-gradient-to-b from-red-500 to-black rounded-lg blur opacity-20 group-hover:opacity-100 transition duration-500"></div>
                  
                  {/* Kartın Kendisi (Evidence File Görünümü) */}
                  <div className="relative w-full h-full bg-[#111] border border-red-900/60 rounded-lg overflow-hidden shadow-2xl flex flex-col">
                    
                    {/* Üst Bant: "TOP SECRET" */}
                    <div className="h-7 sm:h-8 bg-[#1a0505] border-b border-red-900/30 flex items-center justify-between px-2 sm:px-3">
                        <div className="flex gap-1 sm:gap-1.5">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-600 animate-pulse"></div>
                            <span className="text-[8px] sm:text-[10px] text-red-500 font-mono tracking-wider sm:tracking-widest">CONFIDENTIAL</span>
                        </div>
                        <span className="text-[8px] sm:text-[10px] text-gray-500 font-mono">TOKEN #{card.tokenId}</span>
                    </div>

                    {/* Görsel Alanı */}
                    <div className="relative flex-1 bg-black overflow-hidden group-hover:brightness-110 transition duration-500">
                        {/* CRT Scanlines Overlay */}
                        <div className="absolute inset-0 z-20 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%]"></div>
                        
                        {/* NFT Resmi - Multi-gateway fallback */}
                        <img 
                          src={ipfsToHttp(card.tokenURI)} 
                          alt={`Artifact ${card.number}`} 
                          className="w-full h-full object-cover opacity-90 grayscale group-hover:grayscale-0 transition-all duration-700"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            // Try different IPFS gateways in sequence
                            if (target.src.includes('cloudflare-ipfs.com')) {
                              console.log('⚠️ Cloudflare gateway failed, trying ipfs.io...');
                              target.src = target.src.replace('cloudflare-ipfs.com', 'ipfs.io');
                            } else if (target.src.includes('ipfs.io')) {
                              console.log('⚠️ ipfs.io gateway failed, trying dweb.link...');
                              target.src = target.src.replace('ipfs.io', 'dweb.link');
                            } else if (target.src.includes('dweb.link')) {
                              console.log('❌ All IPFS gateways failed, showing placeholder');
                              target.src = 'https://placehold.co/320x480/111/red?text=CLASSIFIED';
                            }
                          }}
                        />

                        {/* Alt Gradient */}
                        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#111] to-transparent z-10"></div>
                    </div>

                    {/* Alt Bilgi Alanı */}
                    <div className="h-16 sm:h-20 bg-[#0a0a0a] p-2 sm:p-3 relative z-20 border-t border-red-900/30">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-900 text-white text-[7px] sm:text-[8px] font-bold px-1.5 sm:px-2 py-0.5 rounded shadow-lg border border-red-500">
                            ART #{card.number}
                        </div>
                        <div className="flex justify-between mt-3 sm:mt-5 text-[7px] sm:text-[8px] text-gray-500 font-mono uppercase tracking-wider sm:tracking-widest">
                            <span>Origin: Upside Down</span>
                            <span>Status: Recovered</span>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- SABİT BUTON PANELİ (Alt Kısım) --- */}
        <div className="fixed bottom-0 left-0 w-full z-50 pointer-events-none">
             {/* Gradient Fade */}
             <div className="absolute bottom-0 w-full h-40 md:h-52 bg-gradient-to-t from-black via-black/90 to-transparent"></div>
             
             {/* Buton Container - Flex Column on Mobile, Row on Desktop */}
             <div className="relative w-full pb-5 md:pb-8 flex flex-col sm:flex-row justify-center items-center gap-3 h-auto pointer-events-auto px-3">
                  {/* Share on Farcaster Button */}
                  <button 
                    onClick={async () => {
                      const count = revealedCards.length;
                      
                      // Create text without NFT details
                      const text = encodeURIComponent(
  `Just minted ${revealedCards.length} Stranger Things NFT${revealedCards.length > 1 ? 's' : ''} from the Upside Down! 🔴⚡\n\n` +
  revealedCards.map(card => `Artifact #${card.number}`).join('\n') + '\n\n' +
  `Experience: https://voltpacks.xyz\n\n` +
  `#StrangerThings #NFT #Base #Web3`
);
                      
                      // Add NFT images as embeds (Farcaster supports up to 4 embeds)
                      const embeds = revealedCards.slice(0, 4).map(card => 
                        `&embeds[]=${encodeURIComponent(ipfsToHttp(card.tokenURI))}`
                      ).join('');
                      
                      const url = `https://warpcast.com/~/compose?text=${text}${embeds}`;
                      
                      // If in Farcaster, use SDK to open as embed
                      if (isInFarcaster) {
                        try {
                          await sdk.actions.openUrl(url);
                          console.log('✅ Opened Warpcast composer in Farcaster embed');
                        } catch (error) {
                          console.error('❌ Failed to open URL via SDK:', error);
                          window.open(url, '_blank');
                        }
                      } else {
                        window.open(url, '_blank');
                      }
                    }}
                    className="group relative px-5 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 bg-black border-2 border-purple-800 text-purple-500 font-bold text-sm sm:text-base md:text-lg tracking-[0.12em] sm:tracking-[0.16em] uppercase transition-all duration-300 hover:text-white hover:border-purple-500 overflow-hidden skew-x-[-10deg]"
                  >
                     {/* Hover Arka Planı */}
                     <div className="absolute inset-0 bg-gradient-to-r from-purple-700 to-pink-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out skew-x-[10deg] origin-bottom"></div>
                     
                     {/* Buton Metni */}
                     <span className="relative z-10 flex items-center gap-1.5 sm:gap-2 skew-x-[10deg] text-center">
                         <span className="hidden md:inline">SHARE ON FARCASTER</span>
                         <span className="md:hidden">SHARE</span>
                     </span>

                     {/* Neon Glow Efekti */}
                     <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 shadow-[0_0_30px_rgba(168,85,247,0.6)]"></div>
                  </button>

                  {/* Return Button */}
                  <button 
                    onClick={handleContinue} 
                    className="group relative px-6 sm:px-8 md:px-10 py-2 sm:py-3 md:py-4 bg-black border-2 border-red-800 text-red-600 font-bold text-sm sm:text-base md:text-lg tracking-[0.12em] sm:tracking-[0.16em] uppercase transition-all duration-300 hover:text-white hover:border-red-500 overflow-hidden skew-x-[-10deg]"
                 >
                    {/* Hover Arka Planı */}
                    <div className="absolute inset-0 bg-red-700 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out skew-x-[10deg] origin-bottom"></div>
                    
                    {/* Buton Metni */}
                    <span className="relative z-10 flex items-center gap-2 sm:gap-3 skew-x-[10deg] text-center">
                        <span className="hidden sm:inline">RETURN TO THE GATE</span>
                        <span className="sm:hidden">RETURN</span>
                    </span>

                    {/* Neon Glow Efekti */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 shadow-[0_0_30px_rgba(255,0,0,0.6)]"></div>
                 </button>
             </div>
        </div>
        
        {/* Dekoratif Sarmaşıklar (Fixed) */}
        <CreepingVines />

        {/* Custom CSS for fade-in-up animation */}
        <style jsx>{`
          @keyframes fade-in-up {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .perspective-grid {
            perspective: 1500px;
          }
          
          .transform-style-3d {
            transform-style: preserve-3d;
          }
          
          .rotate-x-6 {
            transform: rotateX(6deg);
          }
          
          .rotate-y-6 {
            transform: rotateY(6deg);
          }
        `}</style>
      </div>
    );
  }

  // ========================
  // RENDER: IDLE (MAIN)
  // ========================
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-sans selection:bg-red-900 selection:text-white cursor-crosshair">
      
      {/* 🔦 FLASHLIGHT EFFECT */}
      <div 
        className="pointer-events-none fixed inset-0 z-25 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.98) 100%)`
        }}
      ></div>

      {/* 📺 CRT GRAIN & SCANLINES */}
      <div className="fixed inset-0 z-20 pointer-events-none opacity-10 bg-[url('https://upload.wikimedia.org/wikipedia/commons/7/76/Noise_tv.png')] animate-grain"></div>
      <div className="fixed inset-0 z-20 pointer-events-none bg-gradient-to-b from-transparent via-red-900/5 to-transparent bg-[length:100%_4px] animate-scanline opacity-20"></div>

      {/* BACKGROUND DEPTH */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#1a0505_0%,#050101_100%)] z-0"></div>
      <CreepingVines />
      <ChristmasLights />
      
      {/* 🌫️ SPORES (Upside Down Ash) - Optimized count */}
      {[...Array(10)].map((_, i) => (
        <div key={i} className="spore-particle z-10" style={{
            left: `${Math.random() * 100}%`,
            width: Math.random() * 4 + 1 + 'px',
            height: Math.random() * 4 + 1 + 'px',
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${10 + Math.random() * 10}s`,
            opacity: Math.random() * 0.7
          }}
        />
      ))}

      {/* MAIN CONTENT */}
      <div className="relative z-40 min-h-screen flex flex-col items-center justify-center p-4 pt-24 md:pt-20">
        
        {/* LOGO AREA */}
        <div className="relative mb-6 md:mb-10 group">
          <div className="absolute -inset-5 md:-inset-8 bg-red-600/20 blur-[48px] md:blur-[80px] animate-pulse-slow group-hover:bg-red-600/30 transition-all duration-500"></div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-900 tracking-tighter drop-shadow-[0_0_24px_rgba(255,0,0,0.8)] scale-y-90" 
              style={{ 
                fontFamily: 'ITC Benguiat, serif',
                textShadow: '0 4px 20px rgba(200, 0, 0, 0.5)'
              }}>
            STRANGER <br/> CARDS
          </h1>
          <div className="absolute top-0 left-0 w-full h-full border-t border-b border-red-900/30 scale-x-125 pointer-events-none"></div>
          <p className="text-red-500 font-mono text-[10px] sm:text-xs md:text-sm tracking-[0.4em] md:tracking-[0.6em] text-center mt-2 md:mt-3 animate-flicker uppercase opacity-80">
            Upside Down Artifacts
          </p>
        </div>

        {/* 📦 THE PACK (Interactive & Animated) */}
        <div className="relative group perspective-card mb-6 md:mb-10">
          {/* Floating Particles around Pack */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-red-500/60 rounded-full animate-float-particle"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            />
          ))}
          
          <div className="relative w-52 h-64 sm:w-60 sm:h-80 md:w-64 md:h-[380px] transition-transform duration-500 transform-style-3d group-hover:rotate-y-6 group-hover:rotate-x-6 animate-float-card">
            
            {/* Multi-Layer Pulsing Aura */}
            <div className="absolute -inset-4 bg-red-600/30 rounded-full blur-2xl group-hover:bg-red-600/50 animate-pulse transition-all"></div>
            <div className="absolute -inset-8 bg-red-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '0.5s'}}></div>
            <div className="absolute -inset-12 bg-red-400/10 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '1s'}}></div>
            
            {/* The Pack Itself */}
            <div className="relative w-full h-full bg-[#0a0a0a] border-[3px] border-red-800/80 rounded-lg shadow-[0_0_60px_rgba(139,0,0,0.3)] flex flex-col items-center justify-center overflow-hidden animate-card-glow">
               {/* Grunge Texture */}
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-60 mix-blend-overlay"></div>
               <div className="absolute inset-0 bg-gradient-to-t from-red-900/40 via-transparent to-black/80"></div>
               
               {/* Animated Veins on Card (More Dynamic) */}
               <svg className="absolute inset-0 w-full h-full opacity-40 mix-blend-color-dodge" viewBox="0 0 100 100" preserveAspectRatio="none">
                 <path d="M50,110 Q10,70 50,50 T50,-10" stroke="#ff0000" strokeWidth="1" fill="none" className="animate-pulse-slow" />
                 <path d="M-10,50 Q40,60 50,50 T110,50" stroke="#ff0000" strokeWidth="1" fill="none" className="animate-pulse-slow" style={{animationDelay: '1s'}} />
                 <path d="M0,0 Q50,25 100,50 T100,100" stroke="#ff0000" strokeWidth="0.5" fill="none" className="animate-pulse-slow" style={{animationDelay: '0.5s'}} />
               </svg>
               
               {/* Rotating Energy Ring */}
               <div className="absolute inset-0 border-2 border-red-500/20 rounded-lg animate-spin-slow"></div>

               <div className="relative z-10 text-center transform group-hover:scale-105 transition-transform">
                 <div className="text-[10px] text-red-500 tracking-[0.24em] mb-1.5 font-mono animate-pulse">WARNING: HAZARDOUS</div>
                 <h2 className="text-4xl font-extrabold text-red-600 tracking-tighter drop-shadow-[0_2px_8px_rgba(0,0,0,1)] animate-text-glow" style={{ fontFamily: 'ITC Benguiat, serif' }}>
                   MYSTERY<br/>PACK
                 </h2>
               </div>
            </div>
          </div>
        </div>

        {/* 🎛️ CONTROLS */}
        <div className="flex flex-col items-center gap-3 md:gap-5 w-full max-w-sm z-50 px-3">
           {/* Counter */}
           <div className="flex items-center gap-3 sm:gap-5 bg-black/50 p-1.5 rounded-xl border border-red-900/30 backdrop-blur-sm">
              <button onClick={() => setPackCount(Math.max(1, packCount - 1))} disabled={stage !== 'idle'}
                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-red-500 hover:text-white hover:bg-red-900/50 rounded-lg text-lg sm:text-xl font-bold transition-all border border-red-900/30">-</button>
              <div className="text-center w-16 sm:w-20">
                <span className="text-xl sm:text-2xl font-bold text-white drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]">{packCount}</span>
                <div className="text-[8px] sm:text-[9px] text-gray-500 font-mono tracking-widest uppercase">PACKS</div>
              </div>
              <button onClick={() => setPackCount(packCount + 1)} disabled={stage !== 'idle'}
                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-red-500 hover:text-white hover:bg-red-900/50 rounded-lg text-lg sm:text-xl font-bold transition-all border border-red-900/30">+</button>
           </div>

           {/* Action Button */}
           <button
            onClick={handleOpenPack}
            disabled={stage !== 'idle' && stage !== 'approved'}
            className={`
              relative w-full py-3 sm:py-4 md:py-5 px-5 sm:px-6 font-bold text-sm sm:text-base md:text-lg tracking-[0.12em] sm:tracking-[0.16em] uppercase transition-all duration-300 group overflow-hidden rounded-sm pointer-events-auto
              ${(stage !== 'idle' && stage !== 'approved') ? 'bg-gray-800 text-gray-600 border border-gray-700 cursor-wait' :
                !isConnected ? 'bg-gray-900 text-gray-500 border border-gray-700 cursor-pointer hover:bg-gray-800 hover:text-gray-400' :
                'bg-red-900/20 text-red-500 border border-red-600 hover:bg-red-600 hover:text-black hover:shadow-[0_0_50px_rgba(255,0,0,0.6)] cursor-pointer'}
            `}
          >
            {/* Button Inner Glitch Effect */}
            <div className="absolute inset-0 bg-red-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 skew-y-12"></div>
            <span className="relative z-10 flex items-center justify-center gap-2">
               {stage === 'approving' ? (
                 <span className="animate-pulse">AWAITING APPROVAL...</span>
               ) : isApproveConfirming ? (
                 <span className="animate-pulse">CONFIRMING APPROVAL...</span>
               ) : stage === 'minting' ? (
                 <span className="animate-pulse">OPENING PACK...</span>
               ) : isMintConfirming ? (
                 <span className="animate-pulse">MINTING...</span>
               ) : !isConnected ? (
                 <>
                   {isInFarcaster && isAuthenticated && userData ? (
                     <span className="flex flex-col items-center gap-0.5">
                       <span className="text-sm">CONNECT WALLET</span>
                       <span className="text-[10px] opacity-70">@{userData.username}</span>
                     </span>
                   ) : (
                     'CONNECT WALLET'
                   )}
                 </>
               ) : needsApproval ? (
                 'AUTHORIZE'
               ) : (
                 'OPEN PACK'
               )}
            </span>
          </button>
          
          <div className="text-[8px] sm:text-[10px] text-red-900/80 font-mono tracking-wider sm:tracking-widest text-center">
            TOTAL FLUX: {(parseFloat(PACK_PRICE) * packCount).toFixed(2)} USDC
          </div>
        </div>

        {/* 📼 VHS TAPE SLIDER (Community) */}
        {communityNFTs.length > 0 && (
          <div className="mt-12 md:mt-20 w-full border-t border-red-900/20 pt-6 md:pt-10 relative">
            <h3 className="text-center text-red-800 font-mono text-[10px] sm:text-xs tracking-[0.24em] sm:tracking-[0.4em] mb-5 md:mb-6 uppercase animate-pulse">Recent Discoveries</h3>
            <div className="relative overflow-hidden mask-linear-fade">
              <div className="flex gap-5 animate-scroll-left hover:[animation-play-state:paused] py-3">
                {[...communityNFTs, ...communityNFTs].map((nft: MintedNFT, idx: number) => (
                  <div key={`${nft.id}-${idx}`} className="flex-shrink-0 w-32 group cursor-pointer">
                    {/* VHS Case Look */}
                    <div className="relative aspect-[2/3] bg-gray-900 rounded border border-gray-800 overflow-hidden transform group-hover:-translate-y-2 transition-transform duration-300 shadow-lg">
                       <img 
                         src={ipfsToHttp(nft.image)} 
                         alt={`Token #${nft.tokenId}`}
                         loading="lazy" 
                         className="w-full h-full object-cover opacity-60 group-hover:opacity-100 grayscale group-hover:grayscale-0 transition-all duration-500" 
                         onError={(e) => {
                           const target = e.target as HTMLImageElement;
                           // Fallback to a different IPFS gateway if Cloudflare fails
                           if (target.src.includes('cloudflare-ipfs.com')) {
                             target.src = target.src.replace('cloudflare-ipfs.com', 'ipfs.io');
                           } else if (target.src.includes('ipfs.io')) {
                             // Second fallback to placeholder
                             target.src = 'https://placehold.co/128x192/1a1a1a/red?text=NFT';
                           }
                         }}
                       />
                       <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                       {/* Tape Label */}
                       <div className="absolute bottom-1.5 sm:bottom-2 left-1.5 sm:left-2 bg-white text-black text-[8px] sm:text-[10px] font-mono px-1 transform -rotate-2">
                         {nft.artId ? `ART_${nft.artId}` : `TOK_${nft.tokenId}`}
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Splash Screen - Loading bitince kendini kapatır */}
      {isLoading && <SplashScreen finishLoading={() => setIsLoading(false)} />}
      
      {/* GitHub Export Button - Always visible during build */}
      
      
      <MusicPanel />
      <SoundCloudPlayer />
    </div>
  );
}
