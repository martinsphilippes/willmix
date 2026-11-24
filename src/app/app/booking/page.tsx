import { isWellmix } from "@/lib/auth/permissions";
import { canSeePurchasePrice } from "@/lib/auth/function-access";
import { PartnerBookingList } from "./_components/partner-booking";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import {
  bookingLotLockable,
  BOOKING_LOT_SORT_KEYS,
  type BookingLotRow,
  type BookingLotSortKey,
} from "@/lib/booking-lots";
import {
  canSuperviseBooks,
  listBookingLots,
  myBookingLocks,
} from "@/lib/services/booking-lots";
import { durationText, itemTypeKey } from "@/lib/booking-locks";
import { getSettings } from "@/lib/settings";
import { dictionaries } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { BookingLocksBar } from "./_components/booking-locks-bar";
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

export default async function BookingLotsPage({
  searchParams,
}: PageProps<"/app/booking">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/booking");
  requireScreen(user, "booking");
  const t = await getT();
  // Login externo (Trading…): só os bookings da empresa dele, sem a análise.
  if (!isWellmix(user))
    return (
      <PartnerBookingList
        user={user}
        t={t}
        discarded={(await searchParams).discarded === "1"}
      />
    );
  const query = await searchParams;
  const [entries, supervisor, mine, settings] = await Promise.all([
    listBookingLots(user),
    canSuperviseBooks(user),
    myBookingLocks(user),
    getSettings(),
  ]);
  const slaHours = settings.bookingLockSlaHours;
  // A hora da leitura (uma por pedido da página): a primeira pintura do
  // prazo ("Faltam…") sai igual no servidor e no navegador; depois o
  // relógio anda na tela.
  const renderedAt = new Date().getTime();
  const errorCode = typeof query.error === "string" ? query.error : "";
  const errorKey = [
    `bookWork.error.${errorCode}`,
    `bookingLots.error.${errorCode}`,
    `common.${errorCode}`,
  ].find((k) => k in dictionaries.pt) as DictionaryKey | undefined;
  const errorText = !errorCode
    ? null
    : errorKey
      ? t(errorKey)
      : fallbackError(t, errorCode);
  // Sinais da previsão de preço: só com "Ver preço de compra" (dono, 15/11/2026);
  // sem ela as contagens nem vão ao navegador.
  const seesPrice = canSeePurchasePrice(user);
  const statusLabel = (s: string) =>
    t(`bookingLots.status.${s}` as DictionaryKey);
  const rows: BookingLotRow[] = (entries ?? []).map((e) => {
    return {
      itemType: e.lot.itemType ?? "",
      sourceKind: [e.lot.storeNumber, e.lot.supplierName]
        .filter(Boolean)
        .join(" · "),
      workedPct: e.worked.pct,
      workedText: t("bookWork.worked.count", {
        worked: e.worked.worked,
        total: e.worked.total,
      }),
      holder: e.held ? (e.held.user?.name ?? "—") : "",
      lockId: e.held?.lock.id ?? null,
      lockMine: e.held?.lock.userId === user.id,
      lockCanRelease: !!e.held?.canRelease,
      lockByType: e.held?.lock.scope === "type",
      heldMinutes: e.held ? e.held.minutes : null,
      heldText: e.held ? durationText(e.held.minutes) : "",
      heldSince: e.held?.since ?? null,
      workDoneAt: e.lot.workDoneAt ?? null,
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
      viable: seesPrice ? e.signals.viable : 0,
      below: seesPrice ? e.signals.below : 0,
      loss: seesPrice ? e.signals.loss : 0,
      missing: seesPrice ? e.signals.missing : 0,
      owner: e.owner?.name ?? "",
      createdAt: e.lot.createdAt,
      createdText: formatDate(e.lot.createdAt, t),
    };
  });
  // Tipos de item que dá para travar: os dos books livres à vista.
  const freeTypes = new Map<string, string>();
  for (const e of entries ?? [])
    if (
      !e.held &&
      // Só os books que já saíram do rascunho entram na trava.
      bookingLotLockable(e.lot.status) &&
      e.lot.itemType &&
      !freeTypes.has(itemTypeKey(e.lot.itemType))
    )
      freeTypes.set(itemTypeKey(e.lot.itemType), e.lot.itemType);
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
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {query.locked === "1" || query.unlocked === "1" ? (
        <div className="mb-3">
          <Alert tone="success">
            {t(
              query.locked === "1"
                ? "bookWork.lock.done"
                : "bookWork.unlock.done",
            )}
          </Alert>
        </div>
      ) : null}
      {entries ? (
        <BookingLocksBar
          t={t}
          supervisor={supervisor}
          slaHours={slaHours}
          freeTypes={[...freeTypes.values()].sort((a, b) =>
            a.localeCompare(b, "pt"),
          )}
          mine={mine.map(({ lock, lotNumber, minutes, canRelease }) => ({
            canRelease,
            id: lock.id,
            scope: lock.scope,
            itemType: lock.itemType,
            lotNumber,
            time: durationText(minutes),
          }))}
        />
      ) : null}
      <Card>
        {rows.length ? (
          <BookingLotsTable
            rows={rows}
            showSignals={seesPrice}
            slaHours={slaHours}
            renderedAt={renderedAt}
            labels={{
              lock: t("bookWork.lock"),
              unlock: t("bookWork.unlock"),
              free: t("bookWork.lock.free"),
              byType: t("bookWork.lock.byTypeShort"),
              slaOk: t("bookWork.sla.ok", { h: slaHours }),
              slaLate: t("bookWork.sla.late", { h: slaHours }),
              // Com os {marcadores}: a tela preenche com a hora de agora.
              clock: {
                left: t("bookWork.clock.left"),
                late: t("bookWork.clock.late"),
                done: t("bookWork.clock.done"),
                doneNow: t("bookWork.clock.doneNow"),
                until: t("bookWork.clock.until"),
                due: t("bookWork.clock.due"),
                doneAt: t("bookWork.clock.doneAt"),
                heldBy: t("bookWork.lock.heldBy"),
                doneHint: t("bookWork.clock.doneHint"),
              },
              search: t("bookingLots.search"),
              searchPlaceholder: t("bookingLots.searchPlaceholder"),
              count: t("bookingLots.count"),
              noMatch: t("bookingLots.noMatch"),
              sortBy: t("bookingLots.sortBy"),
              supplierNone: t("bookingLots.supplierNone"),
              signalsNone: t("bookingLots.signals.none"),
              more: t("requestSheet.more"),
              less: t("requestSheet.less"),
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
