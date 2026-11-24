import "server-only";

import { getStore, type SupplierRequest, type User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import {
  responsibleOf,
  withFix,
  type Responsible,
} from "@/lib/request-responsible";
import {
  samplingDueAt,
  samplingOf,
  samplingTurn,
  supplierRequestTurn,
} from "@/lib/supplier-request-sampling";
import {
  negotiationTurn,
  supplierRequestSlaDue,
} from "@/lib/supplier-requests";
import type { NextStep, PurchaseProgress } from "./request-list";
import { peopleDirectory } from "./request-responsible";

/*
 * Quem age na coluna Vez da cotação (dono, 24/11/2026; docs/TURNS.md): a
 * mesma peça "Quem pode agir" da lista de Encomendas, pela regra das
 * Pendências. No fornecedor, os logins ativos dele (o e-mail só para o
 * administrador; sem login, o aviso e o atalho para gerar); na Wellmix,
 * quem tem a função da etapa (decidir a resposta, validar a amostra). Só a
 * Wellmix vê; nada é gravado.
 */
export async function supplierRequestResponsibles(
  viewer: User,
  rows: readonly SupplierRequest[],
  options: {
    /** SLA da negociação (minutos), o prazo de responder e de decidir. */
    slaMinutes: number;
    /** SLA da amostragem (dias), o prazo de enviar a amostra. */
    samplingDays: number;
    /** O fornecedor é do tipo Trading (a vez aparece como Trading). */
    trading?: boolean;
    translate: (key: string) => string;
  },
): Promise<Map<string, Responsible | null>> {
  const out = new Map<string, Responsible | null>();
  const turns = rows.map((r) => ({ r, turn: supplierRequestTurn(r) }));
  if (!isWellmix(viewer) || !turns.some((x) => x.turn)) return out;
  const users = await getStore().list("users");
  const directory = await peopleDirectory(viewer, {
    users,
    requests: [],
    ctx: null,
    partnerIds: rows.map((r) => r.supplierId).filter(Boolean),
    customerName: () => null,
    translate: options.translate,
  });
  const { fixDirectory } = await import("./request-fix");
  const fixDir = await fixDirectory(viewer, {
    users,
    customerIds: [],
    people: directory,
  });
  for (const { r, turn } of turns) {
    if (!turn) {
      out.set(r.id, null);
      continue;
    }
    const sampling = samplingOf(r);
    const purchase: PurchaseProgress = {
      decision: null,
      quote: null,
      supplierRequests: [
        {
          status: r.status,
          negotiation: negotiationTurn(r),
          sampling: samplingTurn(sampling),
          supplierId: r.supplierId,
          negotiationDueAt: supplierRequestSlaDue(r, options.slaMinutes),
          samplingDueAt: samplingDueAt(sampling, options.samplingDays),
        },
      ],
    };
    const step: NextStep = {
      key: turn.step,
      who:
        turn.party === "wellmix"
          ? "wellmix"
          : options.trading
            ? "trading"
            : "supplier",
    };
    // Sem cliente: o pedido é ao fornecedor (o atalho é só o do parceiro).
    const request = { id: r.id, customerId: "" };
    out.set(
      r.id,
      withFix(
        responsibleOf(step, request, purchase, directory),
        step,
        request,
        purchase,
        fixDir,
      ),
    );
  }
  return out;
}
