import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// All bills/settlements across the merchant's apps (for the Payments dashboard).
export async function GET(req: NextRequest) {
  const walletAddress = req.headers.get("x-wallet-address");
  if (!walletAddress) return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });

  const db = await getDb();
  const apps = await db.collection("merchant_apps")
    .find({ user_id: walletAddress })
    .project({ _id: 1, name: 1 })
    .toArray();
  const appIds = apps.map((a) => a._id);
  const nameById = Object.fromEntries(apps.map((a) => [String(a._id), a.name]));

  const bills = await db.collection("merchant_bills")
    .find({ app_id: { $in: appIds } })
    .sort({ created_at: -1 })
    .limit(100)
    .toArray();

  const payments = bills.map((b) => ({
    id: String(b._id),
    hash: b.hash,
    app: nameById[String(b.app_id)] || "App",
    amount: b.amount,
    asset: b.asset || "USDC",
    description: b.description || "",
    status: b.status || "pending",
    payment_mode: b.payment_mode || null,
    tx_hash: b.tx_hash || null,
    created_at: b.created_at,
    paid_at: b.paid_at || null,
  }));

  const settled = payments.filter((p) => p.status === "paid");
  return NextResponse.json({
    payments,
    stats: {
      total: payments.length,
      settled: settled.length,
      pending: payments.length - settled.length,
      volume: settled.reduce((s, p) => s + (p.amount || 0), 0),
    },
  });
}
