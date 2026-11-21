import {
  parseRequestSchedule,
  type RequestSchedule,
} from "@/lib/workflow/request-schedule";
import type {
  RequestCompanyAllocation,
  RequestInnerRequirement,
} from "@/lib/db/schema";
import { parseNumberInput } from "@/lib/number-input";
/*
 * Linhas de produto do formulário de nova solicitação. Cada linha usa o
 * prefixo `p<n>.` nos campos (p0.productName, p0.quantity…); linhas removidas
 * na tela deixam buracos na numeração, por isso os índices vêm dos campos
 * presentes. Este arquivo NÃO é "use server": só ajuda a action.
 */

export interface RequestItemFields {
  index: number;
  productId: string | null;
  /** Variação escolhida de um produto com variações (nula sem). */
  variantId: string | null;
  productName: string;
  description: string;
  specification: string | null;
  quantity: number | null;
  unit: string;
  sourcingDemand: boolean;
  attachments: File[];
  /** Programação de entregas da linha (nula quando não ligada). */
  schedule: RequestSchedule | null;
  /**
   * Peças de cada empresa do grupo econômico em cada entrega
   * (docs/ECONOMIC_GROUPS.md); nulo no pedido de um cliente só. A action
   * confere as empresas e as somas.
   */
  companyAllocations: RequestCompanyAllocation[] | null;
  /**
   * Caixa inner exigida pelo cliente (dono, 21/11/2026): "Sim" com as peças
   * por inner; "Não" (o padrão) = nula.
   */
  innerRequirement: RequestInnerRequirement | null;
}

/**
 * `<linha>.innerRequired` ("yes"/"no") e `<linha>.innerQty`. No envio, "Sim"
 * sem um número inteiro positivo = Error("inner_qty_required"); no rascunho,
 * fica "Sim" sem o número.
 */
export function parseInnerRequirement(
  choice: string,
  rawQty: string,
  lenient = false,
): RequestInnerRequirement | null {
  if (choice !== "yes") return null;
  const n = parseNumberInput(rawQty, { int: true });
  const qty =
    n !== null && Number.isInteger(n) && n > 0 && n <= 1_000_000 ? n : null;
  if (qty === null && !lenient) throw new Error("inner_qty_required");
  return { qty };
}

const ALLOC_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** O campo `<linha>.companyAllocations` (JSON); inválido = Error("allocations"). */
export function parseCompanyAllocations(
  raw: string,
): RequestCompanyAllocation[] | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("allocations");
  }
  if (!Array.isArray(data) || data.length > 200) throw new Error("allocations");
  const out = data.map((a) => {
    const id = (a as { customerId?: unknown })?.customerId;
    const q = (a as { quantities?: unknown })?.quantities;
    if (
      typeof id !== "string" ||
      !ALLOC_ID.test(id) ||
      !Array.isArray(q) ||
      q.length < 1 ||
      q.length > 60 ||
      !q.every((n) => Number.isInteger(n) && n >= 0 && n <= 1e9)
    )
      throw new Error("allocations");
    return { customerId: id, quantities: q as number[] };
  });
  return out.length ? out : null;
}

const ROW = /^p(\d+)\.(productId|productName|description|quantity)$/;
/** Teto de produtos por formulário (a tela não chega perto; protege o servidor). */
export const MAX_REQUEST_ITEMS = 30;

export function parseRequestItems(
  form: FormData,
  /**
   * Rascunho (dono, 18/11/2026): o formulário volta como foi salvo, mesmo
   * incompleto. Uma programação ainda sem quantidade (ou de outro produto)
   * não derruba os produtos: a linha volta sem ela. O envio segue estrito.
   */
  options: { lenient?: boolean } = {},
): RequestItemFields[] {
  const indices = new Set<number>();
  for (const key of form.keys()) {
    const m = ROW.exec(key);
    if (m) indices.add(Number(m[1]));
  }
  if (indices.size > MAX_REQUEST_ITEMS && !options.lenient)
    throw new Error("too_many_products");
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v.trim() : "";
  };
  return [...indices]
    .sort((a, b) => a - b)
    .slice(0, options.lenient ? MAX_REQUEST_ITEMS : undefined)
    .map((index) => {
      const p = `p${index}.`;
      const qty = text(`${p}quantity`).replace(",", ".");
      const productId = text(`${p}productId`) || null;
      const variantId = text(`${p}variantId`) || null;
      let schedule: RequestSchedule | null = null;
      try {
        schedule = parseRequestSchedule(form, p, undefined, {
          allowZero: true,
          draft: options.lenient,
        });
      } catch (error) {
        if (!options.lenient) throw error;
      }
      // Programação gerada para outro produto (trocado depois de gerar): a
      // tela já tira; o servidor recusa se ainda vier (dono, 14/11/2026).
      const scheduleFor = text(`${p}schedule.for`);
      const current = productId ? `${productId}:${variantId ?? ""}` : "outside";
      if (schedule && scheduleFor && scheduleFor !== current) {
        if (!options.lenient) throw new Error("schedule_product_changed");
        schedule = null;
      }
      let companyAllocations: RequestCompanyAllocation[] | null = null;
      try {
        companyAllocations = parseCompanyAllocations(
          text(`${p}companyAllocations`),
        );
      } catch (error) {
        if (!options.lenient) throw error;
      }
      let innerRequirement: RequestInnerRequirement | null = null;
      try {
        innerRequirement = parseInnerRequirement(
          text(`${p}innerRequired`),
          text(`${p}innerQty`),
          options.lenient,
        );
      } catch (error) {
        if (!options.lenient) throw error;
      }
      return {
        index,
        productId,
        variantId,
        companyAllocations,
        innerRequirement,
        productName: text(`${p}productName`),
        description: text(`${p}description`),
        specification: text(`${p}specification`) || null,
        quantity:
          qty === "" || (options.lenient && !Number.isFinite(Number(qty)))
            ? null
            : Number(qty),
        unit: text(`${p}unit`) || "un",
        sourcingDemand: form.get(`${p}sourcingDemand`) === "on",
        schedule,
        attachments: form
          .getAll(`${p}attachments`)
          .filter((f): f is File => f instanceof File && f.size > 0),
      };
    });
}

/**
 * Programação do pedido (dono, 15/11/2026): as datas e o número de
 * programações são do pedido, iguais para todos os produtos; cada produto
 * só reparte a quantidade dele nelas. Ou todas as linhas têm a mesma
 * programação (número, 1ª data, intervalo e a data de cada programação,
 * inclusive as fixadas à mão), ou nenhuma tem (pedido único).
 * Fora disso: Error("schedule_mismatch").
 */
export function assertSameSchedule(rows: RequestItemFields[]): void {
  const plans = rows.map((r) =>
    r.schedule
      ? `${r.schedule.items.length}|${r.schedule.firstDate}|${r.schedule.intervalDays}|${r.schedule.items.map((i) => i.expectedAt).join(",")}`
      : "",
  );
  if (new Set(plans).size > 1) throw new Error("schedule_mismatch");
}
