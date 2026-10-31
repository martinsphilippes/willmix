import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore, type FreightTariff, type Party, type User } from "@/lib/db";
import { getSettings, type Settings } from "@/lib/settings";
import { brazilDay } from "@/lib/supplier-terms";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  PER_CBM_MAX_JUMP,
  comparativeTariff,
  currentFreightTariff,
  getFreightTariff,
  listFreightTariffs,
  perCbmDestination,
  tariffContainerCapacity,
  type ComparativeTariff,
} from "@/lib/services/freight-tariff";
import {
  TARIFF_CONTAINER_TYPE,
  blockOfCompany,
  cheapestByOrigin,
  perCbmSuggestion,
  sankhyaRows,
  tariffCounts,
  type FreightTariffData,
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
  Select,
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
  SankhyaLines,
  TariffSheetView,
} from "@/components/freight-tariff-sheet";
import { errorCode } from "@/app/app/actions/helpers";
import {
  applyTariffPerCbmAction,
  importFreightTariffAction,
} from "../../actions/freight-tariff";

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Avisos só para saber (aparecem em toda planilha do modelo; nada a corrigir nela). */
const INFO_WARNINGS = new Set([
  "sankhya_duplicate_ids",
  "ptax_iof_unused",
  "ptax_iof_added",
  "destination_fixed_id",
  "other_blocks_ignored",
]);
const FROM_ORDER = /^\/app\/orders\/[A-Za-z0-9_-]{1,64}$/;
/** Avisos do CSV do Sankhya (códigos internos da Wellmix): a companhia não vê. */
const SANKHYA_WARNINGS = new Set([
  "forwarder_no_code",
  "line_no_code",
  "port_no_id",
  "port_no_id_similar",
  "sankhya_tab_outdated",
  "sankhya_duplicate_ids",
  "destination_fixed_id",
]);

/** Dia AAAA-MM-DD na tela (meio-dia UTC: o fuso não muda o dia). */
const day = (value: string, t: Translate) =>
  formatDate(`${value}T12:00:00Z`, t);

const brl2 = (n: number, t: Translate) =>
  n.toLocaleString(t.intl, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function errorText(t: Translate, code: string) {
  const key = `tariff.error.${code}` as DictionaryKey;
  return t(key) !== key ? t(key) : fallbackError(t, code);
}

/** "2" ou "1,5 a 2" (faixa de percentuais entre as companhias). */
function percentRange(t: Translate, min: unknown, max: unknown) {
  const fmt = (v: unknown) =>
    (typeof v === "number" ? v : Number(v) || 0).toLocaleString(t.intl, {
      maximumFractionDigits: 3,
    });
  return min === max || max === undefined
    ? fmt(min)
    : t("tariff.range", { min: fmt(min), max: fmt(max) });
}

function warningText(t: Translate, w: TariffWarning) {
  const code = w.code === "ptax_iof_unused" ? "ptax_iof_added" : w.code;
  const key = `tariff.warning.${code}` as DictionaryKey;
  if (t(key) === key) return w.code;
  if (code === "ptax_iof_added")
    return t(key, {
      ptax: percentRange(t, w.params.ptax, w.params.ptaxMax ?? w.params.ptax),
      iof: percentRange(t, w.params.iof, w.params.iofMax ?? w.params.iof),
    });
  const params = Object.fromEntries(
    Object.entries(w.params).map(([k, v]) => [
      k,
      k === "sheet" || k === "otherSheet" || k === "first"
        ? String(v).replace(/^COMPARATIVO\s*-\s*/i, "")
        : typeof v === "number" &&
            (k === "fx" || k === "firstFx" || k === "value")
          ? v.toLocaleString(t.intl, {
              minimumFractionDigits: k === "value" ? 2 : 4,
              maximumFractionDigits: k === "value" ? 2 : 6,
            })
          : typeof v === "number" && k !== "id"
            ? v.toLocaleString(t.intl)
            : String(v),
    ]),
  );
  return t(key, params);
}

/** Nome de quem mandou a planilha: a companhia ou "planilha consolidada". */
function sourceName(t: Translate, company: string | null) {
  return company ?? t("tariff.compare.consolidated");
}

/**
 * Tarifário de frete marítimo. Wellmix: comparativo das planilhas de todas as
 * companhias (menor custo de cada rota, conferência, CSV do Sankhya, frete
 * por m³) e importação em nome de uma companhia. Companhia marítima: envia a
 * própria planilha e vê só as dela.
 */
export default async function FreightTariffPage({
  searchParams,
}: PageProps<"/app/freight/tariff">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/freight/tariff");
  const wellmix = isWellmix(user);
  requireScreen(user, "freightTariff");
  if (user.role === "shipping_line" && !user.partyId) redirect("/app");
  const sp = await searchParams;
  const t = await getT();
  const param = (k: string) => (typeof sp[k] === "string" ? sp[k] : null);
  // "current" (o comparativo) não é um id de planilha.
  const id =
    param("id") && ID.test(param("id")!) && param("id") !== "current"
      ? param("id")
      : null;
  const imported =
    param("imported") && ID.test(param("imported")!) ? param("imported") : null;
  const from =
    param("from") && FROM_ORDER.test(param("from")!) ? param("from") : null;
  const error = param("error");
  const destParam = param("dest");
  // Uma planilha: "como na planilha" (padrão) ou o resumo com PTAX e IOF.
  const view: "sheet" | "summary" =
    param("view") === "summary" ? "summary" : "sheet";
  // Companhia já marcada no formulário da Wellmix (ex.: a do pedido).
  const companyParam =
    param("company") && ID.test(param("company")!) ? param("company") : null;

  let comparative: ComparativeTariff | null = null;
  let mine: FreightTariff | null = null;
  let viewing: FreightTariff | null = null;
  let history: FreightTariff[] = [];
  let loadError: string | null = null;
  try {
    [comparative, mine, history] = await Promise.all([
      wellmix ? comparativeTariff(user) : Promise.resolve(null),
      wellmix ? Promise.resolve(null) : currentFreightTariff(user),
      listFreightTariffs(user),
    ]);
    if (id) viewing = await getFreightTariff(user, id);
    else if (!wellmix)
      viewing = imported ? await getFreightTariff(user, imported) : mine;
  } catch (e) {
    // Tabela ainda não publicada vira "schema_outdated"; o resto, "unexpected".
    loadError = errorCode("/app/freight/tariff", e);
  }
  const store = getStore();
  const [settings, capacity, users, lines] = await Promise.all([
    getSettings(),
    wellmix ? tariffContainerCapacity() : Promise.resolve(null),
    history.length
      ? store.list("users", {
          filter: { id: [...new Set(history.map((h) => h.uploadedByUserId))] },
        })
      : Promise.resolve([] as User[]),
    wellmix
      ? store.list("parties", { filter: { type: "shipping_line" } })
      : Promise.resolve([] as Party[]),
  ]);
  const userName = (uid: string) =>
    users.find((u) => u.id === uid)?.name ?? "—";
  // Companhia marítima: a planilha vai sempre para a dela (o formulário diz qual).
  const ownLine = wellmix
    ? null
    : ((await store.get("parties", user.partyId!))?.name ?? null);
  const companyName = (lineId: string | null | undefined) =>
    lineId ? (lines.find((p) => p.id === lineId)?.name ?? null) : null;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (id) p.set("id", id);
    if (from) p.set("from", from);
    if (view === "summary") p.set("view", view);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const fromQs = from ? `from=${encodeURIComponent(from)}` : "";
  const today = brazilDay(new Date()) ?? undefined;
  const importedRow = imported
    ? (history.find((h) => h.id === imported) ?? null)
    : null;
  const auto = settings.freightPerCbmAuto;
  // Comparativo (Wellmix, sem ?id=) ou uma planilha só.
  const showComparative = wellmix && !id;
  const data: FreightTariffData | null = showComparative
    ? (comparative?.data ?? null)
    : (viewing?.data ?? null);
  const dest: TariffDestination | null =
    data?.destinations.find((d) => d.code === destParam) ??
    data?.destinations[0] ??
    null;

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
      {wellmix && id ? (
        <Link
          href={from ? `?${fromQs}` : "?"}
          className="mb-2 ml-3 inline-block text-sm font-medium text-zinc-500 hover:text-brand-700"
          data-tariff-back-compare=""
        >
          {t("tariff.backToCompare")}
        </Link>
      ) : null}
      <PageHeader
        t={t}
        title={t(wellmix ? "tariff.title" : "tariff.mine.title")}
        subtitle={t(wellmix ? "tariff.subtitle" : "tariff.mine.subtitle")}
        help={
          wellmix
            ? { body: "tariff.help.body", steps: "tariff.help.steps" }
            : { body: "tariff.mine.help.body", steps: "tariff.mine.help.steps" }
        }
      />
      {error ? (
        <Alert tone="danger">
          <span data-tariff-error={error}>{errorText(t, error)}</span>
        </Alert>
      ) : null}
      {loadError && loadError !== error ? (
        <Alert tone="danger">{errorText(t, loadError)}</Alert>
      ) : null}
      {importedRow ? (
        <Alert tone="success">
          <span data-tariff-imported={importedRow.id}>
            {t(wellmix ? "tariff.imported" : "tariff.mine.imported", {
              rates: String(importedRow.rateCount),
              forwarders: String(importedRow.forwarderCount ?? 0),
              source: sourceName(t, companyName(importedRow.shippingLineId)),
            })}
          </span>
          {wellmix && !id ? (
            <>
              {" "}
              <TextLink
                href={`?id=${encodeURIComponent(importedRow.id)}${fromQs ? `&${fromQs}` : ""}`}
              >
                {t("tariff.compare.viewOne")}
              </TextLink>
            </>
          ) : null}
          {wellmix && auto && auto.tariffId === importedRow.id ? (
            <span className="mt-1 block text-xs" data-tariff-auto={auto.status}>
              <AutoText t={t} auto={auto} />
            </span>
          ) : null}
        </Alert>
      ) : null}
      {sp.perCbm === "1" ? (
        <Alert tone="success">{t("tariff.perCbm.applied")}</Alert>
      ) : null}

      <div className="mt-3 space-y-4">
        <ImportCard
          t={t}
          from={from}
          wellmix={wellmix}
          lines={lines}
          today={today}
          company={companyParam}
          ownLine={ownLine}
        />

        {loadError ? null : showComparative ? (
          comparative ? (
            <ComparativeView
              t={t}
              user={user}
              comparative={comparative}
              dest={dest}
              lines={lines}
              settings={settings}
              capacity={capacity}
              from={from}
              qs={qs}
            />
          ) : (
            <Empty>{t("tariff.empty")}</Empty>
          )
        ) : viewing && data ? (
          <SourceView
            t={t}
            row={viewing}
            data={data}
            dest={dest}
            wellmix={wellmix}
            company={companyName(viewing.shippingLineId)}
            current={wellmix ? null : mine}
            from={from}
            qs={qs}
            view={view}
          />
        ) : id ? (
          <Empty>{t("tariff.error.tariff_not_found")}</Empty>
        ) : (
          <Empty>{t("tariff.mine.empty")}</Empty>
        )}

        {history.length ? (
          <Card title={t("tariff.history.title")}>
            <Table>
              <thead>
                <tr>
                  {wellmix ? <Th>{t("tariff.history.company")}</Th> : null}
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
                    data-tariff-history={h.id}
                  >
                    {wellmix ? (
                      <Td>{sourceName(t, companyName(h.shippingLineId))}</Td>
                    ) : null}
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
                          href={`?id=${encodeURIComponent(h.id)}${fromQs ? `&${fromQs}` : ""}`}
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

/**
 * Importar: a planilha vai inteira para a companhia marcada, com qualquer
 * nome no arquivo. A Wellmix escolhe a companhia (já marcada quando vem do
 * pedido); a companhia marítima vê para qual vai (sempre a dela).
 */
function ImportCard({
  t,
  from,
  wellmix,
  lines,
  today,
  company,
  ownLine,
}: {
  t: Translate;
  from: string | null;
  wellmix: boolean;
  lines: Party[];
  today: string | undefined;
  /** Companhia já marcada (Wellmix). */
  company: string | null;
  /** Nome da companhia do usuário (companhia marítima). */
  ownLine: string | null;
}) {
  const options = [...lines]
    .filter((p) => p.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
  const picked =
    company && options.some((p) => p.id === company) ? company : "";
  return (
    <Card
      title={t(wellmix ? "tariff.import.title" : "tariff.mine.importTitle")}
    >
      <p className="mb-3 text-sm text-zinc-600">
        {t(wellmix ? "tariff.import.hint" : "tariff.mine.importHint")}
      </p>
      <form
        action={importFreightTariffAction}
        className="@container"
        data-tariff-import=""
      >
        {from ? <input type="hidden" name="from" value={from} /> : null}
        <div
          className={cx(
            // Alinhados pelo topo: rótulos na mesma linha, caixas na mesma
            // linha; as dicas (de tamanhos diferentes) ficam embaixo.
            "grid items-start gap-3",
            "@lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_auto]",
          )}
        >
          {!wellmix ? (
            <Field
              label={t("tariff.mine.goesTo")}
              hint={t("tariff.mine.goesToHint")}
            >
              <p
                className="flex min-h-8 items-center rounded-md border border-zinc-200 bg-zinc-50 px-2.5 text-[13px] font-semibold text-zinc-900"
                data-tariff-goes-to=""
              >
                {ownLine ?? "—"}
              </p>
            </Field>
          ) : null}
          {wellmix ? (
            <Field
              label={t("tariff.import.company")}
              hint={t("tariff.import.companyHint")}
            >
              <Select
                name="shippingLineId"
                required
                defaultValue={picked}
                data-tariff-company=""
              >
                <option value="" disabled>
                  {t("tariff.import.companyPick")}
                </option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="consolidated">
                  {t("tariff.import.consolidated")}
                </option>
              </Select>
            </Field>
          ) : null}
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
            hint={t(
              wellmix ? "tariff.import.dateHint" : "tariff.mine.dateHint",
            )}
          >
            <Input
              name="referenceDate"
              type="date"
              defaultValue={today}
              required
            />
          </Field>
          {/* Botão na altura das caixas (abaixo da linha dos rótulos). */}
          <div className="@lg:pt-6">
            <SubmitButton>
              {t(wellmix ? "tariff.import.submit" : "tariff.mine.submit")}
            </SubmitButton>
          </div>
        </div>
      </form>
    </Card>
  );
}

/** Lista de avisos (a corrigir em amarelo; só para saber em azul). */
function WarningBoxes({
  t,
  groups,
}: {
  t: Translate;
  /** Avisos por planilha (título null = do comparativo/da planilha vista). */
  groups: { title: string | null; warnings: TariffWarning[] }[];
}) {
  const fix = groups
    .map((g) => ({
      ...g,
      warnings: g.warnings.filter((w) => !INFO_WARNINGS.has(w.code)),
    }))
    .filter((g) => g.warnings.length);
  // Notas iguais em várias planilhas aparecem uma vez.
  // PTAX/IOF de várias planilhas viram uma nota só, com a faixa de todas.
  const seen = new Set<string>();
  const info: TariffWarning[] = [];
  let ptax: TariffWarning | null = null;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  for (const g of groups)
    for (const w of g.warnings) {
      if (!INFO_WARNINGS.has(w.code)) continue;
      if (w.code === "ptax_iof_added" || w.code === "ptax_iof_unused") {
        const p = {
          ptax: num(w.params.ptax),
          ptaxMax: num(w.params.ptaxMax ?? w.params.ptax),
          iof: num(w.params.iof),
          iofMax: num(w.params.iofMax ?? w.params.iof),
        };
        if (!ptax) {
          ptax = { code: "ptax_iof_added", params: p };
          info.push(ptax);
        } else {
          const q = ptax.params as typeof p;
          ptax.params = {
            ptax: Math.min(q.ptax, p.ptax),
            ptaxMax: Math.max(q.ptaxMax, p.ptaxMax),
            iof: Math.min(q.iof, p.iof),
            iofMax: Math.max(q.iofMax, p.iofMax),
          };
        }
        continue;
      }
      // Códigos repetidos no Sankhya: vale o número do comparativo (o 1º grupo).
      const key =
        w.code === "sankhya_duplicate_ids"
          ? w.code
          : `${w.code}|${JSON.stringify(w.params)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      info.push(w);
    }
  const total = fix.reduce((s, g) => s + g.warnings.length, 0);
  return (
    <>
      {total ? (
        <Alert tone="warning">
          <p className="font-semibold">
            {t("tariff.warnings.title", { n: String(total) })}
          </p>
          {fix.map((g, gi) => (
            <div key={gi} className="mt-1">
              {g.title ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide">
                  {g.title}
                </p>
              ) : null}
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {g.warnings.map((w, i) => (
                  <li key={i} data-tariff-warning={w.code}>
                    {warningText(t, w)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Alert>
      ) : (
        <Alert tone="success">{t("tariff.warnings.ok")}</Alert>
      )}
      {info.length ? (
        <Alert tone="info">
          <p className="font-semibold">
            {t("tariff.notes.title", { n: String(info.length) })}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {info.map((w, i) => (
              <li key={i} data-tariff-warning={w.code}>
                {warningText(t, w)}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </>
  );
}

/** Botões dos destinos (NVT, ITJ, IOA), como as abas da planilha. */
function DestinationNav({
  t,
  data,
  dest,
  qs,
}: {
  t: Translate;
  data: FreightTariffData;
  dest: TariffDestination;
  qs: (extra: Record<string, string>) => string;
}) {
  return (
    <nav
      aria-label={t("tariff.dest.label")}
      className="-mt-1 mb-3 flex flex-wrap gap-1.5"
    >
      {data.destinations.map((d) => (
        <Link
          key={d.code}
          href={qs({ dest: d.code })}
          aria-current={d.code === dest.code ? "page" : undefined}
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
    </nav>
  );
}

/** Destinos (NVT, ITJ, IOA) e a tabela de portos × companhias. */
function DestinationCard({
  t,
  data,
  dest,
  qs,
}: {
  t: Translate;
  data: FreightTariffData;
  dest: TariffDestination;
  qs: (extra: Record<string, string>) => string;
}) {
  return (
    <Card title={t("tariff.dest.label")}>
      <DestinationNav t={t} data={data} dest={dest} qs={qs} />
      <RatesTable t={t} dest={dest} />
    </Card>
  );
}

/** Comparativo de todas as companhias (Wellmix). */
function ComparativeView({
  t,
  user,
  comparative,
  dest,
  lines,
  settings,
  capacity,
  from,
  qs,
}: {
  t: Translate;
  user: User;
  comparative: ComparativeTariff;
  dest: TariffDestination | null;
  lines: Party[];
  settings: Settings;
  capacity: number | null;
  from: string | null;
  qs: (extra: Record<string, string>) => string;
}) {
  const { data, sources } = comparative;
  const counts = tariffCounts(data);
  const fromQs = from ? `&from=${encodeURIComponent(from)}` : "";
  // Companhias do cadastro que ainda não mandaram a própria tabela.
  const sent = new Set(
    sources.map((s) => s.row.shippingLineId).filter(Boolean) as string[],
  );
  const missing = lines
    .filter((p) => p.active !== false && !sent.has(p.id))
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b));
  const autoDest = perCbmDestination(data, settings.freightTariffDestination);
  // Código ou ID que faltava numa planilha e o comparativo achou em outra:
  // o aviso dela não vale mais aqui.
  const noCode = new Set<string>();
  const noId = new Set<string>();
  for (const d of data.destinations) {
    if (d.portId === null) noId.add(d.name);
    for (const f of d.forwarders) if (!f.code) noCode.add(f.name);
    for (const o of d.origins) if (o.portId === null) noId.add(o.name);
  }
  const stillMissing = (w: TariffWarning) =>
    w.code === "forwarder_no_code"
      ? noCode.has(String(w.params.forwarder))
      : w.code === "port_no_id" || w.code === "port_no_id_similar"
        ? noId.has(String(w.params.port))
        : true;
  // Avisos de cada planilha no comparativo. Na de uma companhia, o código
  // que falta é o dela (aviso do comparativo), não o da aba FORNECEDORES.
  const sourceWarnings = (row: FreightTariff) =>
    (row.data.warnings ?? []).filter(
      (w) =>
        stillMissing(w) &&
        !(row.shippingLineId && w.code === "forwarder_no_code"),
    );
  const suggestion =
    dest && capacity ? perCbmSuggestion(data, dest.code, capacity) : null;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("tariff.stat.updated")}
          value={day(comparative.referenceDate, t)}
        />
        <Stat
          label={t("tariff.stat.fxCompare")}
          value={
            <span data-tariff-fx-source={data.fxSource ?? "sheet"}>
              R${" "}
              {(dest?.fx ?? data.fx).toLocaleString(t.intl, {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
              })}
              <span className="block text-xs font-normal text-zinc-500">
                {data.fxSource === "portal"
                  ? t("tariff.stat.fxPortalDetail", {
                      date: comparative.fxDay ? day(comparative.fxDay, t) : "—",
                    })
                  : t("tariff.stat.fxSheetDetail")}
              </span>
            </span>
          }
        />
        <Stat
          label={t("tariff.stat.road")}
          value={
            <span>
              {formatMoney(
                dest?.roadFreightBrl ?? data.roadFreightBrl,
                "BRL",
                t,
              )}
              <span className="block text-xs font-normal text-zinc-500">
                {t("tariff.stat.roadDetail", { dest: dest?.name ?? "" })}
              </span>
            </span>
          }
        />
        <Stat
          label={t("tariff.stat.rates")}
          value={
            <span>
              {counts.rates}
              <span className="block text-xs font-normal text-zinc-500">
                {t("tariff.stat.ratesDetail", {
                  forwarders: String(counts.forwarders),
                  destinations: String(counts.destinations),
                })}
              </span>
            </span>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href="/api/freight-tariff/current/sankhya"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          data-tariff-csv=""
        >
          {t("tariff.download")}
        </a>
        <p className="w-full text-xs text-zinc-500">
          {t("tariff.compare.downloadHint")}
        </p>
      </div>

      <Card title={t("tariff.compare.sources")}>
        <Table>
          <thead>
            <tr>
              <Th>{t("tariff.history.company")}</Th>
              <Th>{t("tariff.history.date")}</Th>
              <Th>{t("tariff.history.rates")}</Th>
              <Th>{t("tariff.compare.warnings")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {sources.map(({ row, company }) => (
              <tr key={row.id} className={rowClass} data-tariff-source={row.id}>
                <Td className="font-medium text-zinc-900">
                  {sourceName(t, company)}
                </Td>
                <Td>{day(row.referenceDate, t)}</Td>
                <Td className="tabular-nums">{row.rateCount}</Td>
                <Td className="tabular-nums">
                  {
                    sourceWarnings(row).filter(
                      (w) => !INFO_WARNINGS.has(w.code),
                    ).length
                  }
                </Td>
                <Td>
                  <TextLink href={`?id=${encodeURIComponent(row.id)}${fromQs}`}>
                    {t("tariff.compare.viewSheet")}
                  </TextLink>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {missing.length ? (
          <p className="mt-3 text-xs text-zinc-600" data-tariff-missing="">
            {t("tariff.compare.missing", { names: missing.join(", ") })}
          </p>
        ) : null}
      </Card>

      <WarningBoxes
        t={t}
        groups={[
          { title: null, warnings: data.warnings },
          ...sources.map(({ row, company }) => ({
            title: t("tariff.compare.sourceHeading", {
              source: sourceName(t, company),
              date: day(row.referenceDate, t),
            }),
            warnings: sourceWarnings(row),
          })),
        ]}
      />

      {dest ? <DestinationCard t={t} data={data} dest={dest} qs={qs} /> : null}
      {dest ? <FeesTable t={t} dest={dest} /> : null}
      {dest ? (
        <SankhyaLines
          t={t}
          rows={sankhyaRows(data, comparative.referenceDate).filter(
            (r) => r.destinationCode === dest.code,
          )}
          dest={dest.name}
        />
      ) : null}

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
                  container: brl2(suggestion.containerBrl, t),
                  capacity: String(capacity),
                  type: TARIFF_CONTAINER_TYPE,
                  perCbm: brl2(suggestion.perCbm, t),
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
              <p className="text-xs text-zinc-500" data-tariff-auto-rule="">
                {t("tariff.perCbm.auto", {
                  dest:
                    data.destinations.find((d) => d.code === autoDest)?.name ??
                    autoDest ??
                    "—",
                  max: String(PER_CBM_MAX_JUMP * 100),
                })}{" "}
                {settings.freightPerCbmAuto ? (
                  <AutoText t={t} auto={settings.freightPerCbmAuto} />
                ) : null}
              </p>
              {user.role === "admin" ? (
                <form action={applyTariffPerCbmAction} className="space-y-1">
                  <input type="hidden" name="tariffId" value="current" />
                  <input type="hidden" name="destination" value={dest.code} />
                  {from ? (
                    <input type="hidden" name="from" value={from} />
                  ) : null}
                  <SubmitButton variant="secondary" data-tariff-apply-cbm="">
                    {t("tariff.perCbm.apply", {
                      perCbm: brl2(suggestion.perCbm, t),
                      dest: dest.name,
                    })}
                  </SubmitButton>
                  <p className="text-xs text-zinc-500">
                    {t("tariff.perCbm.applyHint")}
                  </p>
                </form>
              ) : (
                <p className="text-xs text-zinc-500">
                  {t("tariff.perCbm.applyHintOperator")}
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
  );
}

/** Situação da última atualização automática do frete por m³. */
function AutoText({
  t,
  auto,
}: {
  t: Translate;
  auto: NonNullable<Settings["freightPerCbmAuto"]>;
}) {
  const date = formatDate(auto.at, t);
  if (auto.status === "applied" && auto.perCbm !== null)
    return (
      <>
        {t("tariff.perCbm.autoApplied", { date, perCbm: brl2(auto.perCbm, t) })}
      </>
    );
  if (auto.status === "held" && auto.perCbm !== null)
    return (
      <>
        {t("tariff.perCbm.autoHeld", {
          date,
          perCbm: brl2(auto.perCbm, t),
          previous:
            auto.previous !== null
              ? `${auto.previousCurrency ?? "BRL"} ${brl2(auto.previous, t)}`
              : "—",
        })}
      </>
    );
  return (
    <>
      {t(
        auto.reason === "no_capacity"
          ? "tariff.perCbm.autoSkipped.no_capacity"
          : "tariff.perCbm.autoSkipped.no_rates",
        { date },
      )}
    </>
  );
}

/** Uma planilha só (a de uma companhia, a consolidada ou uma antiga). */
function SourceView({
  t,
  row,
  data,
  dest,
  wellmix,
  company,
  current,
  from,
  qs,
  view,
}: {
  t: Translate;
  row: FreightTariff;
  data: FreightTariffData;
  dest: TariffDestination | null;
  wellmix: boolean;
  company: string | null;
  /** Companhia: a planilha vigente dela (para avisar quando vê uma antiga). */
  current: FreightTariff | null;
  from: string | null;
  qs: (extra: Record<string, string>) => string;
  view: "sheet" | "summary";
}) {
  const counts = tariffCounts(data);
  return (
    <>
      {wellmix ? (
        <Alert tone="info">
          <span data-tariff-viewing={row.id}>
            {t("tariff.viewingSource", {
              source: sourceName(t, company),
              date: day(row.referenceDate, t),
            })}
          </span>
        </Alert>
      ) : current && current.id !== row.id ? (
        <Alert tone="info">
          {t("tariff.viewingOld", { date: day(row.referenceDate, t) })}{" "}
          <TextLink href={from ? `?from=${encodeURIComponent(from)}` : "?"}>
            {t("tariff.viewCurrent")}
          </TextLink>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("tariff.stat.date")}
          value={
            <span className="flex flex-wrap items-center gap-2">
              {day(row.referenceDate, t)}
              <Badge tone={row.status === "active" ? "success" : "neutral"}>
                {t(`tariff.status.${row.status}` as DictionaryKey)}
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
              {(dest?.fx ?? data.fx).toLocaleString(t.intl, {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
              })}
              {data.fxBase !== null && (!dest || dest.fx === data.fx) ? (
                <span className="block text-xs font-normal text-zinc-500">
                  {t("tariff.stat.fxDetail", {
                    base: data.fxBase.toLocaleString(t.intl, {
                      maximumFractionDigits: 4,
                    }),
                    spread: (data.fxSpread ?? 0).toLocaleString(t.intl, {
                      maximumFractionDigits: 4,
                    }),
                    dest: dest?.name ?? "",
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
              {formatMoney(
                dest?.roadFreightBrl ?? data.roadFreightBrl,
                "BRL",
                t,
              )}
              <span className="block text-xs font-normal text-zinc-500">
                {t("tariff.stat.roadDetail", { dest: dest?.name ?? "" })}
              </span>
            </span>
          }
        />
        <Stat
          label={t("tariff.stat.rates")}
          value={
            <span>
              {counts.rates}
              <span className="block text-xs font-normal text-zinc-500">
                {t("tariff.stat.ratesDetail", {
                  forwarders: String(counts.forwarders),
                  destinations: String(counts.destinations),
                })}
              </span>
            </span>
          }
        />
      </div>

      {wellmix ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={`/api/freight-tariff/${encodeURIComponent(row.id)}/sankhya`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            data-tariff-csv=""
          >
            {t("tariff.download")}
          </a>
          {row.fileDocumentId ? (
            <a
              href={`/api/files/${encodeURIComponent(row.fileDocumentId)}`}
              className={cx(linkClass, "text-sm")}
            >
              {t("tariff.original")}
            </a>
          ) : null}
          <p className="w-full text-xs text-zinc-500">
            {t("tariff.downloadHint")}
          </p>
        </div>
      ) : null}

      <WarningBoxes
        t={t}
        groups={[
          {
            title: null,
            warnings: wellmix
              ? data.warnings
              : data.warnings.filter((w) => !SANKHYA_WARNINGS.has(w.code)),
          },
        ]}
      />

      {dest ? (
        <nav
          aria-label={t("tariff.view.sheet")}
          className="flex flex-wrap gap-1.5"
          data-tariff-view={view}
        >
          {(["sheet", "summary"] as const).map((v) => (
            <Link
              key={v}
              href={qs({ dest: dest.code, view: v })}
              aria-current={v === view ? "page" : undefined}
              className={cx(
                "rounded-xl border px-3 py-1.5 text-sm font-semibold transition",
                v === view
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-brand-400",
              )}
            >
              {t(`tariff.view.${v}`)}
            </Link>
          ))}
        </nav>
      ) : null}
      {dest && view === "sheet" ? (
        <>
          <Card title={t("tariff.dest.label")}>
            <DestinationNav t={t} data={data} dest={dest} qs={qs} />
          </Card>
          <TariffSheetView
            t={t}
            data={data}
            dest={dest}
            referenceDate={row.referenceDate}
            wellmix={wellmix}
          />
        </>
      ) : null}
      {dest && view === "summary" ? (
        <DestinationCard t={t} data={data} dest={dest} qs={qs} />
      ) : null}
      {dest && view === "summary" ? <FeesTable t={t} dest={dest} /> : null}
    </>
  );
}

/** Nome da companhia embaixo do bloco, quando o bloco não diz qual é. */
function companyLine(f: { name: string; company?: string | null }) {
  return f.company && !blockOfCompany(f.name, f.company) ? f.company : null;
}

/** Portos × companhias de um destino, com o menor custo de cada porto em verde. */
function RatesTable({ t, dest }: { t: Translate; dest: TariffDestination }) {
  const containerQty = dest.containerQty;
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
        {containerQty > 1
          ? t("tariff.table.captionShipment", {
              type: `${containerQty} × 40HQ`,
            })
          : t("tariff.table.caption", { type: "40HQ" })}
      </p>
      <Table>
        <thead>
          <tr>
            <Th>{t("tariff.table.origin")}</Th>
            {withRates.map(({ f, i }) => (
              <Th key={i}>
                <span className="block">{f.name}</span>
                {companyLine(f) ? (
                  <span className="block text-[11px] font-normal normal-case text-zinc-600">
                    {companyLine(f)}
                  </span>
                ) : null}
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

/** Taxas de cada companhia no destino (US$ e R$), PTAX/IOF e os totais. */
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
  const pct = (v: number | null) =>
    v === null
      ? "—"
      : `${(v * 100).toLocaleString(t.intl, { maximumFractionDigits: 3 })}%`;
  return (
    <Card title={t("tariff.fees.title")}>
      <Table>
        <thead>
          <tr>
            <Th>{t("tariff.fees.fee")}</Th>
            {cols.map(({ f, i }) => (
              <Th key={i}>
                <span className="block">{f.name}</span>
                {companyLine(f) ? (
                  <span className="block text-[11px] font-normal normal-case text-zinc-600">
                    {companyLine(f)}
                  </span>
                ) : null}
              </Th>
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
              {t("tariff.fees.ptaxIof")}
            </Td>
            {cols.map(({ f, i }) => (
              <Td key={i} className="tabular-nums" data-tariff-ptax={f.name}>
                {pct(f.ptaxPercent)} / {pct(f.iofPercent)}
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
