// Client for the Irion B2B / neobank API (irion-b2b-api on :8088).
// Auth is PASSKEYS (WebAuthn) — register/login via the browser authenticator
// (Touch ID / Windows Hello / FIDO2); the returned session token authorises every
// /v1/account/* call. Replaces the old spoofable x-wallet-address header.
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

const BASE = process.env.NEXT_PUBLIC_B2B_API_URL || "http://localhost:8088";
const KEY = "irion_session";

export const getSession = (): string | null => (typeof window !== "undefined" ? localStorage.getItem(KEY) : null);
const setSession = (t: string | null) => { if (typeof window !== "undefined") { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } };

async function req(method: string, path: string, body?: unknown, auth = true): Promise<any> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const s = getSession();
  if (auth && s) headers.authorization = "Bearer " + s;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) throw new Error(j?.error || `${path} → ${r.status}`);
  return j;
}
export const apiGet = (p: string) => req("GET", p);
export const apiPost = (p: string, b?: unknown) => req("POST", p, b);

// ---- passkey auth ----
export interface Account { id: string; name: string; email: string; party: string; createdAt: string; passkeys?: number }
export async function register(name: string, email: string): Promise<Account> {
  const { options, regToken } = await req("POST", "/v1/auth/register/begin", { name, email }, false);
  const response = await startRegistration({ optionsJSON: options });
  const out = await req("POST", "/v1/auth/register/finish", { regToken, response }, false);
  setSession(out.session);
  return out.account;
}
export async function login(email: string): Promise<Account> {
  const { options, loginToken } = await req("POST", "/v1/auth/login/begin", { email }, false);
  const response = await startAuthentication({ optionsJSON: options });
  const out = await req("POST", "/v1/auth/login/finish", { loginToken, response }, false);
  setSession(out.session);
  return out.account;
}
export const logout = () => setSession(null);
export const me = () => apiGet("/v1/auth/me");

// ---- treasury / FX ----
export const getTreasury = () => apiGet("/v1/account/treasury");
export const deposit = (amount: number, currency = "USDC") => apiPost("/v1/account/treasury/deposit", { amount, currency });
export const getRates = () => apiGet("/v1/account/treasury/rates");
export const rebalance = (from: string, to: string, amount: number) => apiPost("/v1/account/treasury/rebalance", { from, to, amount });
export const sweep = (amount: number) => apiPost("/v1/account/treasury/sweep", { amount });
export const redeem = () => apiPost("/v1/account/treasury/redeem", {});
export const transfer = (to: string, amount: number, currency = "USDC") => apiPost("/v1/account/transfers", { to, amount, currency });

// ---- payroll ----
export const getEmployees = () => apiGet("/v1/account/employees");
export const addEmployee = (e: { name: string; email?: string; currency?: string; salary?: number }) => apiPost("/v1/account/employees", e);
export const getPayrollRuns = () => apiGet("/v1/account/payroll/runs");
export const runPayroll = (entries: { employeeId: string; amount?: number; currency?: string }[]) => apiPost("/v1/account/payroll/runs", { entries });

// ---- lending ----
export const getCredit = () => apiGet("/v1/account/credit");
export const underwrite = () => apiPost("/v1/account/credit/underwrite", {});
export const getLoans = () => apiGet("/v1/account/loans");
export const drawLoan = (amount: number, termDays = 30) => apiPost("/v1/account/loans", { amount, termDays });
export const repayLoan = (id: string, amount: number) => apiPost(`/v1/account/loans/${encodeURIComponent(id)}/repay`, { amount });

export const getEvents = () => apiGet("/v1/account/events");
