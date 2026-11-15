import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Nova solicitação (dono, 15/11/2026): a ordem Cliente → Programação →
 * Produtos; a 1ª programação a partir do lançamento + 120 dias corridos (o
 * 120º incluso), com a data permitida à vista, o calendário sem os dias
 * antes e a regra também no servidor; cada data da lista "Datas das
 * programações" editável sozinha, fixada à mão; trocar o intervalo
 * recalcula só as automáticas; datas fora de ordem apontadas antes de
 * enviar; as datas gravadas voltam iguais ao reabrir a solicitação.
 */

/** Hoje em Brasília (AAAA-MM-DD), como o servidor. */
const todayBr = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** AAAA-MM-DD → DD/MM/AAAA (como a tela em português). */
const br = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const row = (page: Page, n: number) =>
  page.locator(`[data-request-item="${n}"]`);

async function setCount(page: Page, n: string) {
  const input = page.locator("[data-order-plan-count]");
  await input.fill(n);
  await input.blur();
}

/** Compra para estoque com a boneca, o total de caixas nas datas do pedido. */
async function stockDoll(page: Page, cartons: string) {
  await page.locator("[data-request-customer] [data-stock-option]").check();
  const picker = row(page, 0).locator('[data-product-picker="catalog"]');
  await picker.locator("[data-product-picker-input]").fill("boneca");
  await picker.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(row(page, 0).locator('[role="status"]').first()).toBeVisible();
  const gen = row(page, 0).locator("[data-rounds-generator]");
  await gen.locator("[data-generate-total]").fill(cartons);
  await gen.locator("[data-generate-submit]").click();
}

const planDates = (page: Page) =>
  page.locator("[data-order-plan-date-text]").allInnerTexts();

test("Nova solicitação: Cliente → Programação → Produtos, 1ª data em lançamento + 120 dias, datas editáveis uma a uma e reabertura", async ({
  page,
}) => {
  const launch = todayBr();
  const min = addDays(launch, 120);
  await login(page, "admin@wellmix.com");
  await page.goto("/app/requests/new");

  // 1. A ordem: Cliente, a programação do pedido e só depois "Produtos" e
  // o Produto 1.
  const order = await page.evaluate(() => {
    const at = (sel: string) => document.querySelector(sel)!;
    const after = (a: Element, b: Element) =>
      !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const customer = at("[data-request-customer]");
    const plan = at("[data-order-plan]");
    const title = at("[data-request-products-title]");
    const product = at('[data-request-item="0"]');
    return [after(customer, plan), after(plan, title), after(title, product)];
  });
  expect(order).toEqual([true, true, true]);

  // 2. O servidor também recusa o 119º dia (data digitada, envio sem a
  // conferência do navegador).
  await setCount(page, "2");
  const first = page.locator("[data-order-plan-first]");
  await first.fill(addDays(launch, 119));
  await stockDoll(page, "100");
  await page.evaluate(() => {
    document.querySelector<HTMLFormElement>(
      "form:has([data-order-plan])",
    )!.noValidate = true;
  });
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await page.waitForURL(/[?&]error=schedule_too_soon/);
  await expect(page.locator("main")).toContainText(
    `A 1ª programação precisa ser a partir de ${br(min)}`,
  );

  // 3. 4 programações: a 1ª data começa na permitida, com ela à vista; o
  // calendário de cada data começa nela.
  await setCount(page, "4");
  await expect(first).toHaveValue(min);
  await expect(first).toHaveAttribute("min", min);
  const minHint = page.locator("[data-order-plan-min]");
  await expect(minHint).toHaveAttribute("data-order-plan-min", min);
  await expect(minHint).toContainText(br(min));
  await expect(minHint).toContainText(br(launch));
  for (const n of [1, 2, 3, 4])
    await expect(
      page.locator(`[data-order-plan-date-input="${n}"]`),
    ).toHaveAttribute("min", min);

  // 4. O 119º dia não vale; o 120º vale.
  await first.fill(addDays(launch, 119));
  expect(
    await first.evaluate((el: HTMLInputElement) => el.validity.valid),
  ).toBe(false);
  await expect(minHint).toHaveClass(/text-red-700/);
  await first.fill(min);
  expect(
    await first.evaluate((el: HTMLInputElement) => el.validity.valid),
  ).toBe(true);
  expect(await planDates(page)).toEqual(
    [0, 45, 90, 135].map((d) => br(addDays(min, d))),
  );

  // 5. A Programação 2 trocada sozinha: as outras não mudam; ela fica
  // fixada (marca e botão de voltar à automática).
  const p2 = addDays(min, 40);
  await page.locator('[data-order-plan-date-input="2"]').fill(p2);
  expect(await planDates(page)).toEqual([
    br(min),
    br(p2),
    br(addDays(min, 90)),
    br(addDays(min, 135)),
  ]);
  await expect(page.locator('[data-order-plan-date="2"]')).toHaveAttribute(
    "data-order-plan-manual",
    "1",
  );
  await expect(page.locator("[data-order-plan-manual]")).toHaveCount(1);
  await expect(page.locator('[data-order-plan-unpin="2"]')).toBeVisible();

  // 6. Intervalo de 30 dias: só as automáticas mudam; a fixada fica.
  await page.click('[data-order-plan-interval="30"]');
  const expected = [
    br(min),
    br(p2),
    br(addDays(min, 60)),
    br(addDays(min, 90)),
  ];
  expect(await planDates(page)).toEqual(expected);

  // 7. Fora de ordem: a Programação 2 depois da 3 é apontada e segura o
  // envio; corrigida, o aviso some.
  const p2Input = page.locator('[data-order-plan-date-input="2"]');
  await p2Input.fill(addDays(min, 75));
  const issues = page.locator("[data-order-plan-issues]");
  await expect(issues).toHaveAttribute("data-order-plan-issues", "3");
  await expect(issues).toContainText("Programação 3");
  for (const n of [2, 3])
    await expect(page.locator(`[data-order-plan-date="${n}"]`)).toHaveAttribute(
      "data-order-plan-flagged",
      "1",
    );
  expect(
    await page
      .locator('[data-order-plan-date-input="3"]')
      .evaluate((el: HTMLInputElement) => el.validity.valid),
  ).toBe(false);
  await p2Input.fill(p2);
  await expect(issues).toHaveCount(0);
  expect(await planDates(page)).toEqual(expected);

  // 8. O produto reparte nas mesmas datas (com a fixada) e envia.
  await stockDoll(page, "400");
  expect(
    await row(page, 0).locator("[data-schedule-date]").allInnerTexts(),
  ).toEqual(expected);
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+$/);
  const requestId = new URL(page.url()).pathname.split("/").pop()!;

  // 9. Reabrir: a solicitação mostra as 4 datas gravadas, a 2 ajustada.
  const table = page.locator("[data-request-schedule-table]");
  for (const [i, date] of expected.entries())
    await expect(
      table.locator(`[data-request-schedule-date="${i + 1}"]`),
    ).toContainText(date);
  await expect(
    table.locator('[data-request-schedule-date="2"]'),
  ).toHaveAttribute("data-request-schedule-manual", "1");
  await expect(table.locator("[data-request-schedule-manual]")).toHaveCount(1);

  // 10. Reaberta para acrescentar produto: a mesma programação volta igual
  // (4 datas, 30 dias, a 2 fixada) e a referência continua o lançamento.
  await page.goto(`/app/requests/new?addTo=${requestId}`);
  await expect(page.locator("[data-order-plan]")).toHaveAttribute(
    "data-order-plan",
    "4",
  );
  await expect(page.locator('[data-order-plan-interval="30"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await planDates(page)).toEqual(expected);
  await expect(page.locator('[data-order-plan-date="2"]')).toHaveAttribute(
    "data-order-plan-manual",
    "1",
  );
  await expect(page.locator("[data-order-plan-min]")).toHaveAttribute(
    "data-order-plan-min",
    min,
  );
});
