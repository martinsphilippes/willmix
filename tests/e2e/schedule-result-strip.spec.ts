import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  bookingSheet,
  chooseItem,
  chooseOrderOrigin,
  importAndClose,
  login,
} from "./helpers";

/*
 * "Resultado da programação" (dono, 15/11/2026): embaixo de "Gerar
 * programação", no lugar do texto "Cálculo", uma faixa só com três grupos
 * (Caixa master e capacidade, Por programação, Total programado), o mesmo
 * componente na Seleção de itens e na Nova solicitação. Aqui: os valores
 * com os dados do item, a troca do container (o tipo e a ocupação
 * equivalente acima de 100%), a caixa inner com e sem quantidade, o peso
 * líquido com a base no rótulo (por peça) e, logo depois dele, o peso bruto
 * (dono, 16/11/2026). Desde 16/11/2026 a faixa não rola para o lado: os
 * campos quebram a linha dentro do quadro, todos à vista (computador, iPad
 * deitado e em pé e celular), com o líquido e o bruto lado a lado.
 */
const TAG = `RES${Date.now().toString(36).toUpperCase()}`;

type Strip = Record<string, Record<string, [string, string]>>;

/** A faixa: grupo → campo → [rótulo, valor], na ordem da tela. */
async function strip(scope: Locator): Promise<Strip> {
  return scope.locator("[data-generate-strip]").evaluate((el) => {
    const clean = (s: string | null | undefined) =>
      (s ?? "").replace(/\s+/g, " ").trim();
    const out: Record<string, Record<string, [string, string]>> = {};
    for (const g of el.querySelectorAll("[data-generate-group]")) {
      const group: Record<string, [string, string]> = {};
      for (const f of g.querySelectorAll("[data-generate-field]"))
        group[f.getAttribute("data-generate-field")!] = [
          clean(f.querySelector("dt")?.textContent),
          clean(f.querySelector("dd")?.textContent),
        ];
      out[g.getAttribute("data-generate-group")!] = group;
    }
    return out;
  });
}

/**
 * A faixa no card: tudo à vista, sem rolar para o lado. Cada campo (rótulo
 * e valor) dentro do quadro, sem texto cortado e sem encostar em outro; o
 * peso bruto logo à direita do líquido, na mesma linha.
 */
async function layout(scope: Locator) {
  return scope.locator("[data-rounds-generator]").evaluate((card) => {
    const stripEl = card.querySelector("[data-generate-strip]")!;
    const box = card.getBoundingClientRect();
    const s = stripEl.getBoundingClientRect();
    const fields = [...stripEl.querySelectorAll("[data-generate-field]")];
    const rects = fields.map((f) => f.getBoundingClientRect());
    const inside = (r: DOMRect) =>
      r.left >= s.left - 0.5 &&
      r.right <= s.right + 0.5 &&
      r.top >= s.top - 0.5 &&
      r.bottom <= s.bottom + 0.5;
    // Texto cortado: rótulo ou valor mais largo que a caixa dele.
    const cut = fields.filter((f) =>
      [...f.querySelectorAll("dt, dd")].some(
        (el) => el.scrollWidth > el.clientWidth + 1,
      ),
    );
    const overlaps: string[] = [];
    rects.forEach((a, i) =>
      rects.slice(i + 1).forEach((b, j) => {
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 0.5 && h > 0.5)
          overlaps.push(
            `${fields[i].getAttribute("data-generate-field")} × ${fields[i + 1 + j].getAttribute("data-generate-field")}`,
          );
      }),
    );
    const carton = stripEl.querySelector('[data-generate-group="carton"]')!;
    const net = carton
      .querySelector('[data-generate-field="net-weight"]')!
      .getBoundingClientRect();
    const gross = carton
      .querySelector('[data-generate-field="gross-weight"]')!
      .getBoundingClientRect();
    return {
      groups: [...stripEl.querySelectorAll("[data-generate-group]")].map((g) =>
        g.getAttribute("data-generate-group"),
      ),
      insideCard: s.left >= box.left - 1 && s.right <= box.right + 1,
      scrolls: stripEl.scrollWidth > stripEl.clientWidth + 1,
      allInside: rects.every(inside),
      cut: cut.map((f) => f.getAttribute("data-generate-field")),
      overlaps,
      // O bruto na mesma linha do líquido, logo à direita.
      grossNextToNet:
        Math.abs(gross.top - net.top) <= 1 &&
        gross.left > net.right &&
        gross.left - net.right < 16,
      pageScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

/** Tudo à vista no card, sem rolagem nem corte (a mesma conta em toda largura). */
const fits = {
  groups: ["carton", "per-round", "total"],
  insideCard: true,
  scrolls: false,
  allInside: true,
  cut: [],
  overlaps: [],
  grossNextToNet: true,
  pageScroll: false,
};

/** Larguras de tela: celular, iPad em pé, iPad deitado e computador. */
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
  { width: 1280, height: 720 },
];

async function fitsEverywhere(page: Page, scope: Locator) {
  for (const size of VIEWPORTS) {
    await page.setViewportSize(size);
    expect(await layout(scope), `${size.width}×${size.height}`).toEqual(fits);
  }
}

async function generate(scope: Locator, cartons: string, rounds: string) {
  const gen = scope.locator("[data-rounds-generator]");
  await gen.locator("[data-generate-total]").fill(cartons);
  const roundsField = gen.locator("[data-generate-rounds]");
  if ((await roundsField.getAttribute("readonly")) === null)
    await roundsField.fill(rounds);
  else await expect(roundsField).toHaveValue(rounds);
  await gen.locator("[data-generate-submit]").click();
}

async function openSelection(page: Page, code: string) {
  await page.goto(`/app/booking/selection?q=${encodeURIComponent(TAG)}`);
  await page.locator("input[data-basket-all]").check();
  await page.click("[data-selection-group]");
  await page.waitForURL(/tab=selection&ids=/);
  await chooseItem(page, code);
}

/** O que a faixa mostra para 300 caixas em 2 datas da caixa da boneca. */
const perRound = {
  cartons: ["Caixas", "150"],
  pieces: ["Peças", "7.200"],
  volume: ["Volume", "18,03 m³"],
  occupancy: ["Ocupação 40HC", "26%"],
};
const total = {
  rounds: ["Programações", "2"],
  cartons: ["Caixas", "300"],
  pieces: ["Peças", "14.400"],
  volume: ["Volume", "36,06 m³"],
  // 300 caixas ÷ 565 por 40HC = 0,531 → 53%.
  equivalent: ["Ocupação equivalente", "53% de 1 × 40HC"],
};

test("Resultado da programação: a faixa nas duas telas, o container, a caixa inner e o peso", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  // Item do Book com a caixa da boneca (48 peças, 0,1202 m³), caixa inner
  // (12), peso líquido por peça (0,3 kg; no Book os dois são obrigatórios) e
  // peso bruto por peça (G.W./PC, 0,35 kg).
  await importAndClose(
    page,
    bookingSheet(
      "Shenzhen Supplier A",
      `${TAG}-A`,
      `Boneca ${TAG}`,
      undefined,
      {
        cbm: "0.1202",
      },
    ),
    "Shenzhen Supplier A",
  );
  // 1. Seleção de itens, item A: 300 caixas em 2 datas.
  await openSelection(page, `${TAG}-A`);
  const choice = page.locator("[data-selection-quantity-block]");
  await generate(choice, "300", "2");
  await expect(choice.locator("[data-schedule-item]")).toHaveCount(2);
  const gen = choice.locator("[data-rounds-generator]");
  await expect(gen.locator("[data-generate-calc] > p").first()).toHaveText(
    "Resultado da programação",
  );
  // Sem fórmulas nem parágrafos: só o título e a faixa.
  await expect(gen.locator("[data-generate-calc] > p")).toHaveCount(1);
  expect(await strip(choice)).toEqual({
    carton: {
      "pieces-per-carton": ["Peças por caixa", "48"],
      inner: ["Caixa inner", "12"],
      "cbm-per-carton": ["CBM por caixa", "0,1202 m³"],
      "net-weight": ["Peso líquido por peça", "0,3 kg"],
      "gross-weight": ["Peso bruto por peça", "0,35 kg"],
      capacity: ["Capacidade 40HC", "565 caixas · 27.120 peças"],
    },
    "per-round": perRound,
    total,
  });
  // Os campos de cima e os cartões de cada programação continuam.
  await expect(gen.locator("[data-generate-per-round]")).toHaveText("1");
  await expect(gen.locator("[data-generate-total-containers]")).toHaveText("2");
  expect(await layout(choice)).toEqual(fits);

  // 2. Trocar o container: o tipo em todos os rótulos e a ocupação
  // equivalente acima de 100% quando o total passa de um container.
  await gen.locator('[data-generate-container="20GP"]').click();
  let now = await strip(choice);
  expect(now.carton.capacity).toEqual([
    "Capacidade 20GP",
    "232 caixas · 11.136 peças",
  ]);
  expect(now["per-round"].occupancy).toEqual(["Ocupação 20GP", "64%"]);
  expect(now.total.equivalent).toEqual([
    "Ocupação equivalente",
    "129% de 1 × 20GP",
  ]);
  await gen.locator('[data-generate-container="40GP"]').click();
  now = await strip(choice);
  expect(now["per-round"].occupancy).toEqual(["Ocupação 40GP", "31%"]);
  expect(now.total.equivalent).toEqual([
    "Ocupação equivalente",
    "62% de 1 × 40GP",
  ]);
  await gen.locator('[data-generate-container="40HC"]').click();
  expect((await strip(choice)).total.equivalent).toEqual(total.equivalent);

  // 3. Celular, iPad em pé e deitado e computador: tudo à vista no quadro,
  // sem rolar para o lado (dono, 16/11/2026), e o bruto ao lado do líquido.
  await fitsEverywhere(page, choice);

  // 4. Nova solicitação: a boneca do cadastro (caixa inner 6, 0,28 kg
  // líquido e 0,35 kg bruto por peça) com a mesma entrada dá as mesmas
  // programações e o mesmo total.
  await page.goto("/app/requests/new");
  // Venda ao cliente pela Wellmix: país e grupo antes do produto
  // (docs/ORDER_TERMS.md).
  await chooseOrderOrigin(page);
  const line = page.locator('[data-request-item="0"]');
  const picker = line.locator('[data-product-picker="catalog"]');
  await picker.locator("[data-product-picker-input]").fill("boneca");
  await picker.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(line.locator('[data-generate-item="ok"]')).toBeVisible();
  const planCount = page.locator("[data-order-plan-count]");
  await planCount.fill("2");
  await planCount.blur();
  await generate(line, "300", "2");
  await expect(line.locator("[data-schedule-item]")).toHaveCount(2);
  expect(await strip(line)).toEqual({
    carton: {
      "pieces-per-carton": ["Peças por caixa", "48"],
      inner: ["Caixa inner", "6"],
      "cbm-per-carton": ["CBM por caixa", "0,1202 m³"],
      "net-weight": ["Peso líquido por peça", "0,28 kg"],
      "gross-weight": ["Peso bruto por peça", "0,35 kg"],
      capacity: ["Capacidade 40HC", "565 caixas · 27.120 peças"],
    },
    "per-round": perRound,
    total,
  });
  // A Nova solicitação divide a largura com o histórico do cliente: a
  // coluna mais estreita, a do pedido do dono (iPad deitado).
  await fitsEverywhere(page, line);
  await page.setViewportSize({ width: 1280, height: 720 });

  // 5. A piscina do cadastro não tem caixa inner: "—"; os pesos (3,1 kg e
  // 3,6 kg) são por peça. Trocar o produto pede gerar de novo.
  await page.goto("/app/requests/new");
  await chooseOrderOrigin(page, "CHINA", "fm:INFLAVEIS");
  await picker.locator("[data-product-picker-input]").fill("piscina");
  await picker.locator('[data-product-picker-option="prod-piscina"]').click();
  await expect(line.locator('[data-generate-item="ok"]')).toBeVisible();
  const carton = (await strip(line)).carton;
  expect(carton.inner).toEqual(["Caixa inner", "—"]);
  expect(carton["net-weight"]).toEqual(["Peso líquido por peça", "3,1 kg"]);
  expect(carton["gross-weight"]).toEqual(["Peso bruto por peça", "3,6 kg"]);
  expect(carton["pieces-per-carton"]).toEqual(["Peças por caixa", "6"]);
});
