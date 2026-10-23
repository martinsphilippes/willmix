import "server-only";

import {
  getStore,
  type FreightTariff,
  type Order,
  type Party,
  type User,
} from "@/lib/db";
import {
  ForbiddenError,
  assertRole,
  assertWellmix,
  isWellmix,
} from "@/lib/auth/permissions";
import {
  getSettings,
  setSetting,
  type FreightPerCbmAuto,
} from "@/lib/settings";
import { brazilDay } from "@/lib/supplier-terms";
import { audit } from "./audit";
import { uploadDocument } from "./documents";
import { notifyWellmix } from "./notifications";
import { openWorkbook } from "./xlsx";
import {
  TARIFF_CONTAINER_TYPE,
  TariffError,
  blocksWithRates,
  comparativeSources,
  destinationCode,
  foldName,
  matchOrigin,
  mergeTariffs,
  normalizeTariffData,
  optionsForOrigin,
  originsWithRates,
  ownerOfBlock,
  parseFreightTariff,
  perCbmSuggestion,
  tariffCounts,
  wellmixCodes,
  withCompanyCodes,
  type FreightTariffData,
  type RegisteredLine,
  type TariffOption,
  type TariffParseOptions,
  type TariffSheet,
  type TariffSource,
} from "./freight-tariff-calc";

/*
 * Tarifário de frete marítimo. Cada companhia marítima envia a própria
 * planilha "ESTIMATIVA DE FRETE" (ou a Wellmix importa em nome dela, ou a
 * planilha consolidada com várias companhias). O portal guarda cada uma, junta
 * as vigentes num comparativo (menor custo de cada rota, com o mesmo câmbio
 * para todas), gera o AD_FREINT.CSV do Sankhya (o que a macro fazia) e
 * atualiza o frete por m³ do preço a cada planilha importada.
 *
 * Quem vê o quê: a Wellmix vê tudo; a companhia vê só as próprias planilhas;
 * fornecedor e cliente não veem nada.
 */

/** Teto do arquivo (a planilha modelo tem ~130 KB). */
export const MAX_TARIFF_BYTES = 4_000_000;
/**
 * Variação máxima do frete por m³ aplicada sozinha (30%). Acima disso fica
 * esperando o admin conferir: protege o preço de planilha com erro de digitação.
 */
export const PER_CBM_MAX_JUMP = 0.3;

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLSM_MIME = "application/vnd.ms-excel.sheet.macroenabled.12";

/** Abas lidas: os comparativos por destino e as tabelas de códigos do Sankhya. */
const SUPPORT_SHEETS = ["FORNECEDORES", "PORTOS", "AD_FREINT"];
/** Tetos da leitura (a planilha modelo usa uma fração disto). */
const MAX_DESTINATION_SHEETS = 12;
const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;
const MAX_SHEET_XML_BYTES = 8 * 1024 * 1024;
/** Colunas lidas: o bloco de 4 colunas de até 20 companhias e as taxas ao lado. */
const MAX_COLUMNS = 100;
/** Destino padrão do frete por m³ (Navegantes). */
const DEFAULT_PER_CBM_DESTINATION = "NVT";

function assertSpreadsheet(bytes: Uint8Array, fileName: string) {
  // Formato binário (OLE): .xls antigo ou .xlsx/.xlsm protegido por senha.
  if (
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  )
    throw new TariffError(
      /\.xls[xm]$/i.test(fileName) ? "tariff_encrypted" : "tariff_xls",
    );
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b))
    throw new TariffError("tariff_invalid");
}

/**
 * Lê as abas que interessam da planilha (o resto, como macros, é ignorado):
 * o arquivo é aberto uma vez e só as partes usadas são descompactadas.
 */
export function readTariffWorkbook(
  bytes: Uint8Array,
  fileName = "",
  options: TariffParseOptions = {},
) {
  assertSpreadsheet(bytes, fileName);
  const fail = (error: unknown): never => {
    throw new TariffError(
      error instanceof Error && error.message === "xlsx_too_large"
        ? "tariff_too_large"
        : "tariff_invalid",
    );
  };
  let workbook: ReturnType<typeof openWorkbook>;
  let names: string[] = [];
  try {
    workbook = openWorkbook(bytes, { maxTotalBytes: MAX_UNZIPPED_BYTES });
    names = workbook.sheetNames();
  } catch (error) {
    return fail(error);
  }
  const destinations = [
    ...new Set(names.filter((n) => destinationCode(n) !== null)),
  ].slice(0, MAX_DESTINATION_SHEETS);
  const support = [
    ...new Set(
      names.filter((n) => SUPPORT_SHEETS.includes(n.trim().toUpperCase())),
    ),
  ].slice(0, SUPPORT_SHEETS.length);
  const sheets: TariffSheet[] = [];
  for (const name of [...destinations, ...support]) {
    try {
      sheets.push(
        workbook!.readCells(name, {
          maxCols: MAX_COLUMNS,
          maxXmlBytes: MAX_SHEET_XML_BYTES,
        }),
      );
    } catch (error) {
      fail(error);
    }
  }
  // Mesma ordem do arquivo (a 1ª aba de destino dá o câmbio de referência).
  sheets.sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name));
  return parseFreightTariff(sheets, options);
}

/** Companhia do registro (os gravados antes do campo são da planilha consolidada). */
const lineOf = (row: Pick<FreightTariff, "shippingLineId">) =>
  row.shippingLineId ?? null;

/** Quem pode ver uma planilha: a Wellmix, ou a companhia dona dela. */
export function canViewTariff(
  user: User,
  row: Pick<FreightTariff, "shippingLineId">,
): boolean {
  if (isWellmix(user)) return true;
  return (
    user.role === "shipping_line" &&
    !!user.partyId &&
    lineOf(row) === user.partyId
  );
}

/** Companhia marítima do cadastro (ou erro, se o id não é de uma). */
async function shippingLine(id: string): Promise<Party> {
  const party = await getStore().get("parties", id);
  if (!party || party.type !== "shipping_line")
    throw new TariffError("tariff_company_invalid");
  return party;
}

/**
 * Importa a planilha: lê, confere, guarda o original (documento interno) e
 * passa a ser a vigente daquela companhia (a anterior dela fica no
 * histórico). A companhia marítima importa a própria; a Wellmix escolhe a
 * companhia ou a planilha consolidada (`shippingLineId` vazio). A planilha é
 * inteira da companhia escolhida, com qualquer nome nos blocos.
 */
export async function importFreightTariff(
  user: User,
  file: File,
  referenceDate: string | null,
  shippingLineId: string | null = null,
): Promise<FreightTariff> {
  let lineId: string | null;
  if (isWellmix(user)) lineId = shippingLineId || null;
  else if (user.role === "shipping_line" && user.partyId) lineId = user.partyId;
  else throw new ForbiddenError();
  const company = lineId ? await shippingLine(lineId) : null;
  if (!file || file.size === 0) throw new TariffError("tariff_file_required");
  if (file.size > MAX_TARIFF_BYTES) throw new TariffError("tariff_too_large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = (file.name || "tarifario.xlsx").slice(0, 200);
  // Bloco sem nome na planilha de uma companhia é dela.
  const data = readTariffWorkbook(bytes, name, {
    fallbackName: company?.name ?? null,
  });
  const store = getStore();
  // Só a planilha anterior da mesma companhia (ou a consolidada anterior)
  // sai de vigência.
  const previous = (
    await store.list("freight_tariffs", { filter: { status: "active" } })
  ).filter((p) => lineOf(p) === lineId);
  // A planilha vai para a companhia escolhida (a companhia marítima: sempre
  // a própria), com qualquer nome nos blocos. Com mais de um bloco, todos
  // entram como preços dela, com um aviso para conferir. Nome de bloco nunca
  // tira nem imita outra companhia no comparativo (só o nome do cadastro).
  if (company) {
    const blocks = blocksWithRates(data);
    if (blocks.length > 1)
      data.warnings.push({
        code: "several_blocks",
        params: {
          company: company.name,
          n: blocks.length,
          blocks: blocks.join(", "),
        },
      });
  }
  const day = referenceDate ?? brazilDay(new Date());
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new TariffError("tariff_date_invalid");
  const counts = tariffCounts(data);

  // Primeiro o banco (se a tabela falhar, nenhum arquivo fica órfão); depois
  // o original, guardado para conferência.
  let row = await store.create("freight_tariffs", {
    referenceDate: day,
    fileName: name,
    fileDocumentId: null,
    status: "active",
    fx: data.fx,
    roadFreightBrl: data.roadFreightBrl,
    rateCount: counts.rates,
    forwarderCount: counts.forwarders,
    warningCount: data.warnings.length,
    data,
    uploadedByUserId: user.id,
    shippingLineId: lineId,
  });
  // Tipo do arquivo normalizado: o navegador manda "macroEnabled" com maiúscula.
  const mime = /\.xlsm$/i.test(name) ? XLSM_MIME : XLSX_MIME;
  const doc = await uploadDocument(
    user,
    new File([bytes], name, { type: mime }),
    { type: "attachment", visibility: "internal" },
  ).catch(() => null);
  if (doc)
    row = await store.update("freight_tariffs", row.id, {
      fileDocumentId: doc.id,
    });
  for (const p of previous)
    await store.update("freight_tariffs", p.id, { status: "replaced" });
  const who = company ? company.name : "planilha consolidada";
  await audit(
    user,
    "freight_tariff.import",
    "freight_tariff",
    row.id,
    `Tarifário de frete importado (${who}, ${name}): ${counts.rates} tarifa(s) de ${counts.forwarders} companhia(s), ${data.warnings.length} aviso(s)`,
  );
  // A companhia mandou a tabela dela: a Wellmix fica sabendo.
  if (!isWellmix(user) && company)
    await notifyWellmix({
      subject: `Tabela de frete nova: ${company.name}`,
      body: `${counts.rates} tarifa(s) com referência de ${day}${data.warnings.length ? `; ${data.warnings.length} aviso(s) na conferência` : ""}. O comparativo e o frete por m³ já usam a tabela nova.`,
      link: `/app/freight/tariff?id=${encodeURIComponent(row.id)}`,
    }).catch(() => null);
  // Frete por m³ do preço refeito com a tabela nova (nunca derruba a importação).
  await refreshPerCbm(row.id).catch((error) =>
    console.error("[freight-tariff] frete por m³ não atualizado", error),
  );
  return row;
}

/** Linha lida do banco com os dados completos (tarifários gravados antes também). */
function normalized(row: FreightTariff | null): FreightTariff | null {
  if (row?.data) normalizeTariffData(row.data);
  return row;
}

/**
 * Planilha vigente da companhia do usuário (companhia marítima) ou a mais
 * nova de todas (Wellmix).
 */
export async function currentFreightTariff(
  user: User,
): Promise<FreightTariff | null> {
  if (!isWellmix(user) && user.role !== "shipping_line")
    throw new ForbiddenError();
  const rows = await getStore().list("freight_tariffs", {
    filter: isWellmix(user)
      ? { status: "active" }
      : { status: "active", shippingLineId: user.partyId ?? "-" },
    orderBy: "createdAt",
    direction: "desc",
  });
  return normalized(rows.find((r) => canViewTariff(user, r)) ?? null);
}

export async function getFreightTariff(
  user: User,
  id: string,
): Promise<FreightTariff | null> {
  if (!isWellmix(user) && user.role !== "shipping_line")
    throw new ForbiddenError();
  const row = await getStore().get("freight_tariffs", id);
  if (!row || !canViewTariff(user, row)) return null;
  const tariff = normalized(row)!;
  // Wellmix vê os códigos do Sankhya da companhia (os do comparativo).
  return isWellmix(user) ? withSankhyaCodes(tariff) : tariff;
}

/** Histórico de importações (mais novas primeiro): todas (Wellmix) ou as da companhia. */
export async function listFreightTariffs(user: User, limit = 30) {
  if (!isWellmix(user) && user.role !== "shipping_line")
    throw new ForbiddenError();
  const rows = await getStore().list("freight_tariffs", {
    filter: isWellmix(user)
      ? undefined
      : { shippingLineId: user.partyId ?? "-" },
    orderBy: "createdAt",
    direction: "desc",
    limit,
  });
  return rows.filter((r) => canViewTariff(user, r));
}

/** Uma planilha vigente no comparativo, com o nome da companhia. */
export interface TariffSourceView {
  row: FreightTariff;
  company: string | null;
}

export interface ComparativeTariff {
  data: FreightTariffData;
  sources: TariffSourceView[];
  /** Data de referência da planilha mais nova. */
  referenceDate: string;
  /** Dia do dólar do portal usado (null = câmbio da planilha). */
  fxDay: string | null;
}

/** Dólar do dia do portal (PTAX), se houver; nunca derruba a tela. */
async function portalUsd(): Promise<{
  rate: number;
  day: string | null;
} | null> {
  try {
    const { getFxRates } = await import("./fx");
    const view = await getFxRates();
    const rate = view.rates.USD;
    return view.status !== "none" && typeof rate === "number" && rate > 0
      ? { rate, day: view.day }
      : null;
  } catch {
    return null;
  }
}

/** R$ por unidade da moeda pelo câmbio do portal (null se não houver). */
async function rateToBrl(currency: string): Promise<number | null> {
  try {
    const { getFxRates } = await import("./fx");
    const view = await getFxRates();
    const rate = (view.rates as Record<string, number | undefined>)[currency];
    return view.status !== "none" && typeof rate === "number" && rate > 0
      ? rate
      : null;
  } catch {
    return null;
  }
}

/** Todas as companhias marítimas do cadastro (dono de bloco pelo nome). */
async function registeredLines(): Promise<RegisteredLine[]> {
  const parties = await getStore().list("parties", {
    filter: { type: "shipping_line" },
  });
  return parties.map((p) => ({
    id: p.id,
    name: p.name,
    active: p.active !== false,
  }));
}

/** Importada pela Wellmix (o código escrito nela vale para o Sankhya)? */
function byWellmixOf(row: FreightTariff, users: User[]): boolean {
  return isWellmix(
    users.find((u) => u.id === row.uploadedByUserId) ?? { role: "customer" },
  );
}

/** Planilhas vigentes como fontes do comparativo, com as companhias do cadastro. */
async function activeSources(): Promise<{
  rows: FreightTariff[];
  lines: RegisteredLine[];
  users: User[];
  sources: TariffSource[];
}> {
  const store = getStore();
  const rows = (
    await store.list("freight_tariffs", { filter: { status: "active" } })
  ).map((r) => normalized(r)!);
  const [lines, users] = await Promise.all([
    registeredLines(),
    rows.length
      ? store.list("users", {
          filter: { id: [...new Set(rows.map((r) => r.uploadedByUserId))] },
        })
      : Promise.resolve([] as User[]),
  ]);
  const company = (id: string | null) =>
    id ? (lines.find((p) => p.id === id)?.name ?? null) : null;
  const sources = rows.map((row) => ({
    id: row.id,
    referenceDate: row.referenceDate,
    createdAt: row.createdAt,
    shippingLineId: lineOf(row),
    company: company(lineOf(row)),
    byWellmix: byWellmixOf(row, users),
    data: row.data,
  }));
  return { rows, lines, users, sources };
}

/** Comparativo das planilhas vigentes (sem checar papel: uso interno). */
async function buildComparative(): Promise<ComparativeTariff | null> {
  const [{ rows, lines, sources }, fx] = await Promise.all([
    activeSources(),
    portalUsd(),
  ]);
  if (!rows.length) return null;
  const data = mergeTariffs(sources, { fx: fx?.rate ?? null, lines });
  if (!data) return null;
  // Só as planilhas que entraram no comparativo (a mais nova de cada companhia).
  const used = new Set<string>();
  for (const d of data.destinations)
    for (const f of d.forwarders) if (f.tariffId) used.add(f.tariffId);
  const inUse = rows
    .filter((row) => used.has(row.id))
    .map((row) => ({
      row,
      company: sources.find((s) => s.id === row.id)?.company ?? null,
    }))
    .sort((a, b) => b.row.createdAt.localeCompare(a.row.createdAt));
  return {
    data,
    sources: inUse,
    referenceDate: inUse
      .map((s) => s.row.referenceDate)
      .sort()
      .at(-1)!,
    fxDay: data.fxSource === "portal" ? (fx?.day ?? null) : null,
  };
}

/**
 * Planilha de uma companhia com os códigos do Sankhya dela (os mesmos do
 * comparativo): para a Wellmix ver a planilha e baixar o CSV dela. A
 * consolidada fica como está.
 */
async function withSankhyaCodes(row: FreightTariff): Promise<FreightTariff> {
  if (!lineOf(row)) return row;
  const { lines, sources } = await activeSources();
  const users = await getStore().list("users", {
    filter: { id: [row.uploadedByUserId] },
  });
  const lineId = lineOf(row);
  return {
    ...row,
    data: withCompanyCodes(
      row.data,
      {
        shippingLineId: lineId,
        byWellmix: byWellmixOf(row, users),
        company: lines.find((l) => l.id === lineId)?.name ?? null,
      },
      lines,
      // Mesma ordem do comparativo (os mesmos códigos nas duas telas).
      wellmixCodes(comparativeSources(sources), lines),
    ),
  };
}

/** Comparativo de todas as companhias (só a Wellmix: tem as tarifas de todas). */
export async function comparativeTariff(
  user: User,
): Promise<ComparativeTariff | null> {
  assertWellmix(user);
  return buildComparative();
}

/** Capacidade útil do container das tarifas (40HC nas Configurações). */
export async function tariffContainerCapacity(): Promise<number | null> {
  const { containerTypes } = await getSettings();
  return (
    containerTypes.find((c) => c.code === TARIFF_CONTAINER_TYPE)?.capacityCbm ??
    null
  );
}

/** Destino do frete por m³: o escolhido pelo admin, Navegantes ou o 1º. */
export function perCbmDestination(
  data: FreightTariffData,
  chosen: string | null | undefined,
): string | null {
  const has = (code: string | null | undefined) =>
    !!code && data.destinations.some((d) => d.code === code);
  if (has(chosen)) return chosen!;
  if (has(DEFAULT_PER_CBM_DESTINATION)) return DEFAULT_PER_CBM_DESTINATION;
  return data.destinations[0]?.code ?? null;
}

/**
 * Usa o tarifário no frete por m³ das Configurações (o que entra no preço
 * quando a companhia ainda não informou o frete do produto) e guarda o
 * destino para as próximas atualizações automáticas. `tariffId` "current" =
 * o comparativo. Só o admin, como as demais Configurações.
 */
export async function applyTariffPerCbm(
  user: User,
  tariffId: string,
  destination: string,
): Promise<number> {
  assertRole(user, ["admin"]);
  let data: FreightTariffData | null;
  let label: string;
  if (tariffId === "current") {
    const comparative = await buildComparative();
    data = comparative?.data ?? null;
    label = `comparativo de ${comparative?.referenceDate ?? "—"}`;
  } else {
    const tariff = normalized(
      await getStore().get("freight_tariffs", tariffId),
    );
    data = tariff?.data ?? null;
    label = `tarifário de ${tariff?.referenceDate ?? "—"}`;
  }
  if (!data) throw new TariffError("tariff_not_found");
  const capacity = await tariffContainerCapacity();
  const suggestion = capacity
    ? perCbmSuggestion(data, destination, capacity)
    : null;
  if (
    !suggestion ||
    !Number.isFinite(suggestion.perCbm) ||
    !(suggestion.perCbm > 0)
  )
    throw new TariffError("tariff_no_suggestion");
  const before = await getSettings();
  await setSetting("freightPerCbm", suggestion.perCbm);
  await setSetting("freightCurrency", "BRL");
  await setSetting("freightTariffDestination", destination);
  // Aplicado à mão: o "esperando conferência" da atualização automática acabou.
  if (before.freightPerCbmAuto?.status === "held")
    await setSetting("freightPerCbmAuto", null);
  await audit(
    user,
    "settings.update",
    "settings",
    "freightPerCbm",
    `Frete por m³ pelo ${label} (${destination}): R$ ${suggestion.perCbm}`,
    {
      freightPerCbm: before.freightPerCbm,
      freightCurrency: before.freightCurrency,
      freightTariffDestination: before.freightTariffDestination,
    },
    {
      freightPerCbm: suggestion.perCbm,
      freightCurrency: "BRL",
      freightTariffDestination: destination,
    },
  );
  return suggestion.perCbm;
}

/**
 * Refaz o frete por m³ com o comparativo depois de cada planilha importada.
 * Aplica sozinho, a não ser que a variação passe de 30% do valor atual: aí
 * guarda o cálculo e avisa a Wellmix (o admin confere e aplica no tarifário).
 */
export async function refreshPerCbm(
  tariffId: string,
): Promise<FreightPerCbmAuto> {
  const settings = await getSettings();
  const comparative = await buildComparative();
  const capacity = await tariffContainerCapacity();
  const destination = comparative
    ? perCbmDestination(comparative.data, settings.freightTariffDestination)
    : null;
  const suggestion =
    comparative && destination && capacity
      ? perCbmSuggestion(comparative.data, destination, capacity)
      : null;
  const previous =
    settings.freightPerCbm !== null && Number.isFinite(settings.freightPerCbm)
      ? settings.freightPerCbm
      : null;
  const base: Omit<FreightPerCbmAuto, "status" | "reason"> = {
    at: new Date().toISOString(),
    destination,
    perCbm: suggestion?.perCbm ?? null,
    previous,
    previousCurrency: previous !== null ? settings.freightCurrency : null,
    tariffId,
  };
  let result: FreightPerCbmAuto;
  if (!capacity) result = { ...base, status: "skipped", reason: "no_capacity" };
  else if (
    !suggestion ||
    !Number.isFinite(suggestion.perCbm) ||
    !(suggestion.perCbm > 0)
  )
    result = { ...base, status: "skipped", reason: "no_rates" };
  else {
    // Compara em R$: valor em outra moeda vira R$ pelo câmbio do dia (sem
    // câmbio, ou sem valor antes, aplica).
    const previousBrl =
      previous !== null && previous > 0
        ? settings.freightCurrency === "BRL"
          ? previous
          : await rateToBrl(settings.freightCurrency).then((rate) =>
              rate ? previous * rate : null,
            )
        : null;
    const jump = previousBrl
      ? Math.abs(suggestion.perCbm - previousBrl) / previousBrl
      : 0;
    result =
      jump > PER_CBM_MAX_JUMP
        ? { ...base, status: "held", reason: "jump" }
        : { ...base, status: "applied", reason: null };
  }
  await setSetting("freightPerCbmAuto", result);
  const destName =
    comparative?.data.destinations.find((d) => d.code === destination)?.name ??
    destination ??
    "";
  const brl = (n: number) =>
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (result.status === "applied" && suggestion) {
    const changed =
      settings.freightCurrency !== "BRL" || previous !== suggestion.perCbm;
    await setSetting("freightPerCbm", suggestion.perCbm);
    await setSetting("freightCurrency", "BRL");
    if (changed) {
      await audit(
        null,
        "settings.update",
        "settings",
        "freightPerCbm",
        `Frete por m³ atualizado sozinho pelo tarifário (${destination}): R$ ${suggestion.perCbm}`,
        {
          freightPerCbm: settings.freightPerCbm,
          freightCurrency: settings.freightCurrency,
        },
        { freightPerCbm: suggestion.perCbm, freightCurrency: "BRL" },
      );
      await notifyWellmix({
        subject: "Frete por m³ atualizado pelo tarifário",
        body: `${previous !== null ? `De ${settings.freightCurrency} ${brl(previous)}` : "Sem valor antes"} para R$ ${brl(suggestion.perCbm)} por m³ (${destName}, mediana de ${suggestion.ports} portos). Vale para a vitrine e o valor ao cliente sem frete da companhia.`,
        link: "/app/freight/tariff",
      }).catch(() => null);
    }
  } else if (result.status === "held" && suggestion && previous !== null) {
    await audit(
      null,
      "freight_tariff.per_cbm_held",
      "settings",
      "freightPerCbm",
      `Frete por m³ não atualizado: R$ ${suggestion.perCbm} (antes R$ ${previous}), variação acima de ${PER_CBM_MAX_JUMP * 100}%`,
    );
    await notifyWellmix({
      subject: "Frete por m³ esperando conferência",
      body: `Com a tabela nova, o frete por m³ iria de R$ ${brl(previous)} para R$ ${brl(suggestion.perCbm)} (${destName}): variação acima de ${PER_CBM_MAX_JUMP * 100}%. O valor antigo continua. Confira as tabelas; se estiver certo, o admin aplica no tarifário.`,
      link: "/app/freight/tariff",
    }).catch(() => null);
  }
  return result;
}

export interface OrderTariffView {
  tariffId: string;
  referenceDate: string;
  /** Local do fornecedor na ficha (de onde se tenta achar o porto). */
  location: string | null;
  /** Porto achado no local (ou null). */
  matchedOrigin: string | null;
  /** Porto mostrado: o escolhido na tela ou o achado. */
  origin: string | null;
  /** Portos com tarifa, para escolher quando o local não bate. */
  origins: string[];
  /** O porto mostrado, como está na lista (null se ele não tem tarifa). */
  selectedOrigin: string | null;
  options: (TariffOption & { assigned: boolean })[];
}

/**
 * Frete pelo comparativo para um pedido (cartão Embarque, só Wellmix): o
 * porto de origem vem do local do fornecedor na ficha de compra, ou do
 * escolhido na tela; a companhia já escolhida no pedido aparece marcada.
 */
export async function orderTariffView(
  user: User,
  order: Pick<Order, "id" | "shippingLineId">,
  chosenOrigin: string | null = null,
): Promise<OrderTariffView | null> {
  assertWellmix(user);
  const comparative = await buildComparative();
  if (!comparative) return null;
  const store = getStore();
  const [[sheet], lines] = await Promise.all([
    store.list("purchase_sheets", { filter: { orderId: order.id }, limit: 1 }),
    order.shippingLineId
      ? registeredLines()
      : Promise.resolve([] as RegisteredLine[]),
  ]);
  const data = comparative.data;
  const location = sheet?.location?.trim() || null;
  const matchedOrigin = matchOrigin(data, location);
  const origins = originsWithRates(data);
  const chosen = chosenOrigin
    ? (origins.find((o) => foldName(o) === foldName(chosenOrigin)) ?? null)
    : null;
  const origin = chosen ?? matchedOrigin;
  const selectedOrigin = origin
    ? (origins.find((o) => foldName(o) === foldName(origin)) ?? null)
    : null;
  // Da companhia do pedido: a planilha dela, ou o bloco da consolidada que
  // é dela (dono pelo nome, entre todas as companhias do cadastro).
  const assigned = (o: TariffOption) =>
    !!order.shippingLineId &&
    (o.shippingLineId
      ? o.shippingLineId === order.shippingLineId
      : ownerOfBlock(o.forwarder, lines) === order.shippingLineId);
  const options = origin
    ? optionsForOrigin(data, origin).map((o) => ({
        ...o,
        assigned: assigned(o),
      }))
    : [];
  return {
    tariffId: "current",
    referenceDate: comparative.referenceDate,
    location,
    matchedOrigin,
    origin: selectedOrigin ?? origin,
    origins,
    selectedOrigin,
    options,
  };
}

/** O que a companhia do pedido vê no cartão Embarque: a última tabela que ela mandou. */
export interface MyTariffStatus {
  referenceDate: string;
  rateCount: number;
  createdAt: string;
}

export async function myTariffStatus(
  user: User,
): Promise<MyTariffStatus | null> {
  if (user.role !== "shipping_line" || !user.partyId) return null;
  const [row] = await getStore().list("freight_tariffs", {
    filter: { status: "active", shippingLineId: user.partyId },
    orderBy: "createdAt",
    direction: "desc",
    limit: 1,
  });
  return row && canViewTariff(user, row)
    ? {
        referenceDate: row.referenceDate,
        rateCount: row.rateCount,
        createdAt: row.createdAt,
      }
    : null;
}
