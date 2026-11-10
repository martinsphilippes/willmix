import "server-only";
import { executeQuery, type SankhyaRow } from "./sankhya-client";
import {
  IMPORT_TOPS,
  addressLine,
  boxQuantities,
  cityLabel,
  convert,
  pick,
} from "./sankhya-mapping";

/*
 * Ligações da carga do Sankhya (docs/SANKHYA.md, "Carga do Sankhya"): valores
 * que estão em outras tabelas do ERP. Cada consulta é só leitura, com
 * SELECT * (os nomes de coluna variam entre versões) e tolerante: se a
 * tabela ou a coluna não existir, aquele valor fica vazio e a carga segue.
 */

const code = (v: unknown) => (v == null ? "" : String(v).trim());

/** Lista de inteiros para o IN (só números; vazia vira -1). */
const ints = (values: unknown[]) => {
  const list = [
    ...new Set(
      values.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0),
    ),
  ];
  return list.length ? list.join(", ") : "-1";
};

/** Consulta tolerante: erro vira lista vazia. */
async function rows(sql: string): Promise<SankhyaRow[]> {
  try {
    return (await executeQuery(sql)).rows;
  } catch {
    return [];
  }
}

const byKey = (list: SankhyaRow[], column: string) => {
  const map = new Map<string, SankhyaRow>();
  for (const r of list)
    if (!map.has(code(r[column]))) map.set(code(r[column]), r);
  return map;
};

/* ---- Parceiros: cidade, país, endereço e contato ---- */

export interface PartnerExtra {
  city: string | null;
  country: string | null;
  address: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export async function partnerExtras(
  partners: SankhyaRow[],
): Promise<Map<string, PartnerExtra>> {
  const out = new Map<string, PartnerExtra>();
  if (!partners.length) return out;
  const col = (c: string) => partners.map((p) => p[c]);
  const [cities, streets, districts, contacts] = await Promise.all([
    rows(`SELECT * FROM TSICID WHERE CODCID IN (${ints(col("CODCID"))})`),
    rows(`SELECT * FROM TSIEND WHERE CODEND IN (${ints(col("CODEND"))})`),
    rows(`SELECT * FROM TSIBAI WHERE CODBAI IN (${ints(col("CODBAI"))})`),
    rows(
      `SELECT * FROM TGFCTT WHERE CODPARC IN (${ints(col("CODPARC"))}) ORDER BY CODPARC, CODCONTATO`,
    ),
  ]);
  const states = await rows(
    `SELECT * FROM TSIUFS WHERE CODUF IN (${ints(cities.map((c) => c.UF))})`,
  );
  const countries = await rows(
    `SELECT * FROM TSIPAI WHERE CODPAIS IN (${ints(states.map((s) => s.CODPAIS))})`,
  );
  const city = byKey(cities, "CODCID");
  const state = byKey(states, "CODUF");
  const country = byKey(countries, "CODPAIS");
  const street = byKey(streets, "CODEND");
  const district = byKey(districts, "CODBAI");
  const contact = byKey(
    contacts.filter((c) => pick(c, "NOMECONTATO")),
    "CODPARC",
  );
  for (const p of partners) {
    const c = city.get(code(p.CODCID));
    const s = c ? state.get(code(c.UF)) : undefined;
    const k = contact.get(code(p.CODPARC));
    out.set(code(p.CODPARC), {
      city: code(p.CODCID) && code(p.CODCID) !== "0" ? cityLabel(c, s) : null,
      country: pick(
        s ? country.get(code(s.CODPAIS)) : undefined,
        "DESCRICAO",
        "NOMEPAIS",
      ),
      address: addressLine(
        p,
        street.get(code(p.CODEND)),
        district.get(code(p.CODBAI)),
      ),
      contactName: pick(k, "NOMECONTATO"),
      contactEmail: pick(k, "EMAIL"),
      contactPhone: pick(k, "TELEFONE", "CELULAR"),
    });
  }
  return out;
}

/* ---- Produtos: fornecedor e preço da última compra, caixas ---- */

export interface ProductExtra {
  supplierCode: string | null;
  /** Valor unitário da última compra (R$) e o câmbio dela. */
  lastPrice: number | null;
  lastFx: number | null;
  lastNunota: string | null;
  masterBoxQty: number | null;
  innerBoxQty: number | null;
}

export async function productExtras(
  products: SankhyaRow[],
): Promise<Map<string, ProductExtra>> {
  const out = new Map<string, ProductExtra>();
  if (!products.length) return out;
  const list = ints(products.map((p) => p.CODPROD));
  const [purchases, volumes] = await Promise.all([
    rows(
      [
        "SELECT I.CODPROD, C.CODPARC, C.NUNOTA, I.VLRUNIT, C.VLRMOEDA",
        "FROM TGFITE I JOIN TGFCAB C ON C.NUNOTA = I.NUNOTA",
        `WHERE I.CODPROD IN (${list}) AND C.CODTIPOPER IN (${IMPORT_TOPS})`,
        "AND C.NUNOTA = (SELECT MAX(C2.NUNOTA) FROM TGFITE I2 JOIN TGFCAB C2 ON C2.NUNOTA = I2.NUNOTA",
        `WHERE I2.CODPROD = I.CODPROD AND C2.CODTIPOPER IN (${IMPORT_TOPS}))`,
      ].join(" "),
    ),
    rows(`SELECT * FROM TGFVOA WHERE CODPROD IN (${list})`),
  ]);
  const purchase = byKey(purchases, "CODPROD");
  for (const p of products) {
    const key = code(p.CODPROD);
    const last = purchase.get(key);
    out.set(key, {
      supplierCode: last ? code(last.CODPARC) || null : null,
      lastPrice: last
        ? (convert("number", last.VLRUNIT, last) as number | null)
        : null,
      lastFx: last
        ? (convert("number", last.VLRMOEDA, last) as number | null)
        : null,
      lastNunota: last ? code(last.NUNOTA) : null,
      ...boxQuantities(volumes.filter((v) => code(v.CODPROD) === key)),
    });
  }
  return out;
}

/* ---- Financeiro: tipo de título ---- */

export async function titleTypeNames(
  financial: SankhyaRow[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = ints(financial.map((f) => f.CODTIPTIT));
  if (list === "-1") return out;
  for (const r of await rows(
    `SELECT * FROM TGFTIT WHERE CODTIPTIT IN (${list})`,
  )) {
    const name = pick(r, "DESCRTIPTIT", "DESCRICAO");
    if (name) out.set(code(r.CODTIPTIT), name);
  }
  return out;
}

/** Parceiros por código (transportadoras dos pedidos), com SELECT *. */
export async function partnersByCode(codes: unknown[]): Promise<SankhyaRow[]> {
  const list = ints(codes);
  if (list === "-1") return [];
  return rows(`SELECT * FROM TGFPAR WHERE CODPARC IN (${list})`);
}
