import { expect, test } from "@playwright/test";
import { bookingSheet, importAndClose, login } from "./helpers";

/*
 * Convite para booking concorrente (docs/BOOKING_INVITES.md): na Seleção de
 * itens a Wellmix abre a cotação de um item e convida um fornecedor; ele vê
 * o convite, sobe a planilha e o booking nasce com ele como responsável.
 */

const TAG = `INV${Date.now().toString(36).toUpperCase()}`;

test("seleção → abrir cotação → convidado sobe o booking concorrente", async ({
  page,
}) => {
  const code = `${TAG}-A`;
  await login(page, "admin@wellmix.com");
  await importAndClose(
    page,
    bookingSheet("Shenzhen Supplier A", code, `Bamboo tray ${TAG}`),
    "Shenzhen Supplier A",
  );

  // Seleção, aba Itens: "Abrir cotação" do item.
  await page.goto(`/app/booking/selection?q=${encodeURIComponent(TAG)}`);
  await page
    .locator("[data-selection-item]", { hasText: code })
    .locator("[data-selection-invite]")
    .click();
  await page.waitForURL(/\/app\/booking\/invite\//);
  const form = page.locator("[data-booking-invite-form]");
  await form
    .locator('[data-booking-invite-partner="fornecedor-b"] input')
    .check();
  await form.locator("textarea[name=message]").fill("Bandeja maior, 40 cm");
  await page.click("[data-booking-invite-submit]");
  await page.waitForURL(/invited=1/);
  await expect(page.locator('[data-booking-invite-row="open"]')).toHaveCount(1);

  // O convidado vê o convite, com o pedido da Wellmix, e sobe a planilha.
  await login(page, "supplier.b@china.com");
  await page.goto("/app/supplier-requests/invites");
  await page
    .locator('[data-booking-invite-row="open"]', { hasText: TAG })
    .locator("[data-booking-invite-open]")
    .click();
  await expect(page.locator("[data-booking-invite-message]")).toContainText(
    "Bandeja maior",
  );
  await page
    .locator("[data-booking-invite-answer-form] input[type=file]")
    .setInputFiles(
      bookingSheet("Guangzhou Supplier B", `${TAG}-B`, `Bamboo tray ${TAG} XL`),
    );
  await page.click("[data-booking-invite-answer-submit]");
  await page.waitForURL(/answered=1/);
  await expect(page.locator("[data-booking-invite-answered]")).toBeVisible();

  // A Wellmix vê o convite respondido e abre o booking enviado.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/supplier-requests/invites");
  await page
    .locator('[data-booking-invite-row="answered"]', { hasText: TAG })
    .locator("[data-booking-invite-open]")
    .click();
  await page.locator("[data-booking-invite-answered] a").click();
  await page.waitForURL(/\/app\/booking\/lots\//);
  await expect(
    page.locator("[data-booking-lot-partner] input[role=combobox]"),
  ).toHaveValue(/Guangzhou Supplier B/);
});
