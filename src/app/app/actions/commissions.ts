"use server";

import { z } from "zod";
import {
  COMMISSION_BASES,
  COMPONENT_KINDS,
  type CommissionComponent,
  type CommissionTier,
} from "@/lib/commission";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Acordos comerciais e comissões (docs/COMMISSIONS.md). Só o administrador;
 * o serviço confere de novo e grava a auditoria.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const BASE = "/app/commissions";

/** "1.234,56" e "1234.56" valem (ponto de milhar só quando há vírgula). */
const number = (form: FormData, key: string): number | null => {
  const raw = str(form, key);
  if (raw === "") return null;
  const n = Number(
    raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw,
  );
  if (!Number.isFinite(n)) throw new Error("invalid_input");
  return n;
};

/** Faixas: "10000:2; 50000:3; :4" (até 10.000, 2%; até 50.000, 3%; acima, 4%). */
function tiers(text: string): CommissionTier[] | null {
  const parts = text
    .split(/[;\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  return parts.map((part) => {
    const [upTo, rate] = part.split(":").map((v) => v.trim().replace(",", "."));
    const r = Number(rate);
    const u = upTo === "" ? null : Number(upTo);
    if (!Number.isFinite(r) || (u !== null && !Number.isFinite(u)))
      throw new Error("commission_tiers_invalid");
    return { upTo: u, rate: r };
  });
}

function components(form: FormData): CommissionComponent[] {
  const rows = Math.min(40, Number(str(form, "rows")) || 0);
  const out: CommissionComponent[] = [];
  for (let i = 0; i < rows; i++) {
    const f = (key: string) => `c${i}.${key}`;
    if (form.getAll(f("remove")).includes("on")) continue;
    const name = str(form, f("name"));
    if (!name) continue;
    const line = str(form, f("line"));
    out.push({
      id: str(form, f("id")),
      name,
      kind: z.enum(COMPONENT_KINDS).parse(str(form, f("kind"))),
      base: z.enum(COMMISSION_BASES).parse(str(form, f("base")) || "items"),
      rate: number(form, f("rate")),
      amount: number(form, f("amount")),
      lineIds: line ? [ID.parse(line)] : [],
      tiers: tiers(str(form, f("tiers"))),
      tierMode: str(form, f("tierMode")) === "whole" ? "whole" : "progressive",
      accumulate: form.getAll(f("accumulate")).includes("on"),
      successEvent: (str(form, f("successEvent")) ||
        null) as CommissionComponent["successEvent"],
      floor: number(form, f("floor")),
      cap: number(form, f("cap")),
    });
  }
  return out;
}

const lines = (text: string) =>
  text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 100);

export async function saveAgreementAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  const back = `${BASE}/agreements/${id || "new"}`;
  await run(back, async () => {
    const svc = await import("@/lib/services/commissions");
    const row = await svc.saveAgreementDraft(user, id ? ID.parse(id) : null, {
      name: str(form, "name"),
      category: str(form, "category"),
      priority: number(form, "priority") ?? 0,
      beneficiary: str(form, "beneficiary"),
      beneficiaryType: str(form, "beneficiaryType"),
      customers: lines(str(form, "customers")),
      suppliers: lines(str(form, "suppliers")),
      lineIds: form
        .getAll("lineIds")
        .filter((v): v is string => typeof v === "string" && v !== ""),
      validFrom: str(form, "validFrom") || null,
      validTo: str(form, "validTo") || null,
      currency: str(form, "currency"),
      generateOn: str(form, "generateOn"),
      releaseOn: str(form, "releaseOn"),
      releaseMode: str(form, "releaseMode"),
      dueDays: number(form, "dueDays") ?? 0,
      components: components(form),
      notes: str(form, "notes") || null,
    });
    return withQuery(`${BASE}/agreements/${row.id}`, "saved", "1");
  });
}

/** Ativar, suspender, encerrar, duplicar ou abrir uma nova versão. */
export async function agreementStepAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  const back = `${BASE}/agreements/${id}`;
  await run(back, async () => {
    const svc = await import("@/lib/services/commissions");
    const step = z
      .enum(["activate", "suspend", "end", "duplicate", "version"])
      .parse(str(form, "step"));
    const target = ID.parse(id);
    if (step === "activate") await svc.activateAgreement(user, target);
    else if (step === "suspend" || step === "end")
      await svc.setAgreementStatus(
        user,
        target,
        step === "suspend" ? "suspended" : "ended",
        str(form, "reason"),
      );
    else {
      const row =
        step === "duplicate"
          ? await svc.duplicateAgreement(user, target)
          : await svc.newAgreementVersion(user, target);
      return withQuery(`${BASE}/agreements/${row.id}`, "saved", step);
    }
    return withQuery(back, "saved", step);
  });
}

const orderOf = async (form: FormData) => {
  const n = Number(str(form, "orderNumber"));
  if (!Number.isInteger(n) || n <= 0)
    throw new Error("commission_order_unknown");
  const { orderByNumber } = await import("@/lib/services/commissions");
  const order = await orderByNumber(n);
  if (!order) throw new Error("commission_order_unknown");
  return order;
};

/** Apura (ou reapura) as comissões de um pedido, pelo número. */
export async function accrueOrderAction(form: FormData) {
  const user = await requireUser();
  const back = withQuery(BASE, "tab", "entries");
  await run(back, async () => {
    const { assertRole } = await import("@/lib/auth/permissions");
    assertRole(user, ["admin"]);
    const svc = await import("@/lib/services/commissions");
    const order = await orderOf(form);
    const note = str(form, "manualNote");
    const r = note
      ? await svc.confirmManualEvent(user, order.id, note)
      : await svc.accrueOrder(user, order.id);
    return withQuery(
      back,
      "saved",
      `accrue:${r.created}:${r.updated}:${r.adjusted}`,
    );
  });
}

export async function approveEntriesAction(form: FormData) {
  const user = await requireUser();
  const back = withQuery(BASE, "tab", "entries");
  await run(back, async () => {
    const ids = z
      .array(ID)
      .max(500)
      .parse(form.getAll("entries").filter((v) => typeof v === "string"));
    if (!ids.length) throw new Error("commission_pick");
    const svc = await import("@/lib/services/commissions");
    const n = await svc.approveEntries(user, ids);
    return withQuery(back, "saved", `approve:${n}`);
  });
}

export async function settleEntriesAction(form: FormData) {
  const user = await requireUser();
  const party = str(form, "party");
  const back = withQuery(withQuery(BASE, "tab", "statement"), "party", party);
  await run(back, async () => {
    const ids = z
      .array(ID)
      .max(500)
      .parse(form.getAll("entryId").filter((v) => typeof v === "string"));
    const allocations = ids
      .map((entryId) => ({ entryId, amount: number(form, `pay.${entryId}`) }))
      .filter(
        (a): a is { entryId: string; amount: number } => a.amount !== null,
      );
    const svc = await import("@/lib/services/commissions");
    const payment = await svc.settleEntries(user, {
      allocations,
      paidAt: str(form, "paidAt"),
      reference: str(form, "reference") || null,
      note: str(form, "note") || null,
    });
    return withQuery(back, "saved", `settle:${payment.number}`);
  });
}
