import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { withTempStore } from "./setup";

/*
 * Fotos dos produtos do Sankhya (TGFPRO.IMAGEM em hexadecimal e AD_IMAGEM*):
 * formato pelos primeiros bytes, miniatura, uma foto por chamada, baixar de
 * novo só quando NUVERSAOIMG muda, coluna que não existe no ERP e link
 * /produto/{CODPROD}.jpg.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const st = await import("@/lib/integrations/sankhya-settings");
const sk = await import("@/lib/integrations/sankhya-client");
const img = await import("@/lib/integrations/sankhya-images");
const { runFullLoad, resetFullLoad } =
  await import("@/lib/integrations/sankhya-full-load");
type User = import("@/lib/db").User;
type Product = import("@/lib/db").Product;

let admin: User;
let a: Product;
let b: Product;
let jpegHex: string;
let pngHex: string;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  await st.saveSankhyaCredentials(
    {
      environment: "production",
      clientId: "c",
      clientSecret: "s",
      xToken: "x",
    },
    "admin",
  );
  const store = getStore();
  const products = await store.list("products");
  a = await store.update("products", products[0].id, { sankhyaCode: "23756" });
  b = await store.update("products", products[1].id, { sankhyaCode: "23800" });
  for (const p of await store.list("product_photos"))
    if (p.productId === a.id || p.productId === b.id)
      await store.remove("product_photos", p.id);
  const jpeg = await sharp({
    create: { width: 1200, height: 900, channels: 3, background: "#c33" },
  })
    .jpeg()
    .toBuffer();
  const png = await sharp({
    create: {
      width: 300,
      height: 300,
      channels: 4,
      background: { r: 0, g: 0, b: 255, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  jpegHex = jpeg.toString("hex").toUpperCase();
  pngHex = "0x" + png.toString("hex");
});
afterEach(() => vi.unstubAllGlobals());

interface FakeRow {
  CODPROD: number;
  NUVERSAOIMG: number | null;
  [column: string]: unknown;
}

/** Sankhya falso: TGFPRO com imagens; AD_IMAGEM04 não existe no ERP. */
function fakeSankhya(rows: FakeRow[], broken: number[] = []) {
  const sqls: string[] = [];
  const reply = (columns: string[], data: unknown[][]) =>
    new Response(
      JSON.stringify({
        status: "1",
        responseBody: {
          fieldsMetadata: columns.map((name) => ({ name })),
          rows: data,
        },
      }),
    );
  const imageCols = ["IMAGEM", "AD_IMAGEM05", "AD_IMAGEM02", "AD_IMAGEM03"];
  vi.stubGlobal("fetch", (async (
    input: RequestInfo | URL,
    init: RequestInit = {},
  ) => {
    if (String(input).endsWith("/authenticate"))
      return new Response(
        JSON.stringify({ access_token: "t", expires_in: 300 }),
      );
    const sql = JSON.parse(String(init.body)).requestBody.sql as string;
    sqls.push(sql);
    if (sql.includes("AD_IMAGEM04"))
      return new Response(
        JSON.stringify({
          status: "0",
          statusMessage: "Invalid column name 'AD_IMAGEM04'",
        }),
      );
    if (sql.includes("CODPROD < 0")) return reply(["N"], [[0]]);
    const gt = /CODPROD > (\d+)/.exec(sql);
    const le = /CODPROD <= (\d+)/.exec(sql);
    const eq = /CODPROD = (\d+)/.exec(sql);
    const hasAny = (r: FakeRow) => imageCols.some((c) => r[c] != null);
    const matching = rows.filter(
      (r) =>
        hasAny(r) &&
        (!gt || r.CODPROD > Number(gt[1])) &&
        (!le || r.CODPROD <= Number(le[1])) &&
        (!eq || r.CODPROD === Number(eq[1])),
    );
    if (sql.includes("NEXTCODE"))
      return reply(
        ["NEXTCODE", "REMAINING"],
        [
          [
            matching.length
              ? Math.min(...matching.map((r) => r.CODPROD))
              : null,
            matching.length,
          ],
        ],
      );
    // Foto que o gateway não entrega (HTTP 500 toda vez, como em 14/11/2026).
    if (eq && broken.includes(Number(eq[1])))
      return new Response(
        JSON.stringify({ status: 500, error: "Internal Server Error" }),
        { status: 500 },
      );
    if (eq) {
      const col = imageCols.find((c) => sql.includes(`, ${c} FROM`))!;
      const r = rows.find((x) => x.CODPROD === Number(eq[1]));
      return reply(
        ["CODPROD", "NUVERSAOIMG", col],
        r ? [[r.CODPROD, r.NUVERSAOIMG, r[col] ?? null]] : [],
      );
    }
    // Lista de versões: sem a imagem, só se a coluna tem algo.
    expect(sql).not.toMatch(/SELECT CODPROD, NUVERSAOIMG, IMAGEM/);
    return reply(
      ["CODPROD", "NUVERSAOIMG", ...imageCols.map((c) => `H_${c}`)],
      matching.map((r) => [
        r.CODPROD,
        r.NUVERSAOIMG,
        ...imageCols.map((c) => (r[c] == null ? 0 : 1)),
      ]),
    );
  }) as typeof fetch);
  return sqls;
}

const downloads = (sqls: string[]) =>
  sqls.filter((s) => /WHERE CODPROD = \d+$/.test(s));

describe("fotos do Sankhya", () => {
  it("formato pelos primeiros bytes; hex nulo ou inválido = sem foto", () => {
    expect(img.decodeSankhyaImage(jpegHex)?.mime).toBe("image/jpeg");
    expect(img.decodeSankhyaImage(pngHex)?.ext).toBe("png");
    expect(img.decodeSankhyaImage(null)).toBeNull();
    expect(img.decodeSankhyaImage("")).toBeNull();
    expect(img.decodeSankhyaImage("ZZ")).toBeNull();
    expect(img.decodeSankhyaImage("00112233")).toBeNull();
  });

  it("miniatura com lado maior de 640 px", async () => {
    const thumb = await img.makeThumbnail(
      img.decodeSankhyaImage(jpegHex)!.bytes,
    );
    const meta = await sharp(Buffer.from(thumb!)).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBe(640);
  });

  it("link /produto/{CODPROD}.jpg", () => {
    expect(img.parseImageLink("23756.jpg")).toEqual({
      code: "23756",
      column: "IMAGEM",
      thumb: false,
    });
    expect(img.parseImageLink("23756-mini.jpg")?.thumb).toBe(true);
    expect(img.parseImageLink("23756-arte800.png")?.column).toBe("AD_IMAGEM05");
    expect(img.parseImageLink("23756-balanca-mini.jpg")).toEqual({
      code: "23756",
      column: "AD_IMAGEM04",
      thumb: true,
    });
    expect(img.parseImageLink("../x.jpg")).toBeNull();
    expect(img.parseImageLink("23756-xyz.jpg")).toBeNull();
  });

  it("carga: grava as fotos, principal, miniatura; de novo só baixa o que mudou", async () => {
    const rows: FakeRow[] = [
      { CODPROD: 23756, NUVERSAOIMG: 3, IMAGEM: jpegHex, AD_IMAGEM05: pngHex },
      { CODPROD: 23800, NUVERSAOIMG: null, IMAGEM: null, AD_IMAGEM02: jpegHex },
      // Produto que não está no portal: ignorado.
      { CODPROD: 30000, NUVERSAOIMG: 1, IMAGEM: jpegHex },
      // Sem foto: nem aparece na lista.
      { CODPROD: 30001, NUVERSAOIMG: null, IMAGEM: null },
    ];
    let sqls = fakeSankhya(rows);
    sk.resetSankhyaTokenCache();
    await resetFullLoad("productImages");
    const first = await runFullLoad(admin, "productImages", 60_000);
    expect(first.progress.done).toBe(true);
    expect(first.progress.missing).toEqual(["AD_IMAGEM04"]);
    expect(first.progress.counts).toMatchObject({ created: 2, skipped: 1 });
    // Uma foto por chamada: 2 do produto A, 1 do B.
    expect(downloads(sqls)).toHaveLength(3);

    const store = getStore();
    const pa = (await store.get("products", a.id))!;
    expect(pa.sankhyaImages?.version).toBe("3");
    expect(Object.keys(pa.sankhyaImages!.photos).sort()).toEqual([
      "AD_IMAGEM05",
      "IMAGEM",
    ]);
    const main = (await store.get(
      "product_photos",
      pa.sankhyaImages!.photos.IMAGEM,
    ))!;
    expect(main).toMatchObject({ kind: "commercial", isPrimary: true });
    expect(pa.primaryPhotoDocumentId).toBe(main.documentId);
    const doc = (await store.get("documents", main.documentId))!;
    expect(doc).toMatchObject({ mime: "image/jpeg", name: "23756.jpg" });
    expect(doc.thumbKey).toBeTruthy();
    // Original guardado inteiro (resolução cheia).
    const original = await store.getFile(doc.storageKey);
    expect(Buffer.from(original!.bytes).toString("hex").toUpperCase()).toBe(
      jpegHex,
    );
    const art = (await store.get(
      "product_photos",
      pa.sankhyaImages!.photos.AD_IMAGEM05,
    ))!;
    expect(art.isPrimary).toBe(false);
    expect(await img.sankhyaImageDocument("23756", "IMAGEM")).toBe(
      main.documentId,
    );
    expect(await img.sankhyaImageDocument("23800", "IMAGEM")).toBeNull();
    const pb = (await store.get("products", b.id))!;
    expect(
      (await store.get("product_photos", pb.sankhyaImages!.photos.AD_IMAGEM02))
        ?.kind,
    ).toBe("supplier");

    // Nada mudou: a passada de novo não baixa nada.
    sqls = fakeSankhya(rows);
    await resetFullLoad("productImages");
    const again = await runFullLoad(admin, "productImages", 60_000);
    expect(again.progress.counts).toMatchObject({ existing: 2, skipped: 1 });
    expect(downloads(sqls)).toHaveLength(0);

    // NUVERSAOIMG mudou no A e a arte saiu: baixa só a foto do A.
    rows[0] = { CODPROD: 23756, NUVERSAOIMG: 4, IMAGEM: pngHex };
    sqls = fakeSankhya(rows);
    await resetFullLoad("productImages");
    const changed = await runFullLoad(admin, "productImages", 60_000);
    expect(changed.progress.counts).toMatchObject({ updated: 1, existing: 1 });
    expect(downloads(sqls)).toHaveLength(1);
    const pa2 = (await store.get("products", a.id))!;
    expect(Object.keys(pa2.sankhyaImages!.photos)).toEqual(["IMAGEM"]);
    const main2 = (await store.get(
      "product_photos",
      pa2.sankhyaImages!.photos.IMAGEM,
    ))!;
    expect(main2.isPrimary).toBe(true);
    expect(pa2.primaryPhotoDocumentId).toBe(main2.documentId);
    expect(await store.get("product_photos", main.id)).toBeNull();
    // O documento anterior fica (pode ter sido copiado para uma ficha).
    expect(await store.get("documents", main.documentId)).not.toBeNull();
    expect((await store.get("documents", main2.documentId))?.mime).toBe(
      "image/png",
    );
  });

  it("orçamento curto: para no meio e continua de onde parou", async () => {
    const rows: FakeRow[] = Array.from({ length: 5 }, (_, i) => ({
      CODPROD: 40000 + i,
      NUVERSAOIMG: 1,
      IMAGEM: jpegHex,
    }));
    fakeSankhya(rows);
    sk.resetSankhyaTokenCache();
    await resetFullLoad("productImages");
    const first = await runFullLoad(admin, "productImages", 1);
    expect(first.progress.done).toBe(false);
    let progress = first.progress;
    for (let i = 0; i < 20 && !progress.done; i++)
      progress = (await runFullLoad(admin, "productImages", 1)).progress;
    expect(progress.done).toBe(true);
  });

  it("HTTP 500 numa foto: tenta de novo, pula, anota e segue; a próxima passada tenta de novo", async () => {
    const rows: FakeRow[] = [
      { CODPROD: 50000, NUVERSAOIMG: 1, IMAGEM: jpegHex },
      { CODPROD: 50001, NUVERSAOIMG: 1, IMAGEM: jpegHex },
    ];
    const store = getStore();
    const products = await store.list("products");
    const c = await store.update("products", products[2].id, {
      sankhyaCode: "50000",
    });
    const d = await store.update("products", products[3].id, {
      sankhyaCode: "50001",
    });
    let sqls = fakeSankhya(rows, [50000]);
    sk.resetSankhyaTokenCache();
    await resetFullLoad("productImages");
    const first = await img.runImageLoad(admin, 60_000, undefined, 0);
    expect(first.done).toBe(true);
    expect(first.counts).toMatchObject({ failed: 1 });
    expect(first.failed).toHaveLength(1);
    expect(first.failed![0]).toMatch(/^50000 IMAGEM: sankhya_http 500/);
    // Uma nova tentativa na quebrada (2 chamadas) e a outra baixou.
    expect(downloads(sqls).filter((q) => q.endsWith("= 50000"))).toHaveLength(
      2,
    );
    expect(
      (await store.get("products", d.id))?.sankhyaImages?.photos.IMAGEM,
    ).toBeTruthy();
    expect(
      (await store.get("products", c.id))?.sankhyaImages ?? null,
    ).toBeNull();

    // O Sankhya voltou a entregar: a passada seguinte baixa só a que faltou.
    sqls = fakeSankhya(rows);
    await resetFullLoad("productImages");
    const again = await img.runImageLoad(admin, 60_000, undefined, 0);
    expect(again.counts).toMatchObject({ created: 1, existing: 1 });
    expect(downloads(sqls)).toHaveLength(1);
    expect(
      (await store.get("products", c.id))?.sankhyaImages?.photos.IMAGEM,
    ).toBeTruthy();
  });

  it("erro que não é do gateway (permissão) para a rodada", async () => {
    vi.stubGlobal("fetch", (async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/authenticate"))
        return new Response(
          JSON.stringify({ access_token: "t", expires_in: 300 }),
        );
      return new Response(
        JSON.stringify({
          status: "0",
          statusMessage: "Usuário sem acesso ao DbExplorerSP",
        }),
      );
    }) as typeof fetch);
    sk.resetSankhyaTokenCache();
    await resetFullLoad("productImages");
    await expect(
      img.runImageLoad(admin, 60_000, undefined, 0),
    ).rejects.toThrow();
  });
});
