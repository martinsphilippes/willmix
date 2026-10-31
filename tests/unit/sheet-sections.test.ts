import { describe, expect, it } from "vitest";
import {
  SHEET_SECTIONS,
  SHEET_SECTION_FIELDS,
  initialSheetSection,
  sectionOfField,
  sheetSectionsView,
} from "@/components/sheet-sections-view";
import {
  REQUIRED_SHEET_PHOTOS,
  SHEET_REQUIRED_FIELDS,
} from "@/lib/services/purchase-sheet-calc";
import type { Translate } from "@/i18n";

const t = ((key: string, vars?: Record<string, unknown>) =>
  key === "sheet.sections.missing"
    ? `Faltam: ${String(vars?.fields)}`
    : key) as unknown as Translate;

describe("ficha em blocos", () => {
  it("todo campo que conta para concluir tem um bloco", () => {
    for (const key of [
      ...SHEET_REQUIRED_FIELDS,
      "lot1",
      ...Object.values(REQUIRED_SHEET_PHOTOS),
    ])
      expect(sectionOfField(key), key).not.toBeNull();
    expect(sectionOfField("naoExiste")).toBeNull();
  });

  it("nenhum campo aparece em dois blocos", () => {
    const seen = new Set<string>();
    for (const section of SHEET_SECTIONS)
      for (const f of SHEET_SECTION_FIELDS[section]) {
        expect(seen.has(f), f).toBe(false);
        seen.add(f);
      }
  });

  it("linhas: o que falta em cada bloco, completo e opcional", () => {
    const { sections, labels } = sheetSectionsView(t, [
      "price",
      "moq",
      "scalePhoto",
    ]);
    const by = Object.fromEntries(sections.map((s) => [s.key, s]));
    expect(by.price.missing.map((m) => m.key)).toEqual(["price", "moq"]);
    expect(by.price.missing[0].label).toBe("sheet.field.price");
    expect(by.photos.missing.map((m) => m.key)).toEqual(["scalePhoto"]);
    expect(by.supplier.missing).toEqual([]);
    expect(by.supplier.optional).toBe(false);
    expect(by.customs.optional).toBe(true);
    expect(by.ecommerce.optional).toBe(true);
    expect(by.schedule.optional).toBe(false);
    expect(labels.missingBefore).toBe("Faltam: ");
    expect(labels.missingAfter).toBe("");
  });

  it("ficha mestre: programação opcional e fotos levam ao card do produto", () => {
    const { sections } = sheetSectionsView(t, [], {
      master: true,
      photosHref: "#photos",
    });
    const by = Object.fromEntries(sections.map((s) => [s.key, s]));
    expect(by.schedule.optional).toBe(true);
    expect(by.photos.href).toBe("#photos");
    expect(by.photos.optional).toBe(false);
  });

  it("abre de início o primeiro bloco com pendência", () => {
    expect(initialSheetSection([])).toBe("supplier");
    expect(initialSheetSection(["cbmPerCarton", "price"])).toBe("carton");
    expect(initialSheetSection(["lot1"])).toBe("schedule");
    expect(initialSheetSection(["rulerPhoto"])).toBe("photos");
    // Fotos fora da ficha (cadastro do produto): não é um bloco que abre.
    expect(initialSheetSection(["rulerPhoto"], { photosHref: "#photos" })).toBe(
      "supplier",
    );
  });
});
