import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  REQUIRED_SHEET_PHOTOS,
  SHEET_REQUIRED_FIELDS,
} from "@/lib/services/purchase-sheet-calc";

/*
 * Ficha de compra em blocos: a tabela no alto da ficha tem uma linha por
 * bloco (Fornecedor, Produto, Caixa…) e diz o que falta em cada um; tocar na
 * linha abre o bloco embaixo. Aqui fica o modelo (que campo é de qual bloco e
 * o estado de cada linha); o desenho e o abre/fecha são do SheetSectionsNav.
 */

export const SHEET_SECTIONS = [
  "supplier",
  "product",
  "carton",
  "price",
  "schedule",
  "photos",
  "customs",
  "ecommerce",
] as const;
export type SheetSectionKey = (typeof SHEET_SECTIONS)[number];

/** Campos da ficha (chave da âncora) por bloco, na ordem em que aparecem. */
export const SHEET_SECTION_FIELDS: Record<SheetSectionKey, readonly string[]> =
  {
    supplier: [
      "sheetDate",
      "location",
      "supplierName",
      "supplierStore",
      "supplierPhone",
      "factoryItemCode",
    ],
    product: [
      "netWeightPcKg",
      "grossWeightPcKg",
      "capacityMl",
      "colorAssortment",
      "material",
      "powerSource",
      "powerDetail",
    ],
    carton: [
      "masterCartonQty",
      "innerQty",
      "packageType",
      "heightCm",
      "widthCm",
      "lengthCm",
      "cbmPerCarton",
    ],
    price: ["incoterm", "currency", "price", "moq"],
    schedule: ["productionStartAt", "containerType", "lot1"],
    photos: Object.values(REQUIRED_SHEET_PHOTOS),
    customs: [
      "ncm",
      "importTaxPercent",
      "ipiPercent",
      "dumping",
      "dumpingNote",
      "averagePrice",
      "certificationRequired",
      "certificationNote",
    ],
    ecommerce: ["ecommerceDescription", "notes"],
  };

/** Bloco de um campo (nulo para chave desconhecida). */
export function sectionOfField(key: string): SheetSectionKey | null {
  for (const section of SHEET_SECTIONS)
    if (SHEET_SECTION_FIELDS[section].includes(key)) return section;
  return null;
}

export interface SheetSectionRow {
  key: SheetSectionKey;
  label: string;
  /** Campos obrigatórios ainda vazios neste bloco, com o rótulo da ficha. */
  missing: Array<{ key: string; label: string }>;
  /** Bloco sem campo obrigatório (completo ou não, não trava a ficha). */
  optional: boolean;
  /** Bloco fora da ficha (fotos do cadastro do produto): a linha leva até lá. */
  href?: string;
}

export interface SheetSectionsLabels {
  title: string;
  section: string;
  status: string;
  complete: string;
  missingBefore: string;
  missingAfter: string;
  optional: string;
  showAll: string;
  showOne: string;
  hint: string;
}

/**
 * Linhas da tabela de blocos. `missing` é a lista do servidor (chaves de
 * campo e de foto); campos que não contam para concluir ficam "opcional".
 * Ficha mestre: sem início de produção nem lotes (a programação é opcional) e
 * as fotos ficam no card de fotos do produto (`photosHref`).
 */
export function sheetSectionsView(
  t: Translate,
  missing: readonly string[],
  {
    master = false,
    photosHref,
    omit = [],
  }: {
    master?: boolean;
    photosHref?: string;
    /** Blocos que não aparecem para quem preenche (ex.: fornecedor sem Despachante). */
    omit?: readonly SheetSectionKey[];
  } = {},
): { sections: SheetSectionRow[]; labels: SheetSectionsLabels } {
  const required = new Set<string>([
    ...SHEET_REQUIRED_FIELDS,
    "lot1",
    ...Object.values(REQUIRED_SHEET_PHOTOS),
  ]);
  if (master) {
    required.delete("productionStartAt");
    required.delete("lot1");
  }
  const sections = SHEET_SECTIONS.filter((k) => !omit.includes(k)).map(
    (key): SheetSectionRow => {
      const fields = SHEET_SECTION_FIELDS[key];
      return {
        key,
        label: t(`sheet.section.${key}` as DictionaryKey),
        missing: fields
          .filter((f) => missing.includes(f))
          .map((f) => ({
            key: f,
            label: t(`sheet.field.${f}` as DictionaryKey),
          })),
        optional: !fields.some((f) => required.has(f)),
        href: key === "photos" ? photosHref : undefined,
      };
    },
  );
  const marker = "\u0001";
  const [missingBefore, missingAfter = ""] = t("sheet.sections.missing", {
    fields: marker,
  }).split(marker);
  return {
    sections,
    labels: {
      title: t("sheet.sections.title"),
      section: t("sheet.sections.section"),
      status: t("sheet.sections.status"),
      complete: t("sheet.sections.complete"),
      missingBefore,
      missingAfter,
      optional: t("sheet.sections.optional"),
      showAll: t("sheet.sections.showAll"),
      showOne: t("sheet.sections.showOne"),
      hint: t("sheet.sections.hint"),
    },
  };
}

/**
 * Bloco aberto de início: o primeiro com pendência (fora o de fotos quando
 * ele fica em outra parte da página), senão o Fornecedor. O servidor já
 * esconde os outros; a tabela de blocos troca depois.
 */
export function initialSheetSection(
  missing: readonly string[],
  { photosHref }: { photosHref?: string } = {},
): SheetSectionKey {
  for (const section of SHEET_SECTIONS) {
    if (section === "photos" && photosHref) continue;
    if (SHEET_SECTION_FIELDS[section].some((f) => missing.includes(f)))
      return section;
  }
  return "supplier";
}
