import { expect, test, type Page } from "@playwright/test";
import { login, PASSWORD } from "./helpers";

/*
 * Treinamento do Portal (dono, 16/11/2026; docs/TRAINING.md): o capelo na
 * barra vermelha, entre o seletor de idiomas e as mensagens, abre a página
 * (só o título, área de conteúdo em branco) para todo login, da equipe e de
 * fora, pelo ícone e pelo endereço. A barra continua alinhada no notebook, no
 * iPad e no celular.
 */

const TITLE = "Treinamento do Portal";

/** O título e o texto do ícone em cada idioma do portal. */
const TEXT = {
  pt: TITLE,
  en: "Portal Training",
  zh: "门户培训",
} as const;
type Lang = keyof typeof TEXT;

/** O idioma em que o login vê o portal (o seletor da barra marca o atual). */
async function langOf(page: Page): Promise<Lang> {
  const value = await page
    .locator("[data-app-header] [data-locale-switcher]")
    .first()
    .getAttribute("data-locale-switcher");
  expect(value && value in TEXT, `idioma ${value}`).toBeTruthy();
  return value as Lang;
}

/**
 * Todas as contas de demonstração: a equipe Wellmix e cada tipo de parceiro,
 * cada uma no idioma do próprio login (fornecedores e a agência da China em
 * chinês, o fornecedor B e o armador em inglês, os demais em português).
 */
const ACCOUNTS = [
  { email: "admin@wellmix.com", who: "administrador" },
  { email: "operador@wellmix.com", who: "comprador e planner" },
  { email: "vendas@wellmix.com", who: "vendas" },
  { email: "diretoria@wellmix.com", who: "diretoria de compras" },
  { email: "juridico@wellmix.com", who: "jurídico" },
  { email: "joao@lojista.com", who: "cliente" },
  { email: "supplier.a@china.com", who: "fornecedor" },
  { email: "supplier.b@china.com", who: "fornecedor (inglês)" },
  { email: "agencia@design.com", who: "agência de design" },
  { email: "despachante@comex.com", who: "despachante" },
  { email: "armador@maritima.com", who: "armador" },
  { email: "transportadora@rodo.com", who: "transportadora" },
  { email: "comex@assessoria.com", who: "assessoria de comex" },
  { email: "agente@cargo.com", who: "agente de carga" },
  { email: "ocp@certifica.com", who: "certificadora" },
  { email: "agencia@marketing.cn", who: "agência de marketing" },
];

/** O capelo da barra vermelha. */
const icon = (page: Page) =>
  page.locator("[data-app-header] [data-training-link]");

/** A página: o título e a área de conteúdo em branco. */
async function expectTrainingPage(page: Page, title = TITLE) {
  await expect(page).toHaveURL(/\/app\/training$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.locator("[data-training-content]")).toBeEmpty();
}

/** Posição (na tela) do primeiro elemento à vista do seletor, ou null. */
async function header(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      for (const el of document.querySelectorAll(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0)
          return {
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height,
            cy: r.top + r.height / 2,
          };
      }
      return null;
    };
    const bar = document.querySelector("[data-app-header]")!;
    const b = bar.getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      bar: { height: b.height, cy: b.top + b.height / 2 },
      logo: box('[data-app-header] a[href="/app"]'),
      locale: box("[data-app-header] [data-locale-switcher]"),
      training: box("[data-app-header] [data-training-link]"),
      messages: box("[data-app-header] [data-messages-link]"),
      bell: box("[data-app-header] [data-notifications-bell]"),
    };
  });
}

test.describe("Treinamento do Portal", () => {
  test("o capelo abre a tela para a equipe e para quem é de fora, também pelo endereço", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const seen = new Set<Lang>();
    for (const account of ACCOUNTS) {
      await test.step(account.who, async () => {
        await login(page, account.email);
        const lang = await langOf(page);
        seen.add(lang);
        const text = TEXT[lang];
        // Texto de ajuda e nome acessível do botão, no idioma do login.
        await expect(icon(page)).toBeVisible();
        await expect(icon(page)).toHaveAttribute("title", text);
        await expect(icon(page)).toHaveAttribute("aria-label", text);
        // Entre o seletor de idiomas e as mensagens.
        const bar = await header(page);
        expect(bar.locale, account.who).not.toBeNull();
        expect(bar.training!.left).toBeGreaterThanOrEqual(bar.locale!.right);
        if (bar.messages)
          expect(bar.training!.right).toBeLessThanOrEqual(bar.messages.left);
        // O clique abre a tela dentro do layout do portal (barra e menu).
        await page
          .locator("[data-app-header]")
          .getByRole("link", { name: text })
          .click();
        await expectTrainingPage(page, text);
        await expect(page.locator("[data-app-header]")).toBeVisible();
        // O endereço direto também abre.
        await page.goto("/app/training");
        await expectTrainingPage(page, text);
      });
    }
    // Os três idiomas passaram pelos logins de verdade.
    expect([...seen].sort()).toEqual(["en", "pt", "zh"]);
  });

  test("endereço direto sem login: entra e volta ao Treinamento", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/app/training");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Ftraining$/);
    await page.getByLabel(/e-mail|email|邮箱/i).fill("joao@lojista.com");
    await page.getByLabel(/senha|password|密码/i).fill(PASSWORD);
    await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
    await page.waitForURL(/\/app\/training$/);
    await expectTrainingPage(page);
  });

  test("PT, EN e ZH: o título e o texto do ícone", async ({ page }) => {
    // O fornecedor da China entra em chinês; a troca pelo seletor termina no
    // idioma dele, para não mudar o login dos outros testes.
    await login(page, "supplier.a@china.com");
    await page.goto("/app/training");
    await expectTrainingPage(page, TEXT.zh);
    const switcher = page.locator("[data-app-header] [data-locale-switcher]");
    for (const lang of ["pt", "en", "zh"] as const) {
      await switcher.locator(`button[data-locale="${lang}"]`).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        TEXT[lang],
      );
      await expect(icon(page)).toHaveAttribute("title", TEXT[lang]);
      await expect(icon(page)).toHaveAttribute("aria-label", TEXT[lang]);
    }
  });

  test("a barra vermelha continua alinhada no notebook, no iPad e no celular", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const SIZES = [
      { name: "desktop", width: 1920, height: 1080 },
      { name: "desktop médio", width: 1440, height: 900 },
      { name: "notebook", width: 1280, height: 800 },
      { name: "iPad Pro em pé", width: 1024, height: 1366 },
      { name: "iPad deitado", width: 1180, height: 820 },
      { name: "iPad em pé", width: 820, height: 1180 },
      { name: "iPad mini em pé", width: 768, height: 1024 },
      { name: "celular deitado", width: 844, height: 390 },
      { name: "celular", width: 390, height: 844 },
      { name: "celular Android", width: 360, height: 800 },
      { name: "celular pequeno", width: 320, height: 568 },
    ];
    for (const email of ["admin@wellmix.com", "joao@lojista.com"]) {
      await login(page, email);
      for (const size of SIZES) {
        await test.step(`${email} · ${size.name}`, async () => {
          await page.setViewportSize({
            width: size.width,
            height: size.height,
          });
          await page.goto("/app/training");
          await expectTrainingPage(page);
          const bar = await header(page);
          const where = `${email} · ${size.name}`;
          // Uma faixa só, da mesma altura (h-14).
          expect(Math.round(bar.bar.height), where).toBe(56);
          // Nada passa da largura da tela.
          expect(bar.pageWidth, where).toBeLessThanOrEqual(bar.viewport);
          const { training, messages, bell, locale, logo } = bar;
          expect(training, where).not.toBeNull();
          expect(messages, where).not.toBeNull();
          expect(bell, where).not.toBeNull();
          // Mesmo tamanho dos ícones de mensagens e do sino.
          for (const other of [messages!, bell!]) {
            expect(training!.width, where).toBe(other.width);
            expect(training!.height, where).toBe(other.height);
          }
          expect(Math.round(training!.width), where).toBe(36);
          // Centrados na altura da barra, na mesma linha.
          for (const item of [training!, messages!, bell!, locale, logo])
            if (item)
              expect(Math.abs(item.cy - bar.bar.cy), where).toBeLessThanOrEqual(
                1,
              );
          // Ordem e espaçamento: [idiomas] capelo · mensagens · sino.
          expect(training!.right, where).toBeLessThanOrEqual(messages!.left);
          expect(messages!.right, where).toBeLessThanOrEqual(bell!.left);
          expect(
            Math.abs(
              messages!.left - training!.right - (bell!.left - messages!.right),
            ),
            where,
          ).toBeLessThanOrEqual(0.5);
          // O sino fica na margem direita da barra, dentro da tela.
          expect(bell!.right, where).toBeLessThanOrEqual(bar.viewport - 15);
          // Do celular (abaixo de 768 px) o idioma fica no menu; do iPad
          // para cima, na barra, logo antes do capelo.
          if (size.width < 768) expect(locale, where).toBeNull();
          else {
            expect(locale, where).not.toBeNull();
            expect(locale!.right, where).toBeLessThanOrEqual(training!.left);
          }
          // A marca não encosta no grupo da direita.
          const first = locale ?? training!;
          expect(logo!.right, where).toBeLessThan(first.left);
        });
      }
    }
  });
});
