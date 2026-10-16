import { z } from "zod";
import { pantoneLabel, parsePantoneRefs } from "@/lib/pantone";
import { cutAtSeparator } from "@/lib/pantone/color-text";
import { parseNumberInput } from "@/lib/number-input";
import {
  SHEET_CURRENCIES,
  SHEET_INCOTERMS,
  SHEET_POWER_SOURCES,
} from "@/lib/db/schema";
import type { SheetInput } from "@/lib/services/purchase-sheet";
import { MAX_LOTS } from "@/lib/services/purchase-sheet-calc";
import { str } from "./helpers";

/*
 * Leitura do formulário da ficha de compra (pedido, cotação e mestre). Não é
 * "use server": só ajuda as Server Actions de ./purchase-sheet.ts (e os testes).
 */

/** Campo ausente = não mexe; vazio = limpa; número como as pessoas digitam. */
function num(form: FormData, key: string, opts: { int?: boolean } = {}) {
  if (!form.has(key)) return undefined;
  const value = parseNumberInput(String(form.get(key) ?? ""), opts);
  if (value === null) return null;
  const schema = opts.int
    ? z.number().int().min(0).max(100_000_000)
    : z.number().min(0).max(100_000_000);
  return schema.parse(value);
}
function text(form: FormData, key: string, max: number) {
  if (!form.has(key)) return undefined;
  const raw = String(form.get(key) ?? "").trim();
  return raw ? z.string().max(max).parse(raw) : null;
}
function choice<T extends readonly string[]>(
  form: FormData,
  key: string,
  values: T,
): T[number] | null | undefined {
  if (!form.has(key)) return undefined;
  const raw = String(form.get(key) ?? "").trim();
  return raw
    ? z.enum(values as unknown as [string, ...string[]]).parse(raw)
    : null;
}
function date(form: FormData, key: string) {
  if (!form.has(key)) return undefined;
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return null;
  return (
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(raw) + "T00:00:00.000Z"
  );
}

/**
 * Ficha lida do formulário. Campo que não dá para ler (ex.: "1.000,00,5" no
 * MOQ) NÃO derruba o envio: fica de fora (não muda) e entra em `invalid`; o
 * resto é salvo e a tela aponta o campo. Antes, um campo inválido descartava
 * a ficha inteira e a tela voltava em branco.
 */
export function parseSheet(form: FormData): {
  input: SheetInput;
  invalid: string[];
} {
  const invalid: string[] = [];
  const safe = <T>(key: string, read: () => T): T | undefined => {
    try {
      return read();
    } catch {
      invalid.push(key);
      return undefined;
    }
  };
  const input: SheetInput = {
    sheetDate: safe("sheetDate", () => date(form, "sheetDate")),
    location: safe("location", () => text(form, "location", 80)),
    supplierName: safe("supplierName", () => text(form, "supplierName", 160)),
    supplierStore: safe("supplierStore", () => text(form, "supplierStore", 60)),
    supplierPhone: safe("supplierPhone", () => text(form, "supplierPhone", 40)),
    factoryItemCode: safe("factoryItemCode", () =>
      text(form, "factoryItemCode", 60),
    ),
    incoterm: safe("incoterm", () => choice(form, "incoterm", SHEET_INCOTERMS)),
    currency: safe("currency", () =>
      choice(form, "currency", SHEET_CURRENCIES),
    ),
    price: safe("price", () => num(form, "price")),
    moq: safe("moq", () => num(form, "moq", { int: true })),
    masterCartonQty: safe("masterCartonQty", () =>
      num(form, "masterCartonQty", { int: true }),
    ),
    innerQty: safe("innerQty", () => num(form, "innerQty", { int: true })),
    netWeightPcKg: safe("netWeightPcKg", () => num(form, "netWeightPcKg")),
    grossWeightPcKg: safe("grossWeightPcKg", () =>
      num(form, "grossWeightPcKg"),
    ),
    cbmPerCarton: safe("cbmPerCarton", () => num(form, "cbmPerCarton")),
    heightCm: safe("heightCm", () => num(form, "heightCm")),
    widthCm: safe("widthCm", () => num(form, "widthCm")),
    lengthCm: safe("lengthCm", () => num(form, "lengthCm")),
    // Mililitros inteiros: "1.000 ml" é mil, não 1.
    capacityMl: safe("capacityMl", () =>
      num(form, "capacityMl", { int: true }),
    ),
    packageType: safe("packageType", () => text(form, "packageType", 120)),
    colorAssortment: safe("colorAssortment", () =>
      text(form, "colorAssortment", 200),
    ),
    // Só vai ao banco quando o formulário traz o campo (coluna nova; antes
    // da publicação do esquema, fichas sem cor Pantone seguem salvando).
    ...(form.has("colorPantones")
      ? {
          colorPantones: safe("colorPantones", () =>
            parsePantoneRefs(str(form, "colorPantones")),
          ),
        }
      : {}),
    material: safe("material", () => text(form, "material", 200)),
    powerSource: safe("powerSource", () =>
      choice(form, "powerSource", SHEET_POWER_SOURCES),
    ),
    powerDetail: safe("powerDetail", () => text(form, "powerDetail", 60)),
    productionStartAt: safe("productionStartAt", () =>
      date(form, "productionStartAt"),
    ),
    containerType: safe("containerType", () => text(form, "containerType", 20)),
    ecommerceDescription: safe("ecommerceDescription", () =>
      text(form, "ecommerceDescription", 4000),
    ),
    notes: safe("notes", () => text(form, "notes", 2000)),
    ncm: safe("ncm", () => {
      // "9503.00.21", "9503 00 21", "9503-00-21", "9503,00,21" e "95030021"
      // valem o mesmo.
      const raw = text(form, "ncm", 20);
      if (raw === undefined || raw === null) return raw;
      const v = raw.replace(/[\s-]/g, "").replace(/,/g, ".");
      return v
        ? z
            .string()
            .regex(/^[\d.]{4,12}$/)
            .parse(v)
        : null;
    }),
    importTaxPercent: safe("importTaxPercent", () =>
      num(form, "importTaxPercent"),
    ),
    ipiPercent: safe("ipiPercent", () => num(form, "ipiPercent")),
  };
  // Sem texto de cor mas com Pantone escolhidas: o texto vira a lista de códigos
  // (o campo "Cor / sortimento" continua obrigatório e legível fora do portal).
  if (!input.colorAssortment && input.colorPantones?.length)
    input.colorAssortment = cutAtSeparator(
      input.colorPantones.map((c) => pantoneLabel(c)).join(" / "),
      200,
    );
  if (form.has("lot1Cartons")) {
    // A programação vai inteira ou não vai (uma linha ilegível não apaga as outras).
    const lots = safe("lots", () =>
      Array.from({ length: MAX_LOTS }, (_, i) => ({
        departureIntervalDays:
          num(form, `lot${i + 1}Interval`, { int: true }) ?? null,
        masterCartons: num(form, `lot${i + 1}Cartons`, { int: true }) ?? null,
      })),
    );
    if (lots) input.lots = lots;
  }
  // Caixas da programação e peças por caixa decidem a quantidade (e o valor)
  // do pedido: se um dos dois não deu para ler, nenhum dos dois muda (gravar
  // só um mudaria a quantidade com a programação antiga).
  if (invalid.includes("lots") || invalid.includes("masterCartonQty")) {
    delete input.lots;
    delete input.masterCartonQty;
    for (const k of ["lots", "masterCartonQty"])
      if (form.has(k === "lots" ? "lot1Cartons" : k) && !invalid.includes(k))
        invalid.push(k);
  }
  for (const key of Object.keys(input) as (keyof SheetInput)[])
    if (input[key] === undefined) delete input[key];
  return { input, invalid };
}

/** Volta com os campos que não deu para ler (o resto já foi salvo). */
export function invalidTarget(back: string, invalid: string[]) {
  const url = new URL(back, "http://x");
  url.searchParams.set("error", "invalid_fields");
  url.searchParams.set("fields", invalid.join(","));
  url.searchParams.set("at", String(Date.now()));
  return url.pathname + url.search + url.hash;
}
