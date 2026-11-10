import "server-only";
import { getStore, type Order, type Request } from "@/lib/db";
import { executeQuery, type NoteInput } from "./sankhya-client";
import type { SankhyaErpSettings } from "./sankhya-settings";

/*
 * Nota do Sankhya a partir de um pedido (ou solicitação com fornecedor
 * escolhido) do portal, com os códigos da Integração (empresa, condição,
 * natureza, centro de resultado, projeto, moeda, volume). Usada pelas regras
 * de processo (docs/PROCESSES.md). Fornecedor e produtos precisam do código do
 * Sankhya (`sankhyaCode`, gravado pela carga); sem ele, diz o que falta.
 */

export type BuiltNote =
  { ok: true; note: NoteInput } | { ok: false; reason: string };

const todayBr = () =>
  new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function buildPortalNote(
  erp: SankhyaErpSettings,
  top: number,
  order: Order | null,
  request: Request | null,
): Promise<BuiltNote> {
  const store = getStore();
  const quote =
    !order && request?.selectedQuoteId
      ? await store.get("quotes", request.selectedQuoteId)
      : null;
  const supplierId = order?.supplierId ?? quote?.supplierId ?? null;
  if (!supplierId) return { ok: false, reason: "sem fornecedor escolhido" };
  const supplier = await store.get("parties", supplierId);
  if (!supplier?.sankhyaCode)
    return {
      ok: false,
      reason: `fornecedor ${supplier?.name ?? supplierId} sem código do Sankhya (CODPARC)`,
    };

  const lines = order
    ? (await store.list("order_items", { filter: { orderId: order.id } })).map(
        (i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          price: i.unitPrice,
        }),
      )
    : request
      ? [
          {
            productId: request.productId,
            name: request.productName,
            quantity: request.quantity,
            price: quote?.price ?? null,
          },
        ]
      : [];
  if (!lines.length) return { ok: false, reason: "sem itens" };
  const items: NoteInput["items"] = [];
  for (const line of lines) {
    const product = line.productId
      ? await store.get("products", line.productId)
      : null;
    if (!product?.sankhyaCode)
      return {
        ok: false,
        reason: `produto ${line.name} sem código do Sankhya (CODPROD)`,
      };
    items.push({
      CODPROD: product.sankhyaCode,
      QTDNEG: line.quantity,
      CODVOL: erp.codVol || "UN",
      VLRUNIT: line.price ?? 0,
      PERCDESC: 0,
    });
  }

  const tops = await executeQuery(
    `SELECT MAX(TIPMOV) AS TIPMOV FROM TGFTOP WHERE CODTIPOPER = ${Math.trunc(top)}`,
  );
  const tipMov = String(tops.rows[0]?.TIPMOV ?? "").trim();
  if (!tipMov) return { ok: false, reason: `TOP ${top} não encontrada` };

  const ref = order
    ? `pedido #${order.number}`
    : `solicitação ${request?.number ?? request?.id ?? ""}`;
  return {
    ok: true,
    note: {
      header: {
        CODEMP: erp.codEmp,
        CODPARC: supplier.sankhyaCode,
        CODTIPOPER: top,
        TIPMOV: tipMov,
        CODTIPVENDA: erp.codTipVenda,
        CODVEND: erp.codVend ?? 0,
        CODNAT: erp.codNat,
        CODCENCUS: erp.codCenCus,
        CODPROJ: erp.codProj ?? 0,
        CODMOEDA: erp.codMoeda ?? undefined,
        DTNEG: todayBr(),
        OBSERVACAO: `Portal Wellmix: ${ref}`,
      },
      items,
      informPrice: true,
    },
  };
}
