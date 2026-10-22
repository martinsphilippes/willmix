import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore, type FreightTariff } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { brazilDay } from "@/lib/supplier-terms";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  currentFreightTariff,
  getFreightTariff,
  listFreightTariffs,
  tariffContainerCapacity,
} from "@/lib/services/freight-tariff";
import {
  TARIFF_CONTAINER_TYPE,
  cheapestByOrigin,
  perCbmSuggestion,
  tariffCounts,
  type TariffDestination,
  type TariffWarning,
} from "@/lib/services/freight-tariff-calc";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  PageHeader,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  formatMoney,
  linkClass,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  applyTariffPerCbmAction,
  importFreightTariffAction,
} from "../../actions/freight-tariff";

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const FROM_ORDER = /^\/app\/orders\/[A-Za-z0-9_-]{1,64}$/;

/** Dia AAAA-MM-DD na tela (meio-dia UTC: o fuso não muda o dia). */
const day = (value: string, t: Translate) =>
  formatDate(`${value}T12:00:00Z`, t);

function errorText(t: Translate, code: string) {
  const key = `tariff.error.${code}` as DictionaryKey;
  return t(key) !== key ? t(key) : fallbackError(t, code);
}

function warningText(t: Translate, w: TariffWarning) {
  const key = `tariff.warning.${w.code}` as DictionaryKey;
  if (t(key) === key) return w.code;
  const params = Object.fromEntries(
    Object.entries(w.params).map(([k, v]) => [
      k,
      k === "sheet" || k === "otherSheet" || k === "first"
        ? String(v).replace(/^COMPARATIVO\s*-\s*/i, "")
        : typeof v === "number" && k !== "id"
          ? v.toLocaleString(t.intl)
          : String(v),
    ]),
  );
  return t(key, params);
}

/**
 * Tarifário de frete marítimo: importar a planilha das companhias marítimas,
 * ver o menor custo de cada rota, conferir a planilha, baixar o CSV do
 * Sankhya e (admin) usar o frete por m³ no preço. Só a Wellmix.
 */
export default async function FreightTariffPage({
  searchParams,
}: PageProps<"/app/freight/tariff">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/freight/tariff");
  if (!isWellmix(user)) redirect("/app");
  const sp = await searchParams;
  const t = await getT();
  const id = typeof sp.id === "string" && ID.test(sp.id) ? sp.id : null;
  const imported =
    typeof sp.imported === "string" && ID.test(sp.imported)
      ? sp.imported
      : null;
  const from =
    typeof sp.from === "string" && FROM_ORDER.test(sp.from) ? sp.from : null;
  const error = typeof sp.error === "string" ? sp.error : null;

  let current: FreightTariff | null = null;
  let viewing: FreightTariff | null = null;
  let history: FreightTariff[] = [];
  let loadError: string | null = null;
  try {
    [current, history] = await Promise.all([
      currentFreightTariff(user),
      listFreightTariffs(user),
    ]);
    viewing =
      (id ?? imported) ? await getFreightTariff(user, (id ?? imported)!) : null;
    viewing ??= current;
  } catch {
    // Ex.: tabela ainda não publicada no Appwrite: explica em vez de quebrar.
    loadError = "schema_outdated";
  }
  const [settings, capacity, users] = await Promise.all([
    getSettings(),
    tariffContainerCapacity(),
    history.length
      ? getStore().list("users", {
          filter: { id: [...new Set(history.map((h) => h.uploadedByUserId))] },
        })
      : Promise.resolve([]),
  ]);
  const userName = (uid: string) =>
    users.find((u) => u.id === uid)?.name ?? "—";
  const data = viewing?.data ?? null;
  const dest: TariffDestination | null =
    data?.destinations.find(
      (d) => typeof sp.dest === "string" && d.code === sp.dest,
    ) ??
    data?.destinations[0] ??
    null;
  const counts = data ? tariffCounts(data) : null;
  const suggestion =
    data && dest && capacity
      ? perCbmSuggestion(data, dest.code, capacity)
      : null;
  const today = brazilDay(new Date()) ?? undefined;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (viewing && viewing.id !== current?.id) p.set("id", viewing.id);
    if (from) p.set("from", from);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      {from ? (
        <Link
          href={from}
          className="mb-2 inline-block text-sm font-medium text-zinc-500 hover:text-brand-700"
        >
          {t("tariff.backToOrder")}
        </Link>
      ) : null}
      <PageHeader
        t={t}
        title={t("tariff.title")}
        subtitle={t("tariff.subtitle")}
        help={{ body: "tariff.help.body", steps: "tariff.help.steps" }}
      />
      {error ? (
        <Alert tone="danger">
          <span data-tariff-error={error}>{errorText(t, error)}</span>
        </Alert>
      ) : null}
      {loadError ? (
        <Alert tone="danger">{errorText(t, loadError)}</Alert>
      ) : null}
      {imported && viewing?.id === imported && counts ? (
        <Alert tone="success">
          <span data-tariff-imported={imported}>
            {t("tariff.imported", {
              rates: String(counts.rates),
              forwarders: String(counts.forwarders),
            })}
          </span>
        </Alert>
      ) : null}
      {sp.perCbm === "1" ? (
        <Alert tone="success">{t("tariff.perCbm.applied")}</Alert>
      ) : null}

      <div className="mt-3 space-y-4">
        <Card title={t("tariff.import.title")}>
          <p className="mb-3 text-sm text-zinc-600">
            {t("tariff.import.hint")}
          </p>
          <form
            action={importFreightTariffAction}
            className="@container"
            data-tariff-import=""
          >
            {from ? <input type="hidden" name="from" value={from} /> : null}
            <div className="grid items-end gap-3 @lg:grid-cols-[minmax(0,1fr)_12rem_auto]">
              <Field label={t("tariff.import.file")}>
                <Input
                  name="file"
                  type="file"
                  required
                  accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                />
              </Field>
              <Field
                label={t("tariff.import.date")}
                hint={t("tariff.import.dateHint")}
              >
                <Input
                  name="referenceDate"
                  type="date"
                  defaultValue={today}
                  required
                />
              </Field>
              <div className="@lg:pb-6">
                <SubmitButton>{t("tariff.import.submit")}</SubmitButton>
              </div>
            </div>
          </form>
        </Card>

        {!viewing || !data ? (
          loadError ? null : (
            <Empty>{t("tariff.empty")}</Empty>
          )
        ) : (
          <>
            {current && viewing.id !== current.id ? (
              <Alert tone="info">
                {t("tariff.viewingOld", {
                  date: day(viewing.referenceDate, t),
                })}{" "}
                <TextLink
                  href={from ? `?from=${encodeURIComponent(from)}` : "?"}
                >
                  {t("tariff.viewCurrent")}
                </TextLink>
              </Alert>
            ) : null}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label={t("tariff.stat.date")}
                value={
                  <span className="flex flex-wrap items-center gap-2">
                    {day(viewing.referenceDate, t)}
                    <Badge
                      tone={viewing.status === "active" ? "success" : "neutral"}
                    >
                      {t(`tariff.status.${viewing.status}` as DictionaryKey)}
                    </Badge>
                  </span>
                }
              />
              <Stat
                label={t("tariff.stat.fx")}
                value={
                  <span>
                    {/* Câmbio com 4 casas, como na planilha (R$ 5,0569). */}
                    R${" "}
                    {data.fx.toLocaleString(t.intl, {
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 4,
                    })}
                    {data.fxBase !== null ? (
                      <span className="block text-xs font-normal text-zinc-500">
                        {t("tariff.stat.fxDetail", {
                          base: data.fxBase.toLocaleString(t.intl, {
                            maximumFractionDigits: 4,
                          }),
                          spread: (data.fxSpread ?? 0).toLocaleString(t.intl, {
                            maximumFractionDigits: 4,
                          }),
                        })}
                      </span>
                    ) : null}
                  </span>
                }
              />
              <Stat
                label={t("tariff.stat.road")}
                value={
                  <span>
                    {formatMoney(data.roadFreightBrl, "BRL", t)}
                    <span className="block text-xs font-normal text-zinc-500">
                      {t("tariff.stat.roadDetail")}
                    </span>
                  </span>
                }
              />
              <Stat
                label={t("tariff.stat.rates")}
                value={
                  <span>
                    {counts?.rates ?? 0}
                    <span className="block text-xs font-normal text-zinc-500">
                      {t("tariff.stat.ratesDetail", {
                        forwarders: String(counts?.forwarders ?? 0),
                        destinations: String(counts?.destinations ?? 0),
                      })}
                    </span>
                  </span>
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <a
                href={`/api/freight-tariff/${encodeURIComponent(viewing.id)}/sankhya`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                data-tariff-csv=""
              >
                {t("tariff.download")}
              </a>
              {viewing.fileDocumentId ? (
                <a
                  href={`/api/files/${encodeURIComponent(viewing.fileDocumentId)}`}
                  className={cx(linkClass, "text-sm")}
                >
                  {t("tariff.original")}
                </a>
              ) : null}
              <p className="w-full text-xs text-zinc-500">
                {t("tariff.downloadHint")}
              </p>
            </div>

            {data.warnings.length ? (
              <Alert tone="warning">
                <p className="font-semibold">
                  {t("tariff.warnings.title", {
                    n: String(data.warnings.length),
                  })}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {data.warnings.map((w, i) => (
                    <li key={i} data-tariff-warning={w.code}>
                      {warningText(t, w)}
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <Alert tone="success">{t("tariff.warnings.ok")}</Alert>
            )}

            {dest ? (
              <Card
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {t("tariff.dest.label")}
                    <span className="flex flex-wrap gap-1.5" role="list">
                      {data.destinations.map((d) => (
                        <Link
                          key={d.code}
                          role="listitem"
                          href={qs({ dest: d.code })}
                          aria-current={
                            d.code === dest.code ? "page" : undefined
                          }
                          className={cx(
                            "rounded-full border px-3 py-1 text-xs font-semibold transition",
                            d.code === dest.code
                              ? "border-brand-600 bg-brand-600 text-white"
                              : "border-zinc-300 bg-white text-zinc-700 hover:border-brand-400",
                          )}
                          data-tariff-dest={d.code}
                        >
                          {d.name}
                        </Link>
                      ))}
                    </span>
                  </span>
                }
              >
                <RatesTable
                  t={t}
                  dest={dest}
                  containerQty={data.containerQty}
                />
              </Card>
            ) : null}

            {dest ? <FeesTable t={t} dest={dest} /> : null}

            {dest ? (
              <Card title={t("tariff.perCbm.title")}>
                {!capacity ? (
                  <p className="text-sm text-zinc-600">
                    {t("tariff.perCbm.noCapacity")}
                  </p>
                ) : suggestion ? (
                  <div className="space-y-3 text-sm text-zinc-700">
                    <p data-tariff-per-cbm={suggestion.perCbm}>
                      {t("tariff.perCbm.body", {
                        ports: String(suggestion.ports),
                        dest: dest.name,
                        container: formatMoney(
                          suggestion.containerBrl,
                          "BRL",
                          t,
                        ).replace(/^R\$\s?/, ""),
                        capacity: String(capacity),
                        type: TARIFF_CONTAINER_TYPE,
                        perCbm: suggestion.perCbm.toLocaleString(t.intl, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
                      })}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {t("tariff.perCbm.current", {
                        value:
                          settings.freightPerCbm !== null
                            ? `${formatMoney(settings.freightPerCbm, settings.freightCurrency, t)}/m³`
                            : t("tariff.perCbm.none"),
                      })}
                    </p>
                    {user.role === "admin" ? (
                      <form
                        action={applyTariffPerCbmAction}
                        className="space-y-1"
                      >
                        <input
                          type="hidden"
                          name="tariffId"
                          value={viewing.id}
                        />
                        <input
                          type="hidden"
                          name="destination"
                          value={dest.code}
                        />
                        <SubmitButton
                          variant="secondary"
                          data-tariff-apply-cbm=""
                        >
                          {t("tariff.perCbm.apply", {
                            perCbm: suggestion.perCbm.toLocaleString(t.intl, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }),
                          })}
                        </SubmitButton>
                        <p className="text-xs text-zinc-500">
                          {t("tariff.perCbm.applyHint")}
                        </p>
                      </form>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        {t("tariff.perCbm.applyHint")}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600">
                    {t("tariff.error.tariff_no_suggestion")}
                  </p>
                )}
              </Card>
            ) : null}
          </>
        )}

        {history.length ? (
          <Card title={t("tariff.history.title")}>
            <Table>
              <thead>
                <tr>
                  <Th>{t("tariff.history.date")}</Th>
                  <Th>{t("tariff.history.file")}</Th>
                  <Th>{t("tariff.history.rates")}</Th>
                  <Th>{t("tariff.history.by")}</Th>
                  <Th>{t("tariff.history.when")}</Th>
                  <Th>{t("tariff.history.status")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr
                    key={h.id}
                    className={cx(
                      rowClass,
                      h.id === viewing?.id && "bg-brand-50/50",
                    )}
                  >
                    <Td>{day(h.referenceDate, t)}</Td>
                    <Td className="max-w-[16rem] truncate">{h.fileName}</Td>
                    <Td className="tabular-nums">{h.rateCount}</Td>
                    <Td>{userName(h.uploadedByUserId)}</Td>
                    <Td>{formatDate(h.createdAt, t)}</Td>
                    <Td>
                      <Badge
                        tone={h.status === "active" ? "success" : "neutral"}
                      >
                        {t(`tariff.status.${h.status}` as DictionaryKey)}
                      </Badge>
                    </Td>
                    <Td>
                      {h.id === viewing?.id ? null : (
                        <TextLink
                          href={`?id=${encodeURIComponent(h.id)}${from ? `&from=${encodeURIComponent(from)}` : ""}`}
                        >
                          {t("tariff.history.view")}
                        </TextLink>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ) : null}
      </div>
    </>
  );
}

/** Portos × companhias de um destino, com o menor custo de cada porto em verde. */
function RatesTable({
  t,
  dest,
  containerQty,
}: {
  t: Translate;
  dest: TariffDestination;
  containerQty: number;
}) {
  const withRates = dest.forwarders
    .map((f, i) => ({ f, i }))
    .filter(({ i }) => dest.rates.some((r) => r.forwarder === i));
  const best = cheapestByOrigin(dest);
  const rows = dest.origins
    .map((o, oi) => ({ o, oi }))
    .filter(({ oi }) => best[oi] !== null);
  if (!rows.length || !withRates.length)
    return <p className="text-sm text-zinc-600">{t("tariff.table.noRates")}</p>;
  const usd = (n: number) => formatMoney(n, "USD", t);
  return (
    <>
      <p className="mb-3 text-xs text-zinc-500">
        {t("tariff.table.caption", {
          type: containerQty > 1 ? `${containerQty} × 40HQ` : "40HQ",
        })}
      </p>
      <Table>
        <thead>
          <tr>
            <Th>{t("tariff.table.origin")}</Th>
            {withRates.map(({ f, i }) => (
              <Th key={i}>
                <span className="block">{f.name}</span>
                <span className="block text-[11px] font-normal normal-case text-zinc-500">
                  {f.paymentTermDays !== null
                    ? t("tariff.table.term", { n: String(f.paymentTermDays) })
                    : t("tariff.table.noTerm")}
                </span>
              </Th>
            ))}
            <Th>{t("tariff.table.best")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ o, oi }, idx) => {
            const cheapest = best[oi]!;
            // Linha do país quando ele muda (CHINA, INDIA, EGITO...).
            const prev = idx > 0 ? rows[idx - 1].o.country : null;
            const countryRow =
              o.country && o.country !== prev ? o.country : null;
            return [
              countryRow ? (
                <tr key={`c-${oi}`} className="bg-zinc-50">
                  <Td
                    colSpan={withRates.length + 2}
                    className="py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {countryRow}
                  </Td>
                </tr>
              ) : null,
              <tr key={oi} className={rowClass} data-tariff-origin={o.name}>
                <Td className="font-medium text-zinc-900">{o.name}</Td>
                {withRates.map(({ i }) => {
                  const rates = dest.rates.filter(
                    (r) => r.origin === oi && r.forwarder === i,
                  );
                  return (
                    <Td key={i} className="align-top">
                      {rates.length ? (
                        <span className="flex flex-col gap-1">
                          {rates.map((r) => (
                            <span
                              key={r.route}
                              className={cx(
                                "rounded-lg px-2 py-1",
                                r === cheapest &&
                                  "bg-emerald-50 font-semibold text-emerald-900 ring-1 ring-emerald-200",
                              )}
                              data-tariff-cell={`${o.name}|${dest.forwarders[i].name}|${r.route}`}
                              data-total={r.totalBrl}
                            >
                              <span className="block tabular-nums">
                                {formatMoney(r.totalBrl, "BRL", t)}
                              </span>
                              <span className="block text-[11px] font-normal text-zinc-500">
                                {usd(r.oceanUsd)} ·{" "}
                                {t(`tariff.route.${r.route}` as DictionaryKey)}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </Td>
                  );
                })}
                <Td className="align-top">
                  <span className="block" data-tariff-best={o.name}>
                    <span className="block font-semibold tabular-nums text-emerald-800">
                      {formatMoney(cheapest.totalBrl, "BRL", t)}
                    </span>
                    <span className="block text-[11px] text-zinc-500">
                      {dest.forwarders[cheapest.forwarder].name}
                    </span>
                  </span>
                </Td>
              </tr>,
            ];
          })}
        </tbody>
      </Table>
    </>
  );
}

/** Taxas de cada companhia no destino (US$ e R$), com os totais. */
function FeesTable({ t, dest }: { t: Translate; dest: TariffDestination }) {
  const cols = dest.forwarders
    .map((f, i) => ({ f, i }))
    .filter(
      ({ f, i }) =>
        dest.rates.some((r) => r.forwarder === i) ||
        f.fees.some((x) => (x.usd ?? 0) > 0 || (x.brl ?? 0) > 0),
    );
  if (!cols.length) return null;
  const labels: string[] = [];
  for (const { f } of cols)
    for (const fee of f.fees)
      if (!labels.includes(fee.label)) labels.push(fee.label);
  const money = (usd: number | null, brl: number | null) => {
    const parts = [
      usd ? formatMoney(usd, "USD", t) : null,
      brl ? formatMoney(brl, "BRL", t) : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" + ") : "—";
  };
  return (
    <Card title={t("tariff.fees.title")}>
      <Table>
        <thead>
          <tr>
            <Th>{t("tariff.fees.fee")}</Th>
            {cols.map(({ f, i }) => (
              <Th key={i}>{f.name}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label) => {
            const perShipment = cols.some(({ f }) =>
              f.fees.some((x) => x.label === label && x.perShipment),
            );
            return (
              <tr key={label} className={rowClass}>
                <Td className="font-medium text-zinc-900">
                  {label}
                  {perShipment ? (
                    <span className="ml-1 text-[11px] font-normal text-zinc-500">
                      ({t("tariff.fees.perShipment")})
                    </span>
                  ) : null}
                </Td>
                {cols.map(({ f, i }) => {
                  const fee = f.fees.find((x) => x.label === label);
                  return (
                    <Td key={i} className="tabular-nums">
                      {fee ? money(fee.usd, fee.brl) : "—"}
                    </Td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="border-t border-zinc-200 bg-zinc-50">
            <Td className="font-semibold text-zinc-900">
              {t("tariff.fees.total")}
            </Td>
            {cols.map(({ f, i }) => (
              <Td key={i} className="tabular-nums font-semibold">
                {money(f.feesUsd, f.feesBrl)}
              </Td>
            ))}
          </tr>
          <tr className="bg-zinc-50">
            <Td className="font-semibold text-zinc-900">
              {t("tariff.fees.totalBrl")}
            </Td>
            {cols.map(({ f, i }) => (
              <Td key={i} className="tabular-nums font-semibold text-brand-800">
                <span data-tariff-fees={f.name}>
                  {formatMoney(f.feesTotalBrl, "BRL", t)}
                </span>
              </Td>
            ))}
          </tr>
        </tbody>
      </Table>
    </Card>
  );
}
