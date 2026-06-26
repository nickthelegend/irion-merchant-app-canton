import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// Settlement analytics for a merchant's apps: how much was settled with Irion.
export async function GET(req: NextRequest) {
  const walletAddress = req.headers.get("x-wallet-address");
  if (!walletAddress) return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });

  try {
    const db = await getDb();
    const apps = await db.collection("merchant_apps").find({ user_id: walletAddress }).toArray();
    const appIds = apps.map((a) => a._id);
    const nameById: Record<string, string> = {};
    for (const a of apps) nameById[String(a._id)] = a.name || "App";

    if (appIds.length === 0) {
      return NextResponse.json({ settledCount: 0, settledVolume: 0, pendingCount: 0, totalBills: 0, recent: [], perApp: [] });
    }

    const bills = await db.collection("merchant_bills").find({ app_id: { $in: appIds } }).toArray();
    const settled = bills.filter((b) => b.status === "paid");
    const pending = bills.filter((b) => b.status !== "paid");

    const settledVolume = settled.reduce((s, b) => s + (Number(b.amount) || 0), 0);

    const recent = settled
      .sort((a, b) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime())
      .slice(0, 12)
      .map((b) => ({
        hash: b.hash,
        amount: Number(b.amount) || 0,
        asset: b.asset || "USDC",
        app: nameById[String(b.app_id)] || "App",
        txHash: b.tx_hash || null,
        description: b.description || "",
        paidAt: b.paid_at || b.created_at,
      }));

    const perAppMap: Record<string, { app: string; count: number; volume: number }> = {};
    for (const b of settled) {
      const k = String(b.app_id);
      perAppMap[k] = perAppMap[k] || { app: nameById[k] || "App", count: 0, volume: 0 };
      perAppMap[k].count += 1;
      perAppMap[k].volume += Number(b.amount) || 0;
    }
    const perApp = Object.values(perAppMap).sort((a, b) => b.volume - a.volume);

    return NextResponse.json({
      settledCount: settled.length,
      settledVolume,
      pendingCount: pending.length,
      totalBills: bills.length,
      apps: apps.length,
      recent,
      perApp,
    });
  } catch (e) {
    console.error("Analytics error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
