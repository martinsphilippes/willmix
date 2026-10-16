import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Especificação do produto montada com os dados do cadastro e da ficha
 * mestre: uma informação por linha, legível; só dados do produto; acompanha
 * os dados enquanto não for escrita à mão.
 */
withTempStore();

const { translator } = await import("@/i18n");
const spec = await import("@/lib/product-spec");
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const pm = await import("@/lib/services/product-sheet");
type User = import("@/lib/db").User;

const labels = spec.productSpecLabels(translator("pt"));
let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("texto da especificação", () => {
  it("uma linha por informação, números em português, sem dados comerciais", () => {
    const text = spec.buildProductSpec(
      {
        material: "VIDRO BOROSSILICATO",
        color: "TRANSPARENTE",
        colorPantones: [{ code: "185 C" }],
        capacityMl: 1500,
        lengthCm: 20,
        widthCm: 12,
        heightCm: 25.5,
        netWeightKg: 0.4,
        grossWeightKg: 0.55,
        powerSource: "battery",
        powerDetail: "2X AA",
        packageType: "COLOR BOX",
        masterBoxQty: 24,
        innerBoxQty: 6,
        boxLengthCm: 60,
        boxWidthCm: 40,
        boxHeightCm: 30,
      },
      labels,
    );
    expect(text).toBe(
      [
        "Material: Vidro borossilicato",
        "Cor: Transparente / PANTONE 185 C",
        "Capacidade: 1.500 ml",
        "Medidas do produto: 20 × 12 × 25,5 cm (C × L × A)",
        "Peso por unidade: 0,4 kg líquido · 0,55 kg bruto",
        "Energia: Bateria / pilha (2X AA)",
        "Embalagem: Color box",
        "Caixa master: 24 peças · 6 por caixa interna · 60 × 40 × 30 cm · 0,072 m³",
      ].join("\n"),
    );
    expect(text).not.toMatch(/USD|MOQ|preço/i);
  });

  it("só o que existe; Pantone que já está na cor não repete; sem energia não aparece", () => {
    expect(spec.buildProductSpec({}, labels)).toBe("");
    expect(
      spec.buildProductSpec(
        {
          color: "BRANCO / PANTONE 185 C",
          colorPantones: [{ code: "185 C" }, { code: "Black C" }],
          powerSource: "none",
          lengthCm: 10,
        },
        labels,
      ),
    ).toBe("Cor: Branco / PANTONE 185 C / PANTONE Black C");
    // Caixa interna de 1 peça (ou igual à master) não diz nada: fica de fora.
    expect(
      spec.buildProductSpec({ masterBoxQty: 4, innerBoxQty: 1 }, labels),
    ).toBe("Caixa master: 4 peças");
  });

  it("maiúsculas viram frase; siglas, números e Pantone ficam", () => {
    expect(spec.readableText("AÇO INOX 304")).toBe("Aço inox 304");
    expect(spec.readableText("PVC ATÓXICO")).toBe("PVC atóxico");
    expect(spec.readableText("WHITE / PANTONE 185 C")).toBe(
      "White / PANTONE 185 C",
    );
    expect(spec.readableText("Vidro temperado")).toBe("Vidro temperado");
    expect(spec.sameSpec("a\r\nb  ", "a\nb")).toBe(true);
  });
});

describe("especificação no cadastro", () => {
  it("vazia é preenchida quando os dados mudam; acompanha enquanto automática; escrita à mão fica", async () => {
    const store = getStore();
    await store.update("products", "prod-piscina", { specification: null });
    await pm.saveProductSheet(admin, "prod-piscina", {
      packageType: "COLOR BOX",
      capacityMl: 2000,
    });
    const first = (await store.get("products", "prod-piscina"))!.specification;
    expect(first).toContain("Embalagem: Color box");
    expect(first).toContain("Capacidade: 2.000 ml");
    expect(first).toContain("Material: PVC 0,4 mm");
    // Automática: acompanha a mudança.
    await pm.saveProductSheet(admin, "prod-piscina", { capacityMl: 2500 });
    expect(
      (await store.get("products", "prod-piscina"))!.specification,
    ).toContain("Capacidade: 2.500 ml");
    // Escrita à mão: não muda mais.
    await store.update("products", "prod-piscina", {
      specification: "Piscina infantil redonda, com válvula.",
    });
    await pm.saveProductSheet(admin, "prod-piscina", { capacityMl: 3000 });
    expect((await store.get("products", "prod-piscina"))!.specification).toBe(
      "Piscina infantil redonda, com válvula.",
    );
  });
});
