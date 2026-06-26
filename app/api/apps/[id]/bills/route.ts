import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import type { Db } from 'mongodb';

// Ownership check: the app must belong to the calling wallet.
async function ownsApp(db: Db, id: string, walletAddress: string | null) {
    if (!walletAddress) return null;
    try {
        return await db.collection('merchant_apps').findOne({ _id: new ObjectId(id), user_id: walletAddress });
    } catch {
        return null;
    }
}

// Wallet-authed bill creation so the dashboard never needs the client_secret.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const walletAddress = req.headers.get('x-wallet-address');
    try {
        const db = await getDb();
        const app = await ownsApp(db, id, walletAddress);
        if (!app) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { amount, description } = await req.json().catch(() => ({}));
        if (!amount) {
            return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
        }

        const billHash = crypto.randomBytes(20).toString('hex');
        await db.collection('merchant_bills').insertOne({
            app_id: app._id,
            amount: parseFloat(amount),
            asset: 'USDC',
            description,
            metadata: {},
            hash: billHash,
            status: 'pending',
            created_at: new Date(),
        });

        const coreUrl = process.env.IRION_CORE_URL || 'http://localhost:3000';
        return NextResponse.json({
            billHash,
            checkoutUrl: `${coreUrl}/pay/${billHash}`,
            amount: parseFloat(amount),
            asset: 'USDC',
            status: 'pending',
        });
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
