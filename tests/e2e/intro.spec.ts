import { expect, test } from "@playwright/test";

/*
 * Abertura do portal (docs/ARQUITETURA.md, seção 6): no desktop a animação
 * cobre a tela antes da página e revela o login; dá para pular; não repete na
 * mesma aba; no celular não toca. O navegador automatizado é ignorado pela
 * abertura (navigator.webdriver), por isso estes testes se apresentam como
 * navegador comum; os outros E2E seguem sem a animação.
 */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
});

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

test("desktop: cobre a tela, dá para pular e não repete na aba", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/login");
  const html = page.locator("html");
  const overlay = page.getByRole("dialog", { name: "Abertura Wellmix" });
  await expect(overlay).toBeVisible();
  await expect(html).toHaveAttribute("data-wm-intro", /pending|playing/);

  // "Pular" aparece depois do primeiro instante e devolve a página na hora.
  const skip = overlay.getByRole("button", { name: "Pular" });
  await expect(skip).toHaveClass(/is-on/);
  await skip.click();
  await expect(overlay).toHaveCount(0);
  await expect(html).not.toHaveAttribute("data-wm-intro", /.*/);
  await expect(page.locator('input[name="email"]')).toBeEditable();

  // Mesma aba: a página vem direto.
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(overlay).toHaveCount(0);
  await expect(html).not.toHaveAttribute("data-wm-intro", /.*/);
});

test("desktop: toca até o fim e devolve a página", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/login?intro=always");
  const overlay = page.getByRole("dialog", { name: "Abertura Wellmix" });
  await expect(overlay).toBeVisible();
  // ~6 s de animação e mais o "pouso" da página.
  await expect(overlay).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator("html")).not.toHaveAttribute("data-wm-intro", /.*/);
  await expect(page.locator('input[name="email"]')).toBeEditable();
});

test("celular: não toca", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-wm-intro", /.*/);
});
