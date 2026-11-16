// Executor de cena: o mesmo roteiro serve ao ENSAIO (sem cabeça, rápido: valida os
// passos e tira as telas paradas com a caixa do alvo) e à GRAVAÇÃO (tempo real,
// no ritmo da narração, com cursor, destaque e clique).
import path from "node:path";
import fs from "node:fs";
import { BASE, DEMO, agora, alvo, caixaDe, dormir, entrar } from "./lib.mjs";

const MOVER = 850;        // ms do cursor até o alvo
const DIGITAR = 75;       // ms por tecla (velocidade legível)
const PAUSA_RESULTADO = 1.3; // s parado no resultado de cada ação
const FOLGA_FALA = 0.35;  // s de respiro depois da fala
const MOUSE_NEUTRO = [1916, 620]; // borda direita (barra de rolagem): nada reage ali

/** Momento (s desde o início do passo) de um gatilho: número, "fim", ou {apos:"palavra"}. */
function momento(spec, tempos, padrao) {
  if (spec == null) return padrao;
  if (typeof spec === "number") return spec;
  const dur = tempos?.duracao ?? 0;
  if (spec === "fim") return Math.max(0, dur - 0.15);
  if (spec === "inicio") return 0.2;
  const palavras = tempos?.palavras ?? [];
  const chave = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const quer = chave(spec.apos ?? spec.em ?? "");
  if (quer) {
    // Procura a palavra (ou o começo de uma expressão) na fala já sintetizada.
    for (let i = 0; i < palavras.length; i++) {
      let junto = "";
      for (let j = i; j < Math.min(palavras.length, i + 6); j++) {
        junto += chave(palavras[j].p);
        if (junto.startsWith(quer) || (quer.startsWith(junto) && junto.length >= quer.length)) {
          if (junto.length >= quer.length) return spec.apos ? palavras[j].fim : palavras[i].ini;
        }
      }
    }
  }
  return padrao;
}

async function aguardar(page, espera) {
  if (!espera) { await page.waitForLoadState("domcontentloaded").catch(() => {}); return; }
  if (espera.url) await page.waitForURL(new RegExp(espera.url), { timeout: 20000 });
  if (espera.seletor) await page.locator(espera.seletor).first().waitFor({ state: espera.estado ?? "visible", timeout: 20000 });
  if (espera.texto) await page.getByText(espera.texto).first().waitFor({ timeout: 20000 });
  if (espera.some) await page.locator(espera.some).first().waitFor({ state: "hidden", timeout: 20000 });
  if (espera.rede) await page.waitForLoadState("networkidle").catch(() => {});
  if (espera.ms) await dormir(espera.ms);
}

async function agir(page, passo, loc, { lento }) {
  const v = passo.valor;
  switch (passo.acao) {
    case "clicar": await loc.click(); break;
    case "digitar":
      await loc.click();
      if (passo.limpar !== false) await loc.fill("");
      if (lento) {
        await page.keyboard.type(String(v), { delay: DIGITAR });
        // Campo numérico pode recusar o ponto ou a vírgula conforme o idioma do navegador:
        // se o valor não ficou como o roteiro pede, grava o valor certo.
        if ((await loc.getAttribute("type")) === "number" && (await loc.inputValue()) !== String(v)) await loc.fill(String(v));
      } else await loc.fill(String(v));
      if (passo.enter) { if (lento) await dormir(350); await page.keyboard.press("Enter"); }
      break;
    case "escolher": await loc.selectOption(v); break;
    case "data": {
      // Campo de data: o valor é em dias a partir de hoje ("+35") ou uma data ISO. Na gravação
      // os dígitos são digitados como a pessoa faria (dia, mês, ano); no ensaio, preenchidos.
      const d = /^[+-]?\d+$/.test(String(v)) ? new Date(Date.now() + Number(v) * 86400000) : new Date(`${v}T12:00:00Z`);
      const iso = d.toISOString().slice(0, 10), [ano, mes, dia] = iso.split("-");
      if (lento) {
        await loc.focus();
        await page.keyboard.type(`${dia}${mes}${ano}`, { delay: DIGITAR * 1.6 });
        if ((await loc.inputValue()) !== iso) await loc.fill(iso);
      } else await loc.fill(iso);
      break;
    }
    case "marcar": await loc.check(); break;
    case "anexar": await loc.setInputFiles(String(v).replace("{DEMO}", DEMO)); break;
    case "tecla": await page.keyboard.press(String(v)); break;
    case "passar": await loc.hover(); break;
    case "ir": await page.goto(BASE + v); break;
    case "enviar": await loc.evaluate((el) => (el.form ?? el.closest("form")).requestSubmit()); break;
    case null: case undefined: case "mostrar": break;
    default: throw new Error(`ação desconhecida: ${passo.acao}`);
  }
}

const ALVO_VISUAL = (passo) => passo.alvo_visual ?? passo.alvo;

/** Abre a cena: login da conta do papel (fora da gravação) e tela inicial. */
export async function abrirCena(page, cena, papel) {
  const conta = cena.conta ?? papel.conta;
  if (cena.login !== false && conta) await entrar(page, conta.email);
  if (cena.inicio?.url) await page.goto(BASE + cena.inicio.url);
  await page.waitForLoadState("networkidle").catch(() => {});
  for (const pre of cena.inicio?.antes ?? []) {
    const loc = pre.alvo ? alvo(page, pre.alvo) : null;
    await agir(page, pre, loc, { lento: false });
    await aguardar(page, pre.espera);
  }
}

/**
 * ENSAIO: executa os passos sem esperar a narração; em cada passo com alvo grava a
 * tela parada (sem a camada didática) e a caixa do elemento, para a simulação e o quiz.
 */
export async function ensaiar(page, cena, pastaQuadros) {
  fs.mkdirSync(pastaQuadros, { recursive: true });
  const quadros = [];
  for (const passo of cena.passos) {
    let loc = null, caixa = null;
    if (passo.alvo) {
      loc = alvo(page, passo.alvo);
      await loc.waitFor({ state: passo.acao === "anexar" ? "attached" : "visible", timeout: 15000 });
    }
    const visual = ALVO_VISUAL(passo);
    if (visual) {
      const lv = alvo(page, visual);
      caixa = await caixaDe(lv);
      await dormir(150);
    }
    const arquivo = path.join(pastaQuadros, `${passo.id}.png`);
    await page.screenshot({ path: arquivo, animations: "disabled" });
    quadros.push({ passo: passo.id, arquivo: path.basename(arquivo), caixa,
      url: new URL(page.url()).pathname, acao: passo.acao ?? null,
      valor: passo.acao === "digitar" || passo.acao === "escolher" ? passo.valor : null });
    await agir(page, passo, loc, { lento: false });
    await aguardar(page, passo.espera);
  }
  const fim = path.join(pastaQuadros, `_fim.png`);
  await dormir(300);
  await page.screenshot({ path: fim, animations: "disabled" });
  return quadros;
}

/**
 * GRAVAÇÃO: executa os passos no ritmo da narração (áudio primeiro). Devolve a linha
 * do tempo real de cada passo (ms desde `t0`), para o áudio e os efeitos casarem.
 */
export async function gravarPassos(page, cena, tempos, t0) {
  const linha = [];
  const rel = () => (agora() - t0) / 1000;
  const ate = async (alvoSeg, ini) => { const falta = alvoSeg - (rel() - ini); if (falta > 0) await dormir(falta * 1000); };
  let numero = 0;
  const total = cena.passos.filter((p) => p.acao && p.acao !== "mostrar" && p.conta_passo !== false).length;
  for (const passo of cena.passos) {
    const tp = tempos?.[passo.id] ?? { duracao: 0, palavras: [] };
    const D = tp.duracao ?? 0;
    const ehAcao = passo.acao && passo.acao !== "mostrar";
    if (ehAcao && passo.conta_passo !== false) numero++;
    const ini = rel();
    const reg = { passo: passo.id, inicio: ini, fala: passo.fala ?? null, duracao_fala: D,
      numero: ehAcao && passo.conta_passo !== false ? numero : null, total, eventos: [] };
    let loc = null, caixa = null, caixaAlvo = null;
    if (passo.alvo) {
      loc = alvo(page, passo.alvo);
      await loc.waitFor({ state: passo.acao === "anexar" ? "attached" : "visible", timeout: 15000 });
    }
    const visual = ALVO_VISUAL(passo);
    const tDest = momento(passo.destaque_em, tp, 0.25);
    const tAcao = ehAcao ? Math.max(tDest + 1.25, momento(passo.acao_em, tp, Math.max(0, D - 0.15))) : null;
    if (visual && passo.destaque !== false) {
      await ate(Math.max(0, tDest - 0.45), ini);
      caixa = await caixaDe(alvo(page, visual));
      // Contorno numa área maior que o alvo (a linha inteira): o rótulo e o clique vão no alvo de verdade.
      if (ehAcao && passo.alvo_visual && loc && passo.acao !== "anexar") caixaAlvo = await caixaDe(loc, { rolar: false }).catch(() => null);
      await ate(tDest, ini);
      await page.evaluate(([c, o]) => window.__treino.destacar(c, o),
        [caixa, { rotulo: passo.rotulo ?? null, numero: ehAcao && passo.conta_passo !== false ? numero : null,
          sombra: passo.foco !== false, lado: passo.rotulo_lado ?? null, ancora: caixaAlvo }]);
      // Passo só de explicação: o cursor aponta o que está sendo mostrado, logo abaixo da
      // caixa (ou acima, se não couber), para não cobrir o texto destacado.
      if (!ehAcao && passo.cursor !== false) {
        // 30 px de folga: o halo do cursor (46 px de largura) fica inteiro fora da caixa destacada.
        const embaixo = caixa.y + caixa.h + 30 < 1050;
        await page.evaluate(([x, y]) => window.__treino.cursor(x, y, 750),
          [caixa.x + Math.min(caixa.w / 2, 140), embaixo ? caixa.y + caixa.h + 30 : Math.max(8, caixa.y - 30)]);
      }
      reg.eventos.push({ tipo: "destaque", t: rel(), caixa, rotulo: passo.rotulo ?? null });
      reg.caixa = caixa;
    }
    // Destaques extras do mesmo passo (explicações: "aqui fica X, ali fica Y").
    for (const extra of passo.destaques ?? []) {
      const te = momento(extra.em, tp, 0.5);
      await ate(Math.max(0, te - 0.35), ini);
      const c = await caixaDe(alvo(page, extra.alvo));
      await ate(te, ini);
      await page.evaluate(([cx, o]) => window.__treino.destacar(cx, o), [c, { rotulo: extra.rotulo ?? null, sombra: extra.foco !== false, lado: extra.rotulo_lado ?? null }]);
      reg.eventos.push({ tipo: "destaque", t: rel(), caixa: c, rotulo: extra.rotulo ?? null });
      if (extra.cursor !== false) await page.evaluate(([x, y]) => window.__treino.cursor(x, y, 700), [c.x + Math.min(c.w / 2, 120), c.y + c.h / 2]);
    }
    if (ehAcao) {
      const c = caixaAlvo ?? caixa ?? (loc && passo.acao !== "anexar" ? await caixaDe(loc) : null);
      // Campo de arquivo nativo (sem botão próprio): o botão "Escolher arquivo" fica na ponta esquerda.
      const pontaEsquerda = passo.acao === "anexar" && !passo.alvo_visual;
      const px = c ? c.x + (pontaEsquerda ? Math.min(56, c.w / 2) : Math.min(c.w / 2, Math.max(24, c.w - 16))) : null;
      const py = c ? c.y + c.h / 2 : null;
      if (c) {
        await ate(tAcao - MOVER / 1000 - 0.1, ini);
        await page.evaluate(([x, y, ms]) => window.__treino.cursor(x, y, ms), [px, py, MOVER]);
      }
      await ate(tAcao, ini);
      if (c) await page.evaluate(() => window.__treino.clique());
      reg.eventos.push({ tipo: "acao", t: rel(), acao: passo.acao, ponto: c ? [px, py] : null });
      await dormir(140);
      if (passo.acao === "digitar") await page.evaluate(() => window.__treino.digitando(true));
      await page.evaluate(() => window.__treino.limpar()).catch(() => {});
      await agir(page, passo, loc, { lento: true });
      if (passo.acao === "digitar") await page.evaluate(() => window.__treino.digitando(false)).catch(() => {});
      // O mouse de verdade sai de cima do elemento (o cursor desenhado fica): sem
      // dicas nativas do navegador nem endereço de link no rodapé da gravação.
      if (!passo.manter_mouse) await page.mouse.move(MOUSE_NEUTRO[0], MOUSE_NEUTRO[1]).catch(() => {});
      await aguardar(page, passo.espera);
      reg.eventos.push({ tipo: "resultado", t: rel() });
    }
    const fimFala = D + FOLGA_FALA;
    const pausa = passo.pausa ?? (ehAcao ? PAUSA_RESULTADO : 0.25);
    const ultimo = reg.eventos.length ? reg.eventos[reg.eventos.length - 1].t - ini : 0;
    await ate(Math.max(fimFala, ehAcao ? ultimo + pausa : 0), ini);
    if (!ehAcao) await page.evaluate(() => window.__treino.limpar()).catch(() => {});
    reg.fim = rel();
    linha.push(reg);
  }
  return linha;
}
