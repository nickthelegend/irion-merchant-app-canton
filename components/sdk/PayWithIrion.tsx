'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Irion migration (wallet/auth ported to Stellar Wallets Kit; payment ported to
// the IrionCore Soroban contract).
//
// handlePayment builds the checkout bill via /api/bills/create (kept), then runs
// a single Soroban invocation of IrionCore::open_purchase, which pays the
// merchant up front into their on-chain escrow balance and opens the shopper's
// BNPL loan. The Stellar tx hash replaces the old Sui digest passed to onSuccess.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useStellarWallet } from '@/lib/stellar-wallet';
import { merchant } from '@/lib/merchant';

const IRION_API_URL = '/api/bills/create';

// Default BNPL term for the demo settlement (in ledgers, ~5s each on testnet).
const DEFAULT_TERM_LEDGERS = 17_280; // ~24h

interface PayWithIrionProps {
    apiKey: string;
    apiSecret: string;
    amount: number;
    details: string;
    onSuccess?: (txHash: string) => void;
    onError?: (error: string) => void;
    className?: string; // Allow custom styling
}

export const PayWithIrion: React.FC<PayWithIrionProps> = ({
    apiKey,
    apiSecret,
    amount,
    details,
    onSuccess,
    onError,
    className
}) => {
    const { address, connected, connect, sign } = useStellarWallet();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string>('');

    const handlePayment = async () => {
        setLoading(true);
        setStatus('Initializing...');
        setError('');

        try {
            // 1. Fetch Payment Config (chain-agnostic — kept as-is).
            const res = await fetch(IRION_API_URL, {
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
            // On Irion, escrowAddress is the merchant's Stellar settlement address.
            const config = await res.json();
            const { escrowAddress, orderId } = config;

            if (!connected || !address) {
                await connect();
                throw new Error('Connect your Stellar wallet, then press pay again.');
            }
            if (!escrowAddress) throw new Error('Merchant settlement address not provisioned for this app yet.');

            // 2. Settle on Stellar via IrionCore::open_purchase. The merchant is
            //    paid `amount` USDC up front into their escrow; the shopper posts
            //    matching collateral and opens a BNPL loan.
            setStatus('Please confirm transaction...');
            const { hash } = await merchant.settlePayment(
                address,
                escrowAddress,
                amount,
                amount, // collateral must be >= amount; full-collateral demo settlement
                DEFAULT_TERM_LEDGERS,
                sign
            );

            // Best-effort: mark the bill paid (orderId is the bill hash).
            if (orderId) {
                fetch('/api/bills/pay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        billHash: orderId,
                        txHash: hash,
                        userAddress: address,
                        paymentMode: 'bnpl',
                    }),
                }).catch(() => {});
            }

            setStatus('Payment confirmed');
            if (onSuccess) onSuccess(hash);
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
                {loading ? status : `Pay ${amount} USDC with Irion`}
            </button>

            <div className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-primary" />
                Secured by Irion Protocol
            </div>
        </div>
    );
};
