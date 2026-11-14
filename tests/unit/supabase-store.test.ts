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

/** Ordem do Postgres: número como número; nulo por último em ordem crescente. */
function pgCompare(x: unknown, y: unknown, dir: string) {
  // Nulo é o maior: por último em ordem crescente, primeiro em decrescente.
  const c =
    x == null || y == null
      ? x == null && y == null
        ? 0
        : x == null
          ? 1
          : -1
      : typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x) < String(y)
          ? -1
          : String(x) > String(y)
            ? 1
            : 0;
  return dir === "desc" ? -c : c;
}

/** Itens de uma lista da árvore lógica (vírgulas fora de aspas e parênteses). */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = false;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === "\\") cur += s[++i];
      else if (c === '"') quote = false;
      continue;
    }
    if (c === '"') quote = true;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

const unquote = (v: string) =>
  v.startsWith('"') ? v.slice(1, -1).replace(/\\(.)/g, "$1") : v;

/** `col.op.valor` (gt, gte, lt, lte, eq, is.null, not.is.null, not.is.true). */
function condition(row: Row, expr: string): boolean {
  const dot = expr.indexOf(".");
  const col = expr.slice(0, dot);
  let rest = expr.slice(dot + 1);
  const negate = rest.startsWith("not.");
  if (negate) rest = rest.slice(4);
  const op = rest.slice(0, rest.indexOf("."));
  const raw = unquote(rest.slice(op.length + 1));
  const x = row[col];
  const value = typeof x === "number" ? Number(raw) : raw;
  let ok: boolean;
  if (op === "is")
    ok = raw === "null" ? x == null : raw === "true" ? x === true : x === false;
  else if (x == null) ok = false;
  else if (op === "eq") ok = pgCompare(x, value, "asc") === 0;
  else if (op === "gt") ok = pgCompare(x, value, "asc") > 0;
  else if (op === "lt") ok = pgCompare(x, value, "asc") < 0;
  else if (op === "gte") ok = pgCompare(x, value, "asc") >= 0;
  else if (op === "lte") ok = pgCompare(x, value, "asc") <= 0;
  else throw new Error(`operador não suportado: ${op}`);
  return negate ? !ok : ok;
}

/** `or(...)`, `and(...)` ou uma condição. */
function logic(row: Row, expr: string): boolean {
  const m = /^(or|and)\((.*)\)$/.exec(expr);
  if (!m) return condition(row, expr);
  const items = splitTop(m[2]).map((e) => logic(row, e));
  return m[1] === "or" ? items.some(Boolean) : items.every(Boolean);
}

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
      if (k === "or") {
        if (!logic(row, `or${v}`)) return false;
      } else if (v === "is.null") {
        if (row[k] != null) return false;
      } else if (v.startsWith("in.")) {
        if (!decodeIn(v.slice(3)).includes(row[k] as never)) return false;
      } else if (v.startsWith("eq.")) {
        if (String(row[k]) !== v.slice(3)) return false;
      } else if (/^(gte?|lte?|not)\./.test(v)) {
        if (!condition(row, `${k}.${v}`)) return false;
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
          const c = pgCompare(a[col], b[col], dir);
          if (c) return c;
        }
        return 0;
      });
      const offset = Number(params.get("offset") ?? 0);
      const limit = Number(params.get("limit") ?? 1000);
      const page = hit.slice(offset, offset + limit);
      // Prefer: count=exact → total no Content-Range, como o PostgREST.
      const prefer = (init.headers as Record<string, string> | undefined)
        ?.Prefer;
      if (prefer === "count=exact")
        return new Response(JSON.stringify(page), {
          status: 200,
          headers: {
            "content-range": `${offset}-${offset + page.length - 1}/${hit.length}`,
          },
        });
      return json(page);
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

describe("listas grandes", () => {
  it("lê a tabela inteira (sem o teto antigo de 10 mil), com páginas em paralelo", async () => {
    const fake = fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co", "key");
    const rows = Array.from({ length: 12_345 }, (_, i) => ({
      id: `p${String(i).padStart(6, "0")}`,
      createdAt: "2026-11-11T00:00:00.000Z",
      updatedAt: "2026-11-11T00:00:00.000Z",
      name: `Produto ${i}`,
    }));
    fake.db.product_lines = rows;
    const all = await store.list("product_lines");
    expect(all).toHaveLength(12_345);
    expect(new Set(all.map((r) => r.id)).size).toBe(12_345);
    expect(all[12_344].id).toBe("p012344");
    // Com limite, para nele.
    expect(await store.list("product_lines", { limit: 1500 })).toHaveLength(
      1500,
    );
  });

  /*
   * Auditoria de performance (14/11/2026): a página seguinte vem pelo fim da
   * anterior (keyset), não por OFFSET (que relia as linhas puladas: N² ao ler
   * a tabela inteira), e sem a contagem exata (que rodava a consulta de novo).
   */
  it("páginas pelo fim da anterior: sem OFFSET, sem contagem, mesma ordem e conjunto", async () => {
    const fake = fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co", "key");
    fake.db.product_lines = Array.from({ length: 3_456 }, (_, i) => ({
      id: `p${String(i).padStart(6, "0")}`,
      // Muitas linhas no mesmo instante: o id desempata.
      createdAt: `2026-11-11T00:00:0${i % 7}.123456+00:00`,
      updatedAt: "2026-11-11T00:00:00.000Z",
      name: `Produto ${i}`,
    }));
    const all = await store.list("product_lines");
    expect(all).toHaveLength(3_456);
    expect(new Set(all.map((r) => r.id)).size).toBe(3_456);
    const lists = fake.calls.filter((c) => c.includes("/product_lines?"));
    expect(lists).toHaveLength(4);
    expect(lists.some((c) => c.includes("offset="))).toBe(false);
    // Fim da 1ª página: 494 linhas no segundo 0, 494 no 1 e 12 no 2 (a 12ª é a 79).
    // Na forma que o índice atende: coluna >= v e (coluna > v ou id > id).
    expect(decodeURIComponent(lists[1])).toContain(
      'createdAt=gte.2026-11-11T00:00:02.123456+00:00&or=(createdAt.gt."2026-11-11T00:00:02.123456+00:00",id.gt."p000079")',
    );
    expect(lists[0]).not.toContain("or=");
    const expected = [...fake.db.product_lines].sort(
      (a, b) =>
        pgCompare(a.createdAt, b.createdAt, "asc") ||
        pgCompare(a.id, b.id, "asc"),
    );
    expect(all.map((r) => r.id)).toEqual(expected.map((r) => r.id));
    // Limite acima de uma página: para nele, na mesma ordem.
    const some = await store.list("product_lines", { limit: 2_500 });
    expect(some.map((r) => r.id)).toEqual(
      expected.slice(0, 2_500).map((r) => r.id),
    );
  });

  it("ordem por coluna com repetidos e nulos, crescente e decrescente, com filtro", async () => {
    const fake = fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co", "key");
    // Nomes repetidos, vazios e com vírgula, ponto, parênteses e aspas.
    const names = [null, 'Ação "A", (1).', "B", "b", null, "Zé", "B"];
    fake.db.parties = Array.from({ length: 2_345 }, (_, i) => ({
      id: `id-${String((i * 7919) % 2_345).padStart(5, "0")}`,
      createdAt: "2026-11-11T00:00:00.000Z",
      updatedAt: "2026-11-11T00:00:00.000Z",
      name: names[i % names.length],
      type: i % 3 === 0 ? "customer" : "supplier",
      number: i % 11,
    }));
    for (const direction of ["asc", "desc"] as const)
      for (const orderBy of ["name", "number", "id"] as const) {
        const got = await store.list("parties", {
          filter: { type: "supplier" },
          // "number" não é coluna de parceiros: só a ordem do PostgREST falso.
          orderBy: orderBy as "name",
          direction,
        });
        const expected = fake.db.parties
          .filter((r) => r.type === "supplier")
          .sort(
            (a, b) =>
              pgCompare(a[orderBy], b[orderBy], direction) ||
              pgCompare(a.id, b.id, direction),
          );
        expect(got.map((r) => r.id)).toEqual(expected.map((r) => r.id));
      }
  });
});

describe("SupabaseStore.listColumns", () => {
  it("pede só as colunas escolhidas e devolve só elas", async () => {
    const { calls } = fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co", "service");
    await store.create("order_items", {
      orderId: "o1",
      productId: null,
      name: "Copo",
      quantity: 2,
      unit: "un",
      unitPrice: 1,
      variantId: null,
      variant: null,
      sankhyaCode: "9",
      sankhyaRefs: { grande: "x".repeat(50) },
    } as never);
    calls.length = 0;
    const rows = await store.listColumns("order_items", ["orderId", "name"], {
      filter: { orderId: "o1" },
    });
    expect(calls[0]).toContain("select=id,createdAt,updatedAt,orderId,name&");
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["createdAt", "id", "name", "orderId", "updatedAt"].sort(),
    );
  });
});

describe("SupabaseStore: busca por nome", () => {
  it("vira ilike com o texto limpo", async () => {
    const { calls } = fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co", "service");
    await store.list("parties", {
      filter: { type: "customer" },
      search: { column: "name", text: "joão*" },
      limit: 20,
    });
    expect(decodeURIComponent(calls[0])).toContain("name=ilike.*joão*");
    expect(decodeURIComponent(calls[0])).not.toContain("joão**");
  });
});

describe("SupabaseStore: histórico do Sankhya em espera", () => {
  it("listas gerais de etapas e pendências deixam de fora as linhas em espera", async () => {
    const { calls } = fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co", "service");
    await store.list("requirements", { filter: { status: ["pending"] } });
    await store.list("stages", { filter: { status: ["active"] } });
    await store.list("requirements", { filter: { orderId: "o1" } });
    await store.list("requirements", { filter: { stageId: "s1" } });
    await store.list("payments", { filter: { orderId: "o1" } });
    await store.list("orders", {});
    expect(calls[0]).toContain("held=not.is.true");
    expect(calls[1]).toContain("held=not.is.true");
    for (const call of calls.slice(2)) expect(call).not.toContain("held=");
  });
});

describe("SupabaseStore: gravação em lote e contagem", () => {
  it("PATCH com o filtro, listas longas em partes, e contagem sem trazer linhas", async () => {
    const { calls } = fakeSupabase();
    const store = new SupabaseStore("https://x.supabase.co", "service");
    const ids = Array.from({ length: 150 }, (_, i) => `o${i}`);
    await store.updateWhere(
      "requirements",
      { orderId: ids, held: true },
      {
        held: null,
      },
    );
    const patches = calls.filter((c) => c.startsWith("PATCH"));
    expect(patches).toHaveLength(2);
    for (const call of patches) expect(call).toContain("held=eq.true");
    calls.length = 0;
    await store.updateWhere("requirements", {}, { held: null });
    expect(calls).toHaveLength(0);
    await store.count("stages", { held: true });
    expect(calls[0]).toContain("select=id&held=eq.true");
    expect(calls[0]).toContain("limit=1");
  });
});
