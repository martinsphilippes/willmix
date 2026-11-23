import { quoteProductTerms } from "@/lib/quote-negotiation";
import type { Translate } from "@/i18n";
import { productNameText } from "@/i18n";
import type {
  PurchaseQuoteItem,
  PurchaseQuoteResponse,
  SupplierSheetData,
} from "@/lib/db/schema";
import { Alert, Table, Td, Th, formatDate, rowClass } from "@/components/ui";
import { materialsText, type MaterialOption } from "@/lib/materials";
import { quoteInnerState } from "@/lib/quote-inner";

/*
 * A cotação travada para o fornecedor (dono, 21/11/2026, opção 1): passado o
 * prazo, ou escolhida a vencedora, o formulário sai e fica só a resposta que
 * ele enviou (preço de cada produto, ficha técnica, foto e condições), com o
 * motivo da trava. Só leitura.
 */
export function QuoteAnswerSummary({
  t,
  items,
  response,
  reason,
  times,
  materials = [],
}: {
  t: Translate;
  items: readonly PurchaseQuoteItem[];
  response: PurchaseQuoteResponse;
  /** "deadline": o prazo dele acabou; "closed": vencedora escolhida ou cotação encerrada. */
  reason: "deadline" | "closed";
  /** O prazo em Brasília e na China. */
  times: { br: string; cn: string };
  /** O catálogo de materiais (os nomes no idioma da tela). */
  materials?: readonly MaterialOption[];
}) {
  const byId = new Map(materials.map((m) => [m.id, m]));
  const n = (v: number, digits = 3) =>
    v.toLocaleString(t.intl, { maximumFractionDigits: digits });
  const sheetText = (s: SupplierSheetData) =>
    [
      `${t("supplierSheet.board.col.masterBoxQty")}: ${n(s.masterBoxQty, 0)}`,
      // O inner da ficha só nas antigas (hoje é exigência do cliente).
      s.innerBoxQty === null
        ? null
        : `${t("supplierSheet.board.col.innerBoxQty")}: ${
            s.innerBoxQty ? n(s.innerBoxQty, 0) : t("supplierSheet.noInner")
          }`,
      s.boxLengthCm !== null && s.boxWidthCm !== null && s.boxHeightCm !== null
        ? `${t("supplierSheet.board.col.dims")}: ${n(s.boxLengthCm, 2)} × ${n(s.boxWidthCm, 2)} × ${n(s.boxHeightCm, 2)}`
        : null,
      `${t("supplierSheet.board.col.cbm")}: ${n(s.cbm, 4)}`,
      `${t("supplierSheet.board.col.netWeight")}: ${n(s.netWeightKg)}`,
      `${t("supplierSheet.board.col.grossWeight")}: ${
        s.grossWeightBoxKg === null
          ? t("quote.sheet.grossUnknownDeclared")
          : n(s.grossWeightBoxKg)
      }`,
      `${t("supplierSheet.board.col.material")}: ${
        (s.materialIds?.length
          ? materialsText(s.materialIds, byId, t.intl)
          : "") || s.material
      }`,
      `${t("supplierSheet.board.col.code")}: ${s.factoryItemCode ?? t("supplierSheet.noCode")}`,
    ]
      .filter(Boolean)
      .join(" · ");
  const terms: Array<[string, string]> =
    response.status === "answered"
      ? [
          [t("strategy.currency"), response.currency ?? "—"],
          [
            t("strategy.last.incoterm"),
            response.incoterm
              ? response.incoterm === "EXW" && response.incotermValue != null
                ? `EXW · ${t("quote.incotermValue")}: ${response.currency ?? ""} ${response.incotermValue.toLocaleString(t.intl, { maximumFractionDigits: 4 })}`
                : response.incoterm
              : "—",
          ],
          [t("demand.notes"), response.note ?? "—"],
        ]
      : [];
  return (
    <div className="space-y-3" data-quote-locked={reason}>
      <Alert tone="neutral">
        {reason === "closed"
          ? t("quote.supplier.lockedClosed")
          : t("quote.supplier.lockedDeadline", times)}
      </Alert>
      {response.status === "answered" ? (
        <div data-quote-sent-answer>
          <p className="text-sm font-semibold text-zinc-900">
            {t("quote.supplier.yourAnswer")}
          </p>
          {response.answeredAt ? (
            <p className="mb-2 text-xs text-zinc-600">
              {t("quote.supplier.sentAt", {
                date: formatDate(response.answeredAt, t),
              })}
            </p>
          ) : null}
          <Table tools={false}>
            <thead>
              <tr>
                <Th>{t("common.product")}</Th>
                <Th>{t("quote.unitPrice")}</Th>
                <Th>{t("supplierSheet.title")}</Th>
                <Th>{t("supplierSheet.board.col.photo")}</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const price = response.prices?.find(
                  (p) => p.productId === item.productId,
                );
                const extra = response.items?.find(
                  (i) => i.productId === item.productId,
                );
                return (
                  <tr
                    key={item.productId}
                    className={rowClass}
                    data-quote-sent-item={item.productId}
                  >
                    <Td>
                      {productNameText(t, item.name)}
                      <span className="block text-xs text-zinc-500">
                        {item.quantity.toLocaleString(t.intl)} {item.unit}
                      </span>
                      {/* Prazo e pedido mínimo do produto (dono, 23/11/2026). */}
                      {(() => {
                        const own = quoteProductTerms(response, item.productId);
                        const parts = [
                          own.leadTimeDays !== null
                            ? `${t("strategy.last.leadTime")}: ${t("strategy.days", { n: own.leadTimeDays })}`
                            : null,
                          own.moq !== null
                            ? `${t("strategy.last.moq")}: ${n(own.moq, 0)}`
                            : null,
                        ].filter(Boolean);
                        return parts.length ? (
                          <span
                            className="block text-xs text-zinc-600"
                            data-quote-sent-terms={item.productId}
                          >
                            {parts.join(" · ")}
                          </span>
                        ) : null;
                      })()}
                      {(() => {
                        const inner = quoteInnerState(item.inner);
                        return inner.kind === "required" ? (
                          <span
                            className="block text-xs text-zinc-600"
                            data-quote-sent-inner={inner.qty}
                          >
                            {t("quote.inner.required", {
                              n: inner.qty.toLocaleString(t.intl),
                            })}
                          </span>
                        ) : null;
                      })()}
                    </Td>
                    <Td className="tabular-nums" data-quote-sent-price>
                      {price
                        ? `${response.currency ?? ""} ${n(price.unitPrice, 6)}`
                        : "—"}
                    </Td>
                    <Td className="text-xs text-zinc-700">
                      {extra?.sheet ? sheetText(extra.sheet) : "—"}
                    </Td>
                    <Td>
                      {extra?.scalePhotoDocumentId ? (
                        <a
                          href={`/api/files/${extra.scalePhotoDocumentId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-10 overflow-hidden rounded border border-zinc-200"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                          <img
                            src={`/api/files/${extra.scalePhotoDocumentId}`}
                            alt={t("supplierSheet.view.photo")}
                            className="h-10 w-10 object-cover"
                          />
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {terms.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="break-words text-zinc-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="text-sm text-zinc-700" data-quote-sent-answer="none">
          {response.status === "declined"
            ? t("quote.supplier.declinedAnswer")
            : t("quote.supplier.noAnswer")}
        </p>
      )}
    </div>
  );
}
