import "server-only";
import {
  executeQuery,
  loadRecords,
  type NoteInput,
  type SankhyaRow,
} from "./sankhya-client";
import {
  buildTestNote,
  erpMissing,
  type SankhyaErpSettings,
} from "./sankhya-settings";

/*
 * Pedido/cotação de teste da tela Integração Sankhya: confere no ERP (só
 * leitura) o parceiro, o produto e a TOP, e monta a nota com os códigos
 * gravados. A pré-visualização e o envio usam a mesma conferência.
 */

export interface TestOrderRequest {
  kind: "order" | "quote";
  codParc: number;
  codProd: number;
  quantity: number;
  unitPrice: number;
}

export type TestOrderCheck =
  | { ok: false; code: "sankhya_erp_incomplete"; detail: string }
  | { ok: false; code: "sankhya_not_found"; detail: string }
  | {
      ok: true;
      note: NoteInput;
      top: SankhyaRow;
      partner: SankhyaRow;
      product: SankhyaRow;
    };

const todayBr = () =>
  new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function checkTestOrder(
  erp: SankhyaErpSettings,
  input: TestOrderRequest,
): Promise<TestOrderCheck> {
  const missing = erpMissing(erp, input.kind);
  if (missing.length)
    return {
      ok: false,
      code: "sankhya_erp_incomplete",
      detail: missing.join(", "),
    };
  const top = Math.trunc(
    (input.kind === "order" ? erp.topOrder : erp.topQuote) ?? 0,
  );
  const [tops, partners, products] = await Promise.all([
    // top é inteiro (validado ao gravar): pode ir no SQL.
    executeQuery(
      `SELECT MAX(TIPMOV) AS TIPMOV, MAX(DESCROPER) AS DESCROPER FROM TGFTOP WHERE CODTIPOPER = ${top}`,
    ),
    loadRecords({
      entity: "Parceiro",
      fields: "CODPARC, NOMEPARC",
      where: "CODPARC = ?",
      params: [{ type: "I", value: String(input.codParc) }],
    }),
    loadRecords({
      entity: "Produto",
      fields: "CODPROD, DESCRPROD, CODVOL",
      where: "CODPROD = ?",
      params: [{ type: "I", value: String(input.codProd) }],
    }),
  ]);
  const topRow = tops.rows[0] ?? {};
  const tipMov = String(topRow.TIPMOV ?? "").trim();
  const partner = partners.rows[0];
  const product = products.rows[0];
  const notFound = [
    !tipMov && `TOP ${top}`,
    !partner && `CODPARC ${input.codParc}`,
    !product && `CODPROD ${input.codProd}`,
  ].filter(Boolean);
  if (notFound.length || !partner || !product)
    return {
      ok: false,
      code: "sankhya_not_found",
      detail: notFound.join(", "),
    };
  return {
    ok: true,
    top: { CODTIPOPER: top, ...topRow },
    partner,
    product,
    note: buildTestNote(erp, {
      ...input,
      tipMov,
      productVolume: product.CODVOL ? String(product.CODVOL) : null,
      date: todayBr(),
    }),
  };
}

/** O que ficou gravado no ERP para um NUNOTA (cabeçalho e itens). */
export async function readNote(nunota: string) {
  const params = [{ type: "I" as const, value: nunota }];
  const [header, items] = await Promise.all([
    loadRecords({
      entity: "CabecalhoNota",
      fields:
        "NUNOTA, NUMNOTA, CODEMP, CODTIPOPER, TIPMOV, CODPARC, CODTIPVENDA, CODVEND, DTNEG, VLRNOTA, STATUSNOTA, PENDENTE, OBSERVACAO",
      where: "NUNOTA = ?",
      params,
    }),
    loadRecords({
      entity: "ItemNota",
      fields:
        "NUNOTA, SEQUENCIA, CODPROD, QTDNEG, CODVOL, CODLOCALORIG, VLRUNIT, VLRTOT",
      where: "NUNOTA = ?",
      params,
    }),
  ]);
  return { header, items };
}
