import "server-only";

import { getStore, type FreightTariff, type Order, type User } from "@/lib/db";
import { assertRole, assertWellmix } from "@/lib/auth/permissions";
import { getSettings, setSetting } from "@/lib/settings";
import { brazilDay } from "@/lib/supplier-terms";
import { audit } from "./audit";
import { uploadDocument } from "./documents";
import { openWorkbook } from "./xlsx";
import {
  TARIFF_CONTAINER_TYPE,
  TariffError,
  destinationCode,
  foldName,
  matchOrigin,
  normalizeTariffData,
  optionsForOrigin,
  originsWithRates,
  parseFreightTariff,
  perCbmSuggestion,
  tariffCounts,
  type TariffOption,
  type TariffSheet,
} from "./freight-tariff-calc";

/*
 * Tarifário de frete marítimo: a Wellmix importa a planilha "ESTIMATIVA DE
 * FRETE" (tarifas das companhias marítimas por porto de origem e destino) e
 * o portal guarda tudo, mostra o menor custo de cada rota, gera o
 * AD_FREINT.CSV do Sankhya (o que a macro da planilha fazia) e sugere o frete
 * por m³ usado no preço quando a companhia ainda não informou o frete.
 * Tem as tarifas de todas as companhias: só a Wellmix vê; nenhuma companhia,
 * fornecedor ou cliente.
 */

/** Teto do arquivo (a planilha modelo tem ~130 KB). */
export const MAX_TARIFF_BYTES = 4_000_000;

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
export function readTariffWorkbook(bytes: Uint8Array, fileName = "") {
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
  return parseFreightTariff(sheets);
}

/**
 * Importa a planilha: lê, confere, guarda o original (documento interno) e
 * passa a ser o tarifário vigente; o anterior fica no histórico.
 */
export async function importFreightTariff(
  user: User,
  file: File,
  referenceDate: string | null,
): Promise<FreightTariff> {
  assertWellmix(user);
  if (!file || file.size === 0) throw new TariffError("tariff_file_required");
  if (file.size > MAX_TARIFF_BYTES) throw new TariffError("tariff_too_large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = (file.name || "tarifario.xlsx").slice(0, 200);
  const data = readTariffWorkbook(bytes, name);
  const day = referenceDate ?? brazilDay(new Date());
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new TariffError("tariff_date_invalid");
  const counts = tariffCounts(data);
  const store = getStore();

  // Primeiro o banco (se a tabela falhar, nenhum arquivo fica órfão); depois
  // o original, guardado para conferência.
  const previous = await store.list("freight_tariffs", {
    filter: { status: "active" },
  });
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
  await audit(
    user,
    "freight_tariff.import",
    "freight_tariff",
    row.id,
    `Tarifário de frete importado (${name}): ${counts.rates} tarifa(s) de ${counts.forwarders} companhia(s), ${data.warnings.length} aviso(s)`,
  );
  return row;
}

/** Linha lida do banco com os dados completos (tarifários gravados antes também). */
function normalized(row: FreightTariff | null): FreightTariff | null {
  if (row?.data) normalizeTariffData(row.data);
  return row;
}

/** Tarifário vigente (o último importado). */
export async function currentFreightTariff(
  user: User,
): Promise<FreightTariff | null> {
  assertWellmix(user);
  const [row] = await getStore().list("freight_tariffs", {
    filter: { status: "active" },
    orderBy: "createdAt",
    direction: "desc",
    limit: 1,
  });
  return normalized(row ?? null);
}

export async function getFreightTariff(
  user: User,
  id: string,
): Promise<FreightTariff | null> {
  assertWellmix(user);
  return normalized(await getStore().get("freight_tariffs", id));
}

/** Histórico de importações (o vigente primeiro). */
export async function listFreightTariffs(user: User, limit = 20) {
  assertWellmix(user);
  return getStore().list("freight_tariffs", {
    orderBy: "createdAt",
    direction: "desc",
    limit,
  });
}

/** Capacidade útil do container das tarifas (40HC nas Configurações). */
export async function tariffContainerCapacity(): Promise<number | null> {
  const { containerTypes } = await getSettings();
  return (
    containerTypes.find((c) => c.code === TARIFF_CONTAINER_TYPE)?.capacityCbm ??
    null
  );
}

/**
 * Usa o tarifário no frete por m³ das Configurações (o que entra no preço
 * quando a companhia ainda não informou o frete do produto). Só o admin,
 * como as demais Configurações.
 */
export async function applyTariffPerCbm(
  user: User,
  tariffId: string,
  destination: string,
): Promise<number> {
  assertRole(user, ["admin"]);
  const tariff = normalized(await getStore().get("freight_tariffs", tariffId));
  if (!tariff) throw new TariffError("tariff_not_found");
  const capacity = await tariffContainerCapacity();
  const suggestion = capacity
    ? perCbmSuggestion(tariff.data, destination, capacity)
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
  await audit(
    user,
    "settings.update",
    "settings",
    "freightPerCbm",
    `Frete por m³ pelo tarifário de ${tariff.referenceDate} (${destination}): R$ ${suggestion.perCbm}`,
    {
      freightPerCbm: before.freightPerCbm,
      freightCurrency: before.freightCurrency,
    },
    { freightPerCbm: suggestion.perCbm, freightCurrency: "BRL" },
  );
  return suggestion.perCbm;
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
 * Frete pelo tarifário vigente para um pedido (cartão Embarque, só Wellmix):
 * o porto de origem vem do local do fornecedor na ficha de compra, ou do
 * escolhido na tela; a companhia já escolhida no pedido aparece marcada.
 */
export async function orderTariffView(
  user: User,
  order: Pick<Order, "id" | "shippingLineId">,
  chosenOrigin: string | null = null,
): Promise<OrderTariffView | null> {
  assertWellmix(user);
  const tariff = await currentFreightTariff(user);
  if (!tariff) return null;
  const store = getStore();
  const [[sheet], line] = await Promise.all([
    store.list("purchase_sheets", { filter: { orderId: order.id }, limit: 1 }),
    order.shippingLineId
      ? store.get("parties", order.shippingLineId)
      : Promise.resolve(null),
  ]);
  const location = sheet?.location?.trim() || null;
  const matchedOrigin = matchOrigin(tariff.data, location);
  const origins = originsWithRates(tariff.data);
  const chosen = chosenOrigin
    ? (origins.find((o) => foldName(o) === foldName(chosenOrigin)) ?? null)
    : null;
  const origin = chosen ?? matchedOrigin;
  const selectedOrigin = origin
    ? (origins.find((o) => foldName(o) === foldName(origin)) ?? null)
    : null;
  const assignedKey = line?.name ? foldName(line.name) : null;
  const options = origin
    ? optionsForOrigin(tariff.data, origin).map((o) => ({
        ...o,
        assigned: !!assignedKey && foldName(o.forwarder) === assignedKey,
      }))
    : [];
  return {
    tariffId: tariff.id,
    referenceDate: tariff.referenceDate,
    location,
    matchedOrigin,
    origin: selectedOrigin ?? origin,
    origins,
    selectedOrigin,
    options,
  };
}
