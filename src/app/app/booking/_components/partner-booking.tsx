import Link from "next/link";
import { notFound } from "next/navigation";
import type { User } from "@/lib/db";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  getPartnerBookingLot,
  listPartnerBookingLots,
} from "@/lib/services/booking-partner";
import {
  Alert,
  Badge,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";

/*
 * Tela Booking para o login externo (Trading; dono, 11/11/2026): os bookings
 * da empresa dele, só para ler. Sem bookings de outros fornecedores e sem a
 * análise da Wellmix (regras em src/lib/services/booking-partner.ts).
 */

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
  const lots = await listPartnerBookingLots(user);
  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingLots.title")}
        subtitle={t("bookingLots.partner.subtitle")}
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
                    <Badge tone="neutral">
                      {t(`bookingLots.status.${lot.status}` as DictionaryKey)}
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
          <Empty>{t("bookingLots.partner.empty")}</Empty>
        )}
      </Card>
    </>
  );
}

export async function PartnerBookingLotView({
  user,
  lotId,
  t,
}: {
  user: User;
  lotId: string;
  t: Translate;
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
          t(`bookingLots.status.${lot.status}` as DictionaryKey),
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <LinkButton href="/app/booking" variant="secondary">
            {t("bookingLots.partner.back")}
          </LinkButton>
        }
      />
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
