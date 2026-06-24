import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { sendWebhook } from '@/lib/webhookSender';

export async function POST(req: NextRequest) {
    const { webhookId } = await req.json().catch(() => ({}));
    const walletAddress = req.headers.get('x-wallet-address');

    if (!webhookId) return NextResponse.json({ error: 'Missing webhook ID' }, { status: 400 });
    if (!walletAddress) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    try {
        const db = await getDb();
        const wh = await db.collection('webhooks').findOne({ _id: new ObjectId(webhookId) });
        if (!wh) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });

        // The webhook's app must belong to the caller.
        const app = await db.collection('merchant_apps').findOne({ _id: new ObjectId(wh.app_id), user_id: walletAddress });
        if (!app) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const result = await sendWebhook(webhookId, 'test.event', {
            message: 'Test webhook from XORR Console',
            id: `test_${crypto.randomUUID()}`,
            timestamp: new Date().toISOString(),
        });
        return NextResponse.json(result);
    } catch {
        return NextResponse.json({ error: 'Invalid webhook ID' }, { status: 400 });
    }
}
