"use server";

import { z } from "zod";
import { assertRole, assertWellmix } from "@/lib/auth/permissions";
import { REQUEST_NCM_SOURCES } from "@/lib/db/schema";
import { files, requireUser, run, str } from "./helpers";

/*
 * Tributos da importação: tabela fiscal (TEC/TIPI) em Configurações (admin) e
 * NCM da solicitação (Wellmix). Toda regra fica nos serviços.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const MAX_FILE = 15 * 1024 * 1024;

/** Upload da planilha oficial da TEC ou da TIPI (XLSX ou CSV). */
export async function uploadFiscalTableAction(form: FormData) {
  const user = await requireUser();
  const back = "/app/settings";
  await run(back, async () => {
    assertRole(user, ["admin"]);
    const kind = z.enum(["tec", "tipi"]).parse(str(form, "kind"));
    const [file] = files(form, "file");
    if (!file) throw new Error("fiscal_file_required");
    if (file.size > MAX_FILE) throw new Error("fiscal_file_too_big");
    if (!/\.(xlsx|csv|txt)$/i.test(file.name))
      throw new Error("fiscal_file_type");
    const { importFiscalFile } = await import("@/lib/services/fiscal");
    const r = await importFiscalFile(
      user,
      kind,
      new Uint8Array(await file.arrayBuffer()),
      file.name,
      "upload",
    );
    return `${back}?fiscal=${kind}-${r.count}-${r.changed}#fiscal`;
  });
}

/** "Atualizar agora": o robô baixa dos links oficiais configurados. */
export async function syncFiscalNowAction() {
  const user = await requireUser();
  const back = "/app/settings";
  await run(back, async () => {
    assertRole(user, ["admin"]);
    const { syncFiscalTables } = await import("@/lib/services/fiscal");
    const r = await syncFiscalTables(user);
    if (r.results.length === 0) throw new Error("fiscal_no_urls");
    return `${back}?fiscalSync=${r.lastError ? "partial" : "ok"}#fiscal`;
  });
}

/** Wellmix pede (de novo) as sugestões de NCM da IA para a solicitação. */
export async function suggestRequestNcmAction(form: FormData) {
  const user = await requireUser();
  const requestId = str(form, "requestId").slice(0, 64);
  const back = `/app/requests/${encodeURIComponent(requestId)}`;
  await run(back, async () => {
    ID.parse(requestId);
    assertWellmix(user);
    const { suggestRequestNcm } = await import("@/lib/services/request-ncm");
    const r = await suggestRequestNcm(user, requestId);
    return `${back}?ncmSuggested=${r.count}${r.aiError ? `&ncmAi=${r.aiError}` : ""}#ncm`;
  });
}

/** Wellmix confirma o NCM (de uma sugestão ou digitado). */
export async function confirmRequestNcmAction(form: FormData) {
  const user = await requireUser();
  const requestId = str(form, "requestId").slice(0, 64);
  const back = `/app/requests/${encodeURIComponent(requestId)}`;
  await run(back, async () => {
    ID.parse(requestId);
    assertWellmix(user);
    const ncm = z
      .string()
      .regex(/^[\d.\s-]{8,14}$/)
      .parse(str(form, "ncm"));
    const source = z
      .enum(REQUEST_NCM_SOURCES)
      .parse(str(form, "source") || "manual");
    const { confirmRequestNcm } = await import("@/lib/services/request-ncm");
    await confirmRequestNcm(user, requestId, ncm, source);
    return `${back}?ncmConfirmed=1#ncm`;
  });
}
