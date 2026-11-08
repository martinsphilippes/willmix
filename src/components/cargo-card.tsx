import type { Translate } from "@/i18n";
import type { CargoView } from "@/lib/services/order-cargo";
import { Card, formatDate } from "./ui";
import { PairsTable } from "./pairs-table";

/**
 * Cartão "Carga e entrega" do transportador: a mercadoria, a carga prevista
 * (caixas, volume, peso), chegada do navio e liberação aduaneira, e onde
 * entregar. Substitui o cartão do pedido (cliente, fornecedor, valores).
 */
export function CargoCard({ t, cargo }: { t: Translate; cargo: CargoView }) {
  const num = (n: number, digits = 2) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: digits });
  // Dia (AAAA-MM-DD) sem virar o dia anterior pelo fuso.
  const day = (d: string | null) =>
    d
      ? formatDate(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d, t)
      : null;
  const pending = (
    <span className="text-zinc-500">{t("orders.cargo.pending")}</span>
  );
  return (
    <Card title={t("orders.cargo.title")}>
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        {t("orders.cargo.hint")}
      </p>
      <div data-cargo-card="">
        <PairsTable
          perRow={1}
          items={[
            [
              t("orders.cargo.items"),
              cargo.items.length ? (
                <span className="block">
                  {cargo.items.map((i, k) => (
                    <span key={k} className="block">
                      <span className="font-medium">{i.name}</span>
                      <span className="text-zinc-600">
                        {" "}
                        · {num(i.quantity)} {i.unit}
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                "—"
              ),
            ],
            [
              t("freight.cargo.cartons"),
              <span key="cartons" data-cargo-cartons="">
                {cargo.cartons !== null ? num(cargo.cartons, 0) : pending}
              </span>,
            ],
            [
              t("freight.cargo.cbm"),
              cargo.totalCbm !== null
                ? `${num(cargo.totalCbm, 3)} m³`
                : pending,
            ],
            [
              t("freight.cargo.gross"),
              cargo.grossWeightKg !== null
                ? `${num(cargo.grossWeightKg)} kg`
                : pending,
            ],
            [
              t("orders.cargo.arrival"),
              <span key="arrival" data-cargo-arrival="">
                {cargo.eta ? day(cargo.eta) : pending}
                {cargo.vessel ? (
                  <span className="block text-xs text-zinc-600">
                    {t("orders.cargo.vessel")}: {cargo.vessel}
                  </span>
                ) : null}
                {cargo.shipDate ? (
                  <span className="block text-xs text-zinc-600">
                    {t("orders.cargo.shipped")}: {day(cargo.shipDate)}
                  </span>
                ) : null}
              </span>,
            ],
            [
              t("orders.cargo.release"),
              <span key="release" data-cargo-release="">
                {cargo.releasedAt ? (
                  formatDate(cargo.releasedAt, t)
                ) : (
                  <span className="text-amber-700">
                    {t("orders.cargo.releasePending")}
                  </span>
                )}
              </span>,
            ],
            [
              t("orders.cargo.deliverTo"),
              <span key="deliver" data-cargo-deliver="">
                {cargo.deliverTo ? (
                  <>
                    <span className="font-medium">{cargo.deliverTo.name}</span>
                    {cargo.deliverTo.address || cargo.deliverTo.city ? (
                      <span className="block text-zinc-700">
                        {[cargo.deliverTo.address, cargo.deliverTo.city]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : (
                      <span className="block text-xs text-amber-700">
                        {t("orders.cargo.noAddress")}
                      </span>
                    )}
                    {cargo.deliverTo.contactName || cargo.deliverTo.phone ? (
                      <span className="block text-xs text-zinc-600">
                        {t("orders.cargo.contact")}:{" "}
                        {[cargo.deliverTo.contactName, cargo.deliverTo.phone]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </>
                ) : (
                  "—"
                )}
              </span>,
            ],
          ]}
        />
      </div>
    </Card>
  );
}
