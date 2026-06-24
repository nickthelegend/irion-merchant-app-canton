import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import type { Db } from 'mongodb';

// Ownership check: the app must belong to the calling wallet.
async function ownsApp(db: Db, id: string, walletAddress: string | null): Promise<boolean> {
    if (!walletAddress) return false;
    try {
        const app = await db.collection('merchant_apps').findOne({ _id: new ObjectId(id), user_id: walletAddress });
        return !!app;
    } catch {
        return false;
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const walletAddress = req.headers.get('x-wallet-address');
    try {
        const db = await getDb();
        if (!(await ownsApp(db, id, walletAddress))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        const webhooks = await db.collection('webhooks').find({ app_id: id }).project({ secret: 0 }).toArray();
        return NextResponse.json({ webhooks });
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const walletAddress = req.headers.get('x-wallet-address');
    const { url, events } = await req.json().catch(() => ({}));
    try {
        const db = await getDb();
        if (!(await ownsApp(db, id, walletAddress))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`; // cryptographically secure
        const result = await db.collection('webhooks').insertOne({
            app_id: id,
            url,
            events: events || ['payment.settled'],
            secret,
            is_active: true,
            created_at: new Date(),
        });
        const webhook = await db.collection('webhooks').findOne({ _id: result.insertedId });
        return NextResponse.json({ webhook }); // secret returned once, omitted from subsequent GETs
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
