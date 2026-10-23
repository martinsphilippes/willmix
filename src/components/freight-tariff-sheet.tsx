import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  sankhyaRows,
  sheetFeesTotalBrl,
  sheetFormulaTotal,
  type FreightTariffData,
  type TariffDestination,
  type TariffRate,
} from "@/lib/services/freight-tariff-calc";
import { Card, cx, formatMoney } from "./ui";

/*
 * O tarifário "como na planilha": cada destino com as mesmas colunas da aba
 * COMPARATIVO (US$ por 40HQ direta e longa, total em R$ direta e longa, de
 * cada companhia), as taxas com o lado (origem/destino), PTAX e IOF, os
 * parâmetros da aba e, para a Wellmix, os códigos e as linhas do arquivo do
 * Sankhya. Dá para conferir tudo sem baixar a planilha.
 */

const th =
  "border-b border-zinc-200 bg-zinc-50/80 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
const td = "border-b border-zinc-100 px-2 py-1.5 align-top text-sm";
/** Coluna da companhia: linha de separação, como os blocos da planilha. */
const groupStart = "border-l border-zinc-200";

/** Rolagem horizontal da tabela larga (a página não rola de lado). */
function Wide({ children }: { children: ReactNode }) {
  return (
    <div className="relative -mx-4 overflow-x-auto border-y border-zinc-200/80 bg-white sm:mx-0 sm:rounded-xl sm:border">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

type Mark = "bestDirect" | "bestLong" | "worst" | "mismatch";

const MARK_CLASS: Record<Exclude<Mark, "mismatch">, string> = {
  bestDirect: "bg-emerald-100 font-semibold text-emerald-900",
  bestLong: "bg-sky-100 font-semibold text-sky-900",
  worst: "bg-rose-100 text-rose-900",
};

/**
 * Destaques de uma linha, como a legenda da planilha: menor custo da rota
 * direta, menor da rota longa e maior custo entre as duas (pelos totais em
 * R$ que a planilha mostra).
 */
function rowMarks(rates: TariffRate[]): Map<TariffRate, Mark> {
  const out = new Map<TariffRate, Mark>();
  const shown = rates.filter((r) => r.sheetTotalBrl !== null);
  const min = (route: "direct" | "long") =>
    shown
      .filter((r) => r.route === route)
      .reduce<TariffRate | null>(
        (best, r) =>
          !best || r.sheetTotalBrl! < best.sheetTotalBrl! ? r : best,
        null,
      );
  if (shown.length > 1) {
    const worst = shown.reduce((a, r) =>
      r.sheetTotalBrl! > a.sheetTotalBrl! ? r : a,
    );
    out.set(worst, "worst");
  }
  const direct = min("direct");
  const long = min("long");
  if (direct) out.set(direct, "bestDirect");
  if (long) out.set(long, "bestLong");
  return out;
}

export function TariffSheetView({
  t,
  data,
  dest,
  referenceDate,
  wellmix,
}: {
  t: Translate;
  data: FreightTariffData;
  dest: TariffDestination;
  /** Data da planilha (vai para o Sankhya). */
  referenceDate: string;
  /** Códigos e linhas do Sankhya: só a Wellmix. */
  wellmix: boolean;
}) {
  const brl = (n: number) => formatMoney(n, "BRL", t);
  const usd = (n: number) => formatMoney(n, "USD", t);
  const pct = (v: number | null) =>
    v === null
      ? "—"
      : `${(v * 100).toLocaleString(t.intl, { maximumFractionDigits: 3 })}%`;
  const forwarders = dest.forwarders.map((f, i) => ({ f, i }));
  const rateOf = (oi: number, fi: number, route: "direct" | "long") =>
    dest.rates.find(
      (r) => r.origin === oi && r.forwarder === fi && r.route === route,
    ) ?? null;
  const fxDetail =
    data.fxBase !== null && dest.fx === data.fx
      ? t("tariff.sheet.fxDetail", {
          base: data.fxBase.toLocaleString(t.intl, {
            maximumFractionDigits: 4,
          }),
          spread: (data.fxSpread ?? 0).toLocaleString(t.intl, {
            maximumFractionDigits: 4,
          }),
        })
      : null;
  // Totais da planilha que não batem com a conta dela (ex.: fórmula com as taxas de outra companhia).
  const wrongTotal = (rate: TariffRate) =>
    rate.sheetTotalBrl !== null &&
    Math.abs(sheetFormulaTotal(rate, dest) - rate.sheetTotalBrl) > 0.05;
  const mismatches = dest.rates.filter(wrongTotal).length;

  const priceCell = (rate: TariffRate | null) =>
    rate ? usd(rate.oceanUsd) : <span className="text-zinc-300">—</span>;
  const totalCell = (rate: TariffRate | null, marks: Map<TariffRate, Mark>) => {
    if (!rate || rate.sheetTotalBrl === null)
      return <span className="text-zinc-300">—</span>;
    const formula = sheetFormulaTotal(rate, dest);
    const wrong = wrongTotal(rate);
    const mark = marks.get(rate);
    return (
      <span
        className={cx(
          "inline-block rounded-md px-1.5 py-0.5 tabular-nums",
          mark && mark !== "mismatch" && MARK_CLASS[mark],
          wrong && "ring-2 ring-amber-400",
        )}
        title={
          wrong
            ? t("tariff.sheet.formulaTitle", { value: brl(formula) })
            : undefined
        }
        data-sheet-total={rate.sheetTotalBrl}
        data-sheet-mismatch={wrong ? "" : undefined}
      >
        {brl(rate.sheetTotalBrl)}
        {wrong ? (
          <span className="block text-[10px] font-normal text-amber-800">
            {t("tariff.sheet.formulaShort", { value: brl(formula) })}
          </span>
        ) : null}
      </span>
    );
  };

  const table = (
    <Wide>
      <thead>
        <tr>
          <th className={th} rowSpan={2}>
            {t("tariff.sheet.country")}
          </th>
          <th className={th} rowSpan={2}>
            {t("tariff.table.origin")}
          </th>
          {forwarders.map(({ f, i }) => (
            <th key={i} className={cx(th, groupStart)} colSpan={4}>
              <span className="block normal-case text-zinc-800">{f.name}</span>
              <span className="block text-[10px] font-normal normal-case text-zinc-500">
                {f.paymentTermDays !== null
                  ? t("tariff.table.term", { n: String(f.paymentTermDays) })
                  : t("tariff.table.noTerm")}
              </span>
            </th>
          ))}
        </tr>
        <tr>
          {forwarders.map(({ i }) =>
            (
              [
                "tariff.sheet.usdDirect",
                "tariff.sheet.usdLong",
                "tariff.sheet.brlDirect",
                "tariff.sheet.brlLong",
              ] as DictionaryKey[]
            ).map((key, k) => (
              <th
                key={`${i}-${k}`}
                className={cx(th, "whitespace-nowrap", k === 0 && groupStart)}
              >
                {t(key)}
              </th>
            )),
          )}
        </tr>
      </thead>
      <tbody>
        {dest.origins.map((o, oi) => {
          const prev = oi > 0 ? dest.origins[oi - 1].country : null;
          const marks = rowMarks(dest.rates.filter((r) => r.origin === oi));
          return (
            <tr key={oi} data-sheet-origin={o.name}>
              <td
                className={cx(
                  td,
                  "whitespace-nowrap text-[11px] font-semibold uppercase text-zinc-500",
                )}
              >
                {o.country && o.country !== prev ? o.country : ""}
              </td>
              <td
                className={cx(
                  td,
                  "whitespace-nowrap font-medium text-zinc-900",
                )}
              >
                {o.name}
              </td>
              {forwarders.map(({ i }) => {
                const direct = rateOf(oi, i, "direct");
                const long = rateOf(oi, i, "long");
                return [
                  <td
                    key={`${i}-ud`}
                    className={cx(
                      td,
                      groupStart,
                      "whitespace-nowrap tabular-nums",
                    )}
                  >
                    {priceCell(direct)}
                  </td>,
                  <td
                    key={`${i}-ul`}
                    className={cx(td, "whitespace-nowrap tabular-nums")}
                  >
                    {priceCell(long)}
                  </td>,
                  <td key={`${i}-bd`} className={cx(td, "whitespace-nowrap")}>
                    {totalCell(direct, marks)}
                  </td>,
                  <td key={`${i}-bl`} className={cx(td, "whitespace-nowrap")}>
                    {totalCell(long, marks)}
                  </td>,
                ];
              })}
            </tr>
          );
        })}
      </tbody>
    </Wide>
  );

  // Taxas: os rótulos na ordem da planilha, com o lado (origem/destino).
  const labels: { label: string; side: string | null; perShipment: boolean }[] =
    [];
  for (const { f } of forwarders)
    for (const fee of f.fees)
      if (!labels.some((l) => l.label === fee.label))
        labels.push({
          label: fee.label,
          side: fee.side,
          perShipment: fee.perShipment,
        });
  const money = (v: number | null, kind: "usd" | "brl") =>
    v ? (kind === "usd" ? usd(v) : brl(v)) : "";
  const footer = (
    label: string,
    cell: (f: TariffDestination["forwarders"][number]) => ReactNode,
    key: string,
  ) => (
    <tr key={key} className="bg-zinc-50">
      <td className={cx(td, "font-semibold text-zinc-900")} colSpan={2}>
        {label}
      </td>
      {forwarders.map(({ f, i }) => (
        <td
          key={i}
          className={cx(
            td,
            groupStart,
            "whitespace-nowrap font-semibold tabular-nums",
          )}
          colSpan={2}
        >
          {cell(f)}
        </td>
      ))}
    </tr>
  );
  const fees = (
    <Wide>
      <thead>
        <tr>
          <th className={th} rowSpan={2}>
            {t("tariff.sheet.side")}
          </th>
          <th className={th} rowSpan={2}>
            {t("tariff.fees.fee")}
          </th>
          {forwarders.map(({ f, i }) => (
            <th
              key={i}
              className={cx(th, groupStart, "normal-case text-zinc-800")}
              colSpan={2}
            >
              {f.name}
            </th>
          ))}
        </tr>
        <tr>
          {forwarders.map(({ i }) => [
            <th key={`${i}-u`} className={cx(th, groupStart)}>
              USD
            </th>,
            <th key={`${i}-b`} className={th}>
              BRL
            </th>,
          ])}
        </tr>
      </thead>
      <tbody>
        {labels.map((l, li) => {
          const prevSide = li > 0 ? labels[li - 1].side : null;
          return (
            <tr key={l.label}>
              <td
                className={cx(
                  td,
                  "text-[11px] font-semibold uppercase text-zinc-500",
                )}
              >
                {l.side && l.side !== prevSide ? l.side : ""}
              </td>
              <td
                className={cx(
                  td,
                  "whitespace-nowrap font-medium text-zinc-900",
                )}
              >
                {l.label}
                {l.perShipment ? (
                  <span className="ml-1 text-[11px] font-normal text-zinc-500">
                    ({t("tariff.fees.perShipment")})
                  </span>
                ) : null}
              </td>
              {forwarders.map(({ f, i }) => {
                const fee = f.fees.find((x) => x.label === l.label);
                return [
                  <td
                    key={`${i}-u`}
                    className={cx(
                      td,
                      groupStart,
                      "whitespace-nowrap tabular-nums",
                    )}
                  >
                    {money(fee?.usd ?? null, "usd")}
                  </td>,
                  <td
                    key={`${i}-b`}
                    className={cx(td, "whitespace-nowrap tabular-nums")}
                  >
                    {money(fee?.brl ?? null, "brl")}
                  </td>,
                ];
              })}
            </tr>
          );
        })}
        {footer(
          t("tariff.sheet.feesTotals"),
          (f) => `${usd(f.feesUsd)} · ${brl(f.feesBrl)}`,
          "totals",
        )}
        {footer("PTAX", (f) => pct(f.ptaxPercent), "ptax")}
        {footer("IOF", (f) => pct(f.iofPercent), "iof")}
        {footer(
          t("tariff.sheet.feesSheet"),
          (f) => brl(sheetFeesTotalBrl(f, dest)),
          "sheet",
        )}
        {footer(
          t("tariff.sheet.feesPortal"),
          (f) => (
            <span className="text-brand-800">{brl(f.feesTotalBrl)}</span>
          ),
          "portal",
        )}
      </tbody>
    </Wide>
  );

  const rows = wellmix
    ? sankhyaRows(data, referenceDate).filter(
        (r) => r.destinationCode === dest.code,
      )
    : [];

  return (
    <div className="space-y-4" data-tariff-sheet={dest.code}>
      <Card title={t("tariff.sheet.paramsTitle", { dest: dest.name })}>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-zinc-500">{t("tariff.sheet.fx")}</dt>
            <dd className="font-semibold tabular-nums text-zinc-900">
              R${" "}
              {dest.fx.toLocaleString(t.intl, {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
              })}
              {fxDetail ? (
                <span className="block text-xs font-normal text-zinc-500">
                  {fxDetail}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{t("tariff.sheet.road")}</dt>
            <dd className="font-semibold tabular-nums text-zinc-900">
              {brl(dest.roadFreightBrl)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">
              {t("tariff.sheet.containers")}
            </dt>
            <dd className="font-semibold tabular-nums text-zinc-900">
              {dest.containerQty}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{t("tariff.sheet.date")}</dt>
            <dd className="font-semibold tabular-nums text-zinc-900">
              {referenceDate.split("-").reverse().join("/")}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title={t("tariff.sheet.ratesTitle", { dest: dest.name })}>
        <p className="mb-3 text-xs text-zinc-500">
          {t("tariff.sheet.ratesHint")}
        </p>
        {table}
        <ul className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <li className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-900">
            {t("tariff.sheet.legendBestDirect")}
          </li>
          <li className="rounded-md bg-sky-100 px-2 py-0.5 text-sky-900">
            {t("tariff.sheet.legendBestLong")}
          </li>
          <li className="rounded-md bg-rose-100 px-2 py-0.5 text-rose-900">
            {t("tariff.sheet.legendWorst")}
          </li>
          <li className="rounded-md px-2 py-0.5 text-amber-900 ring-2 ring-amber-400">
            {t("tariff.sheet.legendMismatch")}
          </li>
        </ul>
        {mismatches ? (
          <p
            className="mt-2 text-xs text-amber-800"
            data-sheet-mismatches={mismatches}
          >
            {t("tariff.sheet.mismatches", { n: String(mismatches) })}
          </p>
        ) : null}
      </Card>

      <Card title={t("tariff.sheet.feesTitle", { dest: dest.name })}>
        {fees}
      </Card>

      {wellmix ? (
        <Card title={t("tariff.sheet.codesTitle")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Wide>
              <thead>
                <tr>
                  <th className={th}>{t("tariff.sheet.company")}</th>
                  <th className={th}>CODPARC</th>
                </tr>
              </thead>
              <tbody>
                {forwarders.map(({ f, i }) => (
                  <tr key={i}>
                    <td className={td}>{f.name}</td>
                    <td className={cx(td, "tabular-nums")}>
                      {f.code ?? (
                        <span className="text-amber-700">
                          {t("tariff.sheet.noCode")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Wide>
            <Wide>
              <thead>
                <tr>
                  <th className={th}>{t("tariff.sheet.port")}</th>
                  <th className={th}>ID</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={cx(td, "font-semibold")}>
                    {dest.name} ({t("tariff.sheet.destination")})
                  </td>
                  <td className={cx(td, "tabular-nums")}>
                    {dest.portId ?? (
                      <span className="text-amber-700">
                        {t("tariff.sheet.noId")}
                      </span>
                    )}
                  </td>
                </tr>
                {dest.origins
                  .filter((_, oi) => dest.rates.some((r) => r.origin === oi))
                  .map((o) => (
                    <tr key={o.name}>
                      <td className={td}>{o.name}</td>
                      <td className={cx(td, "tabular-nums")}>
                        {o.portId ?? (
                          <span className="text-amber-700">
                            {t("tariff.sheet.noId")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </Wide>
          </div>
        </Card>
      ) : null}

      {wellmix ? <SankhyaLines t={t} rows={rows} dest={dest.name} /> : null}
    </div>
  );
}

/** As linhas do AD_FREINT.CSV de um destino, para conferir sem baixar. */
export function SankhyaLines({
  t,
  rows,
  dest,
}: {
  t: Translate;
  rows: ReturnType<typeof sankhyaRows>;
  dest: string;
}) {
  const num = (n: number) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: 4 });
  return (
    <Card
      title={t("tariff.sheet.sankhyaTitle", { dest, n: String(rows.length) })}
    >
      <p className="mb-3 text-xs text-zinc-500">
        {t("tariff.sheet.sankhyaHint")}
      </p>
      {rows.length ? (
        <details data-sankhya-lines={rows.length}>
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">
            {t("tariff.sheet.sankhyaShow", { n: String(rows.length) })}
          </summary>
          <div className="mt-3">
            <Wide>
              <thead>
                <tr>
                  {[
                    "AD_IDEXTERNO",
                    t("tariff.sheet.company"),
                    "CODPARC",
                    "DTREFERENCIA",
                    "IDDEST",
                    t("tariff.table.origin"),
                    "IDORIG",
                    "VALOR (US$)",
                    "TAXA_USD",
                    "TAXA_BRL",
                  ].map((h) => (
                    <th key={h} className={cx(th, "whitespace-nowrap")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.externalId}-${r.destId}`}>
                    <td
                      className={cx(td, "whitespace-nowrap font-mono text-xs")}
                    >
                      {r.externalId}
                    </td>
                    <td className={cx(td, "whitespace-nowrap")}>
                      {r.forwarder}
                    </td>
                    <td className={cx(td, "tabular-nums")}>{r.code}</td>
                    <td className={cx(td, "whitespace-nowrap tabular-nums")}>
                      {r.date}
                    </td>
                    <td className={cx(td, "tabular-nums")}>{r.destId}</td>
                    <td className={cx(td, "whitespace-nowrap")}>{r.origin}</td>
                    <td className={cx(td, "tabular-nums")}>{r.originId}</td>
                    <td className={cx(td, "tabular-nums")}>{num(r.value)}</td>
                    <td className={cx(td, "tabular-nums")}>{num(r.feesUsd)}</td>
                    <td className={cx(td, "tabular-nums")}>{num(r.feesBrl)}</td>
                  </tr>
                ))}
              </tbody>
            </Wide>
          </div>
        </details>
      ) : (
        <p className="text-sm text-zinc-600">{t("tariff.sheet.sankhyaNone")}</p>
      )}
    </Card>
  );
}
