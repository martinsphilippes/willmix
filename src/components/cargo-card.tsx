import type { Translate } from "@/i18n";
import type { CargoView } from "@/lib/services/order-cargo";
import { Card, formatDate } from "./ui";

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
  const dt = "text-xs font-semibold uppercase tracking-wide text-zinc-500";
  const dd = "mt-0.5 text-sm text-zinc-900";
  return (
    <Card title={t("orders.cargo.title")}>
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        {t("orders.cargo.hint")}
      </p>
      <dl className="space-y-3" data-cargo-card="">
        <div>
          <dt className={dt}>{t("orders.cargo.items")}</dt>
          <dd className={dd}>
            {cargo.items.length ? (
              <ul className="space-y-0.5">
                {cargo.items.map((i, k) => (
                  <li key={k}>
                    <span className="font-medium">{i.name}</span>
                    <span className="text-zinc-600">
                      {" "}
                      · {num(i.quantity, 0)} {i.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <dt className={dt}>{t("freight.cargo.cartons")}</dt>
            <dd className={dd} data-cargo-cartons="">
              {cargo.cartons !== null ? num(cargo.cartons, 0) : pending}
            </dd>
          </div>
          <div>
            <dt className={dt}>{t("freight.cargo.cbm")}</dt>
            <dd className={dd}>
              {cargo.totalCbm !== null
                ? `${num(cargo.totalCbm, 3)} m³`
                : pending}
            </dd>
          </div>
          <div>
            <dt className={dt}>{t("freight.cargo.gross")}</dt>
            <dd className={dd}>
              {cargo.grossWeightKg !== null
                ? `${num(cargo.grossWeightKg)} kg`
                : pending}
            </dd>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className={dt}>{t("orders.cargo.arrival")}</dt>
            <dd className={dd}>
              {cargo.eta ? day(cargo.eta) : pending}
              {cargo.vessel ? (
                <span className="block text-xs text-zinc-600">
                  {t("orders.cargo.vessel")}: {cargo.vessel}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className={dt}>{t("orders.cargo.release")}</dt>
            <dd className={dd} data-cargo-release="">
              {cargo.releasedAt ? (
                formatDate(cargo.releasedAt, t)
              ) : (
                <span className="text-amber-700">
                  {t("orders.cargo.releasePending")}
                </span>
              )}
            </dd>
          </div>
        </div>
        <div>
          <dt className={dt}>{t("orders.cargo.deliverTo")}</dt>
          <dd className={dd} data-cargo-deliver="">
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
          </dd>
        </div>
      </dl>
    </Card>
  );
}
