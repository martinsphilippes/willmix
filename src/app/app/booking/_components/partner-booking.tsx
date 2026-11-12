import Link from "next/link";
import { notFound } from "next/navigation";
import { SHEET_CURRENCIES, type BookingLotStatus, type User } from "@/lib/db";
import type { Translate } from "@/i18n";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  canLaunchBooking,
  getPartnerBookingLot,
  listPartnerBookingLots,
} from "@/lib/services/booking-partner";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SheetFileInput } from "@/components/sheet-file-input";
import { launchBookingAction } from "../../actions/booking-lots";

/*
 * Tela Booking para o login externo (Trading; dono, 11/11/2026): ele lança os
 * bookings da empresa dele (sobe a planilha) e vê só os dela. Sem bookings de
 * outras empresas e sem a análise da Wellmix (regras em
 * src/lib/services/booking-partner.ts).
 */

/** Situação do booking nas palavras de quem lançou (a Wellmix vê as dela). */
const PARTNER_STATUS: Partial<
  Record<BookingLotStatus, { key: DictionaryKey; tone: "info" | "success" }>
> = {
  draft: { key: "bookingLots.partner.status.draft", tone: "info" },
  closed: { key: "bookingLots.partner.status.closed", tone: "success" },
};

const statusOf = (t: Translate, status: BookingLotStatus) => {
  const own = PARTNER_STATUS[status];
  return {
    label: t(own?.key ?? (`bookingLots.status.${status}` as DictionaryKey)),
    tone: own?.tone ?? ("neutral" as const),
  };
};

const num = (t: Translate, n: number | null | undefined, digits = 0) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString(t.intl, { maximumFractionDigits: digits });

export async function PartnerBookingList({
  user,
  t,
}: {
  user: User;
  t: Translate;
}) {
  const [lots, canLaunch] = await Promise.all([
    listPartnerBookingLots(user),
    canLaunchBooking(user),
  ]);
  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingLots.title")}
        subtitle={t("bookingLots.partner.subtitle")}
        actions={
          canLaunch && lots !== null ? (
            <LinkButton
              href="/app/booking/import"
              variant="primary"
              data-partner-booking-launch
            >
              {t("bookingLots.partner.launch")}
            </LinkButton>
          ) : null
        }
      />
      {lots === null ? (
        <div className="mb-3">
          <Alert tone="warning">{t("bookingLots.schemaMissing")}</Alert>
        </div>
      ) : null}
      <Card>
        {lots?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("bookingLots.col.number")}</Th>
                <Th>{t("bookingLots.col.status")}</Th>
                <Th>{t("bookingLots.col.date")}</Th>
                <Th>{t("bookingLots.col.fileName")}</Th>
                <Th className="text-right">{t("bookingLots.col.itemCount")}</Th>
                <Th>{t("bookingLots.col.createdAt")}</Th>
              </tr>
            </thead>
            <tbody data-partner-booking-list>
              {lots.map((lot) => (
                <tr
                  key={lot.id}
                  className={rowClass}
                  data-partner-booking={lot.id}
                >
                  <Td className="whitespace-nowrap font-medium">
                    <Link
                      href={`/app/booking/lots/${lot.id}`}
                      className={linkClass}
                    >
                      {t("bookingLots.partner.lot", { n: lot.number })}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={statusOf(t, lot.status).tone}>
                      {statusOf(t, lot.status).label}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {lot.bookingDate ? formatDate(lot.bookingDate, t) : "—"}
                  </Td>
                  <Td className="min-w-48">{lot.fileName}</Td>
                  <Td className="text-right tabular-nums">
                    {num(t, lot.itemCount)}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {formatDate(lot.createdAt, t)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>
            {t(
              canLaunch
                ? "bookingLots.partner.emptyLaunch"
                : "bookingLots.partner.empty",
            )}
          </Empty>
        )}
      </Card>
    </>
  );
}

/**
 * Lançar booking: o parceiro sobe a planilha dele. Nulo quando o login não
 * pode lançar (a tela é só de consulta): quem chama volta para a lista.
 */
export async function PartnerBookingLaunch({
  user,
  t,
  error,
}: {
  user: User;
  t: Translate;
  /** Código do erro da última tentativa (?error=...). */
  error: string;
}) {
  if (!(await canLaunchBooking(user))) return null;
  const known = [
    `bookingLots.error.${error}`,
    `sheetImport.error.${error}`,
  ].find((k) => k in dictionaries.pt) as DictionaryKey | undefined;
  const errorText = !error ? null : known ? t(known) : fallbackError(t, error);
  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingLots.partner.launch")}
        subtitle={t("bookingLots.partner.launch.subtitle")}
        actions={
          <LinkButton href="/app/booking" variant="secondary">
            {t("bookingLots.partner.back")}
          </LinkButton>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card title={t("bookingLots.import.form")} className="lg:col-span-2">
          <form
            action={launchBookingAction}
            className="space-y-3"
            data-partner-booking-launch-form
          >
            <Field
              label={t("bookingLots.import.file")}
              hint={t("bookingLots.import.fileHint")}
            >
              <SheetFileInput
                label={t("bookingLots.import.file")}
                uploadingLabel={t("sheetImport.uploading")}
                failedLabel={t("sheetImport.uploadFailed")}
                chosenLabel={t("sheetImport.uploaded")}
              />
            </Field>
            <Field
              label={t("bookingLots.import.currency")}
              hint={t("bookingLots.import.currencyHint")}
            >
              <Select name="currency" defaultValue="USD">
                {SHEET_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton
              pendingText={t("bookingLots.import.submitting")}
              data-partner-booking-launch-submit
            >
              {t("bookingLots.partner.launch")}
            </SubmitButton>
          </form>
        </Card>
        <Card title={t("bookingLots.import.columns.title")}>
          <div className="space-y-2 text-sm text-zinc-700">
            <p>{t("bookingLots.import.columns.body")}</p>
            <p className="text-zinc-600">
              {t("bookingLots.import.columns.extra")}
            </p>
            <p className="text-zinc-600">
              {t("bookingLots.partner.launch.after")}
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

export async function PartnerBookingLotView({
  user,
  lotId,
  t,
  created = false,
}: {
  user: User;
  lotId: string;
  t: Translate;
  /** Acabou de ser lançado por ele (?created=1). */
  created?: boolean;
}) {
  const detail = await getPartnerBookingLot(user, lotId);
  // Booking de outra empresa (ou que não existe): não se diz qual dos dois.
  if (!detail) notFound();
  const { lot, items } = detail;
  const col = (k: string) =>
    t(`supplierRequests.selection.col.${k}` as DictionaryKey);
  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingLots.partner.lot", { n: lot.number })}
        subtitle={[
          lot.fileName,
          lot.bookingDate ? formatDate(lot.bookingDate, t) : null,
          statusOf(t, lot.status).label,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <LinkButton href="/app/booking" variant="secondary">
            {t("bookingLots.partner.back")}
          </LinkButton>
        }
      />
      {created ? (
        <div className="mb-3" data-partner-booking-launched>
          <Alert tone="success">{t("bookingLots.partner.launched")}</Alert>
        </div>
      ) : null}
      <Card title={t("bookingLots.partner.items", { n: String(items.length) })}>
        {items.length ? (
          <Table>
            <thead>
              <tr>
                <Th className="w-10 text-right">#</Th>
                <Th>{col("item")}</Th>
                <Th className="text-right">{col("price")}</Th>
                <Th className="text-right">{col("moq")}</Th>
                <Th className="text-right">{col("box")}</Th>
                <Th className="text-right">{col("cbm")}</Th>
                <Th>{col("size")}</Th>
                <Th className="text-right">{col("capacity")}</Th>
                <Th>{col("material")}</Th>
              </tr>
            </thead>
            <tbody data-partner-booking-items>
              {items.map((i, index) => (
                <tr key={i.id} className={rowClass}>
                  <Td className="text-right tabular-nums text-zinc-500">
                    {index + 1}
                  </Td>
                  <Td className="min-w-56">
                    <span className="font-medium text-zinc-900">
                      {i.productName ?? i.description ?? "—"}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {[i.itemNumber, i.factoryItemCode]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {i.price === null
                      ? "—"
                      : [num(t, i.price, 4), i.currency, i.incoterm]
                          .filter(Boolean)
                          .join(" ")}
                  </Td>
                  <Td className="text-right tabular-nums">{num(t, i.moq)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {num(t, i.masterCartonQty)}
                    {i.innerQty ? ` / ${num(t, i.innerQty)}` : ""}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {num(t, i.cbmPerCarton, 4)}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {[i.lengthCm, i.widthCm, i.heightCm].some((n) => n !== null)
                      ? [i.lengthCm, i.widthCm, i.heightCm]
                          .map((n) => num(t, n, 2))
                          .join(" × ")
                      : "—"}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {num(t, i.capacityMl)}
                  </Td>
                  <Td className="min-w-40">
                    {[i.material, i.packageType, i.colorAssortment]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("bookingLots.partner.noItems")}</Empty>
        )}
      </Card>
    </>
  );
}
