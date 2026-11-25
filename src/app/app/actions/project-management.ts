"use server";

import { z } from "zod";
import { getStore } from "@/lib/db";
import type { ProjectDoc } from "@/lib/db/schema";
import {
  canSeeProjectManagement,
  PM_COLLECTIONS,
  projectDocRowId,
  type PmCollection,
} from "@/lib/project-management";
import { requireUser } from "./helpers";

/*
 * Gestão do projeto (docs/PROJECT_MANAGEMENT.md): o banco do quadro da
 * Plataforma Wellmix v2. A plataforma roda num iframe e pede à página do
 * portal (postMessage) cada leitura e escrita, que vêm para cá. Só os logins
 * de PROJECT_MANAGEMENT_EMAILS; qualquer outro recebe "forbidden".
 */

export type PmResult<T> = { ok: true; value: T } | { ok: false; error: string };

const collection = z.enum(PM_COLLECTIONS);
const docId = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9._-]+$/);
const data = z.record(z.string(), z.unknown());

/** Teto de um documento (o histórico de uma atividade cresce com o tempo). */
const MAX_DOC_BYTES = 400_000;

async function guarded<T>(fn: () => Promise<T>): Promise<PmResult<T>> {
  const user = await requireUser();
  if (!canSeeProjectManagement(user)) return { ok: false, error: "forbidden" };
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: "invalid" };
    console.error("project-management action failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "failed",
    };
  }
}

const sizeOk = (value: Record<string, unknown>) => {
  if (JSON.stringify(value).length > MAX_DOC_BYTES)
    throw new Error("too_large");
  return value;
};

async function findDoc(c: PmCollection, id: string) {
  const store = getStore();
  const byId = await store.get("project_docs", projectDocRowId(c, id));
  if (byId) return byId;
  const [row] = await store.list("project_docs", {
    filter: { collection: c, docId: id },
    limit: 1,
  });
  return row ?? null;
}

/** Os documentos de uma coleção: [{ id, data }]. */
export async function pmListAction(input: { collection: string }) {
  return guarded(async () => {
    const c = collection.parse(input.collection);
    const rows = await getStore().list("project_docs", {
      filter: { collection: c },
    });
    return rows.map((r: ProjectDoc) => ({ id: r.docId, data: r.data ?? {} }));
  });
}

/** Grava o documento inteiro (cria se não existe). */
export async function pmSetAction(input: {
  collection: string;
  id: string;
  data: Record<string, unknown>;
}) {
  return guarded(async () => {
    const c = collection.parse(input.collection);
    const id = docId.parse(input.id);
    const value = sizeOk(data.parse(input.data));
    const store = getStore();
    const row = await findDoc(c, id);
    if (row) await store.update("project_docs", row.id, { data: value });
    else
      await store.create("project_docs", {
        id: projectDocRowId(c, id),
        collection: c,
        docId: id,
        data: value,
      });
    return true;
  });
}

/** Junta os campos de primeiro nível ao documento (como o update do artifact). */
export async function pmUpdateAction(input: {
  collection: string;
  id: string;
  patch: Record<string, unknown>;
}) {
  return guarded(async () => {
    const c = collection.parse(input.collection);
    const id = docId.parse(input.id);
    const patch = data.parse(input.patch);
    const store = getStore();
    const row = await findDoc(c, id);
    if (!row) throw new Error("not_found");
    const value = sizeOk({ ...(row.data ?? {}), ...patch });
    await store.update("project_docs", row.id, { data: value });
    return true;
  });
}

export async function pmDeleteAction(input: {
  collection: string;
  id: string;
}) {
  return guarded(async () => {
    const c = collection.parse(input.collection);
    const id = docId.parse(input.id);
    const row = await findDoc(c, id);
    if (row) await getStore().remove("project_docs", row.id);
    return true;
  });
}

/** Quem está usando: o login do portal. */
export async function pmMeAction() {
  return guarded(async () => {
    const user = await requireUser();
    return { id: user.id, name: user.name };
  });
}

/** Nomes dos autores do histórico (logins do portal): { id: { name } }. */
export async function pmProfilesAction(input: { ids: string[] }) {
  return guarded(async () => {
    const ids = z.array(z.string().max(80)).max(200).parse(input.ids);
    const store = getStore();
    const out: Record<string, { name: string }> = {};
    for (const id of new Set(ids)) {
      const user = await store.get("users", id).catch(() => null);
      if (user) out[id] = { name: user.name };
    }
    return out;
  });
}

/** Anexo de uma atividade: guarda o arquivo e devolve a chave dele. */
export async function pmUploadAction(form: FormData) {
  return guarded(async () => {
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("missing_file");
    if (file.size > 20_000_000) throw new Error("too_large");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    const stored = await getStore().putFile(bytes, file.name || "anexo", mime);
    return { id: stored.key, contentType: stored.mime };
  });
}
