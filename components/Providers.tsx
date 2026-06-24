'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import '@mysten/dapp-kit/dist/index.css';
import { Toaster } from 'sonner';
import { SUI_NETWORK, SUI_RPC_URLS } from '@/lib/sui';

// Sui networks for @mysten/dapp-kit. Each entry needs { url, network } — the
// @mysten/sui 2.19 `getFullnodeUrl` helper was removed, so URLs come from
// the hardcoded map in lib/sui.ts.
const { networkConfig } = createNetworkConfig({
    testnet: { url: SUI_RPC_URLS.testnet, network: 'testnet' },
    mainnet: { url: SUI_RPC_URLS.mainnet, network: 'mainnet' },
    devnet: { url: SUI_RPC_URLS.devnet, network: 'devnet' },
    localnet: { url: SUI_RPC_URLS.localnet, network: 'localnet' },
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <SuiClientProvider networks={networkConfig} defaultNetwork={SUI_NETWORK}>
                <WalletProvider autoConnect>
                    {children}
                    <Toaster position="top-right" theme="dark" />
                </WalletProvider>
            </SuiClientProvider>
        </QueryClientProvider>
    );
}
