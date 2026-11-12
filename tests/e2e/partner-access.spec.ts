import { expect, test, type Page } from "@playwright/test";
import { bookingSheet, importAndClose } from "./helpers";

/*
 * Tipos em destaque e Gestão de telas (docs/PARTNER_ACCESS.md): Trading,
 * Factory, Supplier e GP nos filtros; uma Factory com login entra com as
 * telas do Fornecedor; o administrador tira uma tela (vale na hora), compara
 * dois perfis e copia a tela de volta com prévia; uma tela de outra classe
 * de login (Multas) é liberada e mostra só os dados da própria empresa.
 */
const PASSWORD = "wellmix123";

async function login(page: Page, user: string, password = PASSWORD) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/e-mail|email|邮箱/i).fill(user);
  await page.getByLabel(/senha|password|密码/i).fill(password);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
}

/**
 * Abre a Gestão de telas e espera a tabela ficar interativa: a busca da
 * tabela só aparece depois da hidratação. Clicar antes perde o clique (a
 * hidratação devolve a caixa ao valor da página).
 */
async function openAccess(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator("[data-table-search]").first()).toBeVisible();
}

test("Factory com login: telas do Fornecedor, revogar, comparar e copiar", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const factoryName = `Fábrica ${tag}`;
  const userLogin = `li-${tag}@factory.com`;
  await login(page, "admin@wellmix.com");

  // Os quatro tipos novos vêm primeiro nos filtros; Gestão de telas à vista.
  await page.goto("/app/parties");
  const chips = page.locator("[data-party-type-chip]");
  await expect(chips.nth(0)).toHaveText("Trading");
  await expect(chips.nth(1)).toHaveText("Factory");
  await expect(chips.nth(2)).toHaveText("Supplier");
  await expect(chips.nth(3)).toHaveText("GP");
  await expect(page.locator("[data-partner-access-link]")).toBeVisible();

  // Novo parceiro a partir do filtro Factory: o tipo já vem marcado.
  await page.locator('[data-party-type-chip="factory"]').click();
  await page.waitForURL(/type=factory/);
  await page.locator("[data-party-new]").click();
  await expect(page.locator("[data-party-type]")).toHaveValue("factory");
  await page.fill('input[name="name"]', factoryName);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?]+$/);

  // Depois de cadastrar, a tela já abre no quadro de acesso, com o atalho no topo.
  await expect(page).toHaveURL(/#access$/);
  await expect(page.locator("[data-party-login-jump]")).toBeVisible();
  // Usuário vinculado: entra com o papel do Fornecedor.
  const access = page.locator("[data-party-access]");
  await expect(access.locator('select[name="role"]')).toHaveValue("supplier");
  await access.locator('input[name="name"]').fill("Li Factory");
  await access.locator('input[name="login"]').fill(userLogin);
  await access.locator('input[name="password"]').fill(PASSWORD);
  await access.locator("[data-party-access-create]").click();
  await page.waitForURL(/saved=user/);
  await expect(page.locator("[data-party-access-profile]")).toContainText(
    "Factory",
  );

  // Na lista, a coluna do login mostra que o parceiro já tem acesso.
  await page.goto("/app/parties?type=factory");
  await expect(
    page.locator("tr", { hasText: factoryName }).locator("[data-party-logins]"),
  ).toHaveAttribute("data-party-logins", "1");

  // Como Factory: as mesmas telas do Fornecedor (o menu é conferido nos testes unitários).
  await login(page, userLogin);
  await page.goto("/app/supplier-requests");
  await expect(page).toHaveURL(/\/app\/supplier-requests/);
  await expect(
    page.getByRole("heading", { name: "Solicitações ao fornecedor" }),
  ).toBeVisible();

  // Administrador: tira Solicitações ao fornecedor da Factory na Gestão de telas.
  await login(page, "admin@wellmix.com");
  await openAccess(page, "/app/parties/access?profile=type:factory");
  await expect(page.locator("[data-access-users]")).toHaveAttribute(
    "data-access-users",
    /^[1-9]/,
  );
  // O catálogo mostra todas as telas, inclusive internas (bloqueadas).
  await expect(page.locator('[data-access-screen="finance"]')).toHaveAttribute(
    "data-access-state",
    "internal",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-access-open="quotes"]').uncheck();
  await page.locator("[data-access-save]").click();
  await page.waitForURL(/saved=/);
  await expect(page.locator('[data-access-screen="quotes"]')).toHaveAttribute(
    "data-access-state",
    "blocked",
  );

  // A vitrine é de outra classe de login: pode ser liberada, com o aviso de
  // que neste perfil ainda abre sem dados.
  await expect(page.locator('[data-access-screen="explore"]')).toHaveAttribute(
    "data-access-state",
    "blocked",
  );
  await expect(page.locator('[data-access-limited="explore"]')).toBeVisible();
  await expect(page.locator('[data-access-limited="orders"]')).toHaveCount(0);

  // Comparar Factory com o Fornecedor: as diferenças são Solicitações ao
  // fornecedor (tirada agora) e o Booking (a Factory tem; o Fornecedor não).
  await page.goto(
    "/app/parties/access?view=compare&a=type:factory&b=role:supplier",
  );
  await expect(page.locator('[data-access-compare="quotes"]')).toHaveAttribute(
    "data-differs",
    "1",
  );
  await expect(page.locator('[data-access-compare="booking"]')).toHaveAttribute(
    "data-differs",
    "1",
  );
  await expect(page.locator("[data-access-compare-diff]")).toHaveAttribute(
    "data-access-compare-diff",
    "2",
  );

  // Como Factory: Solicitações ao fornecedor recusa, mesmo pelo endereço; a Gestão de telas
  // não abre para quem não é administrador.
  await login(page, userLogin);
  await page.goto("/app/supplier-requests");
  await expect(page).toHaveURL(/denied=quotes/);
  await page.goto("/app/parties/access");
  await expect(page).toHaveURL(/denied=parties/);

  // Administrador: copia Solicitações ao fornecedor do Fornecedor de volta para a Factory, com prévia.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/parties/access?view=copy");
  await page.selectOption('select[name="from"]', "role:supplier");
  await page.selectOption('select[name="to"]', "type:factory");
  await page.locator('[data-access-copy-screen="quotes"]').check();
  await page.locator("[data-access-copy-preview]").click();
  await expect(page.locator("[data-access-copy-result]")).toContainText(
    "Passa a abrir",
  );
  await page.locator("[data-access-copy-apply]").click();
  await page.waitForURL(/saved=1/);
  await expect(page.locator('[data-access-screen="quotes"]')).toHaveAttribute(
    "data-access-state",
    "open",
  );
  // Por tela: quem abre Solicitações ao fornecedor.
  await page.goto("/app/parties/access?view=screen&screen=quotes");
  await expect(
    page.locator('[data-access-holder="type:factory"]'),
  ).toHaveAttribute("data-access-open", "1");
  await expect(
    page.locator('[data-access-holder="role:customer"]'),
  ).toHaveAttribute("data-access-open", "0");
  // Copiar Multas (do jurídico) para a Factory: vale, com prévia.
  await page.goto(
    "/app/parties/access?view=copy&preview=1&from=role:legal&to=type:factory&screens=penalties&mode=add",
  );
  await expect(page.locator("[data-access-copy-result]")).toContainText(
    "Passa a abrir",
  );
  await page.locator("[data-access-copy-apply]").click();
  await page.waitForURL(/saved=1/);

  // Copiar Solicitações (do cliente) para a Factory: vale também.
  await page.goto(
    "/app/parties/access?view=copy&preview=1&from=role:customer&to=type:factory&screens=requests&mode=add",
  );
  await expect(page.locator("[data-access-copy-result]")).toContainText(
    "Passa a abrir",
  );
  await page.locator("[data-access-copy-apply]").click();
  await page.waitForURL(/saved=1/);
  // E tira Pendências e Mensagens da Factory.
  await openAccess(page, "/app/parties/access?profile=type:factory");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-access-open="tasks"]').uncheck();
  await page.locator('[data-access-open="messages"]').uncheck();
  await page.locator("[data-access-save]").click();
  await page.waitForURL(/saved=/);

  // Como Factory de novo: Solicitações ao fornecedor voltou a abrir.
  await login(page, userLogin);
  await page.goto("/app/supplier-requests");
  await expect(
    page.getByRole("heading", { name: "Solicitações ao fornecedor" }),
  ).toBeVisible();
  // Multas abre para a Factory e mostra só as da própria empresa (nenhuma).
  await page.goto("/app/penalties");
  await expect(page).toHaveURL(/\/app\/penalties/);
  await expect(page.locator("tbody tr")).toHaveCount(0);
  // Solicitações abre vazia e só para consulta: sem o botão de criar, e o
  // formulário (que traz o catálogo de produtos) não abre para a Factory.
  await page.goto("/app/requests");
  await expect(page).toHaveURL(/\/app\/requests$/);
  await expect(page.locator('a[href="/app/requests/new"]')).toHaveCount(0);
  await page.goto("/app/requests/new");
  await expect(page).toHaveURL(/\/app\/requests$/);
  // Sem Pendências: o início fica só com a saudação e a lista recusa.
  await page.goto("/app");
  await expect(page.locator("[data-home-no-tasks]")).toBeVisible();
  await page.goto("/app/tasks");
  await expect(page).toHaveURL(/denied=tasks/);
  // Sem Mensagens: a tela recusa e o ícone de mensagens some do cabeçalho.
  await page.goto("/app/messages");
  await expect(page).toHaveURL(/denied=messages/);
  await expect(page.locator("[data-messages-link]")).toHaveCount(0);

  // Deixa o perfil como estava para os outros testes.
  await login(page, "admin@wellmix.com");
  await openAccess(page, "/app/parties/access?profile=type:factory");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("[data-access-reset]").click();
  await page.waitForURL(/saved=reset/);
});

/*
 * Booking do Trading (dono, 11 e 12/11/2026; docs/BOOKING.md): o login de uma
 * Trading abre a tela Booking, lança o booking dela em dois passos (sobe a
 * planilha, confere os campos na tela e aperta "Enviar para Wellmix
 * Conferir") e vê só os bookings da empresa dele, sem a análise da Wellmix;
 * o resto do Booking continua só da Wellmix.
 */
test("Trading com login: lança o booking dele e vê só os bookings dele", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const code = `TRD${tag.toUpperCase()}`;
  const tradingName = `Trading ${tag}`;
  const userLogin = `wu-${tag}@trading.com`;
  await login(page, "admin@wellmix.com");

  // Cadastro da Trading com um login (entra com o papel do Fornecedor).
  await page.goto("/app/parties");
  await page.locator('[data-party-type-chip="trading"]').click();
  await page.waitForURL(/type=trading/);
  await page.locator("[data-party-new]").click();
  await expect(page.locator("[data-party-type]")).toHaveValue("trading");
  await page.fill('input[name="name"]', tradingName);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?]+$/);
  // O cadastro novo nasce ativo (senão não entra nas listas de escolha).
  await expect(
    page.locator('input[type="checkbox"][name="active"]'),
  ).toBeChecked();
  const access = page.locator("[data-party-access]");
  await access.locator('input[name="name"]').fill("Wu Trading");
  await access.locator('input[name="login"]').fill(userLogin);
  await access.locator('input[name="password"]').fill(PASSWORD);
  await access.locator("[data-party-access-create]").click();
  await page.waitForURL(/saved=user/);

  // Gestão de telas: o Booking já vem aberto no Trading (e na Factory, no
  // Supplier e no GP); no Fornecedor pode ser liberado (deixou de ser
  // "interna da Wellmix").
  for (const profile of ["type:trading", "type:gp", "type:supplier_partner"]) {
    await openAccess(page, `/app/parties/access?profile=${profile}`);
    await expect(
      page.locator('[data-access-screen="booking"]'),
    ).toHaveAttribute("data-access-state", "open");
    await expect(page.locator('[data-access-limited="booking"]')).toHaveCount(
      0,
    );
  }
  await openAccess(page, "/app/parties/access?profile=role:supplier");
  await expect(page.locator('[data-access-screen="booking"]')).toHaveAttribute(
    "data-access-state",
    "blocked",
  );

  // Dois bookings: um de outro fornecedor e um com a Trading de responsável.
  await importAndClose(
    page,
    bookingSheet(
      "Guangzhou Supplier B",
      `${code}-X`,
      `Glass jar ${code} other`,
    ),
    "Guangzhou Supplier B",
  );
  const foreignUrl = new URL(page.url()).pathname;
  await importAndClose(
    page,
    bookingSheet("Shenzhen Supplier A", `${code}-A`, `Glass jar ${code} own`),
    "Shenzhen Supplier A",
  );
  const ownUrl = new URL(page.url()).pathname;
  const partner = page.locator(
    "[data-booking-lot-partner] input[role=combobox]",
  );
  await partner.click();
  await partner.fill(tradingName);
  await page
    .locator("[data-booking-lot-partner] [role=option]")
    .filter({ hasText: tradingName })
    .first()
    .click();
  await expect(
    page.locator('[data-booking-lot-partner] [data-booking-row-note="saved"]'),
  ).toBeVisible();

  // Como Trading: a tela Booking abre e lista só o booking dele.
  await login(page, userLogin);
  await page.goto("/app/booking");
  await expect(page).toHaveURL(/\/app\/booking$/);
  const rows = page.locator("[data-partner-booking]");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`booking-${code}-A.xlsx`);
  // Sem os botões da Wellmix (importar e seleção); com o de lançar o dele.
  await expect(page.locator("[data-booking-import-link]")).toHaveCount(0);
  await expect(page.locator('a[href="/app/booking/selection"]')).toHaveCount(0);
  await expect(page.locator("[data-partner-booking-launch]")).toBeVisible();
  await rows.first().locator("a").click();
  await page.waitForURL((url) => url.pathname === ownUrl);
  const items = page.locator("[data-partner-booking-items]");
  await expect(items.locator("tr")).toHaveCount(1);
  await expect(items).toContainText(`${code}-A`);
  // Sem a análise da Wellmix e sem os campos de edição do booking.
  await expect(page.locator("[data-booking-item-analysis]")).toHaveCount(0);
  await expect(page.locator("[data-booking-lot-partner]")).toHaveCount(0);
  await expect(page.locator("[data-booking-lot-close-submit]")).toHaveCount(0);
  // O booking de outra empresa não abre, nem pelo endereço.
  const foreign = await page.goto(foreignUrl);
  expect(foreign?.status()).toBe(404);
  await expect(page.locator("[data-partner-booking-items]")).toHaveCount(0);
  // A Seleção de itens é só da Wellmix: volta para a lista dele.
  await page.goto("/app/booking/selection");
  await expect(page).toHaveURL(/\/app\/booking$/);

  // Lançar booking, passo 1: a Trading sobe a planilha dela (só arquivo).
  await page.locator("[data-partner-booking-launch]").click();
  await page.waitForURL(/\/app\/booking\/import$/);
  const launch = page.locator("[data-partner-booking-launch-form]");
  await expect(launch.locator('input[name="sheetUrl"]')).toHaveCount(0);
  await expect(page.locator("[data-booking-import-form]")).toHaveCount(0);
  await launch
    .locator("input[type=file]")
    .setInputFiles(
      bookingSheet(
        "Yiwu Glass Factory",
        `${code}-T`,
        `Glass jar ${code} trade`,
      ),
    );
  await page.locator("[data-partner-booking-launch-submit]").click();
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  const launchedUrl = new URL(page.url()).pathname;

  // Passo 2: confere os campos, todos abertos e já preenchidos pela planilha.
  await expect(page.locator("[data-partner-booking-preparing]")).toBeVisible();
  const editing = page.locator("[data-partner-booking-edit]");
  await expect(editing.locator("tbody tr")).toHaveCount(1);
  const field = (name: string) =>
    editing.locator(`[data-partner-item-field$=":${name}"]`);
  await expect(field("factoryItemCode")).toHaveValue(`${code}-T`);
  await expect(field("price")).toHaveValue("1,25");
  await expect(field("moq")).toHaveValue("1000");
  // (as listas de incoterm e moeda levam a marca no invólucro do select)
  await expect(field("currency").locator("select")).toHaveValue("USD");
  await expect(field("incoterm").locator("select")).toHaveValue("FOB");
  await expect(field("material")).toHaveValue("glass");
  // Corrige o preço: grava ao sair do campo.
  await field("price").fill("1,40");
  await field("price").press("Enter");
  await expect(
    editing.locator('[data-booking-row-note="saved"]').first(),
  ).toBeVisible();
  // A capacidade veio da planilha em ml e aceita letras: o tamanho, quando o
  // produto não tem volume (porta-retrato "8X10").
  await expect(field("capacityMl")).toHaveValue("350");
  await field("capacityMl").fill("8X10");
  await field("capacityMl").press("Enter");
  await expect(
    field("capacityMl")
      .locator("xpath=..")
      .locator('[data-booking-row-note="saved"]'),
  ).toBeVisible();
  // Na lista dele aparece em primeiro, como não enviado.
  await page.goto("/app/booking");
  await expect(page.locator("[data-partner-booking-unsent]")).toBeVisible();
  await expect(page.locator("[data-partner-booking]")).toHaveCount(2);
  await expect(page.locator("[data-partner-booking]").first()).toHaveAttribute(
    "data-partner-booking-status",
    "preparing",
  );

  // Antes de enviar, a Wellmix não vê o booking: nem na lista, nem no endereço.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/booking");
  await expect(
    page.getByText(`booking-${code}-T.xlsx`, { exact: false }),
  ).toHaveCount(0);
  const hidden = await page.goto(launchedUrl);
  expect(hidden?.status()).toBe(404);

  // A Trading volta, vê a correção gravada e aperta Enviar para Wellmix Conferir.
  await login(page, userLogin);
  await page.goto(launchedUrl);
  await expect(
    page
      .locator("[data-partner-booking-edit]")
      .locator('[data-partner-item-field$=":price"]'),
  ).toHaveValue("1,4");
  // O tamanho digitado na capacidade ficou gravado e não conta como em branco.
  await expect(
    page
      .locator("[data-partner-booking-edit]")
      .locator('[data-partner-item-field$=":capacityMl"]'),
  ).toHaveValue("8X10");
  await expect(
    page.locator('[data-partner-item-blank="capacityMl"]'),
  ).toHaveCount(0);
  await page.locator('[data-partner-booking-send="bottom"]').click();
  await page.waitForURL(/[?&]sent=1/);
  await expect(page.locator("[data-partner-booking-sent]")).toBeVisible();
  // Depois de enviado: só consulta, com o preço corrigido.
  await expect(page.locator("[data-partner-booking-edit]")).toHaveCount(0);
  await expect(page.locator("[data-partner-booking-send]")).toHaveCount(0);
  await expect(page.locator("[data-partner-booking-items]")).toContainText(
    `${code}-T`,
  );
  await expect(page.locator("[data-partner-booking-items]")).toContainText(
    "1,4 USD FOB",
  );
  await expect(page.locator("[data-partner-booking-items]")).toContainText(
    "8X10",
  );
  // Na lista dele: o que a Wellmix pôs em nome dela e o que ela enviou.
  await page.goto("/app/booking");
  await expect(page.locator("[data-partner-booking]")).toHaveCount(2);
  await expect(page.locator("[data-partner-booking-unsent]")).toHaveCount(0);
  await expect(page.locator("[data-partner-booking]").first()).toContainText(
    `booking-${code}-T.xlsx`,
  );

  // A Wellmix agora vê o booking, com a Trading de responsável, e é avisada.
  await login(page, "admin@wellmix.com");
  await page.goto(launchedUrl);
  await expect(
    page.locator("[data-booking-lot-partner] input[role=combobox]"),
  ).toHaveValue(new RegExp(tradingName));
  await page.goto("/app/notifications");
  await expect(page.getByText(/lançado por um parceiro/).first()).toBeVisible();
});
