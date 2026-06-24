'use client';

// ─────────────────────────────────────────────────────────────────────────────
// XORR migration (wallet/auth ported to @mysten/dapp-kit; payment ported to Move).
//
// handlePayment builds the checkout bill via /api/bills/create (kept), then runs
// a single Sui programmable transaction that calls
// `merchant_escrow::settle_payment<USDT>` with a coin split from the buyer's USDT
// balance, signed via dapp-kit (useTx → useSignAndExecuteTransaction). The tx
// digest replaces the old EVM tx.hash passed to onSuccess.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useTx } from '@/lib/use-tx';
import { settlePaymentTx, USDT_COIN_TYPE } from '@/lib/escrow';
import { USDT_DECIMALS } from '@/lib/sui';

const POLARIS_API_URL = '/api/bills/create';

interface PayWithPolarisProps {
    apiKey: string;
    apiSecret: string;
    amount: number;
    details: string;
    onSuccess?: (txHash: string) => void;
    onError?: (error: string) => void;
    className?: string; // Allow custom styling
}

export const PayWithPolaris: React.FC<PayWithPolarisProps> = ({
    apiKey,
    apiSecret,
    amount,
    details,
    onSuccess,
    onError,
    className
}) => {
    const account = useCurrentAccount();
    const client = useSuiClient();
    const runTx = useTx();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string>('');

    const handlePayment = async () => {
        setLoading(true);
        setStatus('Initializing...');
        setError('');

        try {
            // 1. Fetch Payment Config (chain-agnostic — kept as-is).
            const res = await fetch(POLARIS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-client-id': apiKey,
                    'x-client-secret': apiSecret
                },
                body: JSON.stringify({ amount, description: details })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to initialize payment');
            }

            // Bill created successfully; escrowAddress/orderId come back here.
            const config = await res.json();
            const { escrowAddress, orderId } = config;

            if (!account) throw new Error('No Sui wallet connected. Please connect your wallet.');
            if (!escrowAddress) throw new Error('Merchant escrow not provisioned for this app yet.');

            // 2. Settle on Sui: split `amount` USDT out of the buyer's coin and
            //    pay it into the merchant escrow via merchant_escrow::settle_payment.
            setStatus('Please confirm transaction...');

            // Pick a single USDT coin with enough balance to cover the payment.
            const { data: coins } = await client.getCoins({ owner: account.address, coinType: USDT_COIN_TYPE });
            const need = BigInt(Math.floor(amount * 10 ** USDT_DECIMALS));
            const coin = coins.find((c) => BigInt(c.balance) >= need);
            if (!coin) {
                throw new Error(`Insufficient USDC balance to pay ${amount}. Fund your wallet and try again.`);
            }

            const tx = settlePaymentTx(escrowAddress, coin.coinObjectId, amount, orderId, account.address);
            const txRes = await runTx('Payment', tx);

            setStatus('Payment confirmed');
            if (onSuccess) onSuccess(txRes.digest);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Payment failed');
            if (onError) onError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flex flex-col items-center gap-4 ${className}`}>
            {error && (
                <div className="text-red-500 text-sm flex items-center gap-2 bg-red-500/10 p-2 rounded">
                    <AlertCircle className="w-4 h-4" /> {error}
                </div>
            )}

            <button
                onClick={handlePayment}
                disabled={loading}
                className={`
                    flex items-center gap-2 bg-primary text-black font-black uppercase tracking-tighter py-4 px-8 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(166,242,74,0.3)]
                    ${loading ? 'cursor-wait' : ''}
                `}
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                {loading ? status : `Pay ${amount} USDC with Polaris`}
            </button>

            <div className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-primary" />
                Secured by Polaris Protocol
            </div>
        </div>
    );
};
