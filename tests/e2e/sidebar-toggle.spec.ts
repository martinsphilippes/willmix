import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Botão de recolher e expandir o menu lateral (dono, 14/11/2026): no iPad, no
 * fim da página, a seta ficava em parte embaixo do cabeçalho vermelho. A
 * margem da barrinha de início do iPad (env(safe-area-inset-bottom) no body)
 * empurrava a barra lateral, que era "sticky", para cima. Aqui a mesma margem
 * (20 px) é posta à mão, porque o Chromium não tem a barrinha. Em cada
 * tamanho em que o controle existe, nos dois estados, no alto, no meio e no
 * fim da página: o botão fica inteiro logo abaixo do cabeçalho, clicável, no
 * centro da barra recolhida e à direita da barra aberta, com o rótulo do
 * estado; e alterna pelo próprio botão no fim da página.
 */
const SIZES = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "iPad em pé", width: 834, height: 1194 },
  { name: "iPad deitado", width: 1194, height: 834 },
  { name: "celular deitado", width: 844, height: 390 },
];

/** Página longa com a margem do iPad no fim, rolada até `where`. */
async function scrollTo(page: Page, where: "top" | "middle" | "bottom") {
  await page.evaluate((to) => {
    document.body.style.paddingBottom = "20px";
    const main = document.querySelector("main")!;
    if (!main.querySelector("[data-test-filler]")) {
      const filler = document.createElement("div");
      filler.setAttribute("data-test-filler", "");
      filler.style.height = "2400px";
      main.append(filler);
    }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, to === "top" ? 0 : to === "middle" ? max / 2 : max);
  }, where);
  // Um quadro para a tela assentar depois da rolagem (sem rolagem suave).
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => r(null))),
  );
}

/** Onde está o botão em relação ao cabeçalho e à barra. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const header = document
      .querySelector("[data-app-header]")!
      .getBoundingClientRect();
    const btn = document.querySelector<HTMLElement>("[data-sidebar-toggle]")!;
    const r = btn.getBoundingClientRect();
    const aside = btn.closest("[data-sidebar]")!.getBoundingClientRect();
    const hits = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      return !!el && (el === btn || btn.contains(el));
    };
    const cx = r.left + r.width / 2;
    const left = r.left - aside.left;
    const right = aside.right - r.right;
    return {
      // Inteiro abaixo do cabeçalho, com folga, e dentro da tela.
      belowHeader: r.top >= header.bottom + 4,
      onScreen: r.bottom <= window.innerHeight,
      // Clicável em cima, no meio e embaixo (nada por cima dele).
      clickable:
        hits(cx, r.top + 1) &&
        hits(cx, r.top + r.height / 2) &&
        hits(cx, r.bottom - 1),
      // Área de toque confortável (44 px).
      size: Math.round(Math.min(r.width, r.height)),
      align:
        Math.abs(left - right) <= 1
          ? "center"
          : right < left
            ? "right"
            : "left",
      label: btn.getAttribute("aria-label"),
      title: btn.getAttribute("title"),
    };
  });
}

test("menu lateral: o botão de recolher e expandir fica inteiro abaixo do cabeçalho", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  for (const size of SIZES) {
    await page.setViewportSize(size);
    for (const collapsed of [true, false]) {
      await page.evaluate(
        (c) => localStorage.setItem("wm-nav-collapsed", c ? "1" : "0"),
        collapsed,
      );
      await page.goto("/app/parties");
      await expect(page.locator("[data-sidebar]")).toHaveAttribute(
        "data-sidebar-collapsed",
        collapsed ? "1" : "0",
      );
      const label = collapsed ? "Expandir menu" : "Recolher menu";
      for (const where of ["top", "middle", "bottom"] as const) {
        await scrollTo(page, where);
        expect(
          await measure(page),
          `${size.name} · ${label} · ${where}`,
        ).toEqual({
          belowHeader: true,
          onScreen: true,
          clickable: true,
          size: 44,
          align: collapsed ? "center" : "right",
          label,
          title: label,
        });
      }
    }
    // No fim da página, o próprio botão recolhe e abre de novo.
    const sidebar = page.locator("[data-sidebar]");
    const toggle = page.getByRole("button", { name: "Recolher menu" });
    await toggle.click();
    await expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "1");
    await page.getByRole("button", { name: "Expandir menu" }).click();
    await expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "0");
    expect((await measure(page)).belowHeader).toBe(true);
  }
  // Celular em pé: sem a barra lateral (o menu abre pelo botão do cabeçalho).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/parties");
  await expect(page.locator("[data-sidebar-toggle]")).toBeHidden();
  await expect(page.locator("[data-mobile-menu]")).toBeVisible();
});
