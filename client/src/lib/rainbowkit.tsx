import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';

// ARC Testnet configuration
const arcTestnet = {
  id: parseInt(import.meta.env.VITE_ARC_CHAIN_ID || '1243', 10),
  name: 'ARC Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_ARC_RPC_URL || 'https://rpc-testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ARC Explorer',
      url: import.meta.env.VITE_ARC_EXPLORER_URL || 'https://testnet-explorer.arc.network',
    },
  },
  testnet: true,
} as const;

// Get WalletConnect Project ID
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  console.warn(
    'VITE_WALLETCONNECT_PROJECT_ID is not set. WalletConnect features will not work. ' +
    'Get a project ID from https://cloud.walletconnect.com'
  );
}

export const config = getDefaultConfig({
  appName: 'ArcPayKit',
  projectId: projectId || '00000000000000000000000000000000', // Fallback to prevent errors
  chains: [arcTestnet, mainnet, sepolia], // ARC Testnet as primary, with fallbacks
  ssr: false, // If your dApp uses server-side rendering (SSR)
  autoConnect: false, // Disable auto-connect to prevent wallets from auto-connecting
  transports: {
    [arcTestnet.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});

