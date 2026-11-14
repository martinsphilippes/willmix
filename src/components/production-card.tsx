import { productNameText } from "@/i18n";
import type { Order, User } from "@/lib/db";
import { FOLLOWUP_DAYS } from "@/lib/db/schema";
import type { ProductionView } from "@/lib/services/production";
import {
  inspectSkuAction,
  recordFollowupAction,
  respondSkuAction,
  saveProductionPlanAction,
  scheduleInspectionAction,
} from "@/app/app/actions/production";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  formatDate,
  rowClass,
} from "./ui";
import { SubmitButton } from "./submit-button";
import type { getT } from "@/i18n/server";

/*
 * Produção do pedido (Wellmix e o fornecedor do pedido): fábrica ou trade,
 * início e ETD (mudar pede motivo), follow 5/15/25 dias, inspeção agendada e
 * resultado por SKU, com a correção do fornecedor quando reprovado.
 */

type Translate = Awaited<ReturnType<typeof getT>>;

const dateValue = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10) : "";

export function ProductionCard({
  t,
  user,
  order,
  view,
  wellmix,
  notice,
  names,
  sections = ["plan", "followup", "inspection"],
  returnTo,
}: {
  /**
   * Partes do cartão (tela do passo do menu, docs/FLOW_MENU.md): dados e
   * ETD, follow 5/15/25, inspeção (agenda e SKUs). Padrão: todas.
   */
  sections?: ReadonlyArray<"plan" | "followup" | "inspection">;
  /** Tela do passo do menu: a ação volta para ela em vez do pedido. */
  returnTo?: string;
  t: Translate;
  user: User;
  order: Order;
  view: ProductionView;
  wellmix: boolean;
  notice: string | null;
  names: Map<string, string>;
}) {
  const track = view.track;
  const hidden = (
    <>
      <input type="hidden" name="orderId" value={order.id} />
      {returnTo ? (
        <input type="hidden" name="returnTo" value={returnTo} />
      ) : null}
    </>
  );
  const show = (part: "plan" | "followup" | "inspection") =>
    sections.includes(part);
  const name = (id: string | null) => (id ? (names.get(id) ?? "—") : "—");
  const delayDays =
    track?.etd && track.etdOriginal
      ? Math.round(
          (Date.parse(track.etd) - Date.parse(track.etdOriginal)) / 86_400_000,
        )
      : 0;

  // Fornecedor que fabrica: nome e endereço vêm do cadastro (trade: a
  // fábrica é outra empresa, digitada).
  const own = track?.mode === "trade" ? null : view.supplierFactory;
  const planForm = `production-plan-${order.id}`;
  const inspectionForm = `production-inspection-${order.id}`;
  return (
    <Card title={t("production.title")}>
      <span id="production" className="block scroll-mt-24" />
      <div className="space-y-5" data-production-card>
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {show("plan") ? (
          <>
            {/* Fábrica ou trade, início e ETD numa linha (campos ligados ao
            formulário pelo atributo form). */}
            <form id={planForm} action={saveProductionPlanAction}>
              {hidden}
            </form>
            <Table>
              <thead>
                <tr>
                  <Th>{t("production.mode")}</Th>
                  <Th>{t("production.start")}</Th>
                  <Th>{t("production.etd")}</Th>
                  <Th>{t("production.factoryName")}</Th>
                  <Th>{t("production.factoryAddress")}</Th>
                  {track?.etd ? <Th>{t("production.etdReason")}</Th> : null}
                  <Th />
                </tr>
              </thead>
              <tbody>
                <tr data-production-plan>
                  <Td className="min-w-36">
                    <Select
                      form={planForm}
                      name="mode"
                      defaultValue={track?.mode ?? ""}
                      aria-label={t("production.mode")}
                    >
                      <option value="">{t("common.select")}</option>
                      <option value="factory">
                        {t("production.mode.factory")}
                      </option>
                      <option value="trade">
                        {t("production.mode.trade")}
                      </option>
                    </Select>
                  </Td>
                  <Td className="min-w-36">
                    <Input
                      form={planForm}
                      type="date"
                      name="productionStartAt"
                      defaultValue={dateValue(track?.productionStartAt)}
                      aria-label={t("production.start")}
                      disabled={!!view.startAuto}
                      data-production-start={view.startAuto ? "auto" : "manual"}
                    />
                    {view.startAuto ? (
                      <span className="mt-1 block text-xs text-zinc-500">
                        {t(
                          view.startAuto.signed
                            ? "sheet.productionStart.auto"
                            : "sheet.productionStart.waiting",
                          { days: String(view.startAuto.days) },
                        )}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="min-w-36">
                    <Input
                      form={planForm}
                      type="date"
                      name="etd"
                      defaultValue={dateValue(track?.etd)}
                      aria-label={t("production.etd")}
                      data-production-etd
                    />
                    {track?.etdOriginal && delayDays !== 0 ? (
                      <span className="mt-0.5 block text-xs text-amber-700">
                        {t("production.etdShift", {
                          original: formatDate(track.etdOriginal, t),
                          days: String(delayDays),
                        })}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="min-w-44">
                    <Input
                      form={planForm}
                      name="factoryName"
                      maxLength={160}
                      defaultValue={track?.factoryName ?? own?.name ?? ""}
                      aria-label={t("production.factoryName")}
                      title={t("production.factoryHint")}
                      data-production-factory
                    />
                    {own?.name && !track?.factoryName ? (
                      <span className="mt-1 block text-xs text-zinc-500">
                        {t("production.factoryAuto")}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="min-w-52">
                    <Input
                      form={planForm}
                      name="factoryAddress"
                      maxLength={1000}
                      defaultValue={track?.factoryAddress ?? own?.address ?? ""}
                      aria-label={t("production.factoryAddress")}
                    />
                  </Td>
                  {track?.etd ? (
                    <Td className="min-w-44">
                      <Input
                        form={planForm}
                        name="etdReason"
                        maxLength={1000}
                        aria-label={t("production.etdReason")}
                      />
                    </Td>
                  ) : null}
                  <Td className="text-right">
                    <SubmitButton
                      form={planForm}
                      variant="secondary"
                      data-production-save
                    >
                      {t("production.save")}
                    </SubmitButton>
                  </Td>
                </tr>
              </tbody>
            </Table>
            <p className="-mt-3 text-xs text-zinc-500">
              {t("production.factoryHint")}
            </p>

            {track?.etdHistory?.length ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-zinc-700">
                  {t("production.etdHistory")} ({track.etdHistory.length})
                </summary>
                <div className="mt-2">
                  <Table>
                    <thead>
                      <tr>
                        <Th>{t("production.col.from")}</Th>
                        <Th>{t("production.col.to")}</Th>
                        <Th>{t("production.col.by")}</Th>
                        <Th>{t("production.col.at")}</Th>
                        <Th>{t("production.col.reason")}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {track.etdHistory.map((h, i) => (
                        <tr key={i} className={rowClass}>
                          <Td className="whitespace-nowrap tabular-nums">
                            {formatDate(h.from, t)}
                          </Td>
                          <Td className="whitespace-nowrap tabular-nums">
                            {formatDate(h.to, t)}
                          </Td>
                          <Td className="whitespace-nowrap">
                            {name(h.byUserId)}
                          </Td>
                          <Td className="whitespace-nowrap tabular-nums">
                            {formatDate(h.at, t)}
                          </Td>
                          <Td>{h.reason ?? "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </details>
            ) : null}
          </>
        ) : null}
        {show("followup") ? (
          <>
            {/* Follow 5/15/25 dias (Wellmix registra): um por linha. */}
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-zinc-800">
                {t("production.followups")}
              </h3>
              {!track?.productionStartAt ? (
                <p className="text-sm text-zinc-500">
                  {t(
                    view.startAuto
                      ? "production.followups.noStart.auto"
                      : "production.followups.noStart",
                  )}
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>{t("production.col.followup")}</Th>
                      <Th>{t("production.col.status")}</Th>
                      <Th>{t("production.col.by")}</Th>
                      <Th>{t("production.col.note")}</Th>
                      {wellmix ? <Th>{t("production.col.record")}</Th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {FOLLOWUP_DAYS.map((d) => {
                      const done = track.followups?.find((f) => f.day === d);
                      const due = view.due.some((x) => x.day === d);
                      return (
                        <tr key={d} className={rowClass} data-followup-day={d}>
                          <Td className="whitespace-nowrap font-medium">
                            {t("production.followups.day", { day: String(d) })}
                          </Td>
                          <Td className="whitespace-nowrap">
                            {done ? (
                              <Badge
                                tone={
                                  done.status === "delayed"
                                    ? "danger"
                                    : "success"
                                }
                              >
                                {t(
                                  done.status === "delayed"
                                    ? "production.followups.delayed"
                                    : "production.followups.onTrack",
                                )}
                              </Badge>
                            ) : due ? (
                              <Badge tone="warning">
                                {t("production.followups.due")}
                              </Badge>
                            ) : (
                              <span className="text-zinc-500">
                                {t("production.followups.later")}
                              </span>
                            )}
                          </Td>
                          <Td className="whitespace-nowrap text-zinc-600">
                            {done
                              ? `${name(done.byUserId)} · ${formatDate(done.at, t)}`
                              : "—"}
                          </Td>
                          <Td className="text-zinc-600">{done?.note ?? "—"}</Td>
                          {wellmix ? (
                            <Td className="min-w-72">
                              {!done && due ? (
                                <form
                                  action={recordFollowupAction}
                                  className="flex flex-wrap items-end gap-2"
                                >
                                  {hidden}
                                  <input type="hidden" name="day" value={d} />
                                  <Select name="status" defaultValue="on_track">
                                    <option value="on_track">
                                      {t("production.followups.onTrack")}
                                    </option>
                                    <option value="delayed">
                                      {t("production.followups.delayed")}
                                    </option>
                                  </Select>
                                  <Input
                                    name="note"
                                    maxLength={1000}
                                    placeholder={t("production.followups.note")}
                                  />
                                  <SubmitButton
                                    variant="secondary"
                                    className="px-2.5 py-1 text-xs"
                                    data-followup-save
                                  >
                                    {t("production.followups.save")}
                                  </SubmitButton>
                                </form>
                              ) : (
                                "—"
                              )}
                            </Td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </div>
          </>
        ) : null}
        {show("inspection") ? (
          <>
            {/* Inspeção agendada: uma linha (data e observação; a Wellmix agenda). */}
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-zinc-800">
                {t("production.inspection")}
              </h3>
              {wellmix ? (
                <form id={inspectionForm} action={scheduleInspectionAction}>
                  {hidden}
                </form>
              ) : null}
              <Table>
                <thead>
                  <tr>
                    <Th>{t("production.col.scheduled")}</Th>
                    <Th>{t("production.col.note")}</Th>
                    {wellmix ? <Th /> : null}
                  </tr>
                </thead>
                <tbody>
                  <tr
                    data-inspection-scheduled={
                      track?.inspectionScheduledAt ? "1" : "0"
                    }
                  >
                    <Td className="min-w-40">
                      {wellmix ? (
                        <Input
                          form={inspectionForm}
                          type="date"
                          name="inspectionAt"
                          required
                          defaultValue={dateValue(track?.inspectionScheduledAt)}
                          aria-label={t("production.col.scheduled")}
                        />
                      ) : track?.inspectionScheduledAt ? (
                        t("production.inspection.scheduled", {
                          date: formatDate(track.inspectionScheduledAt, t),
                        })
                      ) : (
                        <span className="text-zinc-500">
                          {t("production.inspection.none")}
                        </span>
                      )}
                    </Td>
                    <Td className="min-w-56">
                      {wellmix ? (
                        <Input
                          form={inspectionForm}
                          name="inspectionNote"
                          maxLength={1000}
                          defaultValue={track?.inspectionNote ?? ""}
                          placeholder={t("production.inspection.note")}
                          aria-label={t("production.inspection.note")}
                        />
                      ) : (
                        (track?.inspectionNote ?? "—")
                      )}
                    </Td>
                    {wellmix ? (
                      <Td className="text-right">
                        <SubmitButton
                          form={inspectionForm}
                          variant="secondary"
                          className="px-2.5 py-1 text-xs"
                          data-inspection-schedule
                        >
                          {t("production.inspection.schedule")}
                        </SubmitButton>
                      </Td>
                    ) : null}
                  </tr>
                </tbody>
              </Table>
              {wellmix && track?.inspectionScheduledAt ? (
                <p className="mt-1 text-xs text-zinc-500">
                  {t("production.inspection.scheduled", {
                    date: formatDate(track.inspectionScheduledAt, t),
                  })}
                </p>
              ) : null}
            </div>

            {/* Inspeção por SKU: um por linha, com a correção do fornecedor. */}
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-zinc-800">
                {t("production.sku")}
                {view.allApproved ? (
                  <span className="ml-2">
                    <Badge tone="success">
                      {t("production.sku.allApproved")}
                    </Badge>
                  </span>
                ) : null}
              </h3>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("production.col.sku")}</Th>
                    <Th>{t("production.col.result")}</Th>
                    <Th>{t("production.col.note")}</Th>
                    <Th>{t("production.col.fix")}</Th>
                    <Th>{t("production.col.action")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {view.items.map(({ item, latest, rounds }) => (
                    <tr
                      key={item.id}
                      className={rowClass}
                      data-sku-item={item.id}
                      data-sku-status={latest?.result ?? "pending"}
                    >
                      <Td className="min-w-40 font-medium">
                        {productNameText(t, item.name)}
                        {item.variant?.name ? (
                          <span className="block text-xs font-normal text-zinc-500">
                            {item.variant.name}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Badge
                          tone={
                            latest?.result === "approved"
                              ? "success"
                              : latest?.result === "rejected"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {t(
                            latest?.result === "approved"
                              ? "production.sku.approved"
                              : latest?.result === "rejected"
                                ? "production.sku.rejected"
                                : "production.sku.pending",
                          )}
                        </Badge>
                        {rounds > 1 ? (
                          <span className="block text-xs text-zinc-500">
                            {t("production.sku.rounds", { n: String(rounds) })}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="min-w-40 text-zinc-700">
                        {latest?.note ?? "—"}
                      </Td>
                      <Td className="min-w-40 text-zinc-600">
                        {latest?.supplierAction ? (
                          t("production.sku.fixedBy", {
                            action: latest.supplierAction,
                            date: formatDate(latest.supplierRespondedAt, t),
                          })
                        ) : latest?.result === "rejected" &&
                          !latest.supplierRespondedAt &&
                          wellmix ? (
                          <span className="text-amber-700">
                            {t("production.sku.waitingSupplier")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="min-w-64">
                        {/* Fornecedor: diz o que corrigiu. */}
                        {latest?.result === "rejected" &&
                        !latest.supplierRespondedAt &&
                        !wellmix ? (
                          <form
                            action={respondSkuAction}
                            className="flex flex-wrap items-end gap-2"
                          >
                            {hidden}
                            <input
                              type="hidden"
                              name="inspectionId"
                              value={latest.id}
                            />
                            <Field label={t("production.sku.action")}>
                              <Textarea
                                name="action"
                                rows={2}
                                required
                                maxLength={1000}
                              />
                            </Field>
                            <SubmitButton
                              className="px-2.5 py-1 text-xs"
                              data-sku-respond
                            >
                              {t("production.sku.respond")}
                            </SubmitButton>
                          </form>
                        ) : null}
                        {/* Wellmix: resultado da (nova) inspeção. */}
                        {wellmix &&
                        latest?.result !== "approved" &&
                        (!latest || latest.supplierRespondedAt) ? (
                          <form
                            action={inspectSkuAction}
                            className="flex flex-wrap items-end gap-2"
                          >
                            {hidden}
                            <input
                              type="hidden"
                              name="orderItemId"
                              value={item.id}
                            />
                            <Input
                              name="note"
                              maxLength={1000}
                              placeholder={t("production.sku.note")}
                            />
                            <SubmitButton
                              name="result"
                              value="approved"
                              className="px-2.5 py-1 text-xs"
                              data-sku-approve
                            >
                              {t("production.sku.approve")}
                            </SubmitButton>
                            <SubmitButton
                              name="result"
                              value="rejected"
                              variant="danger"
                              className="px-2.5 py-1 text-xs"
                              data-sku-reject
                            >
                              {t("production.sku.reject")}
                            </SubmitButton>
                          </form>
                        ) : null}
                        {!(
                          latest?.result === "rejected" &&
                          !latest.supplierRespondedAt &&
                          !wellmix
                        ) &&
                        !(
                          wellmix &&
                          latest?.result !== "approved" &&
                          (!latest || latest.supplierRespondedAt)
                        )
                          ? "—"
                          : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        ) : null}
        {!wellmix && user.role === "supplier" ? (
          <p className="text-xs text-zinc-500">
            {t("production.supplierHint")}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
