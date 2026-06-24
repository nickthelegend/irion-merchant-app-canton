import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { hashSecret } from '@/lib/secret';
import crypto from 'crypto';

// Demo merchant for the XORR shopping-app → /pay → Sui settlement flow.
// Wired to the live USDC v3 MerchantEscrow + the deployer's Sui address so
// bills created with these credentials settle on Sui testnet.
const DEMO_ESCROW = '0x44945bd13ef548fd3beb77c6d111bdfd88e549a3650a9caa7213d527d4e59c0c';
const DEMO_SUI_ADDRESS = '0xbe4290542197515da9967183c24b60ad092f0d08a7baf1201f7eec913d44dc23';

export async function GET() {
    try {
        const db = await getDb();

        // 1. Create merchant user
        await db.collection('merchant_users').insertOne({
            wallet_address: DEMO_SUI_ADDRESS,
            created_at: new Date(),
            updated_at: new Date(),
        });

        // 2. Create merchant app with API credentials + Sui settlement targets
        const client_id = `xorr_${crypto.randomBytes(12).toString('hex')}`;
        const client_secret = `sk_${crypto.randomBytes(24).toString('hex')}`;

        const newApp = {
            user_id: DEMO_SUI_ADDRESS,
            wallet_address: DEMO_SUI_ADDRESS,
            sui_address: DEMO_SUI_ADDRESS,
            name: 'XORR Demo Shop',
            category: 'E-commerce',
            client_id,
            client_secret, // kept for dashboard reveal (testnet demo)
            client_secret_hash: hashSecret(client_secret),
            network: 'sui:testnet',
            asset: 'USDC',
            escrow_contract: DEMO_ESCROW,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
        };

        const result = await db.collection('merchant_apps').insertOne(newApp);

        return NextResponse.json({
            wallet: DEMO_SUI_ADDRESS,
            app_id: result.insertedId,
            client_id,
            client_secret,
            network: 'sui:testnet',
            escrow_contract: DEMO_ESCROW,
        });
    } catch (e: any) {
        console.error('Seed Demo Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
