import {
  parseRequestSchedule,
  type RequestSchedule,
} from "@/lib/workflow/request-schedule";
/*
 * Linhas de produto do formulário de nova solicitação. Cada linha usa o
 * prefixo `p<n>.` nos campos (p0.productName, p0.quantity…); linhas removidas
 * na tela deixam buracos na numeração, por isso os índices vêm dos campos
 * presentes. Este arquivo NÃO é "use server": só ajuda a action.
 */

export interface RequestItemFields {
  index: number;
  productId: string | null;
  productName: string;
  description: string;
  specification: string | null;
  quantity: number | null;
  unit: string;
  sourcingDemand: boolean;
  attachments: File[];
  /** Programação de entregas da linha (nula quando não ligada). */
  schedule: RequestSchedule | null;
}

const ROW = /^p(\d+)\.(productId|productName|description|quantity)$/;
/** Teto de produtos por formulário (a tela não chega perto; protege o servidor). */
export const MAX_REQUEST_ITEMS = 30;

export function parseRequestItems(form: FormData): RequestItemFields[] {
  const indices = new Set<number>();
  for (const key of form.keys()) {
    const m = ROW.exec(key);
    if (m) indices.add(Number(m[1]));
  }
  if (indices.size > MAX_REQUEST_ITEMS) throw new Error("too_many_products");
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v.trim() : "";
  };
  return [...indices]
    .sort((a, b) => a - b)
    .map((index) => {
      const p = `p${index}.`;
      const qty = text(`${p}quantity`).replace(",", ".");
      return {
        index,
        productId: text(`${p}productId`) || null,
        productName: text(`${p}productName`),
        description: text(`${p}description`),
        specification: text(`${p}specification`) || null,
        quantity: qty === "" ? null : Number(qty),
        unit: text(`${p}unit`) || "un",
        sourcingDemand: form.get(`${p}sourcingDemand`) === "on",
        schedule: parseRequestSchedule(form, p),
        attachments: form
          .getAll(`${p}attachments`)
          .filter((f): f is File => f instanceof File && f.size > 0),
      };
    });
}
