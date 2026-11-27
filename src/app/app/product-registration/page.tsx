import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { canSeePurchasePrice } from "@/lib/auth/function-access";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { registrationOverview } from "@/lib/services/product-registration";
import type { RegistrationState } from "@/lib/product-registration";
import {
  Badge,
  Card,
  OpenLink,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
  cx,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";
import { HoverZoomPhoto } from "@/components/hover-zoom-photo";
import { pinnedColumns } from "@/components/pinned-columns";
import { CompletionTd } from "../supplier-requests/_components/completion";

/*
 * Cadastrar produto (dono, 26/11/2026; docs/PRODUCT_REGISTRATION.md): no
 * menu, logo depois da Consulta. Uma linha por produto aprovado na cotação
 * que veio do book; "A cadastrar" até o produto ter o código do Sankhya.
 *
 * Lista rica (dono, 27/11/2026): os cards do passo (quantos a cadastrar,
 * prontos, esperando a amostra, sem o Sankhya, atrasados e a completude
 * média), o que mais falta preencher e, em cada linha, a foto, o que já
 * temos do item (código da fábrica, variação, quantidade, condições e NCM),
 * a completude do cadastro com os obrigatórios que faltam, quem cuida e o
 * prazo.
 */

const TONE: Record<
  RegistrationState,
  "warning" | "info" | "success" | "neutral"
> = {
  waiting_sample: "neutral",
  to_register: "warning",
  to_send: "info",
  done: "success",
};

export default async function ProductRegistrationPage({
  searchParams,
}: PageProps<"/app/product-registration">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "productRegistration");
  if (!isWellmix(user)) notFound();
  const sp = await searchParams;
  const t = await getT();
  const tab = sp.tab === "done" ? "done" : "open";
  const now = new Date();
  const { rows, kpis, topMissing, slaDays } = await registrationOverview(
    user,
    tab,
    now,
  );
  // Preço de compra só com "Ver preço de compra" (regra fixa do dono).
  const seesPrice = canSeePurchasePrice(user);
  const field = (id: string) =>
    t(`productRegistration.field.${id}` as DictionaryKey);
  const n = (v: number, digits = 4) =>
    v.toLocaleString(t.intl, { maximumFractionDigits: digits });
  const pin = pinnedColumns(["3rem", "4rem", "14rem"]);
  const chip = (key: "open" | "done", label: string, count: number) => (
    <Link
      href={
        key === "open"
          ? "/app/product-registration"
          : "/app/product-registration?tab=done"
      }
      className={cx(
        "rounded-full border px-3 py-1 text-xs font-medium",
        tab === key
          ? "border-brand-600 bg-brand-50 text-brand-800"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400",
      )}
      aria-current={tab === key ? "page" : undefined}
      data-registration-tab={key}
    >
      {label} ({count})
    </Link>
  );
  const heads = [
    t("productRegistration.col.photo"),
    t("productRegistration.col.quote"),
    t("productRegistration.col.product"),
  ];
  return (
    <div data-product-registration-list>
      <PageHeader
        t={t}
        title={t("productRegistration.title")}
        subtitle={t("productRegistration.subtitle")}
      />
      {/* Os números do passo (sempre os em aberto). */}
      <div
        className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
        data-registration-kpis
      >
        <Stat
          compact
          label={t("productRegistration.kpi.open")}
          value={kpis.open}
        />
        <Stat
          compact
          label={t("productRegistration.kpi.toRegister")}
          value={kpis.toRegister}
          tone={kpis.toRegister ? "warning" : "neutral"}
        />
        <Stat
          compact
          label={t("productRegistration.kpi.waitingSample")}
          value={kpis.waitingSample}
        />
        <Stat
          compact
          label={t("productRegistration.kpi.toSend")}
          value={kpis.toSend}
        />
        <Stat
          compact
          label={t("productRegistration.kpi.late", { days: slaDays })}
          value={kpis.late}
          tone={kpis.late ? "danger" : "neutral"}
        />
        <Stat
          compact
          label={t("productRegistration.kpi.completeness")}
          value={
            <span data-registration-kpi-completeness={kpis.averagePercent}>
              {kpis.averagePercent}%
              <span className="ml-1 text-xs font-normal text-zinc-500">
                {t("productRegistration.kpi.missingRequired", {
                  n: kpis.missingRequired,
                })}
              </span>
            </span>
          }
        />
      </div>
      {topMissing.length ? (
        <div
          className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs"
          data-registration-top-missing
        >
          <span className="font-semibold uppercase tracking-wide text-zinc-500">
            {t("productRegistration.topMissing")}
          </span>
          {topMissing.map((m) => (
            <span
              key={m.id}
              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-900"
              data-registration-missing-field={m.id}
            >
              {field(m.id)} · {m.n}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap gap-2">
        {chip("open", t("productRegistration.tab.open"), kpis.open)}
        {chip("done", t("productRegistration.tab.done"), kpis.done)}
      </div>
      <Card>
        {rows.length ? (
          /* Buscador em qualquer coluna, sempre à vista (dono, 27/11/2026). */
          <Table alwaysSearch>
            <thead>
              <tr>
                {heads.map((label, i) => (
                  <Th
                    key={label}
                    className={pin.cell(i, true)}
                    style={pin.style(i)}
                  >
                    {i === 0 ? <span className="sr-only">{label}</span> : label}
                  </Th>
                ))}
                <Th>{t("productRegistration.col.state")}</Th>
                <Th className="whitespace-nowrap">
                  {t("productRegistration.col.completeness")}
                </Th>
                <Th>{t("productRegistration.col.missing")}</Th>
                <Th>{t("productRegistration.col.responsible")}</Th>
                <Th className="whitespace-nowrap">
                  {t("productRegistration.col.sla")}
                </Th>
                <Th>{t("productRegistration.col.supplier")}</Th>
                <Th>{t("productRegistration.col.book")}</Th>
                <Th className="whitespace-nowrap">
                  {t("productRegistration.col.quantity")}
                </Th>
                {seesPrice ? (
                  <Th className="whitespace-nowrap">
                    {t("productRegistration.col.price")}
                  </Th>
                ) : null}
                <Th>{t("productRegistration.col.ncm")}</Th>
                <Th>{t("productRegistration.col.code")}</Th>
                <Th>{t("productRegistration.col.saved")}</Th>
                <Th>
                  <span className="sr-only">
                    {t("productRegistration.open")}
                  </span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const r = row.request;
                const c = row.completeness;
                const href = `/app/product-registration/${r.id}`;
                return (
                  <tr
                    key={r.id}
                    className={cx(rowClass, pin.row)}
                    data-registration-row={r.id}
                  >
                    <Td className={pin.cell(0)} style={pin.style(0)}>
                      <div style={pin.box(0)}>
                        <HoverZoomPhoto photoId={row.photoId} />
                      </div>
                    </Td>
                    <Td className={pin.cell(1)} style={pin.style(1)}>
                      <div style={pin.box(1)} className="tabular-nums">
                        <Link
                          href={`/app/supplier-requests/${r.id}?view=item`}
                          className={linkClass}
                        >
                          {r.number}
                        </Link>
                      </div>
                    </Td>
                    <Td className={pin.cell(2)} style={pin.style(2)}>
                      <div
                        style={pin.box(2)}
                        className="space-y-0.5 whitespace-normal"
                      >
                        <Link
                          href={href}
                          className="line-clamp-2 font-medium text-zinc-900 hover:underline"
                          data-registration-product
                        >
                          {productNameText(t, row.name)}
                        </Link>
                        <span className="block text-xs text-zinc-500">
                          {[row.factoryCode, row.variation]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <span data-registration-state={row.state}>
                        <Badge tone={TONE[row.state]}>
                          {t(`productRegistration.state.${row.state}`)}
                        </Badge>
                      </span>
                    </Td>
                    <CompletionTd
                      c={{ done: c.filled, total: c.total, percent: c.percent }}
                      t={t}
                    />
                    <Td
                      className="max-w-56 whitespace-normal text-xs"
                      data-registration-missing={c.missingRequired.length}
                    >
                      {c.missingRequired.length ? (
                        <span
                          className="text-red-700"
                          title={c.missingRequired.map(field).join(", ")}
                        >
                          {t("productRegistration.missingRequired", {
                            n: c.missingRequired.length,
                            fields: c.missingRequired
                              .slice(0, 3)
                              .map(field)
                              .join(", "),
                          })}
                        </span>
                      ) : (
                        <span className="text-emerald-700">
                          {t("productRegistration.requiredOk")}
                        </span>
                      )}
                      <span
                        className="mt-0.5 block text-zinc-500"
                        title={c.missing.map(field).join(", ")}
                      >
                        {t("productRegistration.missingOthers", {
                          n: c.missing.length,
                        })}
                      </span>
                    </Td>
                    <Td className="whitespace-normal text-xs">
                      {row.responsible ? (
                        <>
                          <span className="block font-medium text-zinc-800">
                            {row.responsible.name}
                          </span>
                          <span className="block text-zinc-500">
                            {t(
                              `productRegistration.responsible.${row.responsible.kind}` as DictionaryKey,
                            )}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td
                      className="whitespace-nowrap text-xs"
                      data-registration-sla={
                        row.dueAt ? (row.late ? "late" : "ok") : "none"
                      }
                    >
                      {row.dueAt ? (
                        <>
                          <Badge tone={row.late ? "danger" : "success"}>
                            {t(
                              row.late
                                ? "productRegistration.sla.late"
                                : "productRegistration.sla.ok",
                            )}
                          </Badge>
                          <span className="mt-0.5 block text-zinc-500">
                            {t("productRegistration.sla.due", {
                              date: formatDate(row.dueAt, t),
                            })}
                          </span>
                        </>
                      ) : row.state === "waiting_sample" ? (
                        <span className="text-zinc-500">
                          {t("productRegistration.sla.waiting")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="whitespace-normal">
                      {row.supplierName ?? "—"}
                    </Td>
                    <Td className="tabular-nums">
                      {r.bookingLotId && row.lotNumber !== null ? (
                        <Link
                          href={`/app/booking/lots/${r.bookingLotId}`}
                          className={linkClass}
                        >
                          {row.lotNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      {row.units > 1
                        ? t("supplierRequests.variant.packs", {
                            n: n(row.quantity, 0),
                          })
                        : t("supplierRequests.detail.pieces", {
                            n: n(row.quantity, 0),
                          })}
                    </Td>
                    {seesPrice ? (
                      <Td className="whitespace-nowrap text-right tabular-nums">
                        {row.price !== null
                          ? `${n(row.price)} ${row.currency ?? ""} ${row.incoterm ?? ""}`.trim()
                          : "—"}
                      </Td>
                    ) : null}
                    <Td className="whitespace-nowrap tabular-nums">
                      {row.ncm ?? "—"}
                    </Td>
                    <Td className="tabular-nums">
                      {row.product?.sankhyaCode ?? "—"}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {r.registration?.savedAt
                        ? formatDate(r.registration.savedAt, t)
                        : "—"}
                    </Td>
                    <Td>
                      <OpenLink
                        href={href}
                        label={t("productRegistration.open")}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-zinc-600" data-product-registration-empty>
            {t(
              tab === "done"
                ? "productRegistration.empty.done"
                : "productRegistration.empty.open",
            )}
          </p>
        )}
      </Card>
    </div>
  );
}
