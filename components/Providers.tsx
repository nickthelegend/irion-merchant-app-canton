'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ConnectKitProvider } from '@/lib/canton-connect-kit';
import type { ConnectKitConfig } from '@/lib/canton-connect-kit';

// The merchant app is Canton-first: the whole app sits under the Carpincho
// ConnectKitProvider so the global header + the sidebar console share one wallet
// connection. The dapp-sdk is lazy-loaded on connect, so this provider is
// SSR-safe at the root.
const queryClient = new QueryClient();
const cantonConfig: ConnectKitConfig = {
    appName: 'Irion Merchant',
    appDescription: 'Accept BNPL & private credit on the Canton Network',
    network: 'canton:irion-sandbox',
};

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <ConnectKitProvider config={cantonConfig}>
                {children}
                <Toaster position="top-right" theme="dark" />
            </ConnectKitProvider>
        </QueryClientProvider>
    );
}
