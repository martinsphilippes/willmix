import { randomUUID } from "node:crypto";
import type { TableName, Tables } from "./schema";
import { TABLES } from "./schema";
import type { ListOptions, NewRow, Patch, Store, StoredFile } from "./store";
import { storageFileName } from "../file-kinds";
import {
  clampRange,
  parseContentRange,
  sliceStream,
  type ByteRange,
} from "@/lib/http-range";

/**
 * Implementação sobre o Supabase (docs/SUPABASE.md): Postgres pela API REST
 * (PostgREST) e arquivos no Supabase Storage, sempre com a chave service_role
 * (servidor). Como no Appwrite, a autorização é feita na camada de aplicação;
 * as tabelas têm RLS ligado e nenhuma política (o navegador não chega nelas).
 *
 * Tabelas e colunas vêm de supabase/schema.sql (gerado do schema.ts). Datas
 * voltam em ISO com "Z" (como no modo memória); bool vazio vira false.
 */
const PAGE = 1000;
const MAX_IN = 100;
/** Páginas pedidas ao mesmo tempo numa lista grande. */
const PARALLEL = 8;

export class SupabaseError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`supabase ${status}: ${detail.slice(0, 300)}`);
  }
}

type Row = Record<string, unknown>;

export class SupabaseStore implements Store {
  readonly mode = "supabase" as const;
  private readonly url: string;

  constructor(
    url: string,
    private readonly serviceKey: string,
    private readonly bucket = "arquivos",
  ) {
    this.url = url.replace(/\/$/, "");
  }

  private headers(extra: Record<string, string> = {}) {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      ...extra,
    };
  }

  private async rest(path: string, init: RequestInit = {}): Promise<Row[]> {
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      ...init,
      headers: this.headers({
        "Content-Type": "application/json",
        ...(init.headers as Record<string, string> | undefined),
      }),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw new SupabaseError(res.status, text);
    return text ? (JSON.parse(text) as Row[]) : [];
  }

  /** Uma página e o total de linhas da consulta (cabeçalho Content-Range). */
  private async restCounted(
    path: string,
  ): Promise<{ rows: Row[]; total: number | null }> {
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      headers: this.headers({
        "Content-Type": "application/json",
        Prefer: "count=exact",
      }),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw new SupabaseError(res.status, text);
    const range = res.headers.get("content-range") ?? "";
    const total = Number(range.split("/")[1]);
    return {
      rows: text ? (JSON.parse(text) as Row[]) : [],
      total: Number.isFinite(total) ? total : null,
    };
  }

  async list<K extends TableName>(
    table: K,
    options: ListOptions<Tables[K]> = {},
  ): Promise<Tables[K][]> {
    // Listas grandes no "igual a um destes" viram consultas em partes (URL
    // curta), juntadas e reordenadas aqui, como no Appwrite.
    const big = Object.entries(options.filter ?? {}).find(
      ([, v]) => Array.isArray(v) && v.length > MAX_IN,
    );
    if (big) {
      const [field, values] = big as [string, Array<string | number>];
      const chunks: Array<Array<string | number>> = [];
      for (let i = 0; i < values.length; i += MAX_IN)
        chunks.push(values.slice(i, i + MAX_IN));
      const parts = await inBatches(chunks, PARALLEL, (chunk) =>
        this.list(table, {
          ...options,
          filter: {
            ...options.filter,
            [field]: chunk,
          } as ListOptions<Tables[K]>["filter"],
        }),
      );
      const orderBy = (options.orderBy ?? "createdAt") as string;
      const dir = options.direction === "desc" ? -1 : 1;
      const merged = parts.flat().sort((a, b) => {
        const x = (a as unknown as Record<string, string | number>)[orderBy];
        const y = (b as unknown as Record<string, string | number>)[orderBy];
        return x < y ? -dir : x > y ? dir : 0;
      });
      return options.limit ? merged.slice(0, options.limit) : merged;
    }
    const params: string[] = ["select=*"];
    for (const [key, value] of Object.entries(options.filter ?? {})) {
      if (value === null) params.push(`${enc(key)}=is.null`);
      else if (Array.isArray(value)) {
        if (value.length === 0) return [];
        params.push(`${enc(key)}=in.(${value.map(inValue).join(",")})`);
      } else params.push(`${enc(key)}=eq.${enc(String(value))}`);
    }
    const dir = options.direction === "desc" ? "desc" : "asc";
    params.push(
      `order=${enc(options.orderBy ?? "createdAt")}.${dir},id.${dir}`,
    );
    // Sem limite: a tabela inteira (até 11/11/2026 parava em 10 mil linhas
    // sem avisar, e a carga do Sankhya duplicava cadastros por não achar os
    // que já existiam). A primeira página traz o total; as outras vêm em
    // paralelo.
    const wanted = options.limit ?? Infinity;
    const query = params.join("&");
    const first = await this.restCounted(
      `${table}?${query}&limit=${Math.min(PAGE, wanted)}&offset=0`,
    );
    const rows: Row[] = [...first.rows];
    const total = Math.min(wanted, first.total ?? wanted);
    if (first.rows.length === PAGE && rows.length < total) {
      if (Number.isFinite(total)) {
        const offsets: number[] = [];
        for (let o = PAGE; o < total; o += PAGE) offsets.push(o);
        const pages = await inBatches(offsets, PARALLEL, (o) =>
          this.rest(
            `${table}?${query}&limit=${Math.min(PAGE, total - o)}&offset=${o}`,
          ),
        );
        for (const page of pages) rows.push(...page);
      } else {
        // Sem total (não deveria acontecer): uma página por vez até o fim.
        for (;;) {
          const page = await this.rest(
            `${table}?${query}&limit=${PAGE}&offset=${rows.length}`,
          );
          rows.push(...page);
          if (page.length < PAGE) break;
        }
      }
    }
    return rows.map((r) => fromRow<Tables[K]>(table, r));
  }

  async get<K extends TableName>(table: K, id: string) {
    const [row] = await this.rest(`${table}?select=*&id=eq.${enc(id)}&limit=1`);
    return row ? fromRow<Tables[K]>(table, row) : null;
  }

  async create<K extends TableName>(table: K, data: NewRow<Tables[K]>) {
    const { id, ...rest } = data as { id?: string } & Row;
    const now = new Date().toISOString();
    const [row] = await this.rest(table, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: id ?? randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...toRow(table, rest),
      }),
    });
    return fromRow<Tables[K]>(table, row);
  }

  async update<K extends TableName>(
    table: K,
    id: string,
    patch: Patch<Tables[K]>,
  ) {
    const [row] = await this.rest(`${table}?id=eq.${enc(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ...toRow(table, patch as Row),
        updatedAt: new Date().toISOString(),
      }),
    });
    // Como o Appwrite: atualizar o que não existe é erro.
    if (!row) throw new SupabaseError(404, `${table}/${id} não encontrado`);
    return fromRow<Tables[K]>(table, row);
  }

  async upsertMany<K extends TableName>(
    table: K,
    rows: Array<NewRow<Tables[K]> & { id: string }>,
  ) {
    const now = new Date().toISOString();
    // Em partes: o corpo de cada POST fica pequeno (resumos têm JSON).
    for (let i = 0; i < rows.length; i += 500) {
      const part = rows.slice(i, i + 500);
      await this.rest(table, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(
          part.map((r) => {
            const { id, ...rest } = r as { id: string } & Row;
            return {
              id,
              createdAt: now,
              updatedAt: now,
              ...toRow(table, rest),
            };
          }),
        ),
      });
    }
  }

  async remove<K extends TableName>(table: K, id: string) {
    await this.rest(`${table}?id=eq.${enc(id)}`, { method: "DELETE" });
  }

  /**
   * Linha com id e datas de origem (cópia do Appwrite): grava como veio, ou
   * atualiza se já existe (rodar a cópia de novo não duplica).
   */
  async upsertRaw<K extends TableName>(table: K, rows: Row[]) {
    if (!rows.length) return;
    await this.rest(table, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(
        rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          ...toRow(table, r),
        })),
      ),
    });
  }

  /** Apaga todas as linhas da tabela (só a cópia, antes da virada). */
  async clearTable(table: TableName) {
    await this.rest(`${table}?id=not.is.null`, { method: "DELETE" });
  }

  /** Arquivo com a chave de origem (cópia do Appwrite); substitui se existir. */
  async putFileAt(key: string, bytes: Uint8Array, mime: string) {
    const res = await fetch(this.object(key), {
      method: "POST",
      headers: this.headers({
        "Content-Type": mime || "application/octet-stream",
        "x-upsert": "true",
      }),
      body: Buffer.from(bytes),
    });
    if (!res.ok) throw new SupabaseError(res.status, await res.text());
  }

  async nextNumber(key: string) {
    const res = await fetch(`${this.url}/rest/v1/rpc/next_number`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ counter_key: key }),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw new SupabaseError(res.status, text);
    return Number(JSON.parse(text));
  }

  /* ---- Arquivos (Supabase Storage) ---- */

  private object(key: string) {
    return `${this.url}/storage/v1/object/${this.bucket}/${key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }

  /**
   * Chave no formato dos ids do Appwrite (letras, números, "_" e "-", até 64
   * caracteres; as ações conferem esse formato): 32 hex únicos + nome + extensão,
   * separados por "_". O nome do arquivo volta da chave (nameFromKey).
   */
  static fileKey(name: string) {
    return fileKeyFor(name);
  }

  /**
   * Link assinado para o navegador subir um arquivo direto (PUT), sem passar
   * pelo limite de corpo da Vercel. A chave é escolhida aqui (servidor).
   */
  async createSignedUpload(name: string) {
    const key = fileKeyFor(name);
    const res = await fetch(
      `${this.url}/storage/v1/object/upload/sign/${this.bucket}/${key}`,
      {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: "{}",
      },
    );
    const text = await res.text();
    if (!res.ok) throw new SupabaseError(res.status, text);
    const { url } = JSON.parse(text) as { url: string };
    return { key, url: `${this.url}/storage/v1${url}` };
  }

  async putFile(
    bytes: Uint8Array,
    name: string,
    mime: string,
  ): Promise<StoredFile> {
    const key = SupabaseStore.fileKey(name);
    const res = await fetch(this.object(key), {
      method: "POST",
      headers: this.headers({
        "Content-Type": mime || "application/octet-stream",
        "x-upsert": "false",
      }),
      body: Buffer.from(bytes),
    });
    if (!res.ok) throw new SupabaseError(res.status, await res.text());
    return { key, name, mime, size: bytes.byteLength };
  }

  async statFile(key: string): Promise<StoredFile | null> {
    const res = await fetch(this.object(key), {
      method: "HEAD",
      headers: this.headers(),
    });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new SupabaseError(res.status, "head");
    return {
      key,
      name: nameFromKey(key),
      mime: res.headers.get("content-type") ?? "application/octet-stream",
      size: Number(res.headers.get("content-length") ?? 0),
    };
  }

  async getFile(key: string) {
    const res = await fetch(this.object(key), { headers: this.headers() });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new SupabaseError(res.status, await res.text());
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      name: nameFromKey(key),
      mime: res.headers.get("content-type") ?? "application/octet-stream",
    };
  }

  /** Em fluxo; com `range`, só o pedaço (recorta aqui se vier o arquivo inteiro). */
  async streamFile(key: string, range?: ByteRange | null) {
    const meta = await this.statFile(key);
    if (!meta) return null;
    const wanted = clampRange(range, meta.size);
    const file = { name: meta.name, mime: meta.mime, size: meta.size };
    const res = await fetch(this.object(key), {
      headers: this.headers(
        wanted ? { Range: `bytes=${wanted.start}-${wanted.end}` } : {},
      ),
    });
    if (res.status === 404) return null;
    if (!res.ok || !res.body)
      throw new SupabaseError(res.status, "storage download");
    if (!wanted) return { ...file, body: res.body, range: null };
    if (res.status === 206) {
      const served = parseContentRange(res.headers.get("content-range"));
      if (served && served.start === wanted.start) {
        const end = Math.min(served.end, wanted.end);
        return {
          ...file,
          body:
            served.end > end
              ? sliceStream(res.body, 0, end - wanted.start + 1)
              : res.body,
          range: { start: wanted.start, end },
        };
      }
    }
    return {
      ...file,
      body: sliceStream(res.body, wanted.start, wanted.end - wanted.start + 1),
      range: wanted,
    };
  }

  async removeFile(key: string) {
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}`, {
      method: "DELETE",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: [key] }),
    });
    if (!res.ok && res.status !== 404)
      throw new SupabaseError(res.status, await res.text());
  }
}

const enc = encodeURIComponent;

const ascii = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Chave do arquivo: <32 hex>_<nome>_<extensão>, até 64 caracteres. */
export function fileKeyFor(name: string) {
  const lower = storageFileName(name);
  const dot = lower.lastIndexOf(".");
  const ext = dot > 0 ? ascii(lower.slice(dot + 1)).slice(0, 10) : "";
  const base = ascii(dot > 0 ? lower.slice(0, dot) : lower) || "arquivo";
  const id = randomUUID().replace(/-/g, "");
  const room = 64 - id.length - 1 - (ext ? ext.length + 1 : 0);
  return `${id}_${base.slice(0, room).replace(/-+$/, "") || "arquivo"}${ext ? `_${ext}` : ""}`;
}

/** Nome do arquivo guardado na chave ("Arte-Final_pdf" → "Arte-Final.pdf"). */
export function nameFromKey(key: string) {
  const parts = key.split("_");
  if (parts.length < 2) return key;
  const [, base, ext] = parts;
  return ext ? `${base}.${ext}` : base;
}

/** Valor dentro de in.(...): texto entre aspas, com aspas e barras escapadas. */
function inValue(v: string | number) {
  if (typeof v === "number") return String(v);
  return enc(`"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
}

function toRow(table: TableName, data: Row): Row {
  const out: Row = {};
  const columns = TABLES[table].columns;
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || !columns[key]) continue;
    out[key] = value;
  }
  return out;
}

const iso = (v: unknown) =>
  v == null || v === "" ? null : new Date(String(v)).toISOString();

export function fromRow<T>(table: TableName, row: Row): T {
  const out: Row = {
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
  for (const [key, def] of Object.entries(TABLES[table].columns)) {
    const value = row[key];
    if (def.type === "bool") out[key] = value ?? false;
    else if (def.type === "datetime") out[key] = iso(value);
    else out[key] = value ?? null;
  }
  return out as T;
}

/** `fn` em cada item, `size` por vez, mantendo a ordem. */
async function inBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}
