import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SupabaseStore,
  fileKeyFor,
  nameFromKey,
} from "@/lib/db/supabase-store";
import { schemaSql } from "@/lib/db/supabase-sql";
import { TABLES } from "@/lib/db/schema";

/*
 * Banco no Supabase (docs/SUPABASE.md): o esquema gerado está em dia com o
 * schema.ts e o SupabaseStore fala PostgREST e Storage do jeito certo
 * (filtros, listas grandes, ordem, páginas, numeração, datas, arquivos com
 * pedaço), contra um PostgREST/Storage falso em memória.
 */

afterEach(() => vi.unstubAllGlobals());

type Row = Record<string, unknown>;

/** PostgREST + Storage falsos: o suficiente do protocolo que o store usa. */
function fakeSupabase() {
  const db: Record<string, Row[]> = {};
  const files = new Map<string, { bytes: Uint8Array; mime: string }>();
  const counters = new Map<string, number>();
  const calls: string[] = [];
  const decodeIn = (raw: string) =>
    raw
      .slice(1, -1)
      .match(/"(?:[^"\\]|\\.)*"|[^,]+/g)!
      .map((v) =>
        v.startsWith('"') ? v.slice(1, -1).replace(/\\(.)/g, "$1") : Number(v),
      );
  const match = (row: Row, params: URLSearchParams) => {
    for (const [k, v] of params) {
      if (["select", "order", "limit", "offset"].includes(k)) continue;
      if (v === "is.null") {
        if (row[k] != null) return false;
      } else if (v.startsWith("in.")) {
        if (!decodeIn(v.slice(3)).includes(row[k] as never)) return false;
      } else if (v.startsWith("eq.")) {
        if (String(row[k]) !== v.slice(3)) return false;
      }
    }
    return true;
  };
  vi.stubGlobal("fetch", (async (
    input: RequestInfo | URL,
    init: RequestInit = {},
  ) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    calls.push(`${method} ${url.pathname}${url.search}`);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status });
    if (url.pathname === "/rest/v1/rpc/next_number") {
      const key = JSON.parse(String(init.body)).counter_key as string;
      counters.set(key, (counters.get(key) ?? 0) + 1);
      return json(counters.get(key));
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.slice("/rest/v1/".length);
      const rows = (db[table] ??= []);
      const params = url.searchParams;
      if (method === "POST") {
        const body = JSON.parse(String(init.body));
        const list = Array.isArray(body) ? body : [body];
        for (const r of list) {
          const i = rows.findIndex((x) => x.id === r.id);
          if (i >= 0) rows[i] = { ...rows[i], ...r };
          else rows.push(r);
        }
        return json(list);
      }
      const hit = rows.filter((r) => match(r, params));
      if (method === "PATCH") {
        const patch = JSON.parse(String(init.body));
        hit.forEach((r) => Object.assign(r, patch));
        return json(hit);
      }
      if (method === "DELETE") {
        db[table] = rows.filter((r) => !hit.includes(r));
        return new Response(null, { status: 204 });
      }
      const order = (params.get("order") ?? "")
        .split(",")
        .map((o) => o.split("."));
      hit.sort((a, b) => {
        for (const [col, dir] of order) {
          const x = String(a[col] ?? "");
          const y = String(b[col] ?? "");
          if (x !== y) return (x < y ? -1 : 1) * (dir === "desc" ? -1 : 1);
        }
        return 0;
      });
      const offset = Number(params.get("offset") ?? 0);
      const limit = Number(params.get("limit") ?? 1000);
      return json(hit.slice(offset, offset + limit));
    }
    if (url.pathname.startsWith("/storage/v1/object/upload/sign/arquivos/")) {
      const key = url.pathname.split("/").pop()!;
      if (method === "POST")
        return json({ url: `/object/upload/sign/arquivos/${key}?token=t1` });
      if (method === "PUT" && url.searchParams.get("token") === "t1") {
        files.set(key, {
          bytes: new Uint8Array(init.body as Buffer),
          mime: (init.headers as Record<string, string>)["Content-Type"],
        });
        return json({ Key: key });
      }
      return new Response("{}", { status: 400 });
    }
    if (url.pathname.startsWith("/storage/v1/object/arquivos")) {
      const key = decodeURIComponent(
        url.pathname.slice("/storage/v1/object/arquivos/".length),
      );
      if (method === "POST") {
        files.set(key, {
          bytes: new Uint8Array(init.body as Buffer),
          mime: (init.headers as Record<string, string>)["Content-Type"],
        });
        return json({ Key: key });
      }
      if (method === "DELETE") {
        for (const p of JSON.parse(String(init.body)).prefixes) files.delete(p);
        return json([]);
      }
      const f = files.get(key);
      if (!f) return new Response("{}", { status: 404 });
      const headers = {
        "content-type": f.mime,
        "content-length": String(f.bytes.length),
      };
      if (method === "HEAD")
        return new Response(null, { status: 200, headers });
      const range = /bytes=(\d+)-(\d+)/.exec(
        (init.headers as Record<string, string>).Range ?? "",
      );
      if (range) {
        const [s, e] = [Number(range[1]), Number(range[2])];
        return new Response(Buffer.from(f.bytes.slice(s, e + 1)), {
          status: 206,
          headers: {
            ...headers,
            "content-range": `bytes ${s}-${e}/${f.bytes.length}`,
          },
        });
      }
      return new Response(Buffer.from(f.bytes), { status: 200, headers });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch);
  return { db, calls };
}

const read = async (s: ReadableStream<Uint8Array>) =>
  new TextDecoder().decode(new Uint8Array(await new Response(s).arrayBuffer()));

describe("esquema do Supabase", () => {
  it("supabase/schema.sql está em dia com o schema.ts", () => {
    const file = readFileSync(
      resolve(__dirname, "../../supabase/schema.sql"),
      "utf8",
    );
    expect(file).toBe(schemaSql());
    for (const table of Object.keys(TABLES))
      expect(file).toContain(`create table if not exists public."${table}"`);
    expect(file).toContain("enable row level security");
    expect(file).not.toMatch(/drop |truncate |delete from/i);
  });
});

describe("SupabaseStore", () => {
  it("cria, lê, filtra, ordena, atualiza e apaga como os outros stores", async () => {
    const { calls } = fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co/", "service");
    const a = await store.create("payment_conditions", {
      code: 33,
      name: 'IMPORTAÇÃO "30/70", A',
      active: true,
      notes: null,
      source: "sankhya",
      updatedByUserId: null,
    });
    expect(a.id).toBeTruthy();
    expect(a.createdAt).toMatch(/Z$/);
    const b = await store.create("payment_conditions", {
      id: "pc-b",
      code: 1,
      name: "À VISTA",
      active: false,
      notes: "x",
      source: "portal",
      updatedByUserId: null,
    });
    expect(b.id).toBe("pc-b");

    expect((await store.get("payment_conditions", "pc-b"))?.name).toBe(
      "À VISTA",
    );
    expect(await store.get("payment_conditions", "nada")).toBeNull();
    expect(
      (
        await store.list("payment_conditions", { filter: { active: true } })
      ).map((r) => r.code),
    ).toEqual([33]);
    expect(
      (
        await store.list("payment_conditions", {
          filter: { name: [a.name, "outro"] },
        })
      ).map((r) => r.id),
    ).toEqual([a.id]);
    expect(
      await store.list("payment_conditions", { filter: { notes: null } }),
    ).toHaveLength(1);
    expect(
      await store.list("payment_conditions", { filter: { code: [] } }),
    ).toEqual([]);
    expect(
      (
        await store.list("payment_conditions", {
          orderBy: "code",
          direction: "desc",
          limit: 1,
        })
      )[0].code,
    ).toBe(33);

    const updated = await store.update("payment_conditions", "pc-b", {
      active: true,
    });
    expect(updated.active).toBe(true);
    await expect(
      store.update("payment_conditions", "nada", { active: true }),
    ).rejects.toThrow("404");
    await store.remove("payment_conditions", "pc-b");
    expect(await store.get("payment_conditions", "pc-b")).toBeNull();
    // Nada de colunas desconhecidas no corpo; ordem estável por id.
    expect(calls.some((c) => c.includes("order=createdAt.asc,id.asc"))).toBe(
      true,
    );
  });

  it("listas grandes em partes, páginas de 1000 e bool/json/data como no portal", async () => {
    const { db } = fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co", "service");
    db.settings = Array.from({ length: 2500 }, (_, i) => ({
      id: `s${String(i).padStart(4, "0")}`,
      createdAt: "2026-11-10T00:00:00+00:00",
      updatedAt: "2026-11-10T00:00:00+00:00",
      key: `k${i}`,
      value: { n: i },
    }));
    const all = await store.list("settings");
    expect(all).toHaveLength(2500);
    expect(all[0]).toMatchObject({
      value: { n: 0 },
      createdAt: "2026-11-10T00:00:00.000Z",
    });
    const keys = Array.from({ length: 250 }, (_, i) => `k${i * 10}`);
    expect(
      await store.list("settings", { filter: { key: keys } }),
    ).toHaveLength(250);
    db.stock_locations = [
      {
        id: "l1",
        createdAt: null,
        updatedAt: null,
        code: 1,
        name: "CD",
        active: null,
      },
    ];
    expect((await store.get("stock_locations", "l1"))?.active).toBe(false);
  });

  it("numeração atômica e cópia com id e datas de origem", async () => {
    const { db } = fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co", "service");
    expect(await store.nextNumber("order_number")).toBe(1);
    expect(await store.nextNumber("order_number")).toBe(2);
    await store.upsertRaw("counters", [
      {
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        key: "x",
        value: 9,
        junk: 1,
      },
    ]);
    await store.upsertRaw("counters", [
      {
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        key: "x",
        value: 10,
      },
    ]);
    expect(db.counters).toEqual([
      {
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        key: "x",
        value: 10,
      },
    ]);
  });

  it("arquivos: grava, confere, baixa inteiro e em pedaço, apaga", async () => {
    fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co", "service");
    const put = await store.putFile(
      new TextEncoder().encode("0123456789"),
      "Arte Final Ç.PDF",
      "application/pdf",
    );
    expect(put.key).toMatch(/^[0-9a-f]{32}_Arte-Final-C_pdf$/);
    // Mesmo formato dos ids do Appwrite que as ações conferem.
    expect(put.key).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
    expect(await store.statFile(put.key)).toMatchObject({
      size: 10,
      mime: "application/pdf",
      name: "Arte-Final-C.pdf",
    });
    expect(
      new TextDecoder().decode((await store.getFile(put.key))!.bytes),
    ).toBe("0123456789");
    const part = await store.streamFile(put.key, { start: 2, end: 4 });
    expect(part?.range).toEqual({ start: 2, end: 4 });
    expect(await read(part!.body)).toBe("234");
    const whole = await store.streamFile(put.key);
    expect(await read(whole!.body)).toBe("0123456789");
    await store.removeFile(put.key);
    expect(await store.statFile(put.key)).toBeNull();
    expect(await store.getFile(put.key)).toBeNull();
    await store.removeFile(put.key);
  });
});

describe("arquivos no Supabase", () => {
  it("chave no formato dos ids e nome de volta, com ou sem extensão", () => {
    const id = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
    for (const name of [
      "foto.JPG",
      "sem extensão",
      "Planilha de preços — fornecedor 2026 (versão final revisada).xlsx",
      "a".repeat(300) + ".pdf",
      "../../etc/passwd",
    ]) {
      const key = fileKeyFor(name);
      expect(key).toMatch(id);
      expect(nameFromKey(key)).not.toContain("/");
    }
    expect(nameFromKey(fileKeyFor("foto.JPG"))).toBe("foto.jpg");
    expect(nameFromKey(fileKeyFor("sem extensão"))).toBe("sem-extensao");
    expect(nameFromKey(fileKeyFor("a".repeat(300) + ".pdf"))).toMatch(
      /^a+\.pdf$/,
    );
  });

  it("link assinado: o servidor escolhe a chave e o navegador sobe com PUT", async () => {
    fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co", "service");
    const { key, url } = await store.createSignedUpload("Arte.PDF");
    expect(key).toMatch(/^[0-9a-f]{32}_Arte_pdf$/);
    expect(url).toBe(
      `https://x.supabase.co/storage/v1/object/upload/sign/arquivos/${key}?token=t1`,
    );
    const put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: Buffer.from("abc"),
    });
    expect(put.ok).toBe(true);
    expect(await store.statFile(key)).toMatchObject({
      name: "Arte.pdf",
      mime: "application/pdf",
      size: 3,
    });
  });
});
