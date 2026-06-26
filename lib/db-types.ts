import { ObjectId } from "mongodb";

export interface MerchantUser {
  _id?: ObjectId;
  wallet_address: string;
  email?: string;
  created_at: Date;
  updated_at: Date;
}

export interface MerchantApp {
  _id?: ObjectId;
  user_id: string; // Refers to MerchantUser._id or wallet_address
  wallet_address: string;
  name: string;
  category: string;
  client_id: string;
  client_secret: string;
  network: string;
  status: "active" | "inactive";
  /** Merchant's Stellar settlement address (the IrionCore escrow key). */
  escrow_contract?: string;
  /** Same Stellar address that authorizes merchant_withdraw on IrionCore. */
  escrow_cap?: string;
  created_at: Date;
  updated_at: Date;
}
