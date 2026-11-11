import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Cópia Appwrite → Supabase (docs/SUPABASE.md, etapa 4): todas as tabelas
 * com o mesmo id e datas, em lotes com cursor; arquivos dos documentos com a
 * mesma chave; contas dos usuários ativos; recomeçar do zero com a palavra;
 * só admin e só antes da virada.
 */
withTempStore();

const { getStore, TABLES } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { uploadDocument } = await import("@/lib/services/documents");
const copy = await import("@/lib/services/supabase-copy");
type User = import("@/lib/db").User;
type TableName = import("@/lib/db").TableName;
type Row = Record<string, unknown> & { id: string };

let admin: User;
let joao: User;
beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  await uploadDocument(
    admin,
    new File(["%PDF-1.4 arte"], "arte.pdf", { type: "application/pdf" }),
    { type: "other", visibility: "internal" } as never,
  ).catch(() => undefined);
});

/** "Appwrite" = o store de memória (ordem por id, cursor depois do id). */
function fakes() {
  const store = getStore();
  const target = new Map<string, Map<string, Row>>();
  const files = new Map<string, Uint8Array>();
  const accounts = new Set<string>();
  const deps: import("@/lib/services/supabase-copy").CopyDeps = {
    source: {
      async listPage(table: TableName, after: string | null, limit: number) {
        const rows = ((await store.list(table)) as unknown as Row[]).sort(
          (a, b) => (a.id < b.id ? -1 : 1),
        );
        const start = after ? rows.findIndex((r) => r.id === after) + 1 : 0;
        return rows.slice(start, start + limit);
      },
      async getFile(key: string) {
        const f = await store.getFile(key);
        return f ? { bytes: f.bytes, mime: f.mime } : null;
      },
    },
    target: {
      async upsertRaw(table: TableName, rows: Row[]) {
        const t = target.get(table) ?? new Map<string, Row>();
        for (const r of rows) t.set(r.id, r);
        target.set(table, t);
      },
      async statFile(key: string) {
        return files.has(key) ? {} : null;
      },
      async putFileAt(key: string, bytes: Uint8Array) {
        files.set(key, bytes);
      },
      async clearTable(table: TableName) {
        target.delete(table);
      },
    },
    auth: {
      async ensureUser(email: string) {
        if (accounts.has(email)) return "existing" as const;
        accounts.add(email);
        return "created" as const;
      },
    },
  };
  return { deps, target, files, accounts };
}

describe("cópia para o Supabase", () => {
  it("copia tabelas, arquivos e contas até concluir; de novo não duplica", async () => {
    const { deps, target, files, accounts } = fakes();
    await expect(copy.runCopy(joao, { deps })).rejects.toThrow("forbidden");

    let p = await copy.runCopy(admin, { deps, budgetMs: 0 });
    for (let i = 0; i < 200 && p.phase !== "done"; i++)
      p = await copy.runCopy(admin, { deps, budgetMs: 0 });
    expect(p.phase).toBe("done");

    const store = getStore();
    for (const table of Object.keys(TABLES) as TableName[]) {
      const source = await store.list(table);
      const copied = target.get(table) ?? new Map();
      // A marcação da cópia e a auditoria dela (gravada no fim) não contam.
      const expected = source.filter(
        (r) =>
          (r as { key?: string }).key !== "supabase.copy" &&
          !String((r as { action?: string }).action ?? "").startsWith(
            "supabase.copy",
          ),
      );
      expect(copied.size, table).toBe(expected.length);
      for (const r of expected) {
        const got = copied.get(r.id)!;
        expect(got.createdAt, table).toBe(r.createdAt);
      }
    }
    // A marcação da cópia não vai para o Supabase.
    expect(
      [...(target.get("settings")?.values() ?? [])].some(
        (r) => r.key === "supabase.copy",
      ),
    ).toBe(false);

    const docs = await store.list("documents");
    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) expect(files.has(d.storageKey), d.name).toBe(true);
    expect(p.files.copied).toBe(docs.length);

    const active = (await store.list("users")).filter(
      (u) => u.active && u.email,
    );
    expect(accounts.size).toBe(active.length);
    expect(p.accounts.created).toBe(active.length);

    // Recomeçar: palavra errada recusa; certa esvazia e roda de novo igual.
    await expect(copy.resetCopy(admin, "errado", { deps })).rejects.toThrow(
      "copy_confirm",
    );
    await copy.resetCopy(admin, "copiar", { deps });
    expect(target.size).toBe(0);
    p = await copy.runCopy(admin, { deps });
    expect(p.phase).toBe("done");
    expect(target.get("users")?.size).toBe((await store.list("users")).length);
    expect(p.files).toMatchObject({ copied: 0, existing: docs.length });
    expect(p.accounts).toMatchObject({ created: 0, existing: active.length });
  });

  it("depois da virada (DATA_MODE=supabase) a cópia fica desligada", async () => {
    const { deps } = fakes();
    const before = process.env.DATA_MODE;
    process.env.DATA_MODE = "supabase";
    try {
      await expect(copy.runCopy(admin, { deps })).rejects.toThrow(
        "already_on_supabase",
      );
    } finally {
      process.env.DATA_MODE = before;
    }
  });
});
