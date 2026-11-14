import type { Order } from "@/lib/db";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { RECEIVING_CHECKS } from "@/lib/db/schema";
import type { ReceivingView } from "@/lib/services/receiving";
import {
  closeReceivingAction,
  concludeQualityAction,
  saveCountsAction,
  saveReturnAction,
  saveRicAction,
  saveUnloadingAction,
} from "@/app/app/actions/receiving";
import {
  Alert,
  Badge,
  Card,
  Input,
  Select,
  Table,
  Td,
  Th,
  formatDate,
  formatMoney,
  rowClass,
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
  sections = ["storage", "return"],
  returnTo,
  canQuality = false,
}: {
  t: Translate;
  order: Order;
  view: ReceivingView;
  notice: string | null;
  /**
   * Partes do cartão (tela do passo do menu, docs/FLOW_MENU.md): Armazenagem
   * (descarga e contagem) e Retorno (RIC, devolução e fechamento). Padrão:
   * as duas.
   */
  sections?: ReadonlyArray<"storage" | "return">;
  /** Tela do passo do menu: a ação volta para ela em vez do pedido. */
  returnTo?: string;
  /** Quem vê pode concluir a conferência da qualidade (mapa E19). */
  canQuality?: boolean;
}) {
  const row = view.row;
  const closed = !!row?.closedAt;
  const hidden = (
    <>
      <input type="hidden" name="orderId" value={order.id} />
      {returnTo ? (
        <input type="hidden" name="returnTo" value={returnTo} />
      ) : null}
    </>
  );
  const money = (n: number | null, c: string | null) =>
    formatMoney(n, c ?? "BRL", t);
  const section = "border-t border-zinc-100 pt-3";
  // Formulários da linha (campos nas células, ligados pelo atributo form).
  const unloadForm = `receiving-unloading-${order.id}`;
  const countsForm = `receiving-counts-${order.id}`;
  const ricForm = `receiving-ric-${order.id}`;
  const returnForm = `receiving-return-${order.id}`;
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

        {sections.includes("storage") ? (
          <>
            {/* Descarga numa linha: lacre, fotos e checklist (campos ligados
            ao formulário pelo atributo form). */}
            <form id={unloadForm} action={saveUnloadingAction}>
              {hidden}
            </form>
            <Table>
              <thead>
                <tr>
                  <Th>{t("receiving.sealNumber")}</Th>
                  <Th>{t("receiving.sealIntact")}</Th>
                  <Th>{t("receiving.sealPhoto")}</Th>
                  <Th>{t("receiving.containerPhotos")}</Th>
                  <Th>{t("receiving.col.checklist")}</Th>
                  {!closed ? <Th /> : null}
                </tr>
              </thead>
              <tbody>
                <tr data-receiving-unloading-row>
                  <Td className="min-w-36">
                    <Input
                      form={unloadForm}
                      name="sealNumber"
                      maxLength={60}
                      defaultValue={row?.sealNumber ?? ""}
                      disabled={closed}
                      aria-label={t("receiving.sealNumber")}
                    />
                  </Td>
                  <Td className="min-w-32">
                    <Select
                      form={unloadForm}
                      name="sealIntact"
                      defaultValue={row?.sealIntact ?? ""}
                      disabled={closed}
                      aria-label={t("receiving.sealIntact")}
                    >
                      <option value="">{t("common.select")}</option>
                      <option value="yes">{t("receiving.seal.yes")}</option>
                      <option value="no">{t("receiving.seal.no")}</option>
                    </Select>
                  </Td>
                  <Td className="min-w-48">
                    <input
                      form={unloadForm}
                      type="file"
                      name="sealPhoto"
                      accept="image/*"
                      className={fileClass}
                      disabled={closed}
                      aria-label={t("receiving.sealPhoto")}
                    />
                    {row?.sealPhotoDocumentId ? (
                      <span className="mt-0.5 block text-xs text-emerald-700">
                        {t("receiving.sent")}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="min-w-48">
                    <input
                      form={unloadForm}
                      type="file"
                      name="containerPhotos"
                      accept="image/*"
                      multiple
                      className={fileClass}
                      disabled={closed}
                      aria-label={t("receiving.containerPhotos")}
                    />
                    {row?.containerPhotoDocumentIds?.length ? (
                      <span className="mt-0.5 block text-xs text-emerald-700">
                        {t("receiving.photosSent", {
                          n: String(row.containerPhotoDocumentIds.length),
                        })}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="min-w-56">
                    <fieldset className="grid gap-1">
                      {RECEIVING_CHECKS.map((c) => (
                        <label
                          key={c}
                          className="flex items-center gap-2 text-[13px]"
                        >
                          <input
                            form={unloadForm}
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
                  </Td>
                  {!closed ? (
                    <Td className="text-right">
                      <SubmitButton
                        form={unloadForm}
                        variant="secondary"
                        data-receiving-unloading
                      >
                        {t("receiving.saveUnloading")}
                      </SubmitButton>
                    </Td>
                  ) : null}
                </tr>
              </tbody>
            </Table>

            {/* Contagem por SKU: um por linha (divergência em vermelho). */}
            <div className={section}>
              <h3 className={title}>{t("receiving.counts")}</h3>
              <form id={countsForm} action={saveCountsAction}>
                {hidden}
              </form>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("receiving.col.sku")}</Th>
                    <Th className="text-right">
                      {t("receiving.col.expected")}
                    </Th>
                    <Th>{t("receiving.received")}</Th>
                    <Th>{t("receiving.damaged")}</Th>
                    <Th>{t("receiving.note")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {view.items.map((item) => {
                    const c = row?.items?.find(
                      (x) => x.orderItemId === item.id,
                    );
                    const diverges =
                      !!c && (c.received !== c.expected || c.damaged > 0);
                    return (
                      <tr
                        key={item.id}
                        className={diverges ? "bg-red-50/60" : rowClass}
                        data-receiving-item={item.id}
                        data-receiving-divergent={diverges ? "1" : "0"}
                      >
                        <Td className="min-w-40 font-medium">
                          <input
                            form={countsForm}
                            type="hidden"
                            name="itemId"
                            value={item.id}
                          />
                          {item.name}
                        </Td>
                        <Td className="whitespace-nowrap text-right tabular-nums">
                          {item.quantity.toLocaleString(t.intl)} {item.unit}
                        </Td>
                        <Td className="min-w-28">
                          <Input
                            form={countsForm}
                            name={`received_${item.id}`}
                            inputMode="numeric"
                            defaultValue={c?.received ?? ""}
                            disabled={closed}
                            aria-label={`${t("receiving.received")}: ${item.name}`}
                          />
                        </Td>
                        <Td className="min-w-28">
                          <Input
                            form={countsForm}
                            name={`damaged_${item.id}`}
                            inputMode="numeric"
                            defaultValue={c?.damaged ?? ""}
                            disabled={closed}
                            aria-label={`${t("receiving.damaged")}: ${item.name}`}
                          />
                        </Td>
                        <Td className="min-w-48">
                          <Input
                            form={countsForm}
                            name={`note_${item.id}`}
                            maxLength={500}
                            defaultValue={c?.note ?? ""}
                            disabled={closed}
                            aria-label={`${t("receiving.note")}: ${item.name}`}
                          />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              {!closed ? (
                <div className="mt-2">
                  <SubmitButton
                    form={countsForm}
                    variant="secondary"
                    data-receiving-counts
                  >
                    {t("receiving.saveCounts")}
                  </SubmitButton>
                </div>
              ) : null}
            </div>
            {/* Qualidade no CD (mapa E19, E19?, E22): conclui a conferência. */}
            <div className="mt-4" data-receiving-quality>
              <h3 className="mb-1 text-sm font-semibold text-zinc-900">
                {t("quality.title")}
              </h3>
              {row?.qualityAt ? (
                <p
                  className={
                    row.qualityResult === "divergent"
                      ? "text-sm text-red-700"
                      : "text-sm text-emerald-700"
                  }
                  data-quality-result={row.qualityResult ?? ""}
                >
                  {t(
                    row.qualityResult === "divergent"
                      ? "quality.divergent"
                      : "quality.ok",
                    { date: formatDate(row.qualityAt, t) },
                  )}
                  {row.qualityNote ? ` · ${row.qualityNote}` : ""}
                </p>
              ) : !row?.items.length ? (
                <p className="text-sm text-zinc-500">
                  {t("quality.waitCounts")}
                </p>
              ) : canQuality && !closed ? (
                <form
                  action={concludeQualityAction}
                  className="flex flex-wrap items-end gap-2"
                  data-quality-form
                >
                  {hidden}
                  <p className="w-full text-sm text-zinc-600">
                    {t("quality.hint")}
                  </p>
                  <Input
                    name="qualityNote"
                    maxLength={1000}
                    placeholder={t("quality.note")}
                    className="min-w-0 flex-1"
                  />
                  <SubmitButton data-quality-conclude>
                    {t("quality.conclude")}
                  </SubmitButton>
                </form>
              ) : (
                <p className="text-sm text-zinc-500">{t("quality.hint")}</p>
              )}
            </div>
          </>
        ) : null}
        {sections.includes("return") ? (
          <>
            {/* RIC e devolução do container: uma linha cada. */}
            <div className={section}>
              <form id={ricForm} action={saveRicAction}>
                {hidden}
              </form>
              <form id={returnForm} action={saveReturnAction}>
                {hidden}
              </form>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("receiving.col.document")}</Th>
                    <Th>{t("receiving.col.value")}</Th>
                    <Th>{t("receiving.col.file")}</Th>
                    <Th>{t("receiving.col.sent")}</Th>
                    {!closed ? <Th /> : null}
                  </tr>
                </thead>
                <tbody>
                  <tr className={rowClass} data-receiving-ric>
                    <Td className="whitespace-nowrap font-medium">
                      {t("receiving.ric")}
                    </Td>
                    <Td className="min-w-40">
                      <Input
                        form={ricForm}
                        name="ricNumber"
                        required
                        maxLength={60}
                        placeholder={t("receiving.ricNumber")}
                        defaultValue={row?.ricNumber ?? ""}
                        disabled={closed}
                        aria-label={t("receiving.ricNumber")}
                      />
                    </Td>
                    <Td className="min-w-48">
                      <input
                        form={ricForm}
                        type="file"
                        name="ricFile"
                        className={fileClass}
                        aria-label={t("receiving.ric")}
                        disabled={closed}
                      />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {row?.ricDocumentId ? (
                        <a
                          href={`/api/files/${row.ricDocumentId}`}
                          className="text-sm text-brand-700 underline"
                        >
                          {t("receiving.file")}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                    {!closed ? (
                      <Td className="text-right">
                        <SubmitButton
                          form={ricForm}
                          variant="secondary"
                          className="px-2.5 py-1 text-xs"
                        >
                          {t("receiving.saveRic")}
                        </SubmitButton>
                      </Td>
                    ) : null}
                  </tr>
                  <tr className={rowClass} data-receiving-return>
                    <Td className="whitespace-nowrap font-medium">
                      {t("receiving.return")}
                    </Td>
                    <Td className="min-w-40">
                      <Input
                        form={returnForm}
                        type="date"
                        name="returnedAt"
                        required
                        defaultValue={
                          row?.containerReturnedAt?.slice(0, 10) ?? ""
                        }
                        disabled={closed}
                        aria-label={t("receiving.return")}
                      />
                    </Td>
                    <Td className="min-w-48">
                      <input
                        form={returnForm}
                        type="file"
                        name="returnFile"
                        className={fileClass}
                        aria-label={t("receiving.return")}
                        disabled={closed}
                      />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {row?.containerReturnDocumentId ? (
                        <a
                          href={`/api/files/${row.containerReturnDocumentId}`}
                          className="text-sm text-brand-700 underline"
                        >
                          {t("receiving.file")}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                    {!closed ? (
                      <Td className="text-right">
                        <SubmitButton
                          form={returnForm}
                          variant="secondary"
                          className="px-2.5 py-1 text-xs"
                        >
                          {t("receiving.saveReturn")}
                        </SubmitButton>
                      </Td>
                    ) : null}
                  </tr>
                </tbody>
              </Table>
            </div>

            {/* Fechamento: adiantado × devido, um lado por linha. */}
            <div className={section} data-receiving-closing>
              <h3 className={title}>{t("receiving.closing")}</h3>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("receiving.col.side")}</Th>
                    <Th>{t("receiving.col.paid")}</Th>
                    <Th className="text-right">{t("receiving.col.due")}</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={rowClass}>
                    <Td className="whitespace-nowrap font-medium">
                      {t("receiving.customerSide")}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
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
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      {view.finance.customerDue !== null ? (
                        <strong
                          className={
                            view.finance.customerDue > 0
                              ? "text-amber-700"
                              : "text-emerald-700"
                          }
                        >
                          {t("receiving.due", {
                            due: money(
                              view.finance.customerDue,
                              view.finance.customerCurrency,
                            ),
                          })}
                        </strong>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                  <tr className={rowClass}>
                    <Td className="whitespace-nowrap font-medium">
                      {t("receiving.supplierSide")}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
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
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      {view.finance.supplierDue !== null ? (
                        <strong>
                          {t("receiving.due", {
                            due: money(
                              view.finance.supplierDue,
                              view.finance.supplierCurrency,
                            ),
                          })}
                        </strong>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                </tbody>
              </Table>
              {closed ? (
                <p className="mt-2 text-sm text-emerald-700">
                  {t("receiving.closedAt", {
                    date: formatDate(row!.closedAt, t),
                  })}
                  {row?.closingNote ? ` · ${row.closingNote}` : ""}
                </p>
              ) : (
                <form
                  action={closeReceivingAction}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  {hidden}
                  {view.missing.length ? (
                    <p
                      className="w-full text-sm text-amber-700"
                      data-receiving-missing
                    >
                      {t("receiving.missing", {
                        list: view.missing
                          .map((m) =>
                            t(`receiving.missing.${m}` as DictionaryKey),
                          )
                          .join(", "),
                      })}
                    </p>
                  ) : null}
                  <Input
                    name="closingNote"
                    maxLength={1000}
                    placeholder={t("receiving.closingNote")}
                    className="min-w-0 flex-1"
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
          </>
        ) : null}
      </div>
    </Card>
  );
}
