import type { Order } from "@/lib/db";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { RECEIVING_CHECKS } from "@/lib/db/schema";
import type { ReceivingView } from "@/lib/services/receiving";
import {
  closeReceivingAction,
  saveCountsAction,
  saveReturnAction,
  saveRicAction,
  saveUnloadingAction,
} from "@/app/app/actions/receiving";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  Select,
  formatDate,
  formatMoney,
} from "./ui";
import { SubmitButton } from "./submit-button";
import type { getT } from "@/i18n/server";

/*
 * Recebimento no armazém (Fase E, só a Wellmix): lacre e fotos, checklist,
 * contagem por SKU com divergência, RIC, devolução do container e
 * encerramento com o resumo financeiro (adiantado × devido).
 */

type Translate = Awaited<ReturnType<typeof getT>>;

const fileClass =
  "block w-full text-sm text-zinc-700 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm";

export function ReceivingCard({
  t,
  order,
  view,
  notice,
}: {
  t: Translate;
  order: Order;
  view: ReceivingView;
  notice: string | null;
}) {
  const row = view.row;
  const closed = !!row?.closedAt;
  const hidden = <input type="hidden" name="orderId" value={order.id} />;
  const money = (n: number | null, c: string | null) =>
    formatMoney(n, c ?? "BRL", t);
  const section = "border-t border-zinc-100 pt-3";
  const title = "mb-1.5 text-sm font-semibold text-zinc-800";

  return (
    <Card
      title={t("receiving.title")}
      actions={
        closed ? (
          <Badge tone="success">{t("receiving.closedBadge")}</Badge>
        ) : view.divergences ? (
          <Badge tone="danger">
            {t("receiving.divergences", { n: String(view.divergences) })}
          </Badge>
        ) : null
      }
    >
      <span id="receiving" className="block scroll-mt-24" />
      <div className="space-y-3" data-receiving-card>
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {/* Lacre, fotos e checklist. */}
        <form action={saveUnloadingAction} className="space-y-2.5">
          {hidden}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("receiving.sealNumber")}>
              <Input
                name="sealNumber"
                maxLength={60}
                defaultValue={row?.sealNumber ?? ""}
                disabled={closed}
              />
            </Field>
            <Field label={t("receiving.sealIntact")}>
              <Select
                name="sealIntact"
                defaultValue={row?.sealIntact ?? ""}
                disabled={closed}
              >
                <option value="">{t("common.select")}</option>
                <option value="yes">{t("receiving.seal.yes")}</option>
                <option value="no">{t("receiving.seal.no")}</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t("receiving.sealPhoto")}
              hint={row?.sealPhotoDocumentId ? t("receiving.sent") : undefined}
            >
              <input
                type="file"
                name="sealPhoto"
                accept="image/*"
                className={fileClass}
                disabled={closed}
              />
            </Field>
            <Field
              label={t("receiving.containerPhotos")}
              hint={
                row?.containerPhotoDocumentIds?.length
                  ? t("receiving.photosSent", {
                      n: String(row.containerPhotoDocumentIds.length),
                    })
                  : undefined
              }
            >
              <input
                type="file"
                name="containerPhotos"
                accept="image/*"
                multiple
                className={fileClass}
                disabled={closed}
              />
            </Field>
          </div>
          <fieldset className="grid gap-1.5 sm:grid-cols-2">
            {RECEIVING_CHECKS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="checklist"
                  value={c}
                  defaultChecked={row?.checklist?.includes(c)}
                  disabled={closed}
                />
                {t(`receiving.check.${c}`)}
              </label>
            ))}
          </fieldset>
          {!closed ? (
            <SubmitButton variant="secondary" data-receiving-unloading>
              {t("receiving.saveUnloading")}
            </SubmitButton>
          ) : null}
        </form>

        {/* Contagem por SKU. */}
        <form action={saveCountsAction} className={`${section} space-y-2`}>
          {hidden}
          <h3 className={title}>{t("receiving.counts")}</h3>
          {view.items.map((item) => {
            const c = row?.items?.find((x) => x.orderItemId === item.id);
            const diverges =
              !!c && (c.received !== c.expected || c.damaged > 0);
            return (
              <div
                key={item.id}
                className={`rounded-lg border p-2 text-sm ${diverges ? "border-red-200 bg-red-50/40" : "border-zinc-200"}`}
                data-receiving-item={item.id}
                data-receiving-divergent={diverges ? "1" : "0"}
              >
                <input type="hidden" name="itemId" value={item.id} />
                <p className="font-medium">
                  {item.name} ·{" "}
                  {t("receiving.expected", {
                    qty: item.quantity.toLocaleString(t.intl),
                    unit: item.unit,
                  })}
                </p>
                <div className="mt-1 grid gap-2 sm:grid-cols-3">
                  <Field label={t("receiving.received")}>
                    <Input
                      name={`received_${item.id}`}
                      inputMode="numeric"
                      defaultValue={c?.received ?? ""}
                      disabled={closed}
                    />
                  </Field>
                  <Field label={t("receiving.damaged")}>
                    <Input
                      name={`damaged_${item.id}`}
                      inputMode="numeric"
                      defaultValue={c?.damaged ?? ""}
                      disabled={closed}
                    />
                  </Field>
                  <Field label={t("receiving.note")}>
                    <Input
                      name={`note_${item.id}`}
                      maxLength={500}
                      defaultValue={c?.note ?? ""}
                      disabled={closed}
                    />
                  </Field>
                </div>
              </div>
            );
          })}
          {!closed ? (
            <SubmitButton variant="secondary" data-receiving-counts>
              {t("receiving.saveCounts")}
            </SubmitButton>
          ) : null}
        </form>

        {/* RIC e devolução do container. */}
        <div className={`${section} grid gap-4 sm:grid-cols-2`}>
          <form action={saveRicAction} className="space-y-2">
            {hidden}
            <h3 className={title}>{t("receiving.ric")}</h3>
            <Input
              name="ricNumber"
              required
              maxLength={60}
              placeholder={t("receiving.ricNumber")}
              defaultValue={row?.ricNumber ?? ""}
              disabled={closed}
            />
            <input
              type="file"
              name="ricFile"
              className={fileClass}
              aria-label={t("receiving.ric")}
              disabled={closed}
            />
            {row?.ricDocumentId ? (
              <a
                href={`/api/files/${row.ricDocumentId}`}
                className="text-sm text-brand-700 underline"
              >
                {t("receiving.file")}
              </a>
            ) : null}
            {!closed ? (
              <SubmitButton variant="secondary" className="px-2.5 py-1 text-xs">
                {t("receiving.saveRic")}
              </SubmitButton>
            ) : null}
          </form>
          <form action={saveReturnAction} className="space-y-2">
            {hidden}
            <h3 className={title}>{t("receiving.return")}</h3>
            <Input
              type="date"
              name="returnedAt"
              required
              defaultValue={row?.containerReturnedAt?.slice(0, 10) ?? ""}
              disabled={closed}
            />
            <input
              type="file"
              name="returnFile"
              className={fileClass}
              aria-label={t("receiving.return")}
              disabled={closed}
            />
            {row?.containerReturnDocumentId ? (
              <a
                href={`/api/files/${row.containerReturnDocumentId}`}
                className="text-sm text-brand-700 underline"
              >
                {t("receiving.file")}
              </a>
            ) : null}
            {!closed ? (
              <SubmitButton variant="secondary" className="px-2.5 py-1 text-xs">
                {t("receiving.saveReturn")}
              </SubmitButton>
            ) : null}
          </form>
        </div>

        {/* Fechamento: adiantado × devido. */}
        <div className={section} data-receiving-closing>
          <h3 className={title}>{t("receiving.closing")}</h3>
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">{t("receiving.customerSide")}</dt>
              <dd>
                {t("receiving.paidOf", {
                  paid: money(
                    view.finance.customerPaid,
                    view.finance.customerCurrency,
                  ),
                  total: money(
                    view.finance.customerTotal,
                    view.finance.customerCurrency,
                  ),
                })}
                {view.finance.customerDue !== null ? (
                  <strong
                    className={
                      view.finance.customerDue > 0
                        ? "ml-1 text-amber-700"
                        : "ml-1 text-emerald-700"
                    }
                  >
                    ·{" "}
                    {t("receiving.due", {
                      due: money(
                        view.finance.customerDue,
                        view.finance.customerCurrency,
                      ),
                    })}
                  </strong>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">{t("receiving.supplierSide")}</dt>
              <dd>
                {t("receiving.paidOf", {
                  paid: money(
                    view.finance.supplierPaid,
                    view.finance.supplierCurrency,
                  ),
                  total: money(
                    view.finance.supplierTotal,
                    view.finance.supplierCurrency,
                  ),
                })}
                {view.finance.supplierDue !== null ? (
                  <strong className="ml-1">
                    ·{" "}
                    {t("receiving.due", {
                      due: money(
                        view.finance.supplierDue,
                        view.finance.supplierCurrency,
                      ),
                    })}
                  </strong>
                ) : null}
              </dd>
            </div>
          </dl>
          {closed ? (
            <p className="mt-2 text-sm text-emerald-700">
              {t("receiving.closedAt", { date: formatDate(row!.closedAt, t) })}
              {row?.closingNote ? ` · ${row.closingNote}` : ""}
            </p>
          ) : (
            <form action={closeReceivingAction} className="mt-2 space-y-2">
              {hidden}
              {view.missing.length ? (
                <p className="text-sm text-amber-700" data-receiving-missing>
                  {t("receiving.missing", {
                    list: view.missing
                      .map((m) => t(`receiving.missing.${m}` as DictionaryKey))
                      .join(", "),
                  })}
                </p>
              ) : null}
              <Input
                name="closingNote"
                maxLength={1000}
                placeholder={t("receiving.closingNote")}
              />
              <SubmitButton
                disabled={view.missing.length > 0}
                data-receiving-close
              >
                {t("receiving.close")}
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}
