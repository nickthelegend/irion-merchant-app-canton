import { useCurrentAccount } from '@mysten/dapp-kit';
import { useEffect } from 'react';

export function useUserSync() {
    const account = useCurrentAccount();

    useEffect(() => {
        async function syncUser() {
            if (account?.address) {
                try {
                    await fetch('/api/auth/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            wallet_address: account.address,
                            // Sui wallets carry no email; kept null for API compatibility.
                            email: null,
                        }),
                    });
                } catch (err) {
                    console.error('Failed to sync user', err);
                }
            }
        }

        syncUser();
    }, [account]);
}
