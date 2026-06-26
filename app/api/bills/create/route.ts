import { NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";
import { verifySecret } from "@/lib/secret";

export async function POST(req: Request) {
  const clientId = req.headers.get("x-client-id");
  const clientSecret = req.headers.get("x-client-secret");

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Missing Client Auth Headers (x-client-id, x-client-secret)" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { amount, description, metadata, asset = "USDC" } = body;

  if (!amount) {
    return NextResponse.json({ error: "Amount is required" }, { status: 400 });
  }

  const db = await getDb();
  // Auth: look up by client_id, then constant-time compare the hashed secret.
  const app = await db.collection("merchant_apps").findOne({ client_id: clientId });

  if (!app || !verifySecret(clientSecret, app.client_secret_hash)) {
    return NextResponse.json({ error: "Invalid API Credentials" }, { status: 403 });
  }

  const billHash = crypto.randomBytes(20).toString("hex");

  const result = await db.collection("merchant_bills").insertOne({
    app_id: app._id,
    amount: parseFloat(amount),
    asset,
    description,
    metadata: metadata || {},
    hash: billHash,
    status: "pending",
    created_at: new Date(),
  });

  const coreUrl = process.env.IRION_CORE_URL || "http://localhost:3000";
  // Carry the bill on the checkout URL: the bill lives in THIS (merchant) DB, but
  // the Canton /pay page renders from query params (it doesn't share our DB).
  // `party` is the merchant's Canton party = the on-ledger settlement target.
  // Which checkout methods this merchant offers (default: all on).
  const cm = app.checkout_methods || {};
  const methods = ["direct", "bnpl", "credit"].filter((m) => cm[m] !== false).join(",");
  const params = new URLSearchParams({
    amount: String(parseFloat(amount)),
    merchant: app.name || "Merchant",
    desc: description || "",
    party: app.user_id || app.wallet_address || "",
    methods: methods || "credit",
  });
  return NextResponse.json({
    billId: result.insertedId,
    billHash,
    orderId: billHash,
    checkoutUrl: `${coreUrl}/pay/${billHash}?${params.toString()}`,
    merchantName: app.name,
    // On Canton, the settlement target is the merchant's Canton party.
    party: app.user_id || app.wallet_address,
    network: "canton:irion-sandbox",
    asset,
    status: "pending",
  });
}
