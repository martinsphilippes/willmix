import { expect, test } from "@playwright/test";

/*
 * Prévia grande da foto ao passar o mouse (src/components/photo-hover-preview.tsx):
 * vale para qualquer <img> do portal, abre por cima da tela sem mexer na
 * miniatura nem ser cortada pelo contêiner, cabe na janela e fecha ao tirar
 * o mouse. O logo não abre prévia; o toque fica como antes.
 */
const PHOTO =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#bf2026"/></svg>',
  );

async function addThumb(page: import("@playwright/test").Page) {
  await page.goto("/login");
  // Miniatura no canto de baixo, à direita, dentro de um quadro que corta o que passa dele.
  await page.evaluate((src) => {
    const card = document.createElement("div");
    card.style.cssText =
      "position:fixed;right:8px;bottom:8px;width:64px;height:64px;overflow:hidden;z-index:50";
    const img = document.createElement("img");
    img.src = src;
    img.alt = "miniatura de teste";
    img.style.cssText = "width:48px;height:48px;object-fit:cover";
    card.append(img);
    document.body.append(card);
  }, PHOTO);
  const thumb = page.getByAltText("miniatura de teste");
  await expect
    .poll(() => thumb.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBe(1200);
  return thumb;
}

test("passar o mouse abre a prévia dentro da janela e tirar o mouse fecha", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const thumb = await addThumb(page);
  const preview = page.locator("[data-photo-preview]");
  await expect(preview).toBeHidden();
  const before = await thumb.boundingBox();

  await thumb.hover();
  await expect(preview).toBeVisible();
  const box = (await preview.boundingBox())!;
  expect(box.width).toBeGreaterThan(400);
  expect(box.width / box.height).toBeCloseTo(1200 / 900, 1);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1280);
  expect(box.y + box.height).toBeLessThanOrEqual(800);
  // A miniatura não muda de lugar nem de tamanho, e a prévia não a cobre.
  expect(await thumb.boundingBox()).toEqual(before);
  expect(box.x + box.width).toBeLessThanOrEqual(before!.x);

  await page.mouse.move(10, 10);
  await expect(preview).toBeHidden();
});

test("logo não abre prévia", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/login");
  await page.locator('img[src^="/brand/"]').first().hover();
  await expect(page.locator("[data-photo-preview]")).toBeHidden();
});

test("toque não abre prévia", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const thumb = await addThumb(page);
  await thumb.tap();
  await expect(page.locator("[data-photo-preview]")).toBeHidden();
  await context.close();
});
