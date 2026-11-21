// Peças comuns da gravação: servidor de demonstração, pontos de salvamento,
// display virtual, navegador com a camada didática e resolução de alvos.
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const TREINO = path.resolve(AQUI, "..");
export const REPO = path.resolve(TREINO, "..");
export const DEMO = path.join(TREINO, "_demo");
// Pasta de dados e porta podem mudar por variável de ambiente (TREINO_DADOS, TREINO_PORTA):
// assim um preparo de dados roda num segundo servidor sem atrapalhar a gravação.
export const DADOS = path.join(DEMO, process.env.TREINO_DADOS ?? ".data-treino");
export const PONTOS = path.join(DEMO, "snapshots");
export const PORTA = Number(process.env.TREINO_PORTA ?? 3200);
export const BASE = `http://localhost:${PORTA}`;
export const SENHA_DEMO = "wellmix123"; // contas de demonstração do modo memória (README do portal)

export const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
export const agora = () => Number(process.hrtime.bigint() / 1000n) / 1000; // ms, relógio monotônico

// ------------------------------------------------------------- servidor ----

let servidor = null;

/** Ambiente do portal de treino: modo memória, sem nenhuma integração externa. */
function ambienteServidor() {
  const env = { ...process.env };
  // Nada de produção nem de serviços externos: sem banco real, ERP, IA ou tokens.
  for (const k of Object.keys(env))
    if (/SUPABASE|APPWRITE|SANKHYA|ANTHROPIC|OPENAI|AI_GATEWAY|MERCADOLIVRE|VERCEL|CRON_SECRET/i.test(k))
      delete env[k];
  // Fuso do servidor em UTC, como na Vercel de produção: as datas saem como lá.
  return { ...env, DATA_MODE: "memory", DATA_DIR: DADOS, SESSION_SECRET: "treinamento-local",
    NODE_ENV: "production", TZ: "UTC" };
}

async function saudavel() {
  try {
    const r = await fetch(`${BASE}/api/health`);
    if (!r.ok) return false;
    const j = await r.json();
    if (j.dataMode !== "memory") throw new Error(`servidor na porta ${PORTA} NÃO está em modo memória`);
    return true;
  } catch (e) {
    if (String(e.message).includes("NÃO está")) throw e;
    return false;
  }
}

export function pararServidor() {
  try { execFileSync("pkill", ["-f", `next start -p ${PORTA}`]); } catch {}
  try { execFileSync("bash", ["-c", `fuser -k ${PORTA}/tcp 2>/dev/null || true`]); } catch {}
  servidor = null;
}

export async function subirServidor() {
  if (await saudavel()) return;
  if (!fs.existsSync(path.join(REPO, ".next", "BUILD_ID")))
    throw new Error("portal não compilado: rode `DATA_MODE=memory npx next build` na raiz");
  const log = fs.openSync(path.join(DEMO, PORTA === 3200 ? "servidor.log" : `servidor-${PORTA}.log`), "a");
  servidor = spawn("npx", ["next", "start", "-p", String(PORTA)], {
    cwd: REPO, env: ambienteServidor(), stdio: ["ignore", log, log], detached: true });
  servidor.unref();
  for (let i = 0; i < 60; i++) { if (await saudavel()) return; await dormir(500); }
  throw new Error("o portal de treino não subiu (veja _demo/servidor.log)");
}

/** Guarda o estado atual dos dados com um nome (o servidor grava a cada escrita). */
export function salvarPonto(nome) {
  const destino = path.join(PONTOS, nome);
  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(PONTOS, { recursive: true });
  fs.cpSync(DADOS, destino, { recursive: true });
}

export const temPonto = (nome) => fs.existsSync(path.join(PONTOS, nome, "db.json"));

/** Volta os dados a um ponto salvo (o servidor lê os dados ao subir: reinicia). */
export async function restaurarPonto(nome) {
  if (!temPonto(nome)) throw new Error(`ponto de salvamento inexistente: ${nome}`);
  pararServidor();
  await dormir(400);
  fs.rmSync(DADOS, { recursive: true, force: true });
  fs.cpSync(path.join(PONTOS, nome), DADOS, { recursive: true });
  await subirServidor();
}

/** Banco vazio: a carga inicial de demonstração nasce na primeira visita ao /login. */
export async function zerarDados() {
  pararServidor();
  await dormir(400);
  fs.rmSync(DADOS, { recursive: true, force: true });
  await subirServidor();
  await fetch(`${BASE}/login?intro=off`);
}

// -------------------------------------------------------------- display ----

export async function subirDisplay(num, largura, altura) {
  const nome = `:${num}`;
  try { execFileSync("pkill", ["-f", `Xvfb ${nome} `]); await dormir(300); } catch {}
  const p = spawn("Xvfb", [nome, "-screen", "0", `${largura}x${altura}x24`, "-nolisten", "tcp", "-ac"],
    { stdio: "ignore", detached: true });
  p.unref();
  await dormir(700);
  return { nome, parar: () => { try { process.kill(p.pid); } catch {} } };
}

// ------------------------------------------------------------ navegador ----

/* Esconde só o que denuncia "modo demonstração" (em produção não existe):
 * a faixa âmbar acima do conteúdo, o seletor DEMO do cabeçalho e o quadro de
 * contas de demonstração do /login. Nada da plataforma em si é escondido. */
export const CSS_SEM_DEMO = `
  div.bg-amber-100.text-amber-900.text-center.text-xs:has(+ main) { display: none !important; }
  header label:has(> span.uppercase + select) { display: none !important; }
  form + div.border-dashed.border-zinc-300 { display: none !important; }
  nextjs-portal { display: none !important; }
`;

const OVERLAYS = fs.readFileSync(path.join(AQUI, "overlays.js"), "utf8");

/** Prepara um contexto: idioma pt, abertura animada desligada, camada didática e CSS.
 *  `oculto`: a camada existe mas não aparece (ensaio e telas paradas). */
export async function prepararContexto(ctx, { oculto = false, idioma = "pt" } = {}) {
  await ctx.addCookies([{ name: "wm_locale", value: idioma, url: BASE }]);
  const d = new Date();
  await ctx.addInitScript(({ css, hoje, oculto }) => {
    window.__treinoCfg = { css, oculto };
    try {
      // Abertura animada já vista hoje; convite "Instale o aplicativo" já dispensado
      // ("Agora não"): o estado de quem usa o portal todo dia.
      localStorage.setItem("wellmix-intro-day", hoje);
      localStorage.setItem("wm-pwa-dismissed", String(Date.now()));
    } catch {}
  }, { css: CSS_SEM_DEMO, hoje: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, oculto });
  await ctx.addInitScript(OVERLAYS);
}

/** Navegador sem cabeça (ensaio, capturas paradas, preparação de dados). */
export async function abrirEnsaio({ escala = 1, idioma = "pt" } = {}) {
  // Navegador completo (não o "headless shell", que só traz inglês): assim o que é do
  // navegador, como o botão "Escolher arquivo", sai em português como na gravação.
  const browser = await chromium.launch({ channel: "chromium", args: ["--lang=pt-BR"],
    env: { ...process.env, LANGUAGE: "pt_BR", LANG: "pt_BR.UTF-8" } });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: escala, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  await prepararContexto(ctx, { oculto: true, idioma });
  const page = await ctx.newPage();
  return { browser, ctx, page, fechar: () => browser.close() };
}

/** Navegador na tela virtual, em janela de aplicativo (sem abas nem barra), para gravar. */
export async function abrirGravacao({ display, escala = 1, idioma = "pt" }) {
  const perfil = fs.mkdtempSync("/tmp/treino-perfil-");
  // Perfil limpo, em português, sem ofertas do navegador (salvar senha, traduzir).
  fs.mkdirSync(path.join(perfil, "Default"), { recursive: true });
  fs.writeFileSync(path.join(perfil, "Default", "Preferences"), JSON.stringify({
    credentials_enable_service: false,
    profile: { password_manager_enabled: false, password_manager_leak_detection: false },
    translate: { enabled: false }, intl: { accept_languages: "pt-BR,pt", selected_languages: "pt-BR,pt" },
    // Sem o sublinhado vermelho do corretor ortográfico nos campos de texto.
    browser: { enable_spellchecking: false }, spellcheck: { dictionaries: [], use_spelling_service: false },
    autofill: { profile_enabled: false, credit_card_enabled: false },
  }));
  const ctx = await chromium.launchPersistentContext(perfil, {
    headless: false, viewport: null, locale: "pt-BR", timezoneId: "America/Sao_Paulo",
    env: { ...process.env, DISPLAY: display, LANGUAGE: "pt_BR", LANG: "pt_BR.UTF-8" },
    args: ["--kiosk", "--window-position=0,0", "--window-size=1920,1080", "--lang=pt-BR",
      `--force-device-scale-factor=${escala}`, "--no-default-browser-check", "--test-type",
      "--disable-infobars", "--hide-crash-restore-bubble", "--noerrdialogs",
      "--disable-features=Translate,TranslateUI,PasswordManagerOnboarding,AutofillServerCommunication,MediaRouter",
      "--disable-save-password-bubble", "--password-store=basic",
      // O navegador da gravação não fala com serviços do Google (sincronia, push, atualizações).
      "--disable-background-networking", "--disable-sync", "--disable-component-update",
      "--disable-domain-reliability", "--no-pings", "--disable-notifications", "--gcm-registration-disabled",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  });
  await prepararContexto(ctx, { idioma });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  return { ctx, page, fechar: async () => { await ctx.close(); fs.rmSync(perfil, { recursive: true, force: true }); } };
}

export async function entrar(page, email, senha = SENHA_DEMO) {
  await page.context().clearCookies({ name: /^(?!wm_locale$).*/ });
  await page.goto(`${BASE}/login?intro=off`);
  await page.getByLabel(/e-mail|email|邮箱/i).fill(email);
  await page.getByLabel(/senha|password|密码/i).fill(senha);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
}

// ---------------------------------------------------------------- alvos ----

/**
 * Alvo de um passo → locator. Formas aceitas:
 *   "css"                              seletor CSS
 *   { seletor, contem?, dentro?, n? }  CSS (contem = só o que tem esse texto; dentro de outro alvo; n = índice)
 *   { papel, nome, exato? }            papel ARIA + nome acessível (botão, link, aba…)
 *   { rotulo }                         campo pelo rótulo
 *   { texto, exato? }                  pelo texto visível
 * Em qualquer forma de objeto, `acima: N` sobe N níveis a partir do elemento achado.
 */
export function alvo(page, spec) {
  if (typeof spec === "string") return page.locator(spec).first();
  const base = spec.dentro ? alvo(page, spec.dentro) : page;
  let loc;
  if (spec.seletor) loc = base.locator(spec.seletor, spec.contem ? { hasText: spec.contem } : undefined);
  else if (spec.papel) loc = base.getByRole(spec.papel, { name: spec.nome, exact: spec.exato ?? true });
  else if (spec.rotulo) loc = base.getByLabel(spec.rotulo, { exact: spec.exato ?? false });
  else if (spec.texto) loc = base.getByText(spec.texto, { exact: spec.exato ?? true });
  else throw new Error(`alvo inválido: ${JSON.stringify(spec)}`);
  loc = spec.n != null ? loc.nth(spec.n) : loc.first();
  // acima: N → sobe N níveis (o cartão em volta de um título, a linha em volta de um texto).
  for (let i = 0; i < (spec.acima ?? 0); i++) loc = loc.locator("xpath=..");
  return loc;
}

/** Caixa do elemento em px da janela (x, y, w, h), depois de trazê-lo para a tela. */
export async function caixaDe(loc, { rolar = true } = {}) {
  if (rolar) {
    await loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const fora = r.top < 90 || r.bottom > innerHeight - 140;
      if (fora) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    });
    // Tabela larga, que rola para o lado dentro de uma caixa: traz a coluna do alvo para o
    // meio da parte visível (as colunas fixas da direita cobrem quem fica na borda). Quem já
    // está numa coluna fixa não precisa.
    await loc.evaluate((el) => {
      for (let c = el; c && c !== document.body; c = c.parentElement)
        if (getComputedStyle(c).position === "sticky") return;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (!/(auto|scroll)/.test(s.overflowX) || p.scrollWidth <= p.clientWidth + 4) continue;
        const r = el.getBoundingClientRect(), pr = p.getBoundingClientRect();
        if (r.left < pr.left + 24 || r.right > pr.right - 340)
          p.scrollTo({ left: Math.max(0, p.scrollLeft + (r.left + r.width / 2) - (pr.left + pr.width * 0.4)), behavior: "smooth" });
        return;
      }
    });
    // Espera a rolagem suave assentar: a caixa tem de ficar parada por três leituras seguidas
    // (240 ms). Com duas, a medida podia sair antes de a rolagem começar, e a moldura ficava
    // onde o alvo estava antes de a página andar.
    let antes = null, paradas = 0;
    for (let i = 0; i < 40 && paradas < 3; i++) {
      await dormir(80);
      const b = await loc.boundingBox();
      paradas = antes && b && Math.abs(b.y - antes.y) < 0.5 && Math.abs(b.x - antes.x) < 0.5 ? paradas + 1 : 0;
      antes = b;
    }
  }
  const b = await loc.boundingBox();
  if (!b) throw new Error("alvo sem caixa visível");
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

export function lerJson(arquivo, padrao = null) {
  try { return JSON.parse(fs.readFileSync(arquivo, "utf8")); } catch { return padrao; }
}
export function gravarJson(arquivo, dados) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
}
