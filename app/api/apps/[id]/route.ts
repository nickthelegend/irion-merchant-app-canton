import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const walletAddress = req.headers.get('x-wallet-address');

    if (!id || !walletAddress) return NextResponse.json({ error: 'Missing ID or wallet address' }, { status: 400 });

    const db = await getDb();

    // Verify ownership and get app
    // In our simplified MongoDB schema, we link merchant_apps using user_id: walletAddress
    const app = await db.collection('merchant_apps').findOne(
        { _id: new ObjectId(id), user_id: walletAddress },
        { projection: { client_secret_hash: 0 } } // owner may reveal their own client_secret
    );

    if (!app) {
        return NextResponse.json({ error: 'App not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ app });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const walletAddress = req.headers.get('x-wallet-address');
    const body = await req.json();

    if (!id || !walletAddress) return NextResponse.json({ error: 'Missing ID or wallet address' }, { status: 400 });

    const db = await getDb();

    // Whitelist updatable fields — never allow client_secret/client_id/user_id/_id/
    // escrow_contract/status to be overwritten via this route (mass-assignment guard).
    const update: Record<string, unknown> = { updated_at: new Date() };
    if (typeof body.name === 'string') update.name = body.name;
    if (typeof body.category === 'string') update.category = body.category;
    // Owner-set on-chain config (Deploy Escrow links these). Still blocks
    // client_secret / client_id / user_id / _id / status from being overwritten.
    if (typeof body.escrow_contract === 'string') update.escrow_contract = body.escrow_contract;
    if (typeof body.escrow_cap === 'string') update.escrow_cap = body.escrow_cap;
    if (typeof body.sui_address === 'string') update.sui_address = body.sui_address;
    if (typeof body.network === 'string') update.network = body.network;

    const result = await db.collection('merchant_apps').findOneAndUpdate(
        { _id: new ObjectId(id), user_id: walletAddress },
        { $set: update },
        { returnDocument: 'after', projection: { client_secret_hash: 0 } }
    );

    if (!result) {
        return NextResponse.json({ error: 'App not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ app: result });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const walletAddress = req.headers.get('x-wallet-address');

    if (!id || !walletAddress) return NextResponse.json({ error: 'Missing ID or wallet address' }, { status: 400 });

    try {
        const db = await getDb();
        // Ownership check before deleting.
        const app = await db.collection('merchant_apps').findOne({ _id: new ObjectId(id), user_id: walletAddress });
        if (!app) return NextResponse.json({ error: 'App not found or unauthorized' }, { status: 404 });

        await db.collection('merchant_apps').deleteOne({ _id: new ObjectId(id), user_id: walletAddress });
        // Clean up related records.
        await db.collection('merchant_bills').deleteMany({ app_id: new ObjectId(id) });
        await db.collection('webhooks').deleteMany({ app_id: id });

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
