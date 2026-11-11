import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import {
  BOOKING_LOT_SORT_KEYS,
  type BookingLotRow,
  type BookingLotSortKey,
} from "@/lib/booking-lots";
import { listBookingLots } from "@/lib/services/booking-lots";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  formatDate,
} from "@/components/ui";
import { BookingLotsTable } from "./_components/booking-lots-table";

/*
 * Booking (docs/BOOKING.md, "Booking por planilha"): os bookings já
 * carregados (planilhas de fornecedor), com busca e ordenação em qualquer
 * coluna, e o botão "Importar booking".
 */

export default async function BookingLotsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/booking");
  requireScreen(user, "booking");
  const t = await getT();
  const entries = await listBookingLots(user);
  const statusLabel = (s: string) =>
    t(`bookingLots.status.${s}` as DictionaryKey);
  const rows: BookingLotRow[] = (entries ?? []).map((e) => ({
    id: e.lot.id,
    number: e.lot.number,
    status: e.lot.status,
    statusLabel: statusLabel(e.lot.status),
    origin: e.lot.origin ?? "",
    supplier: e.supplier?.name ?? "",
    date: e.lot.bookingDate,
    dateText: e.lot.bookingDate ? formatDate(e.lot.bookingDate, t) : "",
    fileName: e.lot.fileName,
    itemCount: e.lot.itemCount,
    pendingItems: e.pendingItems,
    viable: e.signals.viable,
    below: e.signals.below,
    loss: e.signals.loss,
    missing: e.signals.missing,
    owner: e.owner?.name ?? "",
    createdAt: e.lot.createdAt,
    createdText: formatDate(e.lot.createdAt, t),
  }));
  const cols = Object.fromEntries(
    BOOKING_LOT_SORT_KEYS.map((k) => [
      k,
      t(`bookingLots.col.${k}` as DictionaryKey),
    ]),
  ) as Record<BookingLotSortKey, string>;

  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingLots.title")}
        subtitle={t("bookingLots.subtitle")}
        actions={
          <>
            <LinkButton href="/app/booking/selection" variant="secondary">
              {t("nav.bookingSelection")}
            </LinkButton>
            {entries ? (
              <LinkButton
                href="/app/booking/import"
                variant="primary"
                data-booking-import-link
              >
                {t("bookingLots.import")}
              </LinkButton>
            ) : null}
          </>
        }
      />
      {entries === null ? (
        <div className="mb-3">
          <Alert tone="warning">{t("bookingLots.schemaMissing")}</Alert>
        </div>
      ) : null}
      <Card>
        {rows.length ? (
          <BookingLotsTable
            rows={rows}
            labels={{
              search: t("bookingLots.search"),
              searchPlaceholder: t("bookingLots.searchPlaceholder"),
              count: t("bookingLots.count"),
              noMatch: t("bookingLots.noMatch"),
              sortBy: t("bookingLots.sortBy"),
              supplierNone: t("bookingLots.supplierNone"),
              signalsNone: t("bookingLots.signals.none"),
              signal: {
                viable: t("booking.signal.viable"),
                below: t("booking.signal.below"),
                loss: t("booking.signal.loss"),
                missing: t("booking.signal.missing"),
              },
              cols,
            }}
          />
        ) : (
          <Empty>{t("bookingLots.empty")}</Empty>
        )}
      </Card>
    </>
  );
}
