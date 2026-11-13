import { expect, type Page } from "@playwright/test";
import { xlsxBytes } from "../unit/xlsx-fixture";

/*
 * Passos comuns dos testes de ponta a ponta: login das contas de
 * demonstração, booking por planilha (docs/BOOKING.md, seção 0), Seleção de
 * itens, ficha do produto e o preenchimento dos itens do pedido.
 */

export const PASSWORD = "wellmix123";

export const png = {
  name: "foto.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
};

export const pdf = {
  name: "doc.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n%fake\n"),
};

export async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/e-mail|email|邮箱/i).fill(email);
  await page.getByLabel(/senha|password|密码/i).fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
}

const BOOKING_HEADER = [
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

/** Planilha de booking de um fornecedor do cadastro de demonstração, com um item. */
export function bookingSheet(
  supplier: string,
  code: string,
  description: string,
) {
  const row = [
    "2026.10.13",
    "Yiwu",
    supplier,
    code,
    description,
    "FOB",
    "USD",
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
  return {
    name: `booking-${code}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(
      xlsxBytes([{ name: "BOOKING", cells: [BOOKING_HEADER, row] }]),
    ),
  };
}

/**
 * Sobe a planilha e fecha o booking (fornecedor e data vêm dela). Com
 * `checkSupplierPicker`, confere também a busca do fornecedor (filtra,
 * troca e volta, gravando a cada escolha).
 */
export async function importAndClose(
  page: Page,
  file: ReturnType<typeof bookingSheet>,
  supplierName: string,
  { checkSupplierPicker = false } = {},
) {
  await page.goto("/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles(file);
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  // Na caixa "Dados do booking" o campo do fornecedor se chama Fábrica
  // (dono, 13/11/2026) e a palavra "fornecedor" não aparece nela.
  const data = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Dados do booking" }) })
    .first();
  await expect(data.getByText("Fábrica", { exact: true })).toBeVisible();
  await expect(data).not.toContainText(/fornecedor/i);
  // Fornecedor do cadastro (tem login): nenhum aviso de "sem acesso".
  await expect(page.locator("[data-supplier-no-login]")).toHaveCount(0);
  const combo = page.locator(
    "[data-booking-lot-supplier] input[role=combobox]",
  );
  await expect(combo).toHaveValue(new RegExp(supplierName));
  if (checkSupplierPicker) {
    // Fornecedor com busca: digitar filtra a lista até sobrar o que se quer.
    await combo.click();
    await combo.fill(
      supplierName.toLowerCase().split(" ").slice(0, 2).join(" "),
    );
    const options = page.locator("[data-booking-lot-supplier] [role=option]");
    await expect(options.first()).toContainText(supplierName);
    await combo.fill("zzz-nada-casa");
    await expect(options).toHaveCount(0);
    await combo.press("Escape");
    await expect(combo).toHaveValue(new RegExp(supplierName));
    // Trocar e voltar: cada escolha grava sozinha.
    await combo.click();
    await options.first().click();
    await expect(
      page.locator(
        '[data-booking-lot-supplier] [data-booking-row-note="saved"]',
      ),
    ).toBeVisible();
    await combo.click();
    await combo.fill(supplierName);
    await options.filter({ hasText: supplierName }).first().click();
    await expect(combo).toHaveValue(new RegExp(supplierName));
    await expect(
      page.locator(
        '[data-booking-lot-supplier] [data-booking-row-note="saved"]',
      ),
    ).toBeVisible();
  }
  // NCM obrigatório (docs/BOOKING.md, "NCM do item"): sem produto parecido
  // no cadastro, o item fica com o despachante; a Wellmix preenche aqui.
  const ncmInputs = page.locator("input[data-booking-item-ncm]");
  for (let i = 0; i < (await ncmInputs.count()); i++) {
    const input = ncmInputs.nth(i);
    if (await input.inputValue()) continue;
    await input.fill("7013.37.00");
    await input.press("Enter");
    await expect(
      page.locator('[data-booking-row-note="saved"]').nth(i),
    ).toBeVisible();
  }
  await page.click("[data-booking-lot-close-submit]");
  await page.waitForURL(/[?&]closed=1/);
  await expect(page.locator("[data-booking-item-analysis]")).toHaveCount(1);
}

/**
 * Seleção de itens (docs/SUPPLIER_REQUESTS.md): a busca pela marca traz os
 * dois itens; agrupa, escolhe `chosen` (código) com `alternative` de
 * alternativa, grava e abre a solicitação ao fornecedor do escolhido.
 * Devolve o endereço da solicitação (sem a busca).
 */
export async function selectAndOpenSupplierRequest(
  page: Page,
  tag: string,
  chosen: string,
  alternative: string,
  needs: string,
) {
  await page.goto(`/app/booking/selection?q=${encodeURIComponent(tag)}`);
  await expect(page.locator("[data-selection-item]")).toHaveCount(2);
  // A aba Itens só agrupa; a solicitação abre no grupo (aba Seleção).
  await page.locator("input[data-basket-all]").check();
  await page.click("[data-selection-group]");
  await page.waitForURL(/tab=selection&ids=/);
  await expect(page.locator("[data-selection-item]")).toHaveCount(2);
  await page
    .locator("[data-selection-item]", { hasText: chosen })
    .locator("input[data-selection-choose]")
    .check();
  await page
    .locator("[data-selection-item]", { hasText: alternative })
    .locator("input[data-selection-alternative]")
    .check();
  await page.fill("[data-selection-needs]", needs);
  // Gravar só guarda a escolha (nada vai ao fornecedor); o grupo aparece
  // resolvido, com o ganhador em verde, e a solicitação abre dali.
  await page.click("[data-selection-submit]");
  await page.waitForURL(/[?&]saved=1/);
  await expect(page.locator("[data-selection-saved]")).toBeVisible();
  const resolved = page.locator("[data-selection-resolved=saved]");
  await expect(resolved).toHaveCount(1);
  await expect(resolved.locator("[data-selection-winner]")).toContainText(tag);
  await page.click("[data-selection-open-all]");
  // Recém-aberta, a solicitação abre na tela do produto (view=item).
  await page.waitForURL(/\/app\/supplier-requests\/[^/?]+\?.*created=1/);
  return page.url().split("?")[0];
}

/**
 * Tela do produto: as seções vêm recolhidas. Abre todas (a tela lembra as
 * abertas na aba e reabre sozinha depois de cada salvamento).
 */
export async function gotoProduct(page: Page, id: string) {
  await page.goto(`/app/products/${id}`);
  const folds = page.locator("details[data-fold-section]");
  await expect(folds.first()).toBeAttached();
  await page.waitForLoadState("networkidle");
  await folds.evaluateAll((els) =>
    els.forEach((el) => ((el as HTMLDetailsElement).open = true)),
  );
}

/**
 * Preenche, um por vez, os itens pendentes que o usuário logado pode
 * preencher na tela do pedido (aprovação: aprova). `values` dá o número por
 * trecho do rótulo (ex.: peso). Para quando não sobra nenhum ou no `limit`.
 */
export async function fillMyRequirements(
  page: Page,
  orderUrl: string,
  values: Record<string, string> = {},
  limit = 12,
) {
  for (let guard = 0; guard < limit; guard++) {
    await page.goto(orderUrl);
    // O formulário "Excluir" de um anexo enviado não é um requisito a preencher.
    const forms = page.locator(
      "form:has(input[name=requirementId]):not([data-requirement-clear])",
    );
    const count = await forms.count();
    if (count === 0) return;
    const form = forms.first();
    const file = form.locator("input[type=file]");
    const number = form.locator("input[type=number]");
    const amount = form.locator("[data-money=amount]");
    const date = form.locator("input[type=date]");
    const text = form.locator("textarea[name=value]");
    // valor específico por rótulo (ex.: peso)
    const row = form.locator("xpath=ancestor::li[1]");
    const label =
      (await row.locator("span.font-medium").first().textContent()) ?? "";
    if (await file.count()) {
      // Foto e arquivo enviam sozinhos ao escolher (sem botão Enviar).
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST"),
        file.setInputFiles(
          (await file.getAttribute("accept"))?.includes("image") ? png : pdf,
        ),
      ]);
      await page.waitForLoadState("networkidle");
      if (page.url().includes("error=")) {
        const alert = await page.locator("main").innerText();
        throw new Error(
          `Falha ao enviar "${label}": ${page.url()}\n${alert.slice(0, 400)}`,
        );
      }
      continue;
    } else if (await amount.count()) {
      // Custos: moeda + valor (o símbolo vem da moeda escolhida).
      await form.locator("select[name=currency]").selectOption("BRL");
      await amount.fill("1.234,56");
    } else if (await number.count()) {
      const key = Object.keys(values).find((k) =>
        label.toLowerCase().includes(k.toLowerCase()),
      );
      await number.fill(key ? values[key] : "10");
    } else if (await date.count()) {
      await date.fill("2026-10-15");
    } else if (await text.count()) {
      await text.fill("ok");
    }
    await form.locator("button[type=submit]").first().click();
    await page.waitForLoadState("networkidle");
    if (page.url().includes("error=")) {
      const alert = await page.locator("main").innerText();
      throw new Error(
        `Falha ao enviar "${label}": ${page.url()}\n${alert.slice(0, 400)}`,
      );
    }
  }
}
