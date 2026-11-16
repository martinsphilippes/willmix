/*
 * Conversa de demonstração da tela Mensagens, para os vídeos institucionais:
 * a Wellmix (Ana Admin) e o fornecedor (Li Wei) trocam cinco mensagens no
 * assunto do pedido #2, a segunda com a foto da amostra. Tudo é enviado pela
 * tela do portal, com os logins de demonstração (nada é gravado direto na base).
 *   node seed-chat.mjs            cria a conversa
 *   node seed-chat.mjs --foto     só desenha a foto e mostra onde ficou
 * PORTAL escolhe o servidor (padrão: porta 3201, a base em inglês de
 * data-en.mjs). LANGUAGE escolhe o idioma do portal e das mensagens: "en"
 * (padrão) ou "pt" (a base em português de data-pt.mjs, por exemplo
 * PORTAL=http://localhost:3203 LANGUAGE=pt). PAUSA: segundos entre as
 * mensagens (padrão 65, para cada uma sair com um minuto diferente; 0 = sem
 * espera). FOTO: um JPEG pronto no lugar da foto desenhada aqui. Rodar de novo
 * não muda nada: com a primeira mensagem já na conversa, o script para.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launch } from "./lib.mjs";

const BASE = process.env.PORTAL ?? "http://localhost:3201";
const PAUSA = Number(process.env.PAUSA ?? 65) * 1000;
// Idioma do portal e das mensagens (en é o padrão; os rótulos foram conferidos
// nas telas reais: login, botões de conversa do pedido, Configurações).
const IDIOMA = process.env.LANGUAGE === "pt" ? "pt" : "en";
const T = {
  en: {
    cookie: "en",
    locale: "en-US",
    email: "Email",
    senha: "Password",
    entrar: "Sign in",
    fornecedor: /^Supplier$/,
  },
  pt: {
    cookie: "pt",
    locale: "pt-BR",
    email: /e-mail/i,
    senha: /senha/i,
    entrar: "Entrar",
    fornecedor: /^Fornecedor$/,
  },
}[IDIOMA];
const SENHA = "wellmix123";
const WELLMIX = "admin@wellmix.com";
const FORNECEDOR = "supplier.a@china.com";
const PEDIDO = 2;
/* Outros logins da Wellmix que aparecem nas capturas: abrem o assunto no fim,
   para o selo de mensagens não lidas do cabeçalho deles não subir. */
const OUTROS = [
  "operador@wellmix.com",
  "vendas@wellmix.com",
  "diretoria@wellmix.com",
];

/* [quem escreve, texto, com a foto?] */
const CONVERSAS = {
  en: [
    [
      WELLMIX,
      "Hello, Li Wei. Could you send the photos of the mass-production sample for this order?",
    ],
    [
      FORNECEDOR,
      "Hello! Photos attached. Production finishes on the 28th.",
      true,
    ],
    [WELLMIX, "Received, thank you. Color and logo position approved."],
    [FORNECEDOR, "Great. We will book the inspection for next week."],
    [
      WELLMIX,
      "Perfect. The inspection date goes on the order as soon as you confirm it.",
    ],
  ],
  pt: [
    [
      WELLMIX,
      "Olá, Li Wei. Pode nos enviar as fotos da amostra de produção deste pedido?",
    ],
    [
      FORNECEDOR,
      "Olá! Fotos em anexo. A produção termina no dia 28.",
      true,
    ],
    [WELLMIX, "Recebido, agradeço! Cor e posição do logotipo aprovadas."],
    [FORNECEDOR, "Ótimo. Vamos agendar a inspeção para a próxima semana."],
    [
      WELLMIX,
      "Perfeito. A data da inspeção entra no pedido assim que você confirmar.",
    ],
  ],
};
const CONVERSA = CONVERSAS[IDIOMA];

/* Foto fictícia da amostra: copo alto de vidro azulado, com um logotipo de
   exemplo, em fundo cinza-claro de estúdio (1600 × 1200). */
function fotoSvg() {
  const cx = 800;
  const [yt, yb] = [150, 1035]; // boca e fundo do copo
  const [rt, rb] = [178, 151]; // raio em cima e embaixo
  const k = 0.17; // achatamento das elipses (perspectiva)
  const r = (y) => rt + ((rb - rt) * (y - yt)) / (yb - yt);
  const corpo =
    `M${cx - rt} ${yt} L${cx - rb} ${yb} A${rb} ${rb * k} 0 0 0 ${cx + rb} ${yb}` +
    ` L${cx + rt} ${yt} A${rt} ${rt * k} 0 0 0 ${cx - rt} ${yt}Z`;
  // Faixa de luz ao longo do copo; u vai de -1 (borda esquerda) a 1 (direita).
  const brilho = (u, largura, opacidade, desfoque) =>
    `<line x1="${cx + u * r(yt + 50)}" y1="${yt + 50}" x2="${cx + u * r(yb - 120)}" y2="${yb - 120}"
      stroke="url(#luz)" stroke-width="${largura}" stroke-linecap="round" opacity="${opacidade}" filter="url(#d${desfoque})"/>`;
  const desfoque = (n) =>
    `<filter id="d${n}" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1200"><feGaussianBlur stdDeviation="${n}"/></filter>`;
  const yi = yb - 58; // fundo grosso: onde começa por dentro
  const ri = r(yi) * 0.93;
  const ly = yt + (yb - yt) * 0.4; // altura do logotipo
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <defs>
    <linearGradient id="fundo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f2f3f6"/><stop offset=".66" stop-color="#e6e8eb"/>
      <stop offset=".74" stop-color="#e9ebee"/><stop offset="1" stop-color="#dcdee2"/>
    </linearGradient>
    <radialGradient id="claro" cx="800" cy="560" r="700" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cantos" cx=".5" cy=".5" r=".75">
      <stop offset=".5" stop-color="#1c2430" stop-opacity="0"/><stop offset="1" stop-color="#1c2430" stop-opacity=".09"/>
    </radialGradient>
    <linearGradient id="vidro" x1="${cx - rt}" y1="0" x2="${cx + rt}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#28697a" stop-opacity=".66"/><stop offset=".1" stop-color="#3a96ac" stop-opacity=".46"/>
      <stop offset=".3" stop-color="#3a96ac" stop-opacity=".24"/><stop offset=".5" stop-color="#3a96ac" stop-opacity=".18"/>
      <stop offset=".7" stop-color="#3a96ac" stop-opacity=".24"/><stop offset=".9" stop-color="#3a96ac" stop-opacity=".46"/>
      <stop offset="1" stop-color="#28697a" stop-opacity=".66"/>
    </linearGradient>
    <linearGradient id="embaixo" x1="0" y1="${yt}" x2="0" y2="${yb}" gradientUnits="userSpaceOnUse">
      <stop offset=".3" stop-color="#3a96ac" stop-opacity="0"/><stop offset="1" stop-color="#3a96ac" stop-opacity=".14"/>
    </linearGradient>
    <linearGradient id="luz" x1="0" y1="${yt + 40}" x2="0" y2="${yb - 110}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".12" stop-color="#fff"/>
      <stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    ${[1, 3, 5, 9, 12, 20, 34].map(desfoque).join("")}
    <clipPath id="copo"><path d="${corpo}"/></clipPath>
  </defs>
  <rect width="1600" height="1200" fill="url(#fundo)"/>
  <rect width="1600" height="1200" fill="url(#claro)"/>
  <rect width="1600" height="1200" fill="url(#cantos)"/>
  <ellipse cx="${cx + 40}" cy="${yb + 20}" rx="290" ry="42" fill="#28303a" opacity=".3" filter="url(#d34)"/>
  <ellipse cx="${cx + 2}" cy="${yb + 9}" rx="${rb * 1.04}" ry="${rb * k * 0.9}" fill="#1e2832" opacity=".5" filter="url(#d9)"/>
  <path d="${corpo}" fill="url(#vidro)"/>
  <path d="${corpo}" fill="url(#embaixo)"/>
  <g clip-path="url(#copo)">
    <path d="M${cx - r(yi)} ${yi} L${cx - rb} ${yb + 40} L${cx + rb} ${yb + 40} L${cx + r(yi)} ${yi}Z" fill="#28788e" opacity=".3"/>
    <ellipse cx="${cx}" cy="${yi}" rx="${ri}" ry="${ri * k}" fill="#d6f0f6" fill-opacity=".5" stroke="#fff" stroke-opacity=".85" stroke-width="3" filter="url(#d1)"/>
    <path d="M${cx - rb * 0.9} ${yb + rb * k * 0.42} A${rb * 0.97} ${rb * k * 0.97} 0 0 0 ${cx + rb * 0.9} ${yb + rb * k * 0.42}" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="3" filter="url(#d1)"/>
    ${brilho(-0.76, 20, 0.8, 5)}
    ${brilho(-0.42, 90, 0.16, 20)}
    ${brilho(0.83, 11, 0.6, 3)}
    ${brilho(0.6, 34, 0.13, 12)}
  </g>
  <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".95">
    <circle cx="${cx}" cy="${ly}" r="54"/>
    <polyline points="${cx - 26},${ly - 14} ${cx - 13},${ly + 16} ${cx},${ly - 8} ${cx + 13},${ly + 16} ${cx + 26},${ly - 14}"/>
  </g>
  <rect x="${cx - 56}" y="${ly + 72}" width="112" height="10" rx="5" fill="#fff" opacity=".92"/>
  <rect x="${cx - 34}" y="${ly + 94}" width="68" height="6" rx="3" fill="#fff" opacity=".78"/>
  <ellipse cx="${cx}" cy="${yt}" rx="${rt}" ry="${rt * k}" fill="#cdecf3" fill-opacity=".28" stroke="#246e84" stroke-opacity=".6" stroke-width="5"/>
  <ellipse cx="${cx}" cy="${yt}" rx="${rt - 3}" ry="${rt * k - 2}" fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="3"/>
  <path d="M${cx - rt} ${yt} L${cx - rb} ${yb} A${rb} ${rb * k} 0 0 0 ${cx + rb} ${yb} L${cx + rt} ${yt}" fill="none" stroke="#1e647a" stroke-opacity=".5" stroke-width="3" filter="url(#d1)"/>
</svg>`;
}

/** Desenha a foto no navegador e grava em JPEG numa pasta temporária. */
async function desenharFoto(browser) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<body style="margin:0">${fotoSvg()}</body>`);
  const arquivo = join(
    mkdtempSync(join(tmpdir(), "seed-chat-")),
    "sample-long-drink-glass.jpg",
  );
  await page
    .locator("svg")
    .screenshot({ path: arquivo, type: "jpeg", quality: 90 });
  await page.close();
  return arquivo;
}

/** Entra no portal com o login, no idioma escolhido, e devolve a aba. */
async function entrar(browser, email) {
  const ctx = await browser.newContext({ locale: T.locale });
  ctx.setDefaultTimeout(60_000);
  ctx.setDefaultNavigationTimeout(60_000);
  await ctx.addCookies([{ name: "wm_locale", value: T.cookie, url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login?intro=off`);
  await page.getByLabel(T.email).fill(email);
  await page.getByLabel(T.senha).fill(SENHA);
  await page.getByRole("button", { name: T.entrar }).click();
  await page.waitForURL(/\/app/);
  return page;
}

/**
 * Abre a conversa pelo pedido, como a Wellmix faz: Pedidos → #2 → botão
 * "Supplier" ("Fornecedor" em português). Devolve o endereço do assunto (o
 * mesmo para os dois lados).
 */
async function abrirAssunto(page) {
  await page.goto(`${BASE}/app/orders`);
  const pedido = await page
    .locator('a[href^="/app/orders/"]')
    .filter({ hasText: new RegExp(`^#${PEDIDO}$`) })
    .first()
    .getAttribute("href");
  await page.goto(BASE + pedido);
  await page
    .locator("[data-chat-buttons] button")
    .filter({ hasText: T.fornecedor })
    .click();
  await page.waitForURL(/\/app\/messages\?c=[^&]+&t=/);
  await page.locator("[data-thread]").waitFor();
  const url = new URL(page.url());
  return url.pathname + url.search;
}

/**
 * A base que vem do E2E fica com a IA em "Mock", e nesse modo cada mensagem
 * ganha uma tradução de exemplo ("[en · exemplo mock] …") que fica gravada
 * nela. Antes de enviar, a IA vai para "Manual" (sem tradução: cada lado lê o
 * que o outro escreveu). Voltar para "Mock" depois grava a tradução de exemplo
 * na próxima vez que a conversa for aberta.
 */
async function semTraducaoDeExemplo(page) {
  await page.goto(`${BASE}/app/settings`);
  const modo = page.locator('select[name="aiMode"]');
  if ((await modo.inputValue()) !== "MOCK") return;
  await modo.selectOption("MANUAL");
  await modo.evaluate((el) => el.form.requestSubmit());
  await page.waitForURL(/\/app\/settings\?ok=1/);
  console.log('IA: de "Mock" para "Manual" (Configurações)');
}

/** Escreve no assunto; a foto vai pelo botão "Photo or video", com o texto junto. */
async function enviar(page, assunto, texto, foto) {
  await page.goto(BASE + assunto);
  const envio = page.locator("[data-composer]");
  await envio.locator('textarea[name="body"]').fill(texto);
  if (foto)
    await envio
      .locator('[data-chat-attach="photo"] input[type="file"]')
      .setInputFiles(foto);
  else await envio.locator('button[type="submit"]').click();
  const mensagem = page
    .locator("[data-thread] li[data-message]")
    .filter({ hasText: texto });
  await mensagem.waitFor();
  if (foto) await mensagem.locator('[data-attachment="image"] img').waitFor();
}

/** Abre o assunto e espera a tela marcar as mensagens como lidas. */
async function ler(page, assunto) {
  await page.goto(BASE + assunto);
  await page.locator("[data-thread]").waitFor();
  await page.waitForFunction(
    () => !document.querySelector('[aria-current="page"] [data-unread]'),
  );
}

const browser = await launch([`--lang=${T.locale}`]);
try {
  if (process.argv.includes("--foto")) {
    console.log(await desenharFoto(browser));
  } else {
    const wellmix = await entrar(browser, WELLMIX);
    const assunto = await abrirAssunto(wellmix);
    const primeira = wellmix
      .locator("[data-thread] li[data-message]")
      .filter({ hasText: CONVERSA[0][1] });
    if (await primeira.count()) {
      console.log("a conversa já existe, nada a fazer:", assunto);
    } else {
      await semTraducaoDeExemplo(wellmix);
      const foto = process.env.FOTO ?? (await desenharFoto(browser));
      const telas = {
        [WELLMIX]: wellmix,
        [FORNECEDOR]: await entrar(browser, FORNECEDOR),
      };
      for (const [i, [quem, texto, comFoto]] of CONVERSA.entries()) {
        if (i) await new Promise((ok) => setTimeout(ok, PAUSA));
        await enviar(telas[quem], assunto, texto, comFoto ? foto : null);
        console.log(
          `${i + 1}/${CONVERSA.length}`,
          quem,
          comFoto ? "(foto)" : "",
        );
      }
      // Ninguém fica com mensagem não lida deste assunto.
      for (const page of Object.values(telas)) await ler(page, assunto);
      for (const email of OUTROS)
        try {
          await ler(await entrar(browser, email), assunto);
        } catch (e) {
          console.log("não leu:", email, e.message.split("\n")[0]);
        }
      console.log("conversa criada:", assunto);
    }
  }
} finally {
  await browser.close();
}
