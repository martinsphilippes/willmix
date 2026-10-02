import "server-only";

import { getSettings, setSetting, type FxSnapshot } from "@/lib/settings";
import type { FxRates } from "@/lib/pricing";

/*
 * Câmbio para o preço ao cliente: PTAX (venda) do Banco Central, buscada no
 * máximo uma vez por dia (horário de Brasília) e guardada em Configurações.
 * Se a busca falhar, vale a última PTAX obtida (com a data, como sugestão);
 * se nunca houve PTAX, o câmbio manual de Configurações. Nada é inventado.
 */

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
  const params = new URLSearchParams({
    "@moeda": `'${PTAX_CODES[currency]}'`,
    "@dataInicial": `'${bcbDate(daysBefore(day, 7))}'`,
    "@dataFinalCotacao": `'${bcbDate(day)}'`,
    $format: "json",
    $select: "cotacaoVenda,dataHoraCotacao,tipoBoletim",
  });
  const res = await fetcher(`${PTAX_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(8000),
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

/**
 * Câmbio do dia. Primeira chamada do dia busca a PTAX e grava; as demais usam
 * o que foi gravado. Falhou: última PTAX (stale) ou câmbio manual.
 */
export async function getFxRates(
  options: { now?: Date; fetcher?: typeof fetch } = {},
): Promise<FxView> {
  const settings = await getSettings();
  const day = brazilDay(options.now);
  const stored = settings.fxPtax;
  if (stored?.day === day)
    return {
      rates: stored.rates,
      status: "today",
      day,
      quotedAt: stored.quotedAt,
    };
  // Depois de uma falha, só tenta de novo após 1 hora (a página não fica esperando).
  const now = options.now ?? new Date();
  const failedAt = settings.fxPtaxFailedAt
    ? Date.parse(settings.fxPtaxFailedAt)
    : NaN;
  const recentlyFailed =
    Number.isFinite(failedAt) && now.getTime() - failedAt < 60 * 60 * 1000;
  try {
    if (recentlyFailed) throw new Error("ptax_recently_failed");
    const entries = await Promise.all(
      (Object.keys(PTAX_CODES) as FxCurrency[]).map(
        async (c) => [c, await fetchPtax(c, day, options.fetcher)] as const,
      ),
    );
    const snapshot: FxSnapshot = {
      day,
      fetchedAt: now.toISOString(),
      rates: Object.fromEntries(entries.map(([c, v]) => [c, v.rate])),
      quotedAt: Object.fromEntries(entries.map(([c, v]) => [c, v.quotedAt])),
    };
    await setSetting("fxPtax", snapshot);
    return {
      rates: snapshot.rates,
      status: "today",
      day,
      quotedAt: snapshot.quotedAt,
    };
  } catch (error) {
    if (!(error instanceof Error && error.message === "ptax_recently_failed"))
      await setSetting("fxPtaxFailedAt", now.toISOString());
    if (stored)
      return {
        rates: stored.rates,
        status: "stale",
        day: stored.day,
        quotedAt: stored.quotedAt,
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
    };
  }
}
