import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { hashSecret } from '@/lib/secret';
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

// Roll the client secret: generate a new one, persist ONLY its hash, and return
// the plaintext ONCE (it can never be revealed again).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const walletAddress = req.headers.get('x-wallet-address');
    try {
        const db = await getDb();
        const app = await ownsApp(db, id, walletAddress);
        if (!app) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const client_secret = `sk_${crypto.randomBytes(24).toString('hex')}`;
        await db.collection('merchant_apps').updateOne(
            { _id: app._id },
            { $set: { client_secret_hash: hashSecret(client_secret), updated_at: new Date() } }
        );

        return NextResponse.json({ client_secret }); // returned once, not stored in plaintext
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
