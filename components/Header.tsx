'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, LogOut, LayoutDashboard, Loader2 } from 'lucide-react';
import { useConnect, useParty } from '@/lib/canton-connect-kit';

export default function Header() {
    const { connect, disconnect, isConnecting, isConnected } = useConnect();
    const { party } = useParty();
    const pathname = usePathname();

    // /dashboard uses the Canton sidebar console, so hide the marketing header there.
    if (pathname?.startsWith('/dashboard')) return null;

    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                <div className="flex items-center gap-10">
                    <Link href="/" className="flex items-center gap-3 group">
                        <Image
                            src="/logo.png"
                            alt="Irion Logo"
                            width={140}
                            height={40}
                            className="h-9 w-auto hover:brightness-110 transition-all"
                        />
                    </Link>

                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/50">
                        <Link href="/dashboard" className="hover:text-primary transition-colors flex items-center gap-2">
                            <LayoutDashboard className="w-4 h-4" />
                            Console
                        </Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    {isConnected && party ? (
                        <div className="flex items-center gap-3">
                            <div className="hidden lg:flex flex-col items-end leading-tight">
                                <span className="text-[9px] text-primary/80 font-mono uppercase tracking-widest">Carpincho · Canton</span>
                                <span className="text-[10px] text-white/40 font-mono">
                                    {party.partyId.slice(0, 8)}…{party.partyId.slice(-6)}
                                </span>
                            </div>
                            <button
                                onClick={() => void disconnect().catch(() => undefined)}
                                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 transition-all group"
                                title="Disconnect"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => void connect('extension').catch(() => undefined)}
                            disabled={isConnecting}
                            className="flex items-center gap-2 bg-primary text-black font-bold px-6 py-2.5 rounded-xl hover:scale-105 transition-all active:scale-95 disabled:opacity-60 shadow-[0_4px_20px_rgba(166,242,74,0.2)]"
                        >
                            {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                            Connect Carpincho
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
