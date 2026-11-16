import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Minhas pendências do fornecedor e da Trading (dono, 16/11/2026): a faixa
 * "Etapas que chegam até você" segue, depois do Die Cut, Ficha de compra →
 * Aprovar a arte → Assinar o pedido → Confirmar sinal → Inspeção → Amostra →
 * Transportadora → Carregamento → Invoice, onde o serviço da Trading
 * termina. O visual e os filtros são os de antes (o login de demonstração do
 * fornecedor A usa o chinês).
 */

const steps = (page: Page) =>
  page.locator("[data-supplier-flow] [data-supplier-step]");

test("fornecedor e Trading: a linha do tempo vai do Book à Invoice", async ({
  page,
}) => {
  await login(page, "supplier.a@china.com");
  await page.goto("/app/tasks");

  // As 13 etapas, na ordem do mapa, numeradas de 1 a 13.
  expect(
    await steps(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-supplier-step")),
    ),
  ).toEqual([
    "booking",
    "request",
    "sampling",
    "dieline",
    "sheet",
    "art",
    "sign",
    "deposit",
    "inspection",
    "sample",
    "carrier",
    "loading",
    "invoice",
  ]);
  const labels = (
    await steps(page).locator("[data-supplier-step-label]").allInnerTexts()
  ).map((x) => x.trim());
  expect(labels.slice(3)).toEqual([
    "刀模 (Die Cut)",
    "采购表",
    "确认设计稿",
    "签署订单",
    "确认定金",
    "验货",
    "样品",
    "拖车公司",
    "装柜",
    "发票",
  ]);
  await expect(steps(page).last()).toContainText("13");
  // A nota: o serviço termina na Invoice.
  await expect(page.locator("[data-supplier-steps]")).toContainText(
    "您的服务到发票为止",
  );

  // Tocar na Invoice filtra a lista e mostra o que fazer nela.
  await steps(page).last().click();
  await page.waitForURL(/type=supplier\.invoice/);
  await expect(steps(page).last()).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-supplier-step-help]")).toContainText(
    "您的服务到此结束",
  );

  // Link antigo da etapa Embarque: a tela abre, com a faixa nova.
  const res = await page.goto("/app/tasks?type=supplier.shipping");
  expect(res?.status()).toBe(200);
  await expect(steps(page)).toHaveCount(13);
});
