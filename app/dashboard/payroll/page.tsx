"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, UserPlus, Lock, Loader2, AlertTriangle, CheckCircle2,
  Play, ChevronDown, ChevronRight, ShieldCheck, History, Wallet,
} from "lucide-react";
import * as nb from "@/lib/neobank";
import { PageHeader, Card, Stat, fmt, short, page, btn, btnGhost, input, label } from "@/components/neobank/ui";

const CURRENCIES = ["USDC", "EURC", "GBPC"] as const;
type Currency = (typeof CURRENCIES)[number];

interface Employee {
  id: string;
  name: string;
  email: string;
  party: string;
  currency: string;
  salary?: number;
  createdAt: string;
}
interface RunEntry {
  employeeId: string;
  name: string;
  party: string;
  amount: number;
  currency: string;
  updateId: string;
}
interface PayrollRun {
  id: string;
  entries: RunEntry[];
  total: number;
  currency: string;
  createdAt: string;
}
interface Treasury {
  balances: Record<string, number>;
  cash: number;
  total: number;
}

const fmtDate = (x: string) => {
  const d = new Date(x);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

export default function PayrollPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [treasury, setTreasury] = useState<Treasury | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [note, setNote] = useState<string | undefined>(undefined);

  // add-employee form
  const [form, setForm] = useState<{ name: string; email: string; currency: Currency; salary: string }>({
    name: "",
    email: "",
    currency: "USDC",
    salary: "",
  });

  // run-payroll selection + per-run expansion
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const [emp, pr, tr] = await Promise.all([
        nb.getEmployees(),
        nb.getPayrollRuns(),
        nb.getTreasury().catch(() => null),
      ]);
      const list: Employee[] = emp?.employees ?? [];
      setEmployees(list);
      setRuns(pr?.runs ?? []);
      setTreasury(tr);
      // default-select every employee that has a payable salary
      setSelected(new Set(list.filter((e) => (e.salary ?? 0) > 0).map((e) => e.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedEmployees = useMemo(
    () => employees.filter((e) => selected.has(e.id)),
    [employees, selected],
  );

  // total grouped by currency (employees may be paid in different currencies)
  const totalsByCurrency = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const e of selectedEmployees) {
      const cur = e.currency || "USDC";
      acc[cur] = (acc[cur] ?? 0) + (e.salary ?? 0);
    }
    return acc;
  }, [selectedEmployees]);

  const grandTotal = useMemo(
    () => Object.values(totalsByCurrency).reduce((a, b) => a + b, 0),
    [totalsByCurrency],
  );

  async function onAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError(undefined);
    setNote(undefined);
    try {
      const salaryNum = form.salary.trim() === "" ? undefined : Number(form.salary);
      if (salaryNum !== undefined && (isNaN(salaryNum) || salaryNum < 0)) {
        throw new Error("Salary must be a positive number");
      }
      await nb.addEmployee({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        currency: form.currency,
        salary: salaryNum,
      });
      setForm({ name: "", email: "", currency: "USDC", salary: "" });
      setNote(`Added ${form.name.trim()} to payroll.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRunPayroll() {
    if (selected.size === 0) return;
    setBusy(true);
    setError(undefined);
    setNote(undefined);
    try {
      const ids = [...selected];
      const res = await nb.runPayroll(ids.map((employeeId) => ({ employeeId })));
      const run: PayrollRun | undefined = res?.run;
      const count = run?.entries?.length ?? ids.length;
      const paid = run
        ? `${fmt(run.total)} ${run.currency}`
        : Object.entries(totalsByCurrency)
            .map(([cur, amt]) => `${fmt(amt)} ${cur}`)
            .join(" + ");
      setNote(`Paid ${count} employee${count === 1 ? "" : "s"} — ${paid}. Each transfer is its own private Canton contract.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const availableBalance = (cur: string) => treasury?.balances?.[cur];

  return (
    <div className={page}>
      <PageHeader
        title="Payroll"
        subtitle="Pay your team privately — each salary is its own Canton contract, visible only to you and that employee. No one sees anyone else's pay."
      />

      {/* status banners */}
      {error && (
        <div className="flex items-center gap-2.5 bg-red-500/[0.07] border border-red-500/20 rounded-xl px-4 py-3 mb-5 text-red-300/90">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold">{error}</span>
        </div>
      )}
      {note && (
        <div className="flex items-center gap-2.5 bg-primary/[0.07] border border-primary/25 rounded-xl px-4 py-3 mb-5 text-primary">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold">{note}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-white/40 text-sm py-20 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading payroll…
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* ── KPI row ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Stat label="Team" value={employees.length} sub="employees on payroll" />
            <Stat label="Selected this run" value={selectedEmployees.length} sub={`of ${employees.length}`} />
            <Stat
              label="Treasury available"
              value={treasury ? fmt(treasury.balances?.USDC) : "—"}
              sub="USDC ready to pay"
            />
          </div>

          {/* ── Employees ─────────────────────────────────────────── */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-black uppercase tracking-widest">Employees</h2>
            </div>

            {employees.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white/10 rounded-xl bg-white/[0.02] text-white/40 text-sm px-6 mb-5">
                No employees yet — add your first team member below.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-1 px-1 mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/40">
                      <th className="font-bold uppercase text-[10px] tracking-widest pb-2 pr-4">Name</th>
                      <th className="font-bold uppercase text-[10px] tracking-widest pb-2 pr-4">Email</th>
                      <th className="font-bold uppercase text-[10px] tracking-widest pb-2 pr-4">Party</th>
                      <th className="font-bold uppercase text-[10px] tracking-widest pb-2 pr-4 text-right">Salary</th>
                      <th className="font-bold uppercase text-[10px] tracking-widest pb-2">Currency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e) => (
                      <tr key={e.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-4 font-bold">{e.name}</td>
                        <td className="py-2.5 pr-4 text-white/50">{e.email || "—"}</td>
                        <td className="py-2.5 pr-4">
                          <code className="text-[11px] text-white/40 font-mono" title={e.party}>
                            {short(e.party) || "—"}
                          </code>
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums font-bold">
                          {e.salary != null ? fmt(e.salary) : "—"}
                        </td>
                        <td className="py-2.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/50 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                            {e.currency || "USDC"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* add employee */}
            <form onSubmit={onAddEmployee} className="border-t border-white/10 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-white/50" />
                <span className="text-[11px] font-black uppercase tracking-widest text-white/60">Add employee</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={label}>Name</label>
                  <input
                    className={input}
                    value={form.name}
                    onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))}
                    placeholder="Ada Lovelace"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={label}>Email</label>
                  <input
                    className={input}
                    type="email"
                    value={form.email}
                    onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))}
                    placeholder="ada@team.com"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={label}>Currency</label>
                  <select
                    className={input}
                    value={form.currency}
                    onChange={(ev) => setForm((f) => ({ ...f, currency: ev.target.value as Currency }))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c} className="bg-black">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={label}>Salary</label>
                  <input
                    className={input}
                    type="number"
                    min="0"
                    step="any"
                    value={form.salary}
                    onChange={(ev) => setForm((f) => ({ ...f, salary: ev.target.value }))}
                    placeholder="5000"
                  />
                </div>
              </div>
              <div className="mt-4">
                <button type="submit" className={btn} disabled={busy || !form.name.trim()}>
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  Add employee
                </button>
              </div>
            </form>
          </Card>

          {/* ── Run payroll ───────────────────────────────────────── */}
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Play className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-black uppercase tracking-widest">Run payroll</h2>
            </div>
            <p className="text-[11px] text-white/40 mb-4">
              Select who to pay. Each salary settles as a separate private transfer on Canton.
            </p>

            {employees.length === 0 ? (
              <div className="text-center py-8 text-white/40 text-sm">Add employees to run payroll.</div>
            ) : (
              <>
                <div className="flex flex-col divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden mb-5">
                  {employees.map((e) => {
                    const checked = selected.has(e.id);
                    const payable = (e.salary ?? 0) > 0;
                    return (
                      <label
                        key={e.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          checked ? "bg-primary/[0.04]" : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(e.id)}
                          className="w-4 h-4 accent-primary shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold truncate">{e.name}</div>
                          <code className="text-[10px] text-white/30 font-mono">{short(e.party)}</code>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-black tabular-nums">
                            {payable ? fmt(e.salary) : "no salary"}
                            {payable && (
                              <span className="text-[10px] font-bold text-white/30 ml-1 tracking-widest">
                                {e.currency || "USDC"}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <div className={label}>Total this run</div>
                    <div className="text-2xl font-black tracking-tight tabular-nums mt-1">
                      {Object.keys(totalsByCurrency).length === 0 ? (
                        <span className="text-white/30">0.00</span>
                      ) : (
                        Object.entries(totalsByCurrency).map(([cur, amt], i) => (
                          <span key={cur}>
                            {i > 0 && <span className="text-white/30 mx-2 text-lg">+</span>}
                            {fmt(amt)}
                            <span className="text-sm text-white/40 font-bold ml-1">{cur}</span>
                          </span>
                        ))
                      )}
                    </div>
                    <div className="text-[11px] text-white/40 mt-1">
                      {selectedEmployees.length} employee{selectedEmployees.length === 1 ? "" : "s"} selected
                      {treasury && availableBalance("USDC") != null && (
                        <>
                          {" · "}
                          <span className={grandTotal > (availableBalance("USDC") ?? 0) ? "text-amber-400" : ""}>
                            {fmt(availableBalance("USDC"))} USDC available
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button onClick={onRunPayroll} className={btn} disabled={busy || selected.size === 0}>
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Run payroll
                  </button>
                </div>
              </>
            )}
          </Card>

          {/* ── Payroll history ───────────────────────────────────── */}
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <History className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-black uppercase tracking-widest">Payroll history</h2>
            </div>
            <p className="text-[11px] text-white/40 mb-4 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Every entry is a private per-employee transfer — settled on-ledger, visible only to you and the payee.
            </p>

            {runs.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white/10 rounded-xl bg-white/[0.02] text-white/40 text-sm px-6">
                No payroll runs yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {runs.map((r) => {
                  const open = expanded.has(r.id);
                  return (
                    <div key={r.id} className="border border-white/10 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleExpand(r.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                      >
                        {open ? (
                          <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold">{fmtDate(r.createdAt)}</div>
                          <div className="text-[11px] text-white/40">
                            {r.entries?.length ?? 0} employee{(r.entries?.length ?? 0) === 1 ? "" : "s"}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-sm font-black tabular-nums">
                          {fmt(r.total)}
                          <span className="text-[10px] font-bold text-white/30 ml-1 tracking-widest">{r.currency}</span>
                        </div>
                      </button>

                      {open && (
                        <div className="border-t border-white/10 bg-black/20">
                          {(r.entries ?? []).map((en, i) => (
                            <div
                              key={`${r.id}-${en.employeeId}-${i}`}
                              className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-b-0"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold truncate">{en.name}</div>
                                <code
                                  className="text-[10px] text-white/30 font-mono"
                                  title={`updateId ${en.updateId}`}
                                >
                                  proof {short(en.updateId) || "—"}
                                </code>
                              </div>
                              <div className="shrink-0 text-right text-xs font-black tabular-nums">
                                {fmt(en.amount)}
                                <span className="text-[9px] font-bold text-white/30 ml-1 tracking-widest">
                                  {en.currency}
                                </span>
                              </div>
                            </div>
                          ))}
                          <div className="px-4 py-2 text-[10px] text-white/30 flex items-center gap-1.5">
                            <Lock className="w-3 h-3" /> Each transfer above is its own Canton contract — no employee
                            sees another&apos;s pay.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ── Privacy footnote ──────────────────────────────────── */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Payroll on Irion is <span className="text-white/80 font-bold">private by construction</span>. Each
              salary is a distinct Daml contract whose signatory + observer are only you and the employee — the
              synchronizer that orders the transactions sees only encrypted commitments, never the amounts or the
              roster.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
