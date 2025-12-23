/**
 * Wagmi Configuration
 * 
 * CRITICAL: This file must NOT be imported at top level anywhere except inside LazyRainbowKit.
 * It contains dynamic imports that will trigger SES if loaded during app bootstrap.
 * 
 * This config is loaded dynamically after window.onload to prevent SES from breaking React.
 */

// This function creates the config dynamically - no top-level imports
export async function createWagmiConfig() {
  // Dynamic imports - only execute when this function is called
  const { getDefaultConfig } = await import('@rainbow-me/rainbowkit');
  const { http } = await import('wagmi');
  const { mainnet, sepolia, base, baseSepolia } = await import('wagmi/chains');

  // ARC Testnet configuration
  const arcTestnet = {
    id: parseInt(import.meta.env.VITE_ARC_CHAIN_ID || '5042002', 10),
    name: 'ARC Testnet',
    nativeCurrency: {
      decimals: 6, // USDC uses 6 decimals
      name: 'USDC',
      symbol: 'USDC',
    },
    rpcUrls: {
      default: {
        http: [import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.network'],
      },
    },
    blockExplorers: {
      default: {
        name: 'ARC Explorer',
        url: import.meta.env.VITE_ARC_EXPLORER_URL || 'https://testnet.arcscan.app',
      },
    },
    testnet: true,
  } as const;

  // ARC Mainnet configuration
  const arcMainnet = {
    id: 5042001,
    name: 'ARC Network',
    nativeCurrency: {
      decimals: 6,
      name: 'USDC',
      symbol: 'USDC',
    },
    rpcUrls: {
      default: {
        http: ['https://rpc.arc.network'],
      },
    },
    blockExplorers: {
      default: {
        name: 'ARC Explorer',
        url: 'https://arcscan.app',
      },
    },
    testnet: false,
  } as const;

  // Get WalletConnect Project ID
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

  if (!projectId) {
    console.warn(
      'VITE_WALLETCONNECT_PROJECT_ID is not set. WalletConnect features will not work. ' +
      'Get a project ID from https://cloud.walletconnect.com'
    );
  }

  // Configure RainbowKit with browser-only wallets
  return getDefaultConfig({
    appName: 'ArcPayKit',
    projectId: projectId || '00000000000000000000000000000000',
    chains: [arcTestnet, arcMainnet, baseSepolia, base, mainnet, sepolia],
    ssr: false,
    autoConnect: false,
    transports: {
      [arcTestnet.id]: http(),
      [arcMainnet.id]: http(),
      [baseSepolia.id]: http(),
      [base.id]: http(),
      [mainnet.id]: http(),
      [sepolia.id]: http(),
    },
  });
}

