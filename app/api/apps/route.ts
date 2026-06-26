import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { hashSecret } from '@/lib/secret';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    const walletAddress = req.headers.get('x-wallet-address');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Missing wallet address header' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Get User
    const user = await db.collection('merchant_users').findOne({ wallet_address: walletAddress });

    if (!user) {
        return NextResponse.json({ apps: [] }); // User not found, so no apps
    }

    // 2. Get Apps
    const apps = await db.collection('merchant_apps')
        .find({ user_id: walletAddress })
        .project({ client_secret: 0, client_secret_hash: 0 }) // never expose secrets
        .sort({ created_at: -1 })
        .toArray();

    return NextResponse.json({ apps });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-wallet-address',
        },
    });
}


export async function POST(req: NextRequest) {
    try {
        const { wallet_address, name, category, network } = await req.json();

        if (!wallet_address || !name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const db = await getDb();

        // 1. Get User (or fail)
        const user = await db.collection('merchant_users').findOne({ wallet_address });

        if (!user) {
            return NextResponse.json({ error: 'User not registered. Please refresh.' }, { status: 404 });
        }

        // 2. Check for duplicate app name per wallet
        const existingApp = await db.collection('merchant_apps').findOne({
            user_id: wallet_address,
            name
        });

        if (existingApp) {
            return NextResponse.json(
                { error: 'An app with this name already exists for your wallet' },
                { status: 409 }
            );
        }

        // 3. Create App with unique credentials (crypto.randomUUID for client_id, randomBytes for secret)
        const client_id = `irion_${crypto.randomUUID().replace(/-/g, '')}`;
        const client_secret = `sk_${crypto.randomBytes(24).toString('hex')}`;

        const newApp = {
            user_id: wallet_address,
            wallet_address,
            name,
            category: category || '',
            client_id,
            client_secret, // kept so the owner can reveal it in their dashboard (testnet)
            client_secret_hash: hashSecret(client_secret),
            network: network || 'canton:irion-sandbox',
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await db.collection('merchant_apps').insertOne(newApp);

        // Return the plaintext secret ONCE — it is not stored and can't be shown again.
        return NextResponse.json({ app: { ...newApp, _id: result.insertedId, client_secret } });
    } catch (error: any) {
        console.error('Create App Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
