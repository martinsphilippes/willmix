import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Translate } from "@/i18n";
import type { OrderColumn } from "@/lib/order-table";
import type { OrderCells } from "@/lib/services/order-cells";
import { Td, Th, formatDate } from "@/components/ui";
import { ClampText } from "@/components/clamp-text";

/*
 * Pedaços da tabela padrão de pedidos (dono, 22/11/2026;
 * docs/ORDER_TABLES.md) para as listas que não são a de Encomendas nem a de
 * Pedidos: os cabeçalhos pela chave da coluna e as células que vêm da
 * solicitação ligada (data, condições, cliente, m³ e valor). Só para a
 * Wellmix: quem é de fora não recebe estas colunas.
 */

/** Colunas 2 a 18, na ordem do dono (o número é da própria lista). */
export const STANDARD_AFTER_NUMBER: readonly OrderColumn[] = [
  "negotiationDate",
  "saleType",
  "paymentTerm",
  "paymentMethod",
  "billing",
  "vip",
  "group",
  "customerCode",
  "customerName",
  "status",
  "step",
  "sla",
  "items",
  "deliveries",
  "cbm",
  "value",
  "supplier",
];

export function orderHeadText(t: Translate, key: OrderColumn): string {
  return t(
    `orderTable.head.${
      key === "customerName" ? "customer" : key === "sla" ? "deadline" : key
    }` as DictionaryKey,
  );
}

/** Os cabeçalhos padrão depois do número; `seeValue` tira o Valor total. */
export function OrderStandardHeads({
  t,
  seeValue,
  omit = [],
}: {
  t: Translate;
  seeValue: boolean;
  /** Colunas que a tela tira ou põe em outro lugar (ex.: Consulta, 27/11/2026). */
  omit?: readonly OrderColumn[];
}) {
  return (
    <>
      {STANDARD_AFTER_NUMBER.filter(
        (key) => (seeValue || key !== "value") && !omit.includes(key),
      ).map((key) => (
        <Th key={key} className="whitespace-nowrap" data-order-head={key}>
          {orderHeadText(t, key)}
        </Th>
      ))}
    </>
  );
}

const num = "whitespace-nowrap text-right tabular-nums";

/** Data, condições e cliente (colunas 2 a 10). */
export function OrderTermsTds({
  t,
  cells,
  createdAt,
  compact = false,
  omit = [],
}: {
  t: Translate;
  cells: OrderCells | null | undefined;
  /** Sem solicitação ligada: o dia em que a própria linha nasceu. */
  createdAt: string | null;
  /** Colunas que a tela tira (ex.: Tipo de venda na Consulta, 27/11/2026). */
  omit?: readonly OrderColumn[];
  /**
   * Linha fina (dono, 24/11/2026; "Todos no passo"): forma de pagamento,
   * grupo econômico e cliente numa linha só, com "ver mais" no que não cabe.
   */
  compact?: boolean;
}) {
  const c = cells ?? null;
  const text = (value: string | null | undefined) =>
    value && compact ? (
      <ClampText
        text={value}
        lines={1}
        more={t("requestSheet.more")}
        less={t("requestSheet.less")}
        className="max-w-[11rem]"
      />
    ) : (
      (value ?? "—")
    );
  return (
    <>
      <Td
        className="whitespace-nowrap tabular-nums"
        data-order-col="negotiationDate"
      >
        {formatDate(c?.negotiationDate ?? createdAt, t)}
      </Td>
      {omit.includes("saleType") ? null : (
        <Td className="whitespace-nowrap" data-order-col="saleType">
          {c?.terms.saleType
            ? t(`orderTable.saleType.${c.terms.saleType}`)
            : "—"}
        </Td>
      )}
      <Td className={num} data-order-col="paymentTerm">
        {c?.terms.installments ?? "—"}
      </Td>
      <Td data-order-col="paymentMethod">{text(c?.terms.paymentName)}</Td>
      <Td className="whitespace-nowrap" data-order-col="billing">
        {c?.terms.billing ? t(`orderTable.billing.${c.terms.billing}`) : "—"}
      </Td>
      <Td className="whitespace-nowrap" data-order-col="vip">
        {c?.terms.vip
          ? t(`orderTerms.tier.${c.terms.vip}` as DictionaryKey)
          : "—"}
      </Td>
      <Td data-order-col="group">{text(c?.group)}</Td>
      <Td className={num} data-order-col="customerCode">
        {c?.customerCode ?? "—"}
      </Td>
      <Td data-order-col="customerName">{text(c?.customerName)}</Td>
    </>
  );
}

/** Total CBM e Valor total (colunas 16 e 17). */
export function OrderTotalsTds({
  t,
  cells,
  seeValue,
}: {
  t: Translate;
  cells: OrderCells | null | undefined;
  seeValue: boolean;
}) {
  const c = cells ?? null;
  return (
    <>
      <Td className={num} data-order-col="cbm">
        {c && c.cbm.value !== null
          ? c.cbm.value.toLocaleString(t.intl, { maximumFractionDigits: 3 })
          : "—"}
      </Td>
      {seeValue ? (
        <Td className={num} data-order-col="value">
          {c?.sale.amounts.length
            ? c.sale.amounts
                .map(
                  (a) =>
                    `${a.currency} ${a.amount.toLocaleString(t.intl, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`,
                )
                .join(" · ")
            : "—"}
        </Td>
      ) : null}
    </>
  );
}
