import { expect, test, type Page } from "@playwright/test";

/*
 * Abertura do portal (docs/ARQUITETURA.md, seção 6): no desktop a animação
 * cobre a tela antes da página e revela o login ou o início; toca na
 * primeira abertura do dia e ao dar F5 na página inicial, não ao navegar;
 * dá para pular; no celular não toca. O navegador automatizado é ignorado
 * pela abertura (navigator.webdriver), por isso estes testes se apresentam
 * como navegador comum; os outros E2E seguem sem a animação.
 */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
});

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

const overlayOf = (page: Page) =>
  page.getByRole("dialog", { name: "Abertura Wellmix" });

/** A página veio direto: sem camada e sem a fase em <html>. */
async function expectNoIntro(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-wm-intro", /.*/);
  await expect(overlayOf(page)).toHaveCount(0);
}

/** A abertura cobriu a tela; "Pular" devolve a página na hora. */
async function expectIntroAndSkip(page: Page) {
  const overlay = overlayOf(page);
  await expect(overlay).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-wm-intro",
    /pending|playing/,
  );
  const skip = overlay.getByRole("button", { name: "Pular" });
  await expect(skip).toHaveClass(/is-on/);
  await skip.click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-wm-intro", /.*/);
}

test("desktop: primeira vez no dia e F5 na página inicial tocam; navegar não repete", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);

  // Primeira abertura do dia: toca no login.
  await page.goto("/login");
  await expectIntroAndSkip(page);
  await expect(page.locator('input[name="email"]')).toBeEditable();

  // Abrir de novo no mesmo dia: vem direto.
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expectNoIntro(page);

  // F5 na página inicial: toca de novo.
  await page.reload();
  await expectIntroAndSkip(page);

  // Entrar: a navegação é do app (sem recarregar), sem abertura.
  await page.fill('input[name="email"]', "admin@wellmix.com");
  await page.fill('input[name="password"]', "wellmix123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app$/);
  await expectNoIntro(page);

  // F5 no início: toca; F5 numa tela interna: não.
  await page.reload();
  await expectIntroAndSkip(page);
  await page.goto("/app/orders");
  await expectNoIntro(page);
  await page.reload();
  await expect(page).toHaveURL(/\/app\/orders/);
  await expectNoIntro(page);
});

test("desktop: toca até o fim e devolve a página", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/login?intro=always");
  const overlay = overlayOf(page);
  await expect(overlay).toBeVisible();
  // ~6 s de animação e mais o "pouso" da página.
  await expect(overlay).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator("html")).not.toHaveAttribute("data-wm-intro", /.*/);
  await expect(page.locator('input[name="email"]')).toBeEditable();
});

test("celular: não toca, nem no F5", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expectNoIntro(page);
  await page.reload();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expectNoIntro(page);
});
