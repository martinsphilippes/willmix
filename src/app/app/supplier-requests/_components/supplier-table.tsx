import type { SupplierRequest } from "@/lib/db/schema";
import { SHEET_CURRENCIES } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  canPostMessage,
  negotiationTurn,
  pendingProposal,
  supplierCanAnswer,
} from "@/lib/supplier-requests";
import { slaOf } from "@/lib/services/supplier-request-negotiation";
import {
  Badge,
  Card,
  Field,
  Input,
  LinkButton,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  cx,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { QuickDialog } from "@/components/quick-dialog";
import {
  answerSupplierRequestAction,
  postSupplierRequestMessageAction,
} from "../../actions/supplier-requests";
import { STATUS_TONE, answerText } from "./status";
import { SlaBadge } from "./negotiation";

/*
 * O que o fornecedor vê primeiro ao abrir uma solicitação
 * (docs/SUPPLIER_REQUESTS.md, "Tabela do fornecedor"): os produtos que a
 * Wellmix pediu a ele no mesmo booking, com foto, valores e três ações
 * rápidas por linha (mensagem, resposta sim/não e abrir a tela do produto).
 */

export function SupplierRequestTable({
  rows,
  currentId,
  slaMinutes,
  t,
}: {
  rows: SupplierRequest[];
  currentId: string;
  slaMinutes: number;
  t: Translate;
}) {
  const intl = t.intl;
  const num = (n: number | null, digits = 4) =>
    n === null
      ? "—"
      : n.toLocaleString(intl, { maximumFractionDigits: digits });
  const decimal = intl.startsWith("pt") ? "," : ".";
  const raw = (n: number | null) =>
    n === null ? "" : String(n).replace(".", decimal);
  const k = (key: string) =>
    t(`supplierRequests.table.${key}` as DictionaryKey);

  return (
    <Card title={k("title")}>
      <p className="mb-3 text-xs text-zinc-500">{k("hint")}</p>
      <Table>
        <thead>
          <tr>
            <Th>{k("col.photo")}</Th>
            <Th>{k("col.item")}</Th>
            <Th>{k("col.quantity")}</Th>
            <Th>{k("col.bookingPrice")}</Th>
            <Th>{k("col.answer")}</Th>
            <Th>{k("col.status")}</Th>
            <Th className="text-right">{k("col.actions")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const it = r.item;
            const name = it.description ?? it.productName ?? "—";
            const current = r.id === currentId;
            const pending = !!pendingProposal(r.negotiation);
            const canAnswer = supplierCanAnswer(r.status) && !pending;
            const turn = negotiationTurn(r);
            const href = `/app/supplier-requests/${r.id}?view=item`;
            return (
              <tr
                key={r.id}
                className={cx(rowClass, current && "bg-brand-50/60")}
                data-supplier-table-row={r.id}
                data-current={current ? "1" : undefined}
              >
                <Td>
                  <PhotoGallery
                    photos={
                      it.photoDocumentId
                        ? [{ id: it.photoDocumentId, label: null }]
                        : []
                    }
                    name={name}
                    className="h-14 w-14"
                    labels={{
                      title: k("photo"),
                      close: k("close"),
                      open: k("photoOpen"),
                      count: t("supplierRequests.detail.title", {
                        n: r.number,
                      }),
                      noPhoto: k("noPhoto"),
                    }}
                  />
                </Td>
                <Td>
                  <span className="block max-w-72 whitespace-normal font-medium text-zinc-900">
                    {name}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {[
                      `nº ${r.number}`,
                      it.factoryItemCode,
                      it.itemNumber,
                      it.material,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {r.needs ? (
                    <span
                      className="mt-0.5 block max-w-72 truncate text-xs text-zinc-600"
                      title={r.needs}
                    >
                      {k("needs")}: {r.needs}
                    </span>
                  ) : null}
                  {current ? (
                    <span className="mt-1 inline-flex">
                      <Badge tone="info">{k("current")}</Badge>
                    </span>
                  ) : null}
                </Td>
                <Td className="tabular-nums">
                  {t("supplierRequests.detail.pieces", {
                    n: r.quantity.toLocaleString(intl),
                  })}
                  <span className="block text-xs text-zinc-500">
                    MOQ {num(it.moq, 0)}
                  </span>
                </Td>
                <Td className="tabular-nums">
                  {it.price === null
                    ? "—"
                    : `${num(it.price)} ${it.currency ?? ""} ${it.incoterm ?? ""}`.trim()}
                </Td>
                <Td>
                  <span data-supplier-table-answer-text={r.id}>
                    {answerText(t, r)}
                  </span>
                  {r.supplierCanDo === "yes" &&
                  (r.supplierMoq !== null ||
                    r.supplierLeadTimeDays !== null) ? (
                    <span className="block text-xs text-zinc-500">
                      {[
                        r.supplierMoq !== null
                          ? `MOQ ${num(r.supplierMoq, 0)}`
                          : null,
                        r.supplierLeadTimeDays !== null
                          ? `${t("supplierRequests.detail.answer.leadTime")}: ${num(r.supplierLeadTimeDays, 0)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={STATUS_TONE[r.status]}>
                      {t(
                        `supplierRequests.status.${r.status}` as DictionaryKey,
                      )}
                    </Badge>
                    <SlaBadge sla={slaOf(r, slaMinutes)} t={t} />
                  </span>
                  {turn ? (
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {t(
                        `supplierRequests.negotiation.turn.${turn}` as DictionaryKey,
                      )}
                    </span>
                  ) : null}
                  {pending ? (
                    <span
                      className="mt-0.5 block max-w-48 text-xs text-amber-800"
                      data-supplier-table-pending
                    >
                      {k("proposalPending")}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {canPostMessage(r.status) ? (
                      <QuickDialog
                        label={k("message")}
                        title={t("supplierRequests.table.messageTitle", {
                          n: r.number,
                        })}
                        closeLabel={k("close")}
                        data-supplier-table-message={r.id}
                      >
                        <form
                          action={postSupplierRequestMessageAction}
                          className="space-y-2"
                          data-supplier-table-message-form
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <Field label={k("messageText")}>
                            <Textarea
                              name="text"
                              rows={3}
                              maxLength={4000}
                              required
                              data-supplier-table-message-text
                            />
                          </Field>
                          <SubmitButton
                            pendingText={k("sending")}
                            data-supplier-table-message-submit
                          >
                            {k("send")}
                          </SubmitButton>
                        </form>
                      </QuickDialog>
                    ) : null}
                    {canAnswer ? (
                      <QuickDialog
                        label={k("answer")}
                        title={t("supplierRequests.table.answerTitle", {
                          n: r.number,
                        })}
                        closeLabel={k("close")}
                        tone="primary"
                        data-supplier-table-answer-open={r.id}
                      >
                        <form
                          action={answerSupplierRequestAction}
                          className="space-y-2"
                          data-supplier-table-answer-form
                        >
                          <input type="hidden" name="id" value={r.id} />
                          {/* Mantém o que já foi respondido e não aparece aqui. */}
                          <input
                            type="hidden"
                            name="moq"
                            value={raw(r.supplierMoq)}
                          />
                          <input
                            type="hidden"
                            name="leadTimeDays"
                            value={raw(r.supplierLeadTimeDays)}
                          />
                          <p className="text-xs text-zinc-500">
                            {k("answerHint")}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Field
                              label={t("supplierRequests.detail.answer.price")}
                            >
                              <Input
                                name="price"
                                inputMode="decimal"
                                defaultValue={raw(r.supplierPrice)}
                                data-supplier-table-answer-price
                              />
                            </Field>
                            <Field
                              label={t(
                                "supplierRequests.detail.answer.currency",
                              )}
                            >
                              <Select
                                name="currency"
                                defaultValue={
                                  r.supplierCurrency ?? it.currency ?? "USD"
                                }
                              >
                                {SHEET_CURRENCIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                          </div>
                          <Field
                            label={t("supplierRequests.detail.answer.note")}
                          >
                            <Textarea
                              name="note"
                              rows={2}
                              maxLength={4000}
                              defaultValue={r.supplierNote ?? ""}
                            />
                          </Field>
                          <div className="flex flex-wrap gap-2">
                            <SubmitButton
                              name="canDo"
                              value="yes"
                              pendingText={k("sending")}
                              data-supplier-table-answer="yes"
                            >
                              {k("yes")}
                            </SubmitButton>
                            <SubmitButton
                              name="canDo"
                              value="no"
                              variant="danger"
                              pendingText={k("sending")}
                              data-supplier-table-answer="no"
                            >
                              {k("no")}
                            </SubmitButton>
                          </div>
                        </form>
                      </QuickDialog>
                    ) : null}
                    <LinkButton
                      href={href}
                      className="px-2.5 py-1 text-xs"
                      data-supplier-table-open={r.id}
                    >
                      {k("open")}
                    </LinkButton>
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
