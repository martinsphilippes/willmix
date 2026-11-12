import type { SupplierRequest } from "@/lib/db/schema";
import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  answerTimes,
  canPostMessage,
  finalConditions,
  initialConditions,
  type ConditionsState,
  type RequestConditions,
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
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { QuickDialog } from "@/components/quick-dialog";
import {
  answerSupplierRequestAction,
  postSupplierRequestMessageAction,
} from "../../actions/supplier-requests";
import { STATUS_TONE } from "./status";
import { dateTime } from "./negotiation";
import { AnswerIcon, ChatBubbleIcon, OpenIcon } from "./icons";

/*
 * O que se vê primeiro ao abrir uma solicitação (docs/SUPPLIER_REQUESTS.md,
 * "Tabela da solicitação"): os produtos pedidos ao mesmo fornecedor no mesmo
 * booking, uma informação por coluna, e três ações rápidas por linha
 * (mensagem, resposta sim/não e abrir a tela do produto), só com ícones.
 * O fornecedor responde (só ele; a Wellmix não responde por ele).
 */

const STATE_TONE: Record<ConditionsState, Tone> = {
  answer: "info",
  pending: "warning",
  accepted: "success",
  rejected: "danger",
  counter: "info",
};

export function SupplierRequestTable({
  rows,
  currentId,
  slaMinutes,
  wellmix,
  legacy,
  t,
}: {
  rows: SupplierRequest[];
  currentId: string;
  slaMinutes: number;
  wellmix: boolean;
  /** Respostas antigas (auditoria), para a 1ª e a última resposta. */
  legacy: Map<string, Array<{ at: string }>>;
  t: Translate;
}) {
  const intl = t.intl;
  const num = (n: number | null | undefined, digits = 4) =>
    n === null || n === undefined
      ? "—"
      : n.toLocaleString(intl, { maximumFractionDigits: digits });
  const decimal = intl.startsWith("pt") ? "," : ".";
  const raw = (n: number | null) =>
    n === null ? "" : String(n).replace(".", decimal);
  const k = (key: string) =>
    t(`supplierRequests.table.${key}` as DictionaryKey);
  const before = [
    "photo",
    "number",
    "item",
    "factoryCode",
    "itemNumber",
    "material",
    "quantity",
    "bookingMoq",
    "bookingPrice",
    "bookingCurrency",
    "bookingIncoterm",
    "needs",
    "canDo",
  ];
  // Condições iniciais (primeira resposta) e finais (as que valem hoje).
  const conditionCols = ["price", "currency", "moq", "incoterm", "leadTime"];
  const after = [
    "status",
    "sla",
    "turn",
    "openedAt",
    "firstAnswerAt",
    "lastAnswerAt",
  ];
  const nowrap = "whitespace-nowrap";

  /**
   * As colunas de condições de uma linha: as iniciais (do booking) e as
   * finais (a última proposta enviada, com a situação dela).
   */
  const conditionCells = (
    c: (RequestConditions & { state?: ConditionsState }) | null,
    group: "initial" | "final",
    id: string,
  ) => {
    const final = group === "final";
    const cells = [
      <Td
        key={`${group}-price`}
        className={cx(nowrap, "border-l border-zinc-100 tabular-nums")}
        data-supplier-table-answer-price={final ? id : undefined}
        data-supplier-table-initial-price={final ? undefined : id}
      >
        {c ? num(c.price) : "—"}
      </Td>,
      <Td key={`${group}-currency`} className={nowrap}>
        {c?.currency ?? "—"}
      </Td>,
      <Td key={`${group}-moq`} className={cx(nowrap, "tabular-nums")}>
        {c ? num(c.moq, 0) : "—"}
      </Td>,
      <Td
        key={`${group}-incoterm`}
        className={nowrap}
        data-supplier-table-incoterm={final ? id : undefined}
      >
        {c?.incoterm ?? "—"}
      </Td>,
      <Td key={`${group}-lead`} className={cx(nowrap, "tabular-nums")}>
        {c ? num(c.leadTimeDays, 0) : "—"}
      </Td>,
    ];
    if (final)
      cells.push(
        <Td
          key="final-state"
          className={nowrap}
          data-supplier-table-final-state={c?.state ? id : undefined}
        >
          {c?.state ? (
            <Badge tone={STATE_TONE[c.state]}>{k(`state.${c.state}`)}</Badge>
          ) : (
            "—"
          )}
        </Td>,
      );
    return cells;
  };

  return (
    <Card title={k("title")}>
      <p className="mb-3 text-xs text-zinc-500">
        {k(wellmix ? "hintWellmix" : "hint")}
      </p>
      <Table>
        <thead>
          <tr>
            {before.map((c) => (
              <Th key={c} className={nowrap} rowSpan={2}>
                {k(`col.${c}`)}
              </Th>
            ))}
            <Th
              className="border-l border-zinc-200 text-center"
              colSpan={conditionCols.length}
            >
              {k("col.initial")}
            </Th>
            <Th
              className="border-l border-zinc-200 text-center"
              colSpan={conditionCols.length + 1}
            >
              {k("col.final")}
            </Th>
            {after.map((c) => (
              <Th key={c} className={nowrap} rowSpan={2}>
                {k(`col.${c}`)}
              </Th>
            ))}
            <Th
              className="sticky right-0 z-10 bg-zinc-50 text-right shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]"
              rowSpan={2}
            >
              {k("col.actions")}
            </Th>
          </tr>
          <tr>
            {["initial", "final"].flatMap((g) =>
              conditionCols.map((c, i) => (
                <Th
                  key={`${g}-${c}`}
                  className={cx(nowrap, i === 0 && "border-l border-zinc-200")}
                >
                  {k(`col.cond.${c}`)}
                </Th>
              )),
            )}
            <Th className={nowrap}>{k("col.cond.state")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => {
            const it = r.item;
            const name = it.description ?? it.productName ?? "—";
            // Na solicitação com vários produtos, cada linha é um produto dela
            // (2.1, 2.2…): nenhuma é "esta solicitação".
            const current = r.id === currentId && !r.batchId;
            const pending = !!pendingProposal(r.negotiation);
            // Só o fornecedor responde (a Wellmix não responde por ele).
            const canAnswer =
              !wellmix && supplierCanAnswer(r.status) && !pending;
            const turn = negotiationTurn(r);
            const sla = slaOf(r, slaMinutes);
            const times = answerTimes(
              r,
              (legacy.get(r.id) ?? []).map((a) => a.at),
            );
            const yes = r.supplierCanDo === "yes";
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
                    className="h-12 w-12"
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
                <Td className={cx(nowrap, "tabular-nums font-medium")}>
                  {r.batchId && rows.length > 1
                    ? `${r.number}.${index + 1}`
                    : r.number}
                  {current ? (
                    <span className="mt-1 block">
                      <Badge tone="info">{k("current")}</Badge>
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <span className="block min-w-48 max-w-72 whitespace-normal font-medium text-zinc-900">
                    {name}
                  </span>
                </Td>
                <Td className={nowrap}>{it.factoryItemCode ?? "—"}</Td>
                <Td className={nowrap}>{it.itemNumber ?? "—"}</Td>
                <Td className={nowrap}>{it.material ?? "—"}</Td>
                <Td className={cx(nowrap, "tabular-nums")}>
                  {r.quantity.toLocaleString(intl)}
                </Td>
                <Td className={cx(nowrap, "tabular-nums")}>{num(it.moq, 0)}</Td>
                <Td className={cx(nowrap, "tabular-nums")}>{num(it.price)}</Td>
                <Td className={nowrap}>{it.currency ?? "—"}</Td>
                <Td className={nowrap}>{it.incoterm ?? "—"}</Td>
                <Td>
                  <span
                    className="block max-w-56 truncate text-xs text-zinc-600"
                    title={r.needs ?? undefined}
                  >
                    {r.needs ?? "—"}
                  </span>
                </Td>
                <Td className={nowrap}>
                  <span data-supplier-table-answer-text={r.id}>
                    {r.supplierCanDo ? (
                      <Badge tone={yes ? "success" : "danger"}>
                        {k(yes ? "canDoYes" : "canDoNo")}
                      </Badge>
                    ) : (
                      <span className="text-zinc-500">{k("canDoWaiting")}</span>
                    )}
                  </span>
                </Td>
                {conditionCells(initialConditions(r), "initial", r.id)}
                {conditionCells(finalConditions(r), "final", r.id)}
                <Td className={nowrap}>
                  <Badge tone={STATUS_TONE[r.status]}>
                    {t(`supplierRequests.status.${r.status}` as DictionaryKey)}
                  </Badge>
                </Td>
                <Td className={cx(nowrap, "text-xs")}>
                  {sla ? (
                    <span
                      className={sla.late ? "font-semibold text-red-700" : ""}
                      data-supplier-request-sla={sla.late ? "late" : "ok"}
                    >
                      {sla.late ? `${k("late")} · ` : ""}
                      {dateTime(sla.dueAt, t)}
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="text-xs">
                  {turn
                    ? t(
                        `supplierRequests.negotiation.turn.${turn}` as DictionaryKey,
                      )
                    : "—"}
                  {pending ? (
                    <span
                      className="mt-0.5 block max-w-40 text-amber-800"
                      data-supplier-table-pending
                    >
                      {k(
                        wellmix ? "proposalPendingWellmix" : "proposalPending",
                      )}
                    </span>
                  ) : null}
                </Td>
                <Td className={cx(nowrap, "text-xs tabular-nums")}>
                  {dateTime(r.createdAt, t)}
                </Td>
                <Td className={cx(nowrap, "text-xs tabular-nums")}>
                  {dateTime(times.first, t)}
                </Td>
                <Td className={cx(nowrap, "text-xs tabular-nums")}>
                  {dateTime(times.last, t)}
                </Td>
                <Td
                  className={cx(
                    "sticky right-0 z-10 bg-white shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]",
                    current && "bg-brand-50",
                  )}
                >
                  <span className="flex justify-end gap-1">
                    {canPostMessage(r.status) ? (
                      <QuickDialog
                        label={<ChatBubbleIcon />}
                        hint={k("message")}
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
                          <input type="hidden" name="view" value="table" />
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
                        label={<AnswerIcon />}
                        hint={k("answer")}
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
                          <input type="hidden" name="view" value="table" />
                          {/* Mantém o prazo já respondido (muda na tela do produto). */}
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
                                data-supplier-table-answer-price-input
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
                            <Field
                              label={t("supplierRequests.detail.answer.moq")}
                            >
                              <Input
                                name="moq"
                                inputMode="numeric"
                                defaultValue={raw(r.supplierMoq)}
                                data-supplier-table-answer-moq
                              />
                            </Field>
                            <Field
                              label={t(
                                "supplierRequests.detail.answer.incoterm",
                              )}
                            >
                              <Select
                                name="incoterm"
                                defaultValue={
                                  r.supplierIncoterm ?? it.incoterm ?? "FOB"
                                }
                                data-supplier-table-answer-incoterm
                              >
                                {SHEET_INCOTERMS.map((c) => (
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
                      className="px-2.5 py-1"
                      title={k("open")}
                      aria-label={k("open")}
                      data-supplier-table-open={r.id}
                    >
                      <OpenIcon />
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
