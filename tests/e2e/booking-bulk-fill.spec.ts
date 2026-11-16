import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, login } from "./helpers";
import { xlsxBytes } from "../unit/xlsx-fixture";

/*
 * Book, tabela de itens (dono, 16/11/2026): o cabeçalho (títulos e a linha
 * de preenchimento) fica preso logo abaixo da barra vermelha enquanto a
 * tabela passa e sai junto com ela no fim; na rolagem para o lado cada
 * título fica sobre a coluna dele. Preenchimento em massa: marca as linhas,
 * preenche o campo acima da coluna e "Carregar" grava nas marcadas (as
 * desmarcadas e as colunas em branco ficam como estão).
 */
const TAG = `BF${Date.now().toString(36).toUpperCase()}`;
/** Mais alto que a tela do iPad em pé (todas numa página de 50). */
const ROWS = 30;

const HEADER = [
  "DATE",
  "LOCAL",
  "SUPPLIER NAME",
  "SKU/FACTORY ITEM CODE",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "QTY/INNER",
  "N.W./PC",
  "G.W./PC",
  "CBM",
  "SIZE(CM) LENGTH",
  "SIZE(CM) WIDTH",
  "SIZE(CM) HEIGHT",
  "CAPACITY(ML)",
  "PACKAGE",
  "MATERIAL",
  "MOQ",
  "PURCHASE QTY IN PCS",
];
const code = (n: number) => `${TAG}-${String(n).padStart(2, "0")}`;
const row = (n: number) => [
  "2026.10.13",
  "Yiwu",
  "Shenzhen Supplier A",
  code(n),
  `Zqx widget ${TAG} ${n}`,
  "FOB",
  "RMB",
  "1.25",
  "48",
  "12",
  "0.3",
  "0.35",
  "0.12",
  "10",
  "8",
  "20",
  "350",
  "color box",
  "glass",
  "1000",
  "3000",
];
const sheet = () => ({
  name: `booking-${TAG}.xlsx`,
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  buffer: Buffer.from(
    xlsxBytes([
      {
        name: "BOOKING",
        cells: [HEADER, ...Array.from({ length: ROWS }, (_, i) => row(i + 1))],
      },
    ]),
  ),
});

/** O booking da planilha, aberto na tela da Wellmix. */
async function importBooking(page: Page) {
  await page.goto("/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles(sheet());
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  await expect(page.locator("tr[data-booking-item]")).toHaveCount(ROWS);
  // Todas as linhas na mesma página.
  await page.locator("[data-table-page-size]").selectOption("50");
  await expect(page.locator("tr[data-booking-item]:visible")).toHaveCount(ROWS);
  return new URL(page.url()).pathname;
}

/** Rola a página até a tabela passar `past` px por baixo da barra vermelha. */
async function scrollIntoTable(page: Page, past: number) {
  await page.evaluate((px) => {
    const frame = document.querySelector("[data-table-frame]")!;
    const bar = document
      .querySelector("[data-app-header]")!
      .getBoundingClientRect().bottom;
    window.scrollBy(0, frame.getBoundingClientRect().top - bar + px);
  }, past);
}

/** A linha n (1 = a primeira da planilha). */
const line = (page: Page, n: number) =>
  page.locator("tr[data-booking-item]").nth(n - 1);
const currencyOf = (page: Page, n: number) =>
  line(page, n).locator('[data-booking-item-field$=":currency"] select');

const head = (page: Page) => page.locator("[data-table-sticky-head]");

/** Topo do cabeçalho congelado e a altura da barra vermelha. */
async function stuck(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector("[data-app-header]")!;
    const sticky = document.querySelector("[data-table-sticky-head]")!;
    return {
      bar: Math.round(bar.getBoundingClientRect().bottom),
      top: Math.round(sticky.getBoundingClientRect().top),
      bottom: Math.round(sticky.getBoundingClientRect().bottom),
    };
  });
}

/** Distância entre o título de uma coluna e a célula dela na primeira linha. */
async function offsetOf(page: Page, field: string) {
  return page.evaluate((f) => {
    const input = document.querySelector(`[data-bulk-field="${f}"]`)!;
    const title = input.closest("th")!;
    const cell = document
      .querySelector(`[data-booking-item-field$=":${f}"]`)!
      .closest("td")!;
    return Math.abs(
      title.getBoundingClientRect().left - cell.getBoundingClientRect().left,
    );
  }, field);
}

test("Book: cabeçalho congelado e Carregar nas linhas 2, 5 e 8 (desktop)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await login(page, "admin@wellmix.com");
  const url = await importBooking(page);

  // Os títulos e a linha de preenchimento estão no cabeçalho congelado.
  await expect(head(page).locator("tr")).toHaveCount(2);
  await expect(head(page).locator("[data-bulk-load]")).toBeDisabled();

  // Rolando a página, o cabeçalho fica logo abaixo da barra vermelha.
  await scrollIntoTable(page, 400);
  await expect
    .poll(async () => {
      const s = await stuck(page);
      return Math.abs(s.top - s.bar) <= 1;
    })
    .toBe(true);

  // Marca as linhas 2, 5 e 8 (lá embaixo) e escolhe USD acima da Moeda, no
  // cabeçalho congelado, sem voltar ao topo.
  for (const n of [2, 5, 8])
    await line(page, n).locator("[data-bulk-check]").check();
  await expect(head(page).locator("[data-bulk-selected]")).toHaveAttribute(
    "data-bulk-selected",
    "3",
  );
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(200);
  await head(page).locator('[data-bulk-field="currency"]').selectOption("USD");
  const load = head(page).locator("[data-bulk-load]");
  await expect(load).toBeEnabled();
  await load.click();
  await expect(head(page).locator('[data-bulk-status="ok"]')).toContainText(
    "Itens atualizados: 3.",
  );
  // Continuou no mesmo lugar da página.
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - scrolled),
  ).toBeLessThan(40);
  const expected = Array.from({ length: ROWS }, (_, i) =>
    [2, 5, 8].includes(i + 1) ? "USD" : "RMB",
  );
  for (let n = 1; n <= ROWS; n++)
    await expect(currencyOf(page, n)).toHaveValue(expected[n - 1]);
  // O campo em massa esvazia; as linhas continuam marcadas.
  await expect(head(page).locator('[data-bulk-field="currency"]')).toHaveValue(
    "",
  );
  await expect(line(page, 5).locator("[data-bulk-check]")).toBeChecked();

  // Recarregada a página, o que foi gravado continua; as outras colunas
  // das linhas marcadas não mudaram.
  await page.goto(url);
  for (let n = 1; n <= ROWS; n++)
    await expect(currencyOf(page, n)).toHaveValue(expected[n - 1]);
  await expect(
    line(page, 5).locator('[data-booking-item-field$=":price"]'),
  ).toHaveValue("1,25");

  // Duas colunas de uma vez; valor que não dá para ler desliga o Carregar.
  await line(page, 1).locator("[data-bulk-check]").check();
  await line(page, 3).locator("[data-bulk-check]").check();
  await head(page).locator('[data-bulk-field="moq"]').fill("abc");
  await expect(
    head(page).locator('[data-bulk-field-invalid="moq"]'),
  ).toBeVisible();
  await expect(head(page).locator("[data-bulk-load]")).toBeDisabled();
  await head(page).locator('[data-bulk-field="moq"]').fill("2.000");
  await head(page).locator('[data-bulk-field="material"]').fill("steel");
  await head(page).locator("[data-bulk-load]").click();
  await expect(head(page).locator('[data-bulk-status="ok"]')).toContainText(
    "Itens atualizados: 2.",
  );
  for (const n of [1, 3]) {
    await expect(
      line(page, n).locator('[data-booking-item-field$=":moq"]'),
    ).toHaveValue("2000");
    await expect(
      line(page, n).locator('[data-booking-item-field$=":material"]'),
    ).toHaveValue("steel");
  }
  // Coluna em branco no Carregar: a moeda da linha 1 continua RMB; a linha
  // 2 (desmarcada) continua com o material dela.
  await expect(currencyOf(page, 1)).toHaveValue("RMB");
  await expect(
    line(page, 2).locator('[data-booking-item-field$=":material"]'),
  ).toHaveValue("glass");

  // A caixa do cabeçalho: com algumas marcadas (estado misto) desmarca
  // todas; sem nenhuma, marca todas; de novo, desmarca.
  const all = head(page).locator("[data-bulk-select-all]");
  const count = head(page).locator("[data-bulk-selected]");
  await expect(all).toHaveAttribute("data-bulk-select-all", "some");
  await all.click();
  await expect(count).toHaveAttribute("data-bulk-selected", "0");
  await all.click();
  await expect(count).toHaveAttribute("data-bulk-selected", String(ROWS));
  await expect(all).toBeChecked();
  await all.click();
  await expect(count).toHaveAttribute("data-bulk-selected", "0");

  // Rolagem para o lado: cada título e cada campo continuam sobre a coluna.
  await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>(
      "[data-table-sticky-body]",
    )!;
    body.scrollLeft = 900;
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const body = document.querySelector<HTMLElement>(
          "[data-table-sticky-body]",
        )!;
        const headScroll = document.querySelector<HTMLElement>(
          "[data-table-sticky-scroll]",
        )!;
        return Math.abs(body.scrollLeft - headScroll.scrollLeft);
      }),
    )
    .toBeLessThan(1);
  for (const field of ["currency", "moq", "material", "productName"])
    expect(await offsetOf(page, field)).toBeLessThan(1.5);
  // A primeira coluna e a das fotos ficam presas à esquerda (o título da
  // foto sobre a foto de cada linha), mesmo com a tabela rolada.
  const frozen = await page.evaluate(() => {
    const titles = document.querySelectorAll(
      "[data-table-sticky-head] tr[data-table-sort-row] th",
    );
    const body = document
      .querySelector("[data-table-sticky-body]")!
      .getBoundingClientRect();
    const photo = document
      .querySelector("[data-booking-item-photo]")!
      .getBoundingClientRect();
    return {
      first: Math.round(titles[0].getBoundingClientRect().left - body.left),
      photoTitle: Math.round(titles[1].getBoundingClientRect().left),
      firstRight: Math.round(titles[0].getBoundingClientRect().right),
      photoCell: Math.round(photo.left),
    };
  });
  expect(Math.abs(frozen.first)).toBeLessThanOrEqual(1);
  expect(Math.abs(frozen.photoTitle - frozen.firstRight)).toBeLessThanOrEqual(
    1,
  );
  expect(Math.abs(frozen.photoCell - frozen.photoTitle)).toBeLessThanOrEqual(1);

  // No fim da tabela o cabeçalho sai junto com ela.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const end = await stuck(page);
  const tableBottom = await page.evaluate(() =>
    Math.round(
      document
        .querySelector("[data-table-sticky-body]")!
        .getBoundingClientRect().bottom,
    ),
  );
  expect(end.bottom).toBeLessThanOrEqual(tableBottom + 1);
});

test("Book: falha no Carregar avisa o que não gravou e tenta de novo", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await importBooking(page);
  for (const n of [2, 4])
    await line(page, n).locator("[data-bulk-check]").check();
  await head(page).locator('[data-bulk-field="incoterm"]').selectOption("EXW");
  // Sem conexão: nada grava, o aviso diz isso e oferece tentar de novo.
  await page.route("**/app/booking/lots/**", (route) =>
    route.request().method() === "POST" &&
    route.request().headers()["next-action"]
      ? route.abort()
      : route.continue(),
  );
  await head(page).locator("[data-bulk-load]").click();
  const status = head(page).locator('[data-bulk-status="refused"]');
  await expect(status).toBeVisible();
  await expect(status).toContainText("nada foi salvo");
  await expect(
    line(page, 2).locator('[data-booking-item-field$=":incoterm"] select'),
  ).toHaveValue("FOB");
  // A conexão volta: "Tentar de novo" grava os mesmos valores nas mesmas linhas.
  await page.unrouteAll();
  await status.locator("[data-bulk-retry]").click();
  await expect(head(page).locator('[data-bulk-status="ok"]')).toContainText(
    "Itens atualizados: 2.",
  );
  for (const n of [2, 4])
    await expect(
      line(page, n).locator('[data-booking-item-field$=":incoterm"] select'),
    ).toHaveValue("EXW");
  await expect(
    line(page, 3).locator('[data-booking-item-field$=":incoterm"] select'),
  ).toHaveValue("FOB");
});

for (const [name, viewport] of [
  ["iPad em pé", { width: 834, height: 1194 }],
  ["iPad deitado", { width: 1194, height: 834 }],
] as const) {
  test.describe(`Book no ${name} (toque)`, () => {
    test.use({
      viewport,
      hasTouch: true,
      isMobile: true,
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    });
    test("marca lá embaixo, preenche no cabeçalho congelado e carrega", async ({
      page,
    }) => {
      await login(page, "admin@wellmix.com");
      await importBooking(page);
      // Itens lá embaixo: rola até eles e marca com o dedo.
      await scrollIntoTable(page, 900);
      await line(page, 22).locator("[data-bulk-check]").tap();
      await line(page, 20).locator("[data-bulk-check]").tap();
      await expect
        .poll(async () => {
          const s = await stuck(page);
          return Math.abs(s.top - s.bar) <= 1;
        })
        .toBe(true);
      const scrolled = await page.evaluate(() => window.scrollY);
      await head(page)
        .locator('[data-bulk-field="currency"]')
        .selectOption("USD");
      await head(page).locator("[data-bulk-load]").tap();
      await expect(head(page).locator('[data-bulk-status="ok"]')).toContainText(
        "Itens atualizados: 2.",
      );
      expect(
        Math.abs((await page.evaluate(() => window.scrollY)) - scrolled),
      ).toBeLessThan(40);
      await expect(currencyOf(page, 20)).toHaveValue("USD");
      await expect(currencyOf(page, 22)).toHaveValue("USD");
      await expect(currencyOf(page, 21)).toHaveValue("RMB");
      // Deslizando a tabela para o lado, o cabeçalho acompanha.
      await page.evaluate(() => {
        document.querySelector<HTMLElement>(
          "[data-table-sticky-body]",
        )!.scrollLeft = 600;
      });
      await expect.poll(() => offsetOf(page, "currency")).toBeLessThan(1.5);
      // A página não rola para o lado.
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
    });
  });
}

/** Filtro de tipo da aba Cadastros: digita e escolhe a opção. */
async function chooseType(page: Page, text: string, value: string) {
  const input = page.locator("[data-party-type-filter-input]");
  await expect(input).toHaveAttribute("data-party-type-filter-ready", "1");
  await input.click();
  await input.fill(text);
  await page.locator(`[data-party-type-filter-option="${value}"]`).click();
  await page.waitForURL(new RegExp(`type=${encodeURIComponent(value)}`));
}

test("Meus books (Trading): cabeçalho congelado e Carregar no book que ela lança", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const userLogin = `bf-${tag}@trading.com`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, "admin@wellmix.com");
  // Cadastro da Trading com um login.
  await page.goto("/app/parties");
  await chooseType(page, "trad", "trading");
  await page.locator("[data-party-new]").click();
  await expect(page.locator("[data-party-type]")).toHaveValue("trading");
  await page.fill('input[name="name"]', `Trading BF ${tag}`);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?]+$/);
  const access = page.locator("[data-party-access]");
  await access.locator('input[name="name"]').fill("Bia Trading");
  await access.locator('input[name="login"]').fill(userLogin);
  await access.locator('input[name="password"]').fill(PASSWORD);
  await access.locator("[data-party-access-create]").click();
  await page.waitForURL(/saved=user/);

  // Como Trading: lança o book (sobe a planilha) e confere na tela.
  await login(page, userLogin);
  await page.goto("/app/booking/import");
  await page
    .locator("[data-partner-booking-launch-form] input[type=file]")
    .setInputFiles(sheet());
  await page.locator("[data-partner-booking-launch-submit]").click();
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  const url = new URL(page.url()).pathname;
  const editing = page.locator("[data-partner-booking-edit]");
  await expect(editing.locator("tbody tr")).toHaveCount(ROWS);
  const partnerLine = (n: number) =>
    page.locator("tr[data-partner-booking-item]").nth(n - 1);
  const field = (n: number, name: string) =>
    partnerLine(n).locator(`[data-partner-item-field$=":${name}"]`);

  // O cabeçalho fica preso abaixo da barra vermelha.
  await scrollIntoTable(page, 600);
  await expect
    .poll(async () => {
      const s = await stuck(page);
      return Math.abs(s.top - s.bar) <= 1;
    })
    .toBe(true);

  // Linhas 2 e 4: moeda e material de uma vez; as outras ficam.
  for (const n of [2, 4])
    await partnerLine(n).locator("[data-bulk-check]").check();
  await head(page).locator('[data-bulk-field="currency"]').selectOption("USD");
  await head(page).locator('[data-bulk-field="material"]').fill("steel");
  await head(page).locator("[data-bulk-load]").click();
  await expect(head(page).locator('[data-bulk-status="ok"]')).toContainText(
    "Itens atualizados: 2.",
  );
  await page.goto(url);
  for (const n of [2, 4]) {
    await expect(field(n, "currency").locator("select")).toHaveValue("USD");
    await expect(field(n, "material")).toHaveValue("steel");
  }
  await expect(field(3, "currency").locator("select")).toHaveValue("RMB");
  await expect(field(3, "material")).toHaveValue("glass");
  await expect(field(2, "price")).toHaveValue("1,25");
});
