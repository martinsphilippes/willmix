import { after } from "next/server";

/*
 * Resumos por pedido de formato antigo depois de um deploy (auditoria de
 * performance, 14/11/2026). Subir SUMMARY_VERSION (docs/RESUMOS.md) deixa os
 * resumos gravados "fora de formato": até a reconstrução da madrugada, todas
 * as telas voltavam ao caminho antigo e liam tabelas inteiras (em 14/11 o
 * banco estava na versão 6 e o código na 8 desde as 03:44 UTC: itens de pedido
 * lidos inteiros, ~6.500 s de banco em 10 h, timeouts de 60 s e falta de
 * memória em /app, /app/orders e /app/tasks).
 *
 * Agora a primeira tela que encontra o formato antigo pede ao job da
 * reconstrução (/api/jobs/summaries: o mesmo da madrugada, em partes e com
 * trava contra rodadas simultâneas) que comece, depois da resposta. Só em
 * produção (as prévias não têm o banco) e só para cima: código mais velho
 * (rollback) não refaz resumo de formato mais novo. No máximo um pedido por
 * instância a cada 2 minutos; a trava do job descarta os repetidos.
 */

const KICK_EVERY_MS = 2 * 60_000;
let lastKick = Number.NEGATIVE_INFINITY;

export interface KickEnv {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  CRON_SECRET?: string;
}

/** Pede a reconstrução quando o formato gravado é mais velho que o do código; diz se pediu. */
export function kickStaleSummaries(
  stored: number | null | undefined,
  current: number,
  options: { env?: KickEnv; now?: number; fetcher?: typeof fetch } = {},
): boolean {
  const env = options.env ?? process.env;
  if (stored == null || stored >= current) return false;
  if (env.VERCEL_ENV !== "production" || !env.VERCEL_URL) return false;
  const now = options.now ?? Date.now();
  if (now - lastKick < KICK_EVERY_MS) return false;
  lastKick = now;
  const doFetch = options.fetcher ?? fetch;
  // A própria publicação (VERCEL_URL): o job roda o código novo, que grava o
  // formato novo. O job segue sozinho depois que esta chamada desiste.
  const kick = async () => {
    try {
      const res = await doFetch(
        `https://${env.VERCEL_URL}/api/jobs/summaries`,
        {
          headers: env.CRON_SECRET
            ? { authorization: `Bearer ${env.CRON_SECRET}` }
            : {},
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        },
      );
      await res.body?.cancel();
    } catch {
      // Falhou: a próxima tela (depois de 2 minutos) pede de novo.
    }
  };
  try {
    after(kick);
  } catch {
    // Fora de uma requisição (script, teste): pede agora.
    void kick();
  }
  return true;
}
