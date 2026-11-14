import { expect, test } from "@playwright/test";
import { PASSWORD, login } from "./helpers";

/*
 * Excluir acesso (Equipe e acessos → acessos de uma pessoa): o administrador
 * cria um login e a pessoa entra em outro navegador. A confirmação mostra o
 * nome e o login; "Cancelar" não muda nada; confirmado, a lista mostra
 * "Acesso excluído com sucesso" sem a pessoa, a sessão aberta dela cai na
 * próxima tela, o login não entra mais e a exclusão aparece na Auditoria.
 * O próprio acesso aparece desligado, com o motivo. Opção da confirmação
 * (marcada por padrão): quem respondia a ela passa para o chefe dela.
 */
test("Excluir acesso: confirmação, lista, sessão aberta e Auditoria", async ({
  page,
  browser,
}) => {
  const tag = Date.now().toString(36);
  const name = `Gabi ${tag}`;
  const userLogin = `gabi-${tag}@wellmix.com`;
  await login(page, "admin@wellmix.com");

  // Novo login da equipe (sem a troca de senha no primeiro acesso).
  await page.goto("/app/team?tab=team&new=1");
  const form = page.locator("[data-team-new-login]");
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="login"]').fill(userLogin);
  await form.locator('input[name="password"]').fill(PASSWORD);
  await form.locator('input[name="mustChange"]').uncheck();
  // Ela responde à Ana Admin.
  await form
    .locator('select[name="managerUserId"]')
    .selectOption({ label: "Ana Admin" });
  await form.getByRole("button", { name: "Criar login" }).click();
  await page.waitForURL(/\/app\/team\/[^/?]+\?created=/);
  const memberUrl = new URL(page.url()).pathname;
  const memberId = memberUrl.split("/").pop()!;

  // O Otávio passa a responder a ela.
  await page.goto("/app/team");
  const otavioId = await page
    .locator("[data-team-member]", { hasText: "Otávio Operador" })
    .getAttribute("data-team-member");
  // Editar acessos da pessoa (o mesmo editor do painel lateral): salvar fica
  // na tela e mostra o aviso depois que o servidor gravou.
  const setOtavioManager = async (value: string) => {
    await page.goto(`/app/team/${otavioId}`);
    await page.locator("[data-team-manager]").selectOption(value);
    await page.locator("[data-team-save]").click();
    await expect(page.locator("[data-team-saved]")).toBeVisible();
  };
  await setOtavioManager(memberId);

  // A pessoa entra em outro navegador e fica com o portal aberto.
  const other = await browser.newContext();
  const theirs = await other.newPage();
  await login(theirs, userLogin);
  await expect(theirs).toHaveURL(/\/app/);

  // Confirmação com nome e login; cancelar não exclui.
  await page.goto(memberUrl);
  await expect(page.locator("[data-team-delete]")).toHaveAttribute(
    "data-team-delete",
    "on",
  );
  const open = page.locator("[data-team-delete-open]");
  await open.click();
  const dialog = page.locator("[data-team-delete-dialog]");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-team-delete-who]")).toHaveText(
    `${name} · ${userLogin}`,
  );
  await expect(dialog).toContainText("vai perder o acesso à equipe Wellmix");
  // Opção marcada: o Otávio vai para a Ana Admin. Desmarcada, aparece o que
  // fazer depois; marcada de novo, o aviso some.
  const move = dialog.locator("[data-team-delete-move]");
  await expect(move).toBeChecked();
  await expect(dialog.locator("[data-team-delete-reports] label")).toHaveText(
    "Passar as 1 pessoa(s) que respondem a ela para Ana Admin, a quem ela responde",
  );
  const later = dialog.locator("[data-team-delete-reports] p");
  await expect(later).toBeHidden();
  await move.uncheck();
  await expect(later).toBeVisible();
  await move.check();
  await expect(later).toBeHidden();
  await dialog.locator("[data-team-delete-cancel]").click();
  await expect(dialog).toBeHidden();
  await page.goto("/app/team");
  await expect(page.locator(`[data-team-member="${memberId}"]`)).toBeVisible();

  // Confirmado: volta à lista com a mensagem e sem a pessoa.
  await page.goto(memberUrl);
  await open.click();
  await dialog.locator("[data-team-delete-confirm]").click();
  await page.waitForURL(/\/app\/team\?saved=deleted/);
  await expect(page.locator("[data-team-saved-text]")).toHaveText(
    "Acesso excluído com sucesso",
  );
  await expect(page.locator("[data-team-deleted-reports]")).toHaveText(
    "1 pessoa(s) passaram a responder a Ana Admin.",
  );
  await expect(page.locator(`[data-team-member="${memberId}"]`)).toHaveCount(0);
  await expect(page.locator(`[data-team-member="${otavioId}"]`)).toContainText(
    "Ana Admin",
  );

  // A sessão que estava aberta cai na próxima tela; o login não entra mais.
  await theirs.goto("/app");
  await expect(theirs).toHaveURL(/\/login/);
  await theirs.getByLabel(/e-mail|email|邮箱/i).fill(userLogin);
  await theirs.getByLabel(/senha|password|密码/i).fill(PASSWORD);
  await theirs.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  // O anúncio de rota do Next também é role=alert (vazio): só o aviso com texto.
  await expect(
    theirs.getByRole("alert").filter({ hasText: /\S/ }),
  ).toBeVisible();
  await expect(theirs).toHaveURL(/\/login/);
  await other.close();

  // A página de acessos de quem já saiu não abre mais.
  const gone = await page.goto(memberUrl);
  expect(gone?.status()).toBe(404);

  // Auditoria: quem excluiu, qual acesso e quando.
  await page.goto(`/app/audit?module=team&q=${encodeURIComponent(userLogin)}`);
  const row = page.locator('[data-audit-row="team.member.delete"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(`Acesso excluído: ${name} (${userLogin})`);
  await expect(row).toContainText("Ana Admin");

  // O próprio acesso: botão desligado, com o motivo.
  await page.goto("/app/team");
  const self = page.locator("[data-team-member]", { hasText: "Ana Admin" });
  await self.getByRole("link", { name: "Ana Admin" }).click();
  await page.waitForURL(/\/app\/team\/[^/?]+$/);
  await expect(page.locator("[data-team-delete]")).toHaveAttribute(
    "data-team-delete",
    "blocked",
  );
  await expect(page.locator("[data-team-delete-open]")).toBeDisabled();
  await expect(page.locator("[data-team-delete-why]")).toHaveText(
    "Você não pode excluir o próprio acesso.",
  );

  // O Otávio volta a não responder a ninguém, como nos dados de demonstração.
  await setOtavioManager("");
});
