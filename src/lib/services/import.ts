import "server-only";

import { getStore, PARTY_TYPES, type User } from "@/lib/db";
import { audit } from "./audit";
import { DEFAULT_PREPARATION_REQUIREMENTS } from "@/lib/workflow/stages";

export const IMPORT_COLUMNS: Record<string, string[]> = {
  parties: ["type", "name", "country", "email", "phone", "taxId"],
  products: ["line", "name", "sku", "specification"],
  lines: ["name"],
};

/** Parser CSV simples: vírgula ou ponto e vírgula, aspas duplas, cabeçalho obrigatório. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const sep =
    (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === sep && !quoted) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };
  const header = split(lines[0]).map((h) => h.replace(/^﻿/, ""));
  return lines.slice(1).map((line) => {
    const values = split(line);
    return Object.fromEntries(header.map((h, i) => [h, values[i] ?? ""]));
  });
}

export async function importCsv(user: User, entity: string, text: string) {
  const rows = parseCsv(text);
  const store = getStore();
  let created = 0;
  let skipped = 0;

  if (entity === "parties") {
    for (const row of rows) {
      const type = row.type?.toLowerCase();
      if (!(PARTY_TYPES as readonly string[]).includes(type) || !row.name) {
        skipped++;
        continue;
      }
      await store.create("parties", {
        type: type as never,
        name: row.name,
        country: row.country || null,
        email: row.email || null,
        phone: row.phone || null,
        taxId: row.taxId || null,
        notes: null,
        active: true,
      });
      created++;
    }
  } else if (entity === "lines") {
    for (const row of rows) {
      if (!row.name) {
        skipped++;
        continue;
      }
      await store.create("product_lines", {
        name: row.name,
        manualDocumentId: null,
        requirements: DEFAULT_PREPARATION_REQUIREMENTS,
        active: true,
      });
      created++;
    }
  } else if (entity === "products") {
    const lines = await store.list("product_lines");
    for (const row of rows) {
      const line = lines.find(
        (l) =>
          l.name.toLowerCase() === (row.line ?? "").toLowerCase() ||
          l.id === row.line,
      );
      if (!line || !row.name) {
        skipped++;
        continue;
      }
      await store.create("products", {
        lineId: line.id,
        name: row.name,
        sku: row.sku || null,
        specification: row.specification || null,
        active: true,
      });
      created++;
    }
  } else {
    throw new Error("invalid_entity");
  }
  await audit(
    user,
    "import.csv",
    entity,
    "bulk",
    `${created} criados, ${skipped} ignorados`,
  );
  return { created, skipped };
}
