/*
 * Inspeção pelo celular: telas reais do portal para o vídeo institucional
 * completo (cena "inspect" de script.mjs).
 *
 * Percorre pela tela os mesmos passos de tests/e2e/happy-path.spec.ts em um
 * portal em modo demonstração com base nova (porta 3300), do Booking até o
 * fornecedor ficar com a inspeção pendente. Depois, com o login do fornecedor
 * em um celular (390 × 844 em 3x), em inglês, grava em film/shots/intl:
 *   m-insp-1.png  o passo como o fornecedor encontra (nada enviado)
 *   m-insp-2.png  primeira foto escolhida (o portal envia na hora: "Saved.")
 *   m-insp-3.png  as três fotos enviadas e o peso digitado, antes de "Send"
 *   m-insp-4.png  depois de "Send": o peso fica "Done"
 *   insp-desk-0.png e insp-desk.png  o mesmo passo como a Wellmix vê, no
 *                 computador, antes e depois do envio
 * e os pontos de toque em out/insp/state.json (vão para o roteiro).
 *
 * LANGUAGE=pt faz as mesmas capturas com o portal em português (cookie
 * wm_locale=pt, navegador pt-BR, fotos com nomes em português, peso "0,30" com
 * a vírgula que o campo aceita) e grava em film/shots/br; os pontos de toque
 * ficam na chave "br" do mesmo state.json (o inglês, em "taps", não muda).
 * Sem a variável (ou LANGUAGE=en) tudo continua como antes.
 *
 * LANGUAGE=zh faz as mesmas capturas com o portal em chinês (cookie
 * wm_locale=zh, navegador zh-CN, fotos com nome de foto de celular) e grava em
 * film/shots/cn; os pontos de toque ficam na chave "cn". A base é a cópia em
 * chinês de .data-video-insp-before (data-zh.mjs e data-shift.mjs).
 *
 *   python3 inspection/photos.py                       (as três fotos, uma vez)
 *   DATA_MODE=memory DATA_DIR=.data-video-insp npx next start -p 3300
 *   node inspection/flow.mjs                           (tudo, base nova)
 *   node inspection/flow.mjs --from <etapa>            (continua; estado em out/insp/state.json)
 *   node inspection/flow.mjs --only phone              (só as capturas)
 *   LANGUAGE=pt node inspection/flow.mjs --only phone  (as capturas em português)
 *   LANGUAGE=zh node inspection/flow.mjs --only phone  (as capturas em chinês)
 *
 * Etapas: books, request, product, order, registry, lanes, contract, payment,
 * snapshot, phone. "snapshot" copia a base para .data-video-insp-before: para
 * repetir só as capturas, pare o portal, copie essa pasta de volta por cima de
 * .data-video-insp e suba o portal de novo. Tudo aqui é dado fictício.
 */
import { chromium } from "playwright";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(ROOT, "../..");
/** Pasta de trabalho (fotos, estado, capturas de falha): fora do repositório. */
const HERE = join(ROOT, "out/insp");
/**
 * Idioma das capturas: LANGUAGE=pt (ou pt-BR) liga o português; qualquer outro
 * valor, ou nenhum, é o inglês de sempre.
 */
const PT = /^pt/i.test(process.env.LANGUAGE ?? "");
/** LANGUAGE=zh (ou zh-CN): as capturas em chinês, para o vídeo em mandarim. */
const ZH = /^zh/i.test(process.env.LANGUAGE ?? "");
/** Idioma do portal (cookie wm_locale), do navegador e pasta das capturas. */
const LOCALE = PT
  ? { cookie: "pt", browser: "pt-BR" }
  : ZH
    ? { cookie: "zh", browser: "zh-CN" }
    : { cookie: "en", browser: "en-US" };
/** Onde as capturas do vídeo ficam. */
const SHOTS = join(
  ROOT,
  PT ? "film/shots/br" : ZH ? "film/shots/cn" : "film/shots/intl",
);
mkdirSync(HERE, { recursive: true });
mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.PORTAL ?? "http://localhost:3300";
const DATA = join(REPO, process.env.DATA_DIR ?? ".data-video-insp");
const PASSWORD = "wellmix123";
const TIMEOUT = 60_000;

const ADMIN = "admin@wellmix.com";
const SUPPLIER = "supplier.a@china.com"; // Li Wei, Shenzhen Supplier A
const AGENCY = "agencia@design.com";
const OCP = "ocp@certifica.com";

/* Presentable names: they show up on the screens. */
const PRODUCT = "Glass cup 350 ml";
const CODE_A = "GC-350";
const CODE_B = "GH-350";
const SEARCH = "Glass cup 350";
/* The portal's number field takes the decimal comma when the browser is pt-BR. */
const WEIGHT = PT ? "0,30" : "0.30";
/** Texts the script matches on the screen, per language (data-attributes first). */
const TEXT = PT
  ? { card: /em Inspeção$/, saved: "Salvo." }
  : ZH
    ? { card: /· 验货$/, saved: "已保存。" }
    : { card: /in Inspection$/, saved: "Saved." };
/** File names the portal shows for the three photos (zh: phone-camera names). */
const NAMES = PT
  ? ["copo-sem-embalagem.jpg", "copo-embalado.jpg", "copo-na-balanca.jpg"]
  : ZH
    ? ["IMG_2041.jpg", "IMG_2042.jpg", "IMG_2043.jpg"]
    : [];

/** `as`: the file name the portal shows (the bytes come from `name`). */
const photo = (name, as = name) => ({
  name: as,
  mimeType: "image/jpeg",
  buffer: readFileSync(join(HERE, "photos", name)),
});
const PHOTO = {
  unpacked: photo("glass-cup-unpacked.jpg", NAMES[0]),
  packed: photo("glass-cup-packed.jpg", NAMES[1]),
  scale: photo("glass-cup-on-scale.jpg", NAMES[2]),
};
const pdf = (name) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n%fake\n"),
});

/* ---------------------------------------------------------------- state */
const STATE = join(HERE, "state.json");
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const remember = (patch) => {
  Object.assign(state, patch);
  writeFileSync(STATE, JSON.stringify(state, null, 2));
};
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ----------------------------------------------- booking sheet (.xlsx) */
/* Same file the E2E builds (tests/unit/xlsx-fixture.ts): stored ZIP. */
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function colName(i) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function sheetXml(cells) {
  const rows = cells
    .map((row, ri) => {
      const cs = row
        .map((v, ci) => {
          if (v === "") return "";
          const ref = `${colName(ci)}${ri + 1}`;
          return /^-?\d+(\.\d+)?$/.test(v)
            ? `<c r="${ref}"><v>${v}</v></c>`
            : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
        })
        .join("");
      return cs ? `<row r="${ri + 1}">${cs}</row>` : "";
    })
    .join("");
  return `<?xml version="1.0"?><worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData>${rows}</sheetData></worksheet>`;
}
function zip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(content);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    chunks.push(local, data);
    central.push(cd);
    offset += local.length + data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  return Buffer.concat([...chunks, ...central, end]);
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
function bookingSheet(supplier, code, description) {
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
    buffer: zip([
      [
        "xl/workbook.xml",
        `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="BOOKING" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ],
      [
        "xl/_rels/workbook.xml.rels",
        `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
      ],
      ["xl/worksheets/sheet1.xml", sheetXml([BOOKING_HEADER, row])],
    ]),
  };
}

/* -------------------------------------------------------------- helpers */
async function login(page, email) {
  // Keep the language cookie (the phone session reads the portal in LANGUAGE).
  const keep = (await page.context().cookies(BASE)).filter(
    (c) => c.name === "wm_locale",
  );
  await page.context().clearCookies();
  if (keep.length) await page.context().addCookies(keep);
  await page.goto(`${BASE}/login?intro=off`);
  await page.getByLabel(/e-mail|email|邮箱/i).fill(email);
  await page.getByLabel(/senha|password|密码/i).fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
  log("login", email);
}
const go = (page, path) =>
  page.goto(path.startsWith("http") ? path : BASE + path);
const idle = (page) => page.waitForLoadState("networkidle");
const visible = (locator) => locator.first().waitFor({ state: "visible" });
async function until(what, check, ms = TIMEOUT) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await check();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout waiting for: ${what}`);
}
const noError = (page, what) => {
  if (page.url().includes("error="))
    throw new Error(`${what}: the portal refused (${page.url()})`);
};

/** Row of a stage item by its label (the order page). */
const requirementRow = (page, label) =>
  page.locator("li").filter({
    has: page.locator("span.font-medium", { hasText: label }),
  });

/** Uploads the sheet and closes the book (tests/e2e/helpers.ts, importAndClose). */
async function importAndClose(page, file) {
  await go(page, "/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles(file);
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  // NCM is required before closing the book.
  const ncm = page.locator("input[data-booking-item-ncm]");
  for (let i = 0; i < (await ncm.count()); i++) {
    const input = ncm.nth(i);
    if (await input.inputValue()) continue;
    await input.fill("7013.37.00");
    await input.press("Enter");
    await page
      .locator('[data-booking-row-note="saved"]')
      .nth(i)
      .waitFor({ state: "visible" });
  }
  await page.click("[data-booking-lot-close-submit]");
  await page.waitForURL(/[?&]closed=1/);
  log("book closed", file.name);
}

/** Fills, one at a time, the pending items this login can fill on the order page. */
async function fillMyRequirements(page, orderUrl, values = {}, limit = 12) {
  for (let guard = 0; guard < limit; guard++) {
    await go(page, orderUrl);
    await idle(page);
    const forms = page.locator(
      "form:has(input[name=requirementId]):not([data-requirement-clear])",
    );
    if ((await forms.count()) === 0) return;
    const form = forms.first();
    const file = form.locator("input[type=file]");
    const number = form.locator("input[type=number]");
    const amount = form.locator("[data-money=amount]");
    const date = form.locator("input[type=date]");
    const text = form.locator("textarea[name=value]");
    const row = form.locator("xpath=ancestor::li[1]");
    const label =
      (await row.locator("span.font-medium").first().textContent()) ?? "";
    if (await file.count()) {
      const image = (await file.getAttribute("accept"))?.includes("image");
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST"),
        file.setInputFiles(
          image ? PHOTO.unpacked : pdf(values.fileName ?? "document.pdf"),
        ),
      ]);
      await idle(page);
      noError(page, label);
      log("  sent file:", label.trim());
      continue;
    } else if (await amount.count()) {
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
    await idle(page);
    noError(page, label);
    log("  sent:", label.trim());
  }
}

/** Approvals at the end of the milestones (tests/e2e/helpers.ts). */
async function approveMilestoneRows(page, orderUrl, labels) {
  for (const label of labels) {
    await go(page, orderUrl);
    const row = requirementRow(page, label).first();
    await row.waitFor({ state: "visible" });
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      row.locator("form button[type=submit]").first().click(),
    ]);
    await idle(page);
    noError(page, String(label));
    log("  approved:", String(label));
  }
}

async function sendStep(page, orderUrl, anchor, key, input) {
  await go(page, `${orderUrl}#${anchor}`);
  await idle(page);
  const row = page.locator(`#${anchor}-step-${key}`);
  if (input.value !== undefined)
    await row.locator("input[name=value]").fill(input.value);
  if (input.file)
    await row.locator("input[type=file]").setInputFiles(pdf(input.file));
  await Promise.all([
    page.waitForURL(/(importStep|certStep)=submitted/),
    row.locator(`[data-import-submit="${key}"]`).click(),
  ]);
}
async function validateStep(page, orderUrl, anchor, key) {
  await go(page, `${orderUrl}#${anchor}`);
  await idle(page);
  await Promise.all([
    page.waitForURL(/(importStep|certStep)=validated/),
    page
      .locator(`#${anchor}-step-${key} [data-import-validate="${key}"]`)
      .click(),
  ]);
}

/** Signed contract: choosing the file records the signature. */
async function uploadSignedContract(page, orderUrl, name) {
  await go(page, `${orderUrl}/purchase-order`);
  await visible(page.locator("[data-order-sign-turn]"));
  await page
    .locator("[data-order-sign-file] input[type=file]")
    .setInputFiles(pdf(name));
  await page.waitForURL(/signed=1/);
}

/** Product screen: the sections come folded. */
async function gotoProduct(page, id) {
  await go(page, `/app/products/${id}`);
  const folds = page.locator("details[data-fold-section]");
  await folds.first().waitFor({ state: "attached" });
  await idle(page);
  await folds.evaluateAll((els) => els.forEach((el) => (el.open = true)));
}

/* --------------------------------------------------------------- stages */
const stages = {
  /* 1. Two books by spreadsheet (two suppliers, the same kind of item). */
  async books(page) {
    await login(page, ADMIN);
    await go(page, "/app/settings/summaries");
    await page.locator("[data-summaries-rebuild]").click();
    await page.waitForURL(/\/app\/settings\/summaries\?ran=1/);
    await importAndClose(
      page,
      bookingSheet("Shenzhen Supplier A", CODE_A, "Glass cup 350 ml"),
    );
    await importAndClose(
      page,
      bookingSheet(
        "Guangzhou Supplier B",
        CODE_B,
        "Glass cup 350 ml with handle",
      ),
    );
  },

  /* 2. Item selection: A is chosen, B the alternative; opens the request. */
  async request(page) {
    await login(page, ADMIN);
    await go(page, `/app/booking/selection?q=${encodeURIComponent(SEARCH)}`);
    const items = page.locator("[data-selection-item]");
    await until(
      "the two items in the selection",
      async () => (await items.count()) === 2,
    );
    await page.locator("input[data-basket-all]").check();
    await page.click("[data-selection-group]");
    await page.waitForURL(/tab=selection&ids=/);
    await until(
      "the two items in the group",
      async () => (await items.count()) === 2,
    );
    const row = page.locator("[data-selection-item]", { hasText: CODE_A });
    if (!(await row.isVisible()))
      await page
        .locator(
          "[data-selection-winner-bar] label:has(input[data-selection-review])",
        )
        .click();
    await row.locator("[data-selection-choose-button]").click();
    await until("the chosen item", () =>
      row.locator("input[data-selection-choose]").isChecked(),
    );
    await page.fill("[data-selection-needs]", "Color box with the brand");
    await page.click("[data-selection-submit]");
    await page.waitForURL(/[?&]saved=1/);
    await visible(page.locator("[data-selection-resolved=saved]"));
    await page.click("[data-selection-open-all]");
    await page.waitForURL(/\/app\/supplier-requests\/[^/?]+\?.*created=1/);
    const requestUrl = page.url().split("?")[0];
    remember({ requestUrl, requestId: requestUrl.split("/").pop() });
    log("supplier request", requestUrl);
  },

  /* 3-4. Supplier answers, Wellmix approves, sampling, product created. */
  async product(page) {
    const { requestUrl } = state;
    const itemUrl = `${requestUrl}?view=item`;
    await login(page, SUPPLIER);
    await go(page, requestUrl);
    await page.locator("[data-supplier-table-answer-open]").click();
    await page.fill("[data-supplier-table-answer-price-input]", "1,40");
    await page.fill("[data-supplier-table-answer-moq]", "2000");
    await page.selectOption("[data-supplier-table-answer-incoterm]", "FOB");
    await page.click("[data-supplier-table-answer=yes]");
    await page.waitForURL(/[?&]answered=1/);
    await login(page, ADMIN);
    await go(page, itemUrl);
    await page.click("[data-supplier-decide=approved]");
    await page.waitForURL(/[?&]decided=approved/);
    // Sampling: the supplier sends the photo of the piece, Wellmix approves.
    await login(page, SUPPLIER);
    await go(page, itemUrl);
    await page.setInputFiles(
      "[data-sampling-upload] input[type=file]",
      photo("glass-cup-unpacked.jpg"),
    );
    await page.waitForURL(/[?&]sampling=file/);
    await page.click("[data-sampling-submit]");
    await page.waitForURL(/[?&]sampling=submitted/);
    await login(page, ADMIN);
    await go(page, itemUrl);
    await page.click("[data-sampling-review=approve]");
    await page.waitForURL(/[?&]sampling=approved/);
    await page.fill("[data-request-product-name]", PRODUCT);
    // Same line as the E2E (it needs the certificate and the final art).
    await page.selectOption("[data-request-product-line]", "linha-brinquedos");
    await page.click("[data-request-product-create]");
    await page.waitForURL(/[?&]product=created/);
    log("product created");
  },

  /* 5. Purchase order from the approved request. */
  async order(page) {
    const { requestId } = state;
    await login(page, ADMIN);
    await go(page, "/app/supplier-requests");
    await visible(page.locator("[data-purchase-customer]"));
    const group = page.locator(
      `form:has([data-purchase-candidate="${requestId}"])`,
    );
    await visible(group);
    const others = group.locator(
      `[data-purchase-candidate]:not([data-purchase-candidate="${requestId}"]) input[type=checkbox]`,
    );
    for (let i = 0; i < (await others.count()); i++)
      await others.nth(i).uncheck();
    await group.locator("[data-purchase-submit]").click();
    await page.waitForURL(/\/app\/orders\/[^/?]+\?purchase=created/);
    const orderUrl = page.url().split("?")[0];
    const orderNumber = (
      await page
        .getByText(/(Pedido|Order|订单)\s*#\d+/)
        .first()
        .textContent()
    )?.match(/#(\d+)/)?.[1];
    remember({
      orderUrl,
      orderId: new URL(orderUrl).pathname.split("/").pop(),
      orderNumber,
    });
    log("order", orderUrl, "#" + orderNumber);
  },

  /* 5b. Registry and tax: NCM validated and the master sheet complete. */
  async registry(page) {
    const { orderUrl } = state;
    await login(page, ADMIN);
    await go(page, orderUrl);
    const gate = page.locator("[data-requirement-gate=ncm_validated]").first();
    await gate.waitFor({ state: "attached" });
    const taxUrl = await gate.getAttribute("href");
    const productId = taxUrl.split("/")[3];
    remember({ productId });
    await go(page, taxUrl);
    const taxAdd = page.locator("form[data-tax-add]");
    await taxAdd.locator("input[name=ncm]").fill("7013.37.00");
    await Promise.all([
      idle(page),
      taxAdd.locator("button[type=submit]").click(),
    ]);
    await idle(page);
    await go(page, taxUrl);
    await Promise.all([
      idle(page),
      page
        .locator("form[data-tax-validate] button[type=submit]")
        .first()
        .click(),
    ]);
    await idle(page);
    for (const [kind, file] of [
      ["weight_scale", PHOTO.scale],
      ["dimension_scale", PHOTO.scale],
      ["dimension_side", PHOTO.unpacked],
      ["angle", PHOTO.unpacked],
      ["original", PHOTO.packed],
    ]) {
      await gotoProduct(page, productId);
      await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === "POST" && r.status() < 400,
        ),
        page
          .locator(`[data-sheet-photo="${kind}"] input[type=file]`)
          .first()
          .setInputFiles(file),
      ]);
      await idle(page);
      log("  sheet photo", kind);
    }
    await gotoProduct(page, productId);
    await page
      .locator("#product-form details[data-fold-card]")
      .evaluateAll((els) => els.forEach((el) => (el.open = true)));
    await page.locator("#product-form input[name=color]").fill("Clear");
    await Promise.all([
      page.waitForURL(/[?&]saved=1/),
      page.locator("#product-form button[type=submit]").last().click(),
    ]);
    log("registry done");
  },

  /* 6. The lanes: die cut, art, certificate, final art, approvals. */
  async lanes(page) {
    const { orderUrl, orderId } = state;
    // 6a. Supplier: die cut, HD photo, minimum order and lead time.
    await login(page, SUPPLIER);
    await go(page, `${orderUrl}/die-cut`);
    const board = page.locator("[data-die-cut-product]");
    await visible(board);
    for (const [item, file] of [
      ["dieline", pdf("die-cut.pdf")],
      ["hd", PHOTO.unpacked],
    ]) {
      if (
        (await board
          .locator(`[data-die-cut-item="${item}"]`)
          .getAttribute("data-done")) === "yes"
      )
        continue;
      await board
        .locator(`[data-die-cut-item="${item}"] input[type=file]`)
        .last()
        .setInputFiles(file);
      await page.waitForURL(new RegExp(`saved=${item}`));
    }
    const terms = board.locator(
      '[data-die-cut-item="terms"] [data-die-cut-terms]',
    );
    if (await terms.count()) {
      await terms.locator("input[name=leadTimeDays]").fill("45");
      await terms.getByRole("button").click();
      await page.waitForURL(/saved=terms/);
    }
    await fillMyRequirements(page, orderUrl);
    // The buyer approves the art material; the agency sends the art.
    await login(page, ADMIN);
    await approveMilestoneRows(page, orderUrl, [
      /Material de arte aprovado pelo Comprador/,
    ]);
    await login(page, AGENCY);
    await fillMyRequirements(page, orderUrl, { fileName: "artwork.pdf" }, 1);
    // Wellmix validates the art.
    await login(page, ADMIN);
    await go(page, orderUrl);
    const review = requirementRow(
      page,
      /Validação da arte pela Wellmix/,
    ).first();
    await review.waitFor({ state: "visible" });
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      review.locator("button[value=approve]").click(),
    ]);
    await idle(page);
    noError(page, "art validation");
    // 6d. The certifier (OCP): certificate, memorial and seal.
    await login(page, OCP);
    await go(page, "/app/flow/order/certification");
    const certRow = page.locator(
      `[data-flow-case][data-flow-case-order="${orderId}"][data-flow-case-item]`,
    );
    await visible(certRow);
    const certItem = await certRow.first().getAttribute("data-flow-case-item");
    await Promise.all([
      page.waitForURL(
        new RegExp(
          `/app/flow/order/certification/${orderId}\\?item=${certItem}$`,
        ),
      ),
      certRow.first().locator("[data-flow-case-open]").click(),
    ]);
    const certReq = page.locator(
      `[data-flow-order-requirement="certificate__${certItem}"]`,
    );
    await Promise.all([
      page.waitForURL(/[?&]saved=1/),
      certReq
        .locator("[data-requirement-upload] form")
        .last()
        .locator("input[type=file]")
        .setInputFiles(pdf("certificate.pdf")),
    ]);
    await fillMyRequirements(page, orderUrl, { fileName: "certificate.pdf" });
    for (const key of ["cert_memorial", "cert_seal"]) {
      await go(page, `${orderUrl}#certification`);
      await idle(page);
      const box = page.locator(`[data-import-featured="${key}"]`);
      if (key === "cert_seal")
        await box.locator("input[name=value]").fill("OCP 0045/2026");
      await box
        .locator("input[type=file]")
        .setInputFiles(pdf(key === "cert_seal" ? "seal.pdf" : "memorial.pdf"));
      await Promise.all([
        page.waitForURL(/certStep=submitted/),
        box.locator(`[data-import-submit="${key}"]`).click(),
      ]);
      log("  certifier sent", key);
    }
    // 6e. Agency: final art with the seal; Wellmix checks it.
    await login(page, AGENCY);
    await fillMyRequirements(page, orderUrl, { fileName: "final-artwork.pdf" });
    await sendStep(page, orderUrl, "certification", "cert_seal_art", {
      file: "artwork-with-seal.pdf",
    });
    await login(page, ADMIN);
    await validateStep(page, orderUrl, "certification", "cert_seal_art");
    // 6f. Approvals at the end of the milestones.
    await approveMilestoneRows(page, orderUrl, [
      /Cadastro e fiscal aprovados pelo GP/,
      /Certificação aprovada pelo GP/,
    ]);
    log("lanes done");
  },

  /* 7. Contract: sample order and the document signed by both. */
  async contract(page) {
    const { orderUrl } = state;
    await login(page, ADMIN);
    await go(page, `${orderUrl}/samples`);
    await Promise.all([
      page.waitForURL(/[?&]decided=ordered/),
      page
        .locator("form[data-sample-order-create] button[type=submit]")
        .click(),
    ]);
    await uploadSignedContract(page, orderUrl, "purchase-order-signed.pdf");
    await login(page, SUPPLIER);
    await uploadSignedContract(page, orderUrl, "purchase-order-signed.pdf");
    await go(page, `${orderUrl}/samples`);
    const accept = page.locator("form[data-sample-order-accept]");
    await accept.locator("input[name=name]").fill("Li Wei");
    await accept.locator("input[name=agree]").check();
    await Promise.all([
      page.waitForURL(/[?&]accepted=1/),
      accept.locator("button[type=submit]").click(),
    ]);
    log("contract signed by both");
  },

  /* 8. Deposit paid and received; pre-production approved. */
  async payment(page) {
    const { orderUrl, orderNumber } = state;
    await login(page, ADMIN);
    await go(page, orderUrl);
    await Promise.all([
      page.waitForURL(/paid=transfer_copied/),
      page.getByRole("button", { name: /Copiar dados para o banco/ }).click(),
    ]);
    await login(page, SUPPLIER);
    await go(page, "/app/account");
    await page
      .locator("tr", {
        has: page.locator("td", { hasText: new RegExp(`^#${orderNumber}$`) }),
      })
      .getByRole("button", {
        name: /确认收款|Confirm receipt|Confirmar recebimento/,
      })
      .click();
    await idle(page);
    await login(page, ADMIN);
    await approveMilestoneRows(page, orderUrl, [
      /Sinal aprovado pela Diretoria de compras/,
    ]);
    await approveMilestoneRows(page, orderUrl, [
      /Pré-produção \(dados e ETD\) aprovada pelo Planner/,
    ]);
    // The inspection is now the supplier's: the photo item takes a file.
    await login(page, SUPPLIER);
    await go(page, `/app/flow/production/inspection/${state.orderId}`);
    await visible(
      page.locator(
        '[data-flow-order-requirement="photo_unpacked"] input[type=file]',
      ),
    );
    log("inspection pending for the supplier");
  },

  /* 9. Copy of the database right before the inspection is sent. */
  async snapshot() {
    const copy = `${DATA}-before`;
    rmSync(copy, { recursive: true, force: true });
    cpSync(DATA, copy, { recursive: true });
    log("snapshot", copy);
  },
};

/* ------------------------------------------------- phone screenshots */
/* Hides what gives away "demo" (docs/videos/GUIA.md, 7.3). */
const CLEAN = `
  header label:has(> select) { display: none !important; }
  div.bg-amber-100.text-amber-900 { display: none !important; }
  form + div.border-dashed { display: none !important; }
  nextjs-portal { display: none !important; }
  * { caret-color: transparent !important; }
`;
async function clean(page) {
  await page.evaluate((css) => {
    if (!document.getElementById("video-clean")) {
      const style = document.createElement("style");
      style.id = "video-clean";
      style.textContent = css;
      document.head.appendChild(style);
    }
    // The video never shows the ERP vendor name.
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      if (/sankhya/i.test(n.nodeValue))
        n.nodeValue = n.nodeValue.replace(/sankhya/gi, "ERP");
  }, CLEAN);
}
const box = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height].map((v) => Math.round(v)).join(",");
  });
async function shot(page, name) {
  await clean(page);
  await page.waitForTimeout(250);
  const path = join(SHOTS, name);
  await page.screenshot({ path });
  const left = await page.evaluate(() =>
    /sankhya/i.test(document.body.innerText),
  );
  log("screenshot", path, left ? "(Sankhya still visible!)" : "");
}

/** Scrolls until the top of `locator` sits `y` px below the top of the screen. */
async function frame(page, locator, y) {
  await locator.first().evaluate((el, y) => {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - y);
  }, y);
  await page.waitForTimeout(300);
}

async function phone(browser) {
  const { orderId } = state;
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: LOCALE.browser,
  });
  ctx.setDefaultTimeout(TIMEOUT);
  ctx.setDefaultNavigationTimeout(TIMEOUT);
  await ctx.addCookies([
    { name: "wm_locale", value: LOCALE.cookie, url: BASE },
  ]);
  const page = await ctx.newPage();
  await login(page, SUPPLIER);
  const url = `/app/flow/production/inspection/${orderId}`;
  const item = (key) => `[data-flow-order-requirement="${key}"]`;
  const taps = {};
  // Framing: the order card right under the portal header; once something was
  // sent, the "Saved." notice takes that place and pushes the card down.
  const card = page.getByText(TEXT.card).first();
  const saved = page.getByText(TEXT.saved, { exact: true }).first();
  const TOP = 66;
  const sendPhoto = async (key, file) => {
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      page.locator(`${item(key)} input[type=file]`).setInputFiles(file),
    ]);
    await page
      .locator(`${item(key)}[data-status="done"]`)
      .waitFor({ state: "visible" });
    await idle(page);
    noError(page, key);
    log("  photo sent:", key);
  };

  // 0. The step on the Wellmix side before anything is sent (all pending).
  await desktop(browser, url, "insp-desk-0.png");

  // 1. As the person finds it: nothing sent, the photo button in view.
  await go(page, url);
  await idle(page);
  await clean(page);
  await frame(page, card, TOP + 18);
  taps["m-insp-1.png"] = await box(
    page.locator(`${item("photo_unpacked")} [data-photo-button]`),
  );
  await shot(page, "m-insp-1.png");

  // 2. First photo chosen: it is sent at once and the portal answers "Saved.".
  await sendPhoto("photo_unpacked", PHOTO.unpacked);
  await clean(page);
  await frame(page, saved, TOP);
  taps["m-insp-2.png"] = await box(
    page.locator(`${item("photo_packed")} [data-photo-button]`),
  );
  await shot(page, "m-insp-2.png");

  // 3. The other two photos and the measured weight typed, before Send.
  await sendPhoto("photo_packed", PHOTO.packed);
  await sendPhoto("photo_scale", PHOTO.scale);
  const weight = page.locator('[data-requirement-form="weight_measured"]');
  const weightInput = weight.locator("input[name=value]");
  if (PT) {
    // type="number": fill() refuses "0,30"; type it key by key, as a person
    // does (the pt-BR browser turns the comma into the decimal point).
    await weightInput.click();
    await weightInput.pressSequentially(WEIGHT, { delay: 60 });
    const typed = await weightInput.inputValue();
    if (Number(typed) !== 0.3)
      throw new Error(
        `weight field did not take "${WEIGHT}" (value "${typed}")`,
      );
  } else {
    await weightInput.fill(WEIGHT);
  }
  await page.evaluate(() => document.activeElement?.blur());
  await clean(page);
  await frame(page, saved, TOP);
  taps["m-insp-3.png"] = await box(weight.locator("button[type=submit]"));
  await shot(page, "m-insp-3.png");

  // 4. Send: the weight turns Done.
  await Promise.all([
    page.waitForURL(/[?&]saved=1/),
    weight.locator("button[type=submit]").tap(),
  ]);
  await page
    .locator(`${item("weight_measured")}[data-status="done"]`)
    .waitFor({ state: "visible" });
  await idle(page);
  await clean(page);
  await frame(page, saved, TOP);
  await shot(page, "m-insp-4.png");

  // The English taps stay in "taps"; the Portuguese ones go to "br" and the
  // Chinese ones to "cn".
  remember(PT ? { br: taps } : ZH ? { cn: taps } : { taps });
  log("taps", PT ? "br" : ZH ? "cn" : "en", JSON.stringify(taps));
  await ctx.close();

  // 5. The same step as Wellmix sees it (computer), now with what was sent.
  await desktop(browser, url, "insp-desk.png");
}

/** The inspection step on a computer, with the Wellmix admin login. */
async function desktop(browser, url, name) {
  const desk = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    locale: LOCALE.browser,
  });
  desk.setDefaultTimeout(TIMEOUT);
  desk.setDefaultNavigationTimeout(TIMEOUT);
  await desk.addCookies([
    { name: "wm_locale", value: LOCALE.cookie, url: BASE },
  ]);
  const dpage = await desk.newPage();
  await login(dpage, ADMIN);
  await go(dpage, url);
  await idle(dpage);
  await clean(dpage);
  await frame(dpage, dpage.getByText(TEXT.card).first(), 90);
  await shot(dpage, name);
  await desk.close();
}

/* ----------------------------------------------------------------- run */
const args = process.argv.slice(2);
const arg = (name) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : null;
const ORDER = [...Object.keys(stages), "phone"];
const only = arg("--only");
const from = arg("--from");
const todo = only
  ? only.split(",")
  : ORDER.slice(from ? ORDER.indexOf(from) : 0);

// The LANGUAGE variable is also what Chromium on Linux reads for its locale:
// with "pt" the number field takes the decimal comma (--lang alone does not).
const browser = await chromium.launch({
  args: [`--lang=${LOCALE.browser}`, "--force-color-profile=srgb"],
  env: PT
    ? { ...process.env, LANGUAGE: "pt" }
    : ZH
      ? { ...process.env, LANGUAGE: "zh_CN" }
      : process.env,
});
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: LOCALE.browser,
  });
  ctx.setDefaultTimeout(TIMEOUT);
  ctx.setDefaultNavigationTimeout(TIMEOUT);
  const page = await ctx.newPage();
  for (const name of todo) {
    log("== stage", name);
    try {
      if (name === "phone") await phone(browser);
      else await stages[name](page);
    } catch (error) {
      await page
        .screenshot({ path: join(HERE, `failed-${name}.png`), fullPage: true })
        .catch(() => {});
      console.error(`FAILED at stage "${name}" (${page.url()})`);
      throw error;
    }
  }
  await ctx.close();
} finally {
  await browser.close();
}
