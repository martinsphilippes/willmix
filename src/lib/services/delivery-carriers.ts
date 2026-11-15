import "server-only";
import { getStore } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { executeQuery } from "@/lib/integrations/sankhya-client";
import type { CarrierChoice } from "@/lib/order-terms";

/*
 * Transportadoras da "Entrega" na Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md): Transportador e Re-despacho. O portal tem poucas
 * transportadoras no cadastro (parceiros do tipo "Transportadora"); as
 * demais vêm do Sankhya (TGFPAR com TRANSPORTADORA = 'S', ativas), lidas na
 * hora e guardadas por 30 minutos por instância. Sem o Sankhya configurado
 * (ou com erro), só as do portal, e a resposta diz (`sankhya`).
 */

export interface CarrierOption extends CarrierChoice {
  city: string | null;
  /** Código do parceiro no Sankhya (CODPARC); nulo sem ele. */
  erpCode: string | null;
  /** CNPJ/CPF (só números); nulo sem ele. */
  taxId: string | null;
}

export interface CarrierList {
  carriers: CarrierOption[];
  sankhya: "ok" | "off" | "error";
}

const TTL_MS = 30 * 60 * 1000;
let cached: { at: number; rows: CarrierOption[] } | null = null;

/** Para testes: esquece a lista do Sankhya. */
export function resetCarrierCache() {
  cached = null;
}

const SQL =
  "SELECT P.CODPARC, P.NOMEPARC, P.CGC_CPF, C.NOMECID FROM TGFPAR P LEFT JOIN TSICID C ON C.CODCID = P.CODCID WHERE P.TRANSPORTADORA = 'S' AND P.ATIVO = 'S' ORDER BY P.NOMEPARC";

async function sankhyaCarriers(): Promise<CarrierOption[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.rows;
  const table = await executeQuery(SQL);
  const rows = table.rows
    .map((r) => ({
      source: "sankhya" as const,
      code: String(r.CODPARC ?? "").trim(),
      name: String(r.NOMEPARC ?? "").trim(),
      city: r.NOMECID ? String(r.NOMECID).trim() : null,
      erpCode: String(r.CODPARC ?? "").trim() || null,
      taxId: String(r.CGC_CPF ?? "").replace(/\D/g, "") || null,
    }))
    .filter((c) => /^\d{1,10}$/.test(c.code) && c.name);
  cached = { at: Date.now(), rows };
  return rows;
}

/** As transportadoras para escolher: as do portal e as do Sankhya, sem repetir. */
export async function deliveryCarriers(): Promise<CarrierList> {
  const portal = await listColumns(
    getStore(),
    "parties",
    ["name", "city", "sankhyaCode", "taxId"],
    { filter: { type: "carrier", active: true }, orderBy: "name" },
  );
  let fromSankhya: CarrierOption[] = [];
  let sankhya: CarrierList["sankhya"] = "ok";
  try {
    fromSankhya = await sankhyaCarriers();
  } catch (error) {
    const code = (error as { code?: string }).code;
    sankhya = code === "sankhya_not_configured" ? "off" : "error";
    if (sankhya === "error")
      console.error("[carriers] transportadoras do Sankhya", error);
  }
  // A transportadora do portal que veio do Sankhya aparece uma vez (a do portal).
  const linked = new Set(
    portal.map((p) => p.sankhyaCode).filter((c): c is string => !!c),
  );
  const carriers: CarrierOption[] = [
    ...portal.map((p) => ({
      source: "portal" as const,
      code: p.id,
      name: p.name,
      city: p.city ?? null,
      erpCode: p.sankhyaCode ?? null,
      taxId: (p.taxId ?? "").replace(/\D/g, "") || null,
    })),
    ...fromSankhya.filter((c) => !linked.has(c.code)),
  ];
  return { carriers, sankhya };
}

/** A transportadora escolhida, conferida na lista (nulo = não está nela). */
export async function resolveCarrier(
  choice: Pick<CarrierChoice, "source" | "code"> | null,
): Promise<CarrierChoice | null> {
  if (!choice) return null;
  if (choice.source === "portal") {
    const party = await getStore().get("parties", choice.code);
    return party && party.type === "carrier" && party.active
      ? { source: "portal", code: party.id, name: party.name }
      : null;
  }
  const { carriers } = await deliveryCarriers();
  const hit = carriers.find(
    (c) => c.source === "sankhya" && c.code === choice.code,
  );
  return hit ? { source: "sankhya", code: hit.code, name: hit.name } : null;
}
