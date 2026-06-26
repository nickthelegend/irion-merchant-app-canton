'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Irion migration status (wallet/auth ported to Stellar Wallets Kit; settlement
// ported to the IrionCore Soroban contract).
//
// IRION-WIRED:
//   - handleLinkEscrow:  there is no per-merchant contract to deploy on Irion.
//                        Settlement/escrow lives in IrionCore keyed by the
//                        merchant's Stellar address, so we simply persist the
//                        connected wallet address as the app's settlement target.
//   - handleWithdraw:    IrionCore::merchant_withdraw(merchant) sweeps the
//                        merchant's accrued escrow to their wallet.
//   - fetchBalance:      IrionCore::escrow_of(merchant) read.
//   - Settlement history comes from the merchant's bills (MongoDB), not on-chain
//     events.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { useStellarWallet } from '@/lib/stellar-wallet';
import { merchant } from '@/lib/merchant';
import { explorerAccount } from '@/lib/stellar';
import {
    ArrowLeft,
    ShieldCheck,
    Zap,
    Copy,
    ExternalLink,
    Terminal,
    Cpu,
    Code2,
    CheckCircle2,
    AlertCircle,
    Loader2,
    RefreshCw,
    Receipt,
    Link2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import WebhookManager from '@/components/WebhookManager';

export default function AppDetails() {
    const { id } = useParams();
    const router = useRouter();
    const { address, connecting, connect, sign } = useStellarWallet();
    const authenticated = !!address;

    const [mounted, setMounted] = useState(false);
    const [linking, setLinking] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [error, setError] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);
    const [balance, setBalance] = useState('0.00');

    // Client secret rolling — the plaintext is only ever returned once, on roll.
    const [rolledSecret, setRolledSecret] = useState('');
    const [rollingSecret, setRollingSecret] = useState(false);

    // Payment links (hosted checkout bills)
    const [linkAmount, setLinkAmount] = useState('');
    const [linkDesc, setLinkDesc] = useState('');
    const [creatingLink, setCreatingLink] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [links, setLinks] = useState<{ url: string; hash: string; amount: number; description: string }[]>([]);

    // Avoid hydration mismatch: the wallet kit hydrates on the client.
    useEffect(() => setMounted(true), []);

    const { data, error: fetchError, mutate } = useSWR(
        address ? `/api/apps/${id}` : null,
        async (url) => {
            const res = await fetch(url, {
                headers: { 'x-wallet-address': address || '' }
            });
            return res.json();
        }
    );

    const { data: txData, mutate: mutateTx } = useSWR(
        address ? `/api/apps/${id}/transactions` : null,
        async (url) => {
            const res = await fetch(url, {
                headers: { 'x-wallet-address': address || '' }
            });
            return res.json();
        }
    );

    const app = data?.app;
    const transactions: any[] = txData?.transactions || [];
    const settledTx = transactions.filter((t) => t.status === 'paid');

    const fetchBalance = async () => {
        if (!app?.escrow_contract) return;
        try {
            const bal = await merchant.escrowBalance(app.escrow_contract);
            setBalance(bal.toFixed(2));
        } catch (e) {
            console.error('fetchBalance failed', e);
        }
    };

    useEffect(() => {
        if (app?.escrow_contract) {
            fetchBalance();
            const int = setInterval(fetchBalance, 10000);
            return () => clearInterval(int);
        }
    }, [app?.escrow_contract]);

    const handleWithdraw = async () => {
        if (!address || !app?.escrow_contract) return;
        setWithdrawing(true);
        setError('');
        try {
            // IrionCore::merchant_withdraw(merchant) — the connected wallet is the
            // escrow key, so it both authorizes and receives the payout.
            await merchant.merchantWithdraw(address, sign);
            await fetchBalance();
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Withdrawal failed');
        } finally {
            setWithdrawing(false);
        }
    };

    const handleLinkEscrow = async () => {
        if (!address) return;
        setLinking(true);
        setError('');

        try {
            // Irion has no per-merchant contract deploy. Persist the connected
            // Stellar address as the app's settlement target; IrionCore tracks the
            // escrow balance under this address.
            setStatusText('Linking settlement address...');
            const patch = await fetch(`/api/apps/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-address': address,
                },
                body: JSON.stringify({
                    escrow_contract: address,
                    escrow_cap: address,
                    stellar_address: address,
                    network: 'stellar:testnet',
                }),
            });
            if (!patch.ok) throw new Error('Failed to persist settlement address.');

            await mutate();
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Linking failed');
        } finally {
            setLinking(false);
            setStatusText('');
        }
    };

    const handleCopy = (text: string) => {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(text);
        setStatusText('Copied to clipboard!');
        setTimeout(() => setStatusText(''), 2000);
    };

    // Create a hosted payment link (a bill) with this app's API credentials. The
    // returned checkoutUrl points at the Irion core /pay page — share it or show
    // the QR; the customer pays Direct or BNPL there and it settles to escrow.
    const handleCreateLink = async () => {
        if (!app) return;
        const amt = parseFloat(linkAmount);
        if (!amt || amt <= 0) { setLinkError('Enter an amount greater than 0.'); return; }
        setCreatingLink(true);
        setLinkError('');
        try {
            const res = await fetch(`/api/apps/${id}/bills`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-address': address,
                },
                body: JSON.stringify({ amount: amt, description: linkDesc || `Payment to ${app.name}` }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error || !data.checkoutUrl) throw new Error(data.error || 'Failed to create link');
            setLinks((prev) => [
                { url: data.checkoutUrl, hash: data.billHash, amount: amt, description: linkDesc || `Payment to ${app.name}` },
                ...prev,
            ]);
            setLinkAmount('');
            setLinkDesc('');
        } catch (e: any) {
            setLinkError(e.message || 'Failed to create link');
        } finally {
            setCreatingLink(false);
        }
    };

    // Roll the client secret. The plaintext is returned ONCE and shown in local
    // state so the merchant can copy it; it is never stored or re-fetchable.
    const handleRollSecret = async () => {
        if (!address) return;
        if (!confirm('Roll the client secret? Any code using the old secret will stop working until updated.')) return;
        setRollingSecret(true);
        setError('');
        try {
            const res = await fetch(`/api/apps/${id}/roll-secret`, {
                method: 'POST',
                headers: { 'x-wallet-address': address },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.client_secret) throw new Error(data.error || 'Failed to roll secret');
            setRolledSecret(data.client_secret);
        } catch (e: any) {
            setError(e.message || 'Failed to roll secret');
        } finally {
            setRollingSecret(false);
        }
    };

    if (!mounted) return null;

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-display grid-bg">
                <div className="text-center relative z-10">
                    <Zap className="w-12 h-12 text-primary mx-auto mb-6 animate-pulse neon-glow" />
                    <h2 className="text-xl font-bold mb-4 uppercase tracking-tighter">Session Required</h2>
                    <button
                        onClick={connect}
                        disabled={connecting}
                        className="bg-primary text-black px-10 py-4 rounded-xl font-black uppercase text-sm tracking-widest hover:scale-105 transition-all disabled:opacity-60 shadow-[0_8px_30px_rgba(166,242,74,0.3)]"
                    >
                        {connecting ? 'Connecting…' : 'Connect Terminal'}
                    </button>
                </div>
            </div>
        );
    }

    if (fetchError) return <div className="p-8 text-red-500 font-mono">Error loading app. Please check your connection.</div>;
    if (!app) return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">
            <div className="flex items-center gap-3 text-white/40">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm uppercase tracking-widest font-bold">Initialising Configuration...</span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background text-foreground font-display p-8 selection:bg-primary/20 selection:text-white grid-bg">
            <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center gap-2 text-white/40 hover:text-white text-sm group transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Dashboard
                </button>
                {statusText && (
                    <div className="bg-primary text-black px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-wider animate-in fade-in slide-in-from-top-2 shadow-[0_0_15px_rgba(166,242,74,0.4)]">
                        {statusText}
                    </div>
                )}
            </div>

            <header className="max-w-4xl mx-auto mb-12">
                <div className="flex items-end justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Zap className="w-7 h-7 text-primary neon-glow" />
                            <h1 className="text-3xl font-black uppercase italic tracking-tighter">{app.name}</h1>
                            <div className="ml-4 px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] text-white/40 font-bold uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(166,242,74,0.5)]" />
                                Linked: {address?.slice(0, 6)}...{address?.slice(-4)}
                            </div>
                        </div>
                        <p className="text-white/40 text-xs uppercase tracking-widest font-medium">{app.category || 'General Application'}</p>
                    </div>
                    <div className="text-right">
                        <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full border ${app.escrow_contract ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'}`}>
                            {app.escrow_contract ? 'Environment: Live' : 'Status: Configuration Required'}
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: API Keys */}
                <div className="md:col-span-2 space-y-8">
                    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold">API Configuration</h2>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] uppercase text-white/40 font-bold block mb-2">Client ID</label>
                                <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded px-4 py-3 group">
                                    <code className="text-sm text-white/80 flex-1 truncate">{app.client_id}</code>
                                    <Copy
                                        onClick={() => handleCopy(app.client_id)}
                                        className="w-4 h-4 text-white/20 hover:text-white cursor-pointer transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase text-white/40 font-bold block mb-2">Client Secret</label>
                                {rolledSecret ? (
                                    <div className="flex items-center gap-2 bg-black/40 border border-primary/20 rounded px-4 py-3 group">
                                        <code className="text-sm text-primary flex-1 select-all break-all">
                                            {rolledSecret}
                                        </code>
                                        <Copy
                                            onClick={() => handleCopy(rolledSecret)}
                                            className="w-4 h-4 text-white/20 hover:text-white cursor-pointer transition-colors shrink-0"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded px-4 py-3">
                                        <code className="text-sm text-white/40 flex-1">••••••••••••••••••••••••</code>
                                        <button
                                            onClick={handleRollSecret}
                                            disabled={rollingSecret}
                                            className="bg-primary text-black px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-tighter hover:scale-105 disabled:opacity-40 transition-all flex items-center gap-2 shrink-0"
                                        >
                                            {rollingSecret ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Roll Secret'}
                                        </button>
                                    </div>
                                )}
                                <p className="text-[10px] text-white/20 mt-2 italic">
                                    {rolledSecret
                                        ? '* Copy it now — it is shown only this once and cannot be revealed again.'
                                        : '* Shown once at creation — roll to reveal a new one.'}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Payment Links — create a hosted checkout bill + QR */}
                    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Link2 className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold">Payment Links</h2>
                        </div>

                        {!app.escrow_contract && (
                            <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[11px] p-3 rounded flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                Link a settlement address first (right) — a customer&apos;s payment needs a destination.
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-3 py-2 sm:w-36">
                                <span className="text-white/30 text-[10px] font-bold uppercase">USDC</span>
                                <input
                                    value={linkAmount}
                                    onChange={(e) => setLinkAmount(e.target.value)}
                                    type="number" min="0" step="0.01" placeholder="25.00"
                                    className="bg-transparent outline-none text-sm font-bold w-full"
                                />
                            </div>
                            <input
                                value={linkDesc}
                                onChange={(e) => setLinkDesc(e.target.value)}
                                placeholder="What's this for? (optional)"
                                className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                            />
                            <button
                                onClick={handleCreateLink}
                                disabled={creatingLink}
                                className="bg-primary text-black px-5 py-2 rounded-lg font-black text-[10px] uppercase tracking-tighter hover:scale-105 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                            >
                                {creatingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Link'}
                            </button>
                        </div>

                        {linkError && (
                            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] p-3 rounded flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {linkError}
                            </div>
                        )}

                        {links.length === 0 ? (
                            <div className="bg-black/20 border border-dashed border-white/10 rounded-xl p-8 text-center">
                                <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">No payment links yet — create one above</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {links.map((lnk) => (
                                    <div key={lnk.hash} className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-center gap-4">
                                        <div className="bg-white p-2 rounded-lg shrink-0">
                                            <QRCodeSVG value={lnk.url} size={84} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-black text-white mb-1">{lnk.amount} USDC</div>
                                            <div className="text-[10px] text-white/40 mb-2 truncate">{lnk.description}</div>
                                            <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded px-2 py-1">
                                                <code className="text-[10px] text-white/60 flex-1 truncate">{lnk.url}</code>
                                                <Copy onClick={() => handleCopy(lnk.url)} className="w-3.5 h-3.5 text-white/20 hover:text-white cursor-pointer shrink-0" />
                                                <a href={lnk.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-white shrink-0">
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Code2 className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold">Quick Integration</h2>
                        </div>

                        <div className="bg-black/60 rounded-xl overflow-hidden border border-white/5">
                            <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                                <span className="text-[10px] text-white/40 uppercase font-bold">@irion/sdk · Buy Now, Pay Never</span>
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-red-500/20" />
                                    <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
                                    <div className="w-2 h-2 rounded-full bg-green-500/20" />
                                </div>
                            </div>
                            <pre className="p-6 text-xs text-teal-100/70 overflow-x-auto leading-relaxed">
                                {`// 1. Install
//    npm install @irion/sdk

// 2. SERVER — e.g. app/api/irion-checkout/route.ts
//    Keep the secret in an env var; never ship it to the browser.
import { IrionClient } from "@irion/sdk";

const irion = new IrionClient({
  clientId: "${app.client_id}",
  clientSecret: process.env.IRION_CLIENT_SECRET!,
});

export async function POST() {
  const { checkoutUrl } = await irion.createCheckout({
    amount: 125.50,
    orderId: "order_1024",
    description: "Order #1024",
  });
  return Response.json({ checkoutUrl });
}

// 3. CLIENT — drop the button on your shopping site
import { PayWithIrion } from "@irion/sdk/react";

<PayWithIrion
  createCheckout={() =>
    fetch("/api/irion-checkout", { method: "POST" }).then((r) => r.json())
  }
  onSuccess={(r) => console.log("paid!", r.txHash, r.loanId)}
/>`}
                            </pre>
                        </div>
                        <p className="text-[11px] text-white/30 mt-3 leading-relaxed">
                            Your client secret stays server-side. The shopper picks <span className="text-primary/70">Pay Never</span> (collateral earns
                            yield that auto-repays) or pays in full — credit is scored privately with a ZK proof. You get back the
                            Stellar <code className="text-white/50">txHash</code> and <code className="text-white/50">loanId</code>.
                        </p>
                    </section>

                    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-5 h-5 text-primary" />
                                <h2 className="text-lg font-bold">Settlement Stream</h2>
                            </div>
                            <button
                                onClick={() => mutateTx()}
                                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <RefreshCw className="w-4 h-4 text-white/30" />
                            </button>
                        </div>

                        {!app.escrow_contract ? (
                            <div className="bg-black/20 border border-dashed border-white/10 rounded-xl p-12 text-center">
                                <p className="text-xs text-white/20 uppercase tracking-widest">Link settlement address to view stream</p>
                            </div>
                        ) : settledTx.length === 0 ? (
                            <div className="bg-black/20 border border-dashed border-white/10 rounded-xl p-12 text-center">
                                <Loader2 className="w-6 h-6 text-white/20 animate-spin mx-auto mb-4" />
                                <p className="text-xs text-white/20 uppercase tracking-widest">Awaiting first settlement...</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {settledTx.map((log, i) => (
                                    <div key={i} className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-center justify-between gap-4 group hover:border-teal-500/30 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-teal-400">SETTLED</span>
                                                <span className="text-[10px] text-white/30 font-mono">{log.payment_mode || 'bnpl'}</span>
                                            </div>
                                            <div className="text-[10px] text-white/60 truncate">
                                                {log.tx_hash ? `tx ${String(log.tx_hash).slice(0, 10)}...${String(log.tx_hash).slice(-8)}` : '—'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-white">+{log.amount} {log.asset || 'USDC'}</div>
                                            <div className="text-[9px] text-white/20">{log.paid_at ? new Date(log.paid_at).toLocaleString() : ''}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <WebhookManager appId={id as string} walletAddress={address} />

                    {/* Bill Transactions Section */}
                    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-primary" />
                                <h2 className="text-lg font-bold">Bill Transactions</h2>
                            </div>
                            <button
                                onClick={() => mutateTx()}
                                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <RefreshCw className="w-4 h-4 text-white/30" />
                            </button>
                        </div>

                        {transactions.length === 0 ? (
                            <div className="bg-black/20 border border-dashed border-white/10 rounded-xl p-12 text-center">
                                <p className="text-xs text-white/20 uppercase tracking-widest">No bill transactions yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-[10px] uppercase text-white/40 font-bold pb-3 pr-4">Amount</th>
                                            <th className="text-[10px] uppercase text-white/40 font-bold pb-3 pr-4">Asset</th>
                                            <th className="text-[10px] uppercase text-white/40 font-bold pb-3 pr-4">Status</th>
                                            <th className="text-[10px] uppercase text-white/40 font-bold pb-3 pr-4">Payment Mode</th>
                                            <th className="text-[10px] uppercase text-white/40 font-bold pb-3">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map((tx: any) => (
                                            <tr key={tx._id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                                <td className="py-3 pr-4 text-sm font-bold text-white">{tx.amount} {tx.asset}</td>
                                                <td className="py-3 pr-4 text-xs text-white/60">{tx.asset}</td>
                                                <td className="py-3 pr-4">
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                                        tx.status === 'paid'
                                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                            : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                                    }`}>
                                                        {tx.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4 text-xs text-white/60">{tx.payment_mode || '—'}</td>
                                                <td className="py-3 text-xs text-white/40">
                                                    {tx.paid_at
                                                        ? new Date(tx.paid_at).toLocaleDateString()
                                                        : new Date(tx.created_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>

                {/* Right Column: Settlement address */}
                <div className="space-y-8">
                    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-3xl -mr-12 -mt-12" />

                        <div className="flex items-center gap-2 mb-4">
                            <Cpu className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold">On-chain Escrow</h2>
                        </div>

                        {app.escrow_contract ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
                                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                                    <span className="text-xs font-bold uppercase">Settlement Linked</span>
                                </div>
                                <div className="bg-black/40 border border-white/5 rounded p-3">
                                    <label className="text-[9px] uppercase text-white/30 block mb-1">Settlement Address</label>
                                    <div className="flex items-center justify-between gap-1">
                                        <code className="text-[10px] text-white/60 truncate">{app.escrow_contract}</code>
                                        <a href={explorerAccount(app.escrow_contract)} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-white">
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-[9px] uppercase font-bold text-primary/50 mb-1">Escrow Balance</div>
                                        <div className="text-xl font-bold text-white">{balance} USDC</div>
                                    </div>
                                    <button
                                        disabled={withdrawing || parseFloat(balance) === 0}
                                        onClick={handleWithdraw}
                                        className="bg-primary text-black px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-tighter hover:scale-105 disabled:opacity-30 transition-all flex items-center gap-2 shadow-md shadow-primary/10"
                                    >
                                        {withdrawing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Withdraw'}
                                    </button>
                                </div>
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] p-3 rounded flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        {error}
                                    </div>
                                )}
                                <p className="text-[10px] text-white/30 leading-relaxed italic">
                                    Settlements accrue to your IrionCore escrow. Withdraw sweeps the balance to your wallet.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-xs text-white/50 leading-relaxed">
                                    To receive payments, link your <span className="text-white">Stellar wallet</span> as this app&apos;s
                                    settlement address. IrionCore credits this address when shoppers pay.
                                </p>

                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] p-3 rounded flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        {error}
                                    </div>
                                )}

                                <button
                                    onClick={handleLinkEscrow}
                                    disabled={linking}
                                    className="w-full bg-primary hover:scale-[1.02] disabled:bg-white/10 disabled:text-white/20 text-black font-black uppercase tracking-tighter py-3 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-lg shadow-primary/20"
                                >
                                    {linking ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {statusText || 'Processing...'}
                                        </>
                                    ) : (
                                        'Link Settlement Address'
                                    )}
                                </button>
                                <p className="text-[9px] text-white/20 text-center uppercase tracking-widest font-bold">Gas paid in XLM</p>
                            </div>
                        )}
                    </section>

                    <section className="border border-white/5 rounded-2xl p-6 bg-gradient-to-br from-white/[0.02] to-transparent">
                        <div className="flex items-center gap-2 mb-4 opacity-50">
                            <Terminal className="w-4 h-4" />
                            <h3 className="text-xs font-bold uppercase tracking-widest">Network Info</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-[11px]">
                                <span className="text-white/30">Network</span>
                                <span className="text-white/60 font-bold">Stellar Testnet</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-white/30">Currency</span>
                                <span className="text-white/60 font-bold">USDC</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-white/30">Contract</span>
                                <span className="text-white/60 font-bold">IrionCore</span>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
