import "server-only";

import { getSettings, setSetting, type FxSnapshot } from "@/lib/settings";
import type { FxRates } from "@/lib/pricing";

/*
 * Câmbio para o preço ao cliente, buscado no máximo uma vez por dia (horário de
 * Brasília) e guardado em Configurações. Três fontes públicas, sem chave,
 * consultadas em paralelo; vale a primeira que responder nesta ordem:
 *   1. PTAX (venda) do Banco Central do Brasil;
 *   2. cotação comercial (venda) da AwesomeAPI;
 *   3. referência do Banco Central Europeu (Frankfurter), que responde de
 *      servidores fora do Brasil (a Vercel roda em Frankfurt).
 * Se todas falharem, vale a última cotação obtida (com a data, como sugestão);
 * se nunca houve, o câmbio manual. O motivo de cada falha fica registrado.
 */

const AWESOME_URL =
  "https://economia.awesomeapi.com.br/json/last/USD-BRL,CNY-BRL,EUR-BRL";

/** Banco Central Europeu via Frankfurter (dois endereços do mesmo serviço). */
const ECB_URLS = [
  "https://api.frankfurter.dev/v1/latest",
  "https://api.frankfurter.app/latest",
];

export type FxSource = "ptax" | "awesomeapi" | "ecb";

const TIMEOUT_MS = 5000;

const PTAX_URL =
  "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)";

/** Moeda do sistema → código PTAX. */
const PTAX_CODES = { USD: "USD", RMB: "CNY", EUR: "EUR" } as const;
type FxCurrency = keyof typeof PTAX_CODES;

export type FxStatus = "today" | "stale" | "manual" | "none";

export interface FxView {
  rates: FxRates;
  status: FxStatus;
  /** Dia da busca usada (stale: a última que deu certo). */
  day: string | null;
  quotedAt: FxSnapshot["quotedAt"];
  source: FxSource | null;
  /** Por que a última busca falhou (uma linha por fonte), se falhou. */
  lastError: string | null;
}

export function brazilDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** AAAA-MM-DD → MM-DD-AAAA (formato da API do Banco Central). */
const bcbDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${m}-${d}-${y}`;
};

function daysBefore(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

interface PtaxRow {
  cotacaoVenda: number;
  dataHoraCotacao: string;
  tipoBoletim: string;
}

/** Última PTAX de fechamento (ou o último boletim) dos últimos 7 dias. */
export async function fetchPtax(
  currency: FxCurrency,
  day: string,
  fetcher: typeof fetch = fetch,
): Promise<{ rate: number; quotedAt: string }> {
  // Parâmetros OData montados à mão: a API não aceita "@" e "$" codificados.
  const query = [
    `@moeda='${PTAX_CODES[currency]}'`,
    `@dataInicial='${bcbDate(daysBefore(day, 7))}'`,
    `@dataFinalCotacao='${bcbDate(day)}'`,
    "$format=json",
    "$select=cotacaoVenda,dataHoraCotacao,tipoBoletim",
  ].join("&");
  const res = await fetcher(`${PTAX_URL}?${query}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ptax_http_${res.status}`);
  const body = (await res.json()) as { value?: PtaxRow[] };
  const rows = (body.value ?? []).filter(
    (r) => typeof r.cotacaoVenda === "number" && r.cotacaoVenda > 0,
  );
  if (rows.length === 0) throw new Error("ptax_empty");
  rows.sort((a, b) => a.dataHoraCotacao.localeCompare(b.dataHoraCotacao));
  const closing = rows.filter((r) => r.tipoBoletim === "Fechamento PTAX");
  const pick = (closing.length ? closing : rows).at(-1)!;
  return { rate: pick.cotacaoVenda, quotedAt: pick.dataHoraCotacao };
}

/** Cotação comercial de venda (ask) da AwesomeAPI para as três moedas. */
export async function fetchAwesome(
  fetcher: typeof fetch = fetch,
): Promise<Record<FxCurrency, { rate: number; quotedAt: string }>> {
  const res = await fetcher(AWESOME_URL, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`awesome_http_${res.status}`);
  const body = (await res.json()) as Record<
    string,
    { ask?: string; create_date?: string }
  >;
  const pick = (key: string) => {
    const row = body[key];
    const rate = Number(row?.ask);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("awesome_empty");
    return { rate, quotedAt: row?.create_date ?? "" };
  };
  return { USD: pick("USDBRL"), RMB: pick("CNYBRL"), EUR: pick("EURBRL") };
}

/** Referência do BCE (Frankfurter): R$ por unidade de cada moeda. */
export async function fetchEcb(
  fetcher: typeof fetch = fetch,
): Promise<Record<FxCurrency, { rate: number; quotedAt: string }>> {
  let lastError: unknown = null;
  for (const base of ECB_URLS) {
    try {
      const one = async (code: "USD" | "CNY" | "EUR") => {
        const res = await fetcher(`${base}?base=${code}&symbols=BRL`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`http ${res.status}`);
        const body = (await res.json()) as {
          date?: string;
          rates?: { BRL?: number };
        };
        const rate = Number(body.rates?.BRL);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error("vazio");
        return { rate, quotedAt: body.date ?? "" };
      };
      const [USD, RMB, EUR] = await Promise.all([
        one("USD"),
        one("CNY"),
        one("EUR"),
      ]);
      return { USD, RMB, EUR };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("ecb_failed");
}

/** Motivo curto de uma falha de rede/API, para a tela de Configurações. */
function reason(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError")
      return "sem resposta em 5 s";
    const cause = (error as { cause?: { code?: string } }).cause?.code;
    return cause ? `${error.message} (${cause})` : error.message;
  }
  return String(error);
}

export class FxFetchError extends Error {}

/** Consulta as três fontes em paralelo; vale a primeira que respondeu, na ordem. */
async function fetchAll(day: string, now: Date, fetcher?: typeof fetch) {
  const ptax = async () =>
    Object.fromEntries(
      await Promise.all(
        (Object.keys(PTAX_CODES) as FxCurrency[]).map(
          async (c) => [c, await fetchPtax(c, day, fetcher)] as const,
        ),
      ),
    ) as Record<FxCurrency, { rate: number; quotedAt: string }>;
  const sources: Array<
    [
      FxSource,
      () => Promise<Record<FxCurrency, { rate: number; quotedAt: string }>>,
    ]
  > = [
    ["ptax", ptax],
    ["awesomeapi", () => fetchAwesome(fetcher)],
    ["ecb", () => fetchEcb(fetcher)],
  ];
  const results = await Promise.allSettled(sources.map(([, run]) => run()));
  const errors: string[] = [];
  for (let i = 0; i < sources.length; i++) {
    const result = results[i];
    const source = sources[i][0];
    if (result.status === "fulfilled") {
      const entries = Object.entries(result.value) as Array<
        [FxCurrency, { rate: number; quotedAt: string }]
      >;
      const snapshot: FxSnapshot = {
        day,
        fetchedAt: now.toISOString(),
        rates: Object.fromEntries(entries.map(([c, v]) => [c, v.rate])),
        quotedAt: Object.fromEntries(entries.map(([c, v]) => [c, v.quotedAt])),
        source,
      };
      return snapshot;
    }
    errors.push(`${source}: ${reason(result.reason)}`);
  }
  throw new FxFetchError(errors.join(" · "));
}

/**
 * Câmbio do dia. Primeira chamada do dia busca e grava; as demais usam o que
 * foi gravado. `force` (botão "Buscar agora") busca de novo na hora.
 * Falhou: última cotação (stale) ou câmbio manual.
 */
export async function getFxRates(
  options: { now?: Date; fetcher?: typeof fetch; force?: boolean } = {},
): Promise<FxView> {
  const settings = await getSettings();
  const day = brazilDay(options.now);
  const stored = settings.fxPtax;
  if (stored?.day === day && !options.force)
    return {
      rates: stored.rates,
      status: "today",
      day,
      quotedAt: stored.quotedAt,
      source: stored.source ?? "ptax",
      lastError: null,
    };
  // Depois de uma falha, só tenta de novo após 1 hora (a página não fica esperando).
  const now = options.now ?? new Date();
  const failedAt = settings.fxPtaxFailedAt
    ? Date.parse(settings.fxPtaxFailedAt)
    : NaN;
  const recentlyFailed =
    Number.isFinite(failedAt) && now.getTime() - failedAt < 60 * 60 * 1000;
  try {
    if (recentlyFailed && !options.force)
      throw new Error("ptax_recently_failed");
    const snapshot = await fetchAll(day, now, options.fetcher);
    await setSetting("fxPtax", snapshot);
    return {
      rates: snapshot.rates,
      status: "today",
      day,
      quotedAt: snapshot.quotedAt,
      source: snapshot.source ?? "ptax",
      lastError: null,
    };
  } catch (error) {
    if (error instanceof FxFetchError) {
      await setSetting("fxPtaxFailedAt", now.toISOString());
      await setSetting("fxLastError", error.message.slice(0, 500));
    }
    const lastError =
      error instanceof FxFetchError
        ? error.message
        : (settings.fxLastError ?? null);
    if (stored)
      return {
        rates: stored.rates,
        status: "stale",
        day: stored.day,
        quotedAt: stored.quotedAt,
        source: stored.source ?? "ptax",
        lastError,
      };
    const manual = Object.fromEntries(
      Object.entries(settings.fxManualRates).filter(
        ([, v]) => typeof v === "number" && v > 0,
      ),
    ) as FxRates;
    return {
      rates: manual,
      status: Object.keys(manual).length ? "manual" : "none",
      day: null,
      quotedAt: {},
      source: null,
      lastError,
    };
  }
}
