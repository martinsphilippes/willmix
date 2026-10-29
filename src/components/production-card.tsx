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
  Textarea,
  formatDate,
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
}: {
  t: Translate;
  user: User;
  order: Order;
  view: ProductionView;
  wellmix: boolean;
  notice: string | null;
  names: Map<string, string>;
}) {
  const track = view.track;
  const hidden = <input type="hidden" name="orderId" value={order.id} />;
  const name = (id: string | null) => (id ? (names.get(id) ?? "—") : "—");
  const delayDays =
    track?.etd && track.etdOriginal
      ? Math.round(
          (Date.parse(track.etd) - Date.parse(track.etdOriginal)) / 86_400_000,
        )
      : 0;

  return (
    <Card title={t("production.title")}>
      <span id="production" className="block scroll-mt-24" />
      <div className="space-y-4" data-production-card>
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {/* Fábrica ou trade, início e ETD. */}
        <form action={saveProductionPlanAction} className="space-y-2.5">
          {hidden}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("production.mode")}>
              <Select name="mode" defaultValue={track?.mode ?? ""}>
                <option value="">{t("common.select")}</option>
                <option value="factory">{t("production.mode.factory")}</option>
                <option value="trade">{t("production.mode.trade")}</option>
              </Select>
            </Field>
            <Field label={t("production.start")}>
              <Input
                type="date"
                name="productionStartAt"
                defaultValue={dateValue(track?.productionStartAt)}
              />
            </Field>
            <Field
              label={t("production.etd")}
              hint={
                track?.etdOriginal && delayDays !== 0
                  ? t("production.etdShift", {
                      original: formatDate(track.etdOriginal, t),
                      days: String(delayDays),
                    })
                  : undefined
              }
            >
              <Input
                type="date"
                name="etd"
                defaultValue={dateValue(track?.etd)}
                data-production-etd
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t("production.factoryName")}
              hint={t("production.factoryHint")}
            >
              <Input
                name="factoryName"
                maxLength={160}
                defaultValue={track?.factoryName ?? ""}
              />
            </Field>
            <Field label={t("production.factoryAddress")}>
              <Input
                name="factoryAddress"
                maxLength={1000}
                defaultValue={track?.factoryAddress ?? ""}
              />
            </Field>
          </div>
          {track?.etd ? (
            <Field label={t("production.etdReason")}>
              <Input name="etdReason" maxLength={1000} />
            </Field>
          ) : null}
          <SubmitButton variant="secondary" data-production-save>
            {t("production.save")}
          </SubmitButton>
        </form>

        {track?.etdHistory?.length ? (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-zinc-700">
              {t("production.etdHistory")} ({track.etdHistory.length})
            </summary>
            <ul className="mt-1 space-y-1 text-sm text-zinc-600">
              {track.etdHistory.map((h, i) => (
                <li key={i}>
                  {formatDate(h.from, t)} → {formatDate(h.to, t)} ·{" "}
                  {name(h.byUserId)} · {formatDate(h.at, t)}
                  {h.reason ? ` · ${h.reason}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {/* Follow 5/15/25 dias (Wellmix registra). */}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-zinc-800">
            {t("production.followups")}
          </h3>
          {!track?.productionStartAt ? (
            <p className="text-sm text-zinc-500">
              {t("production.followups.noStart")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {FOLLOWUP_DAYS.map((d) => {
                const done = track.followups?.find((f) => f.day === d);
                const due = view.due.some((x) => x.day === d);
                return (
                  <li key={d} data-followup-day={d}>
                    <span className="font-medium">
                      {t("production.followups.day", { day: String(d) })}
                    </span>{" "}
                    {done ? (
                      <Badge
                        tone={done.status === "delayed" ? "danger" : "success"}
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
                    {done ? (
                      <span className="text-zinc-600">
                        {" "}
                        · {name(done.byUserId)} · {formatDate(done.at, t)}
                        {done.note ? ` · ${done.note}` : ""}
                      </span>
                    ) : null}
                    {!done && due && wellmix ? (
                      <form
                        action={recordFollowupAction}
                        className="mt-1 flex flex-wrap items-end gap-2"
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
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Inspeção agendada. */}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-zinc-800">
            {t("production.inspection")}
          </h3>
          {track?.inspectionScheduledAt ? (
            <p className="text-sm" data-inspection-scheduled>
              {t("production.inspection.scheduled", {
                date: formatDate(track.inspectionScheduledAt, t),
              })}
              {track.inspectionNote ? ` · ${track.inspectionNote}` : ""}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">
              {t("production.inspection.none")}
            </p>
          )}
          {wellmix ? (
            <form
              action={scheduleInspectionAction}
              className="mt-1 flex flex-wrap items-end gap-2"
            >
              {hidden}
              <Input
                type="date"
                name="inspectionAt"
                required
                defaultValue={dateValue(track?.inspectionScheduledAt)}
              />
              <Input
                name="inspectionNote"
                maxLength={1000}
                placeholder={t("production.inspection.note")}
              />
              <SubmitButton
                variant="secondary"
                className="px-2.5 py-1 text-xs"
                data-inspection-schedule
              >
                {t("production.inspection.schedule")}
              </SubmitButton>
            </form>
          ) : null}
        </div>

        {/* Inspeção por SKU. */}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-zinc-800">
            {t("production.sku")}
            {view.allApproved ? (
              <span className="ml-2">
                <Badge tone="success">{t("production.sku.allApproved")}</Badge>
              </span>
            ) : null}
          </h3>
          <ul className="space-y-3">
            {view.items.map(({ item, latest, rounds }) => (
              <li
                key={item.id}
                className="rounded-lg border border-zinc-200 p-2.5 text-sm"
                data-sku-item={item.id}
                data-sku-status={latest?.result ?? "pending"}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  {item.variant?.name ? (
                    <span className="text-zinc-500">{item.variant.name}</span>
                  ) : null}
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
                    <span className="text-zinc-500">
                      {t("production.sku.rounds", { n: String(rounds) })}
                    </span>
                  ) : null}
                </div>
                {latest?.note ? (
                  <p className="mt-1 text-zinc-700">{latest.note}</p>
                ) : null}
                {latest?.supplierAction ? (
                  <p className="mt-1 text-zinc-600">
                    {t("production.sku.fixedBy", {
                      action: latest.supplierAction,
                      date: formatDate(latest.supplierRespondedAt, t),
                    })}
                  </p>
                ) : null}
                {/* Fornecedor: diz o que corrigiu. */}
                {latest?.result === "rejected" &&
                !latest.supplierRespondedAt &&
                !wellmix ? (
                  <form action={respondSkuAction} className="mt-2 space-y-2">
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
                {latest?.result === "rejected" &&
                !latest.supplierRespondedAt &&
                wellmix ? (
                  <p className="mt-1 text-amber-700">
                    {t("production.sku.waitingSupplier")}
                  </p>
                ) : null}
                {/* Wellmix: resultado da (nova) inspeção. */}
                {wellmix &&
                latest?.result !== "approved" &&
                (!latest || latest.supplierRespondedAt) ? (
                  <form
                    action={inspectSkuAction}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    {hidden}
                    <input type="hidden" name="orderItemId" value={item.id} />
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
              </li>
            ))}
          </ul>
        </div>
        {!wellmix && user.role === "supplier" ? (
          <p className="text-xs text-zinc-500">
            {t("production.supplierHint")}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
