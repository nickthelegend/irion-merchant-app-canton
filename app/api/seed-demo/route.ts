import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { hashSecret } from '@/lib/secret';
import crypto from 'crypto';

// Demo merchant for the Irion shopping-app → /pay → Stellar settlement flow.
// Wired to the deployer's Stellar address, which is both the merchant wallet and
// the IrionCore escrow key, so bills created with these credentials settle on
// Stellar testnet.
const DEMO_STELLAR_ADDRESS = 'GBKZC3N4UVFZ54CAM7I26NWIDQLQJVPPUVDNLDBAS5PC3BAUA3GYOYXR';
const DEMO_ESCROW = DEMO_STELLAR_ADDRESS;

export async function GET() {
    try {
        const db = await getDb();

        // 1. Create merchant user
        await db.collection('merchant_users').insertOne({
            wallet_address: DEMO_STELLAR_ADDRESS,
            created_at: new Date(),
            updated_at: new Date(),
        });

        // 2. Create merchant app with API credentials + Stellar settlement targets
        const client_id = `irion_${crypto.randomBytes(12).toString('hex')}`;
        const client_secret = `sk_${crypto.randomBytes(24).toString('hex')}`;

        const newApp = {
            user_id: DEMO_STELLAR_ADDRESS,
            wallet_address: DEMO_STELLAR_ADDRESS,
            stellar_address: DEMO_STELLAR_ADDRESS,
            name: 'Irion Demo Shop',
            category: 'E-commerce',
            client_id,
            client_secret, // kept for dashboard reveal (testnet demo)
            client_secret_hash: hashSecret(client_secret),
            network: 'stellar:testnet',
            asset: 'USDC',
            escrow_contract: DEMO_ESCROW,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
        };

        const result = await db.collection('merchant_apps').insertOne(newApp);

        return NextResponse.json({
            wallet: DEMO_STELLAR_ADDRESS,
            app_id: result.insertedId,
            client_id,
            client_secret,
            network: 'stellar:testnet',
            escrow_contract: DEMO_ESCROW,
        });
    } catch (e: any) {
        console.error('Seed Demo Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
