/*
 * Camada didática injetada na página durante a gravação (Playwright addInitScript).
 * Não altera o código da plataforma: vive só no navegador da gravação.
 *
 * window.__treino:
 *   cursor(x, y, ms)        move o cursor desenhado até (x, y) com aceleração suave
 *   clique()                onda no ponto do cursor
 *   destacar(caixa, opt)    contorno + rótulo numerado no elemento ({x,y,w,h} em px da janela)
 *   limpar()                tira o destaque
 *   marca(cor, ms)          tela cheia de uma cor (marca de sincronia da gravação)
 *   digitando(sim)          cursor em forma de texto enquanto digita
 */
(() => {
  if (window.__treino) return;
  const MARCA = { vermelho: "#BF2026", grafite: "#17181C", branco: "#FFFFFF" };
  // Configuração posta pelo gravador: CSS extra (esconde só o que é do modo
  // demonstração) e "oculto" (ensaio: sem cursor nem destaque nas telas paradas).
  const CFG = window.__treinoCfg || {};
  const CHAVE = "__treino_cursor";

  const css = `
  #__treino { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
    width: 100vw; height: 100vh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0;
    background: transparent; overflow: visible; color: inherit;
    font-family: "Geist", "Inter", system-ui, sans-serif; }
  #__treino::backdrop { display: none; }
  #__treino * { box-sizing: border-box; }
  #__treino .cursor { position: absolute; left: 0; top: 0; width: 28px; height: 28px;
    transform: translate(-100px, -100px); will-change: transform;
    filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }
  #__treino .halo { position: absolute; left: 0; top: 0; width: 46px; height: 46px;
    margin: -23px 0 0 -23px; transform: translate(-100px, -100px); will-change: transform; }
  #__treino .halo i { display: block; width: 100%; height: 100%; border-radius: 50%;
    background: rgba(191,32,38,.18); border: 2px solid rgba(191,32,38,.55); }
  #__treino .onda { position: absolute; width: 20px; height: 20px; margin: -10px 0 0 -10px;
    border-radius: 50%; border: 3px solid ${MARCA.vermelho}; opacity: .9;
    animation: __treino_onda .55s ease-out forwards; }
  @keyframes __treino_onda { to { transform: scale(4.2); opacity: 0; } }
  #__treino .foco { position: absolute; border-radius: 10px; opacity: 0;
    border: 3px solid ${MARCA.vermelho};
    box-shadow: 0 0 0 3px rgba(255,255,255,.9), 0 0 0 9999px rgba(23,24,28,.22);
    transition: opacity .25s ease, left .3s ease, top .3s ease, width .3s ease, height .3s ease; }
  #__treino .foco.sem-sombra { box-shadow: 0 0 0 4px rgba(255,255,255,.9), 0 6px 24px rgba(191,32,38,.35); }
  #__treino .foco.on { opacity: 1; }
  #__treino .rotulo { position: absolute; display: flex; align-items: center; gap: 10px;
    max-width: 560px; padding: 9px 16px 9px 9px; border-radius: 999px; opacity: 0;
    background: ${MARCA.grafite}; color: ${MARCA.branco}; font-size: 20px; font-weight: 600;
    line-height: 1.2; letter-spacing: .1px; box-shadow: 0 8px 24px rgba(0,0,0,.35);
    transition: opacity .25s ease; white-space: nowrap; }
  #__treino .rotulo.on { opacity: 1; }
  #__treino .rotulo .n { flex: none; min-width: 32px; height: 32px; padding: 0 9px; border-radius: 999px;
    background: ${MARCA.vermelho}; color: #fff; font-size: 18px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; }
  #__treino .rotulo.sem-numero { padding-left: 16px; }
  #__treino .marca { position: absolute; inset: 0; display: none; }
  `;

  const SETA = `<svg viewBox="0 0 28 28" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 3 L5 23 L10.5 18 L14.2 26 L17.6 24.4 L14 16.6 L21.5 16.6 Z"
      fill="#17181C" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  const TEXTO = `<svg viewBox="0 0 28 28" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 3 h10 M14 3 v22 M9 25 h10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <path d="M9 3 h10 M14 3 v22 M9 25 h10" fill="none" stroke="#17181C" stroke-width="2.2" stroke-linecap="round"/></svg>`;

  let raiz, cursorEl, haloEl, focoEl, rotuloEl, marcaEl;
  let pos = { x: -100, y: -100 };
  try {
    const salvo = JSON.parse(sessionStorage.getItem(CHAVE) || "null");
    if (salvo) pos = salvo;
  } catch {}

  function montar() {
    if (raiz && raiz.isConnected) return;
    porEstilo();
    raiz = document.createElement("div");
    raiz.id = "__treino";
    if (CFG.oculto) raiz.style.display = "none";
    raiz.setAttribute("aria-hidden", "true");
    raiz.innerHTML = `<div class="foco"></div><div class="rotulo"></div><div class="halo"><i></i></div>
      <div class="cursor">${SETA}</div><div class="marca"></div>`;
    document.documentElement.appendChild(raiz);
    [focoEl, rotuloEl, haloEl, cursorEl, marcaEl] = raiz.children;
    aplicar(0);
    topo();
  }

  // Caixa de diálogo nativa (<dialog> modal) vive na "camada do topo" do navegador, acima de
  // qualquer z-index. A camada didática entra nessa mesma camada (como popover manual) e é
  // posta de novo por último sempre que um diálogo abre, para o cursor e o destaque ficarem
  // por cima dele.
  let sobre = null;
  function topo() {
    if (!raiz || CFG.oculto || !raiz.showPopover) return;
    try {
      if (!raiz.hasAttribute("popover")) raiz.setAttribute("popover", "manual");
      const dialogo = document.querySelector("dialog[open]");
      if (!raiz.matches(":popover-open")) raiz.showPopover();
      else if (dialogo && dialogo !== sobre) { raiz.hidePopover(); raiz.showPopover(); }
      sobre = dialogo;
    } catch {}
  }

  function porEstilo() {
    if (document.getElementById("__treino_css")) return;
    const estilo = document.createElement("style");
    estilo.id = "__treino_css";
    estilo.textContent = css + (CFG.css || "");
    document.documentElement.appendChild(estilo);
  }

  function aplicar(ms) {
    const t = ms ? `transform ${ms}ms cubic-bezier(.45,.05,.2,1)` : "none";
    cursorEl.style.transition = t;
    haloEl.style.transition = t;
    // A ponta da seta fica no ponto (5,3) do desenho.
    cursorEl.style.transform = `translate(${pos.x - 5}px, ${pos.y - 3}px)`;
    haloEl.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    try { sessionStorage.setItem(CHAVE, JSON.stringify(pos)); } catch {}
  }

  const api = {
    cursor(x, y, ms = 800) { montar(); topo(); pos = { x, y }; aplicar(ms); },
    posicao() { return pos; },
    clique() {
      montar(); topo();
      const o = document.createElement("div");
      o.className = "onda";
      o.style.left = pos.x + "px";
      o.style.top = pos.y + "px";
      raiz.appendChild(o);
      haloEl.firstChild.animate([{ transform: "scale(1)" }, { transform: "scale(.7)" }, { transform: "scale(1)" }], { duration: 260 });
      setTimeout(() => o.remove(), 700);
    },
    digitando(sim) { montar(); cursorEl.innerHTML = sim ? TEXTO : SETA; },
    destacar(caixa, opt = {}) {
      montar(); topo();
      const m = opt.margem ?? 4;
      const x = Math.max(4, caixa.x - m), y = Math.max(4, caixa.y - m);
      const w = Math.min(innerWidth - x - 4, caixa.w + 2 * m);
      const h = Math.min(innerHeight - y - 4, caixa.h + 2 * m);
      Object.assign(focoEl.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
      focoEl.classList.toggle("sem-sombra", opt.sombra === false);
      focoEl.classList.add("on");
      if (opt.rotulo) {
        rotuloEl.innerHTML = (opt.numero != null ? `<span class="n">${opt.numero}</span>` : "") +
          `<span></span>`;
        rotuloEl.lastChild.textContent = opt.rotulo;
        rotuloEl.classList.toggle("sem-numero", opt.numero == null);
        rotuloEl.style.left = "0px"; rotuloEl.style.top = "0px";
        const r = rotuloEl.getBoundingClientRect();
        // O rótulo fica junto do alvo de verdade (opt.ancora: o botão) quando o contorno
        // pega uma área maior (a linha inteira da tabela).
        const A = opt.ancora ? { x: opt.ancora.x - m, y: opt.ancora.y - m, w: opt.ancora.w + 2 * m, h: opt.ancora.h + 2 * m } : { x, y, w, h };
        // Preferência: abaixo do alvo; sem espaço, acima; alvo alto demais, ao lado.
        // opt.lado força a posição: "acima" | "abaixo" | "direita" | "esquerda".
        let rx = Math.min(Math.max(12, opt.ancora ? A.x + A.w - r.width : A.x), innerWidth - r.width - 12);
        let ry = Math.max(y + h, A.y + A.h) + 14;
        // Item do menu lateral: o rótulo vai para a direita (não cobre o item de baixo).
        const lado = opt.lado ?? (x + w < 330 ? "direita" : null);
        if (lado === "acima" || (!lado && ry + r.height > innerHeight - 90)) ry = Math.min(y, A.y) - r.height - 14;
        if (lado === "direita" || lado === "esquerda" || ry < 12) {
          ry = Math.max(12, Math.min(innerHeight - r.height - 12, A.y + A.h / 2 - r.height / 2));
          rx = lado === "esquerda" ? A.x - r.width - 14 : A.x + A.w + 14;
          if (rx + r.width > innerWidth - 12) rx = Math.max(12, A.x - r.width - 14);
          if (rx < 12) rx = A.x + A.w + 14;
        }
        rotuloEl.style.left = rx + "px";
        rotuloEl.style.top = ry + "px";
        rotuloEl.classList.add("on");
      } else rotuloEl.classList.remove("on");
    },
    limpar() { if (!raiz) return; focoEl.classList.remove("on"); rotuloEl.classList.remove("on"); },
    marca(cor, ms = 200) {
      montar();
      marcaEl.style.background = cor; marcaEl.style.display = "block";
      return new Promise((ok) => setTimeout(() => { marcaEl.style.display = "none"; ok(); }, ms));
    },
    esconder(sim) { montar(); raiz.style.visibility = sim ? "hidden" : "visible"; },
  };
  window.__treino = api;
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", montar, { once: true });
  else montar();
  // Navegações do Next trocam o corpo da página: garante a camada de volta.
  const vigiar = () => new MutationObserver(() => {
    if (!raiz || !raiz.isConnected) { raiz = null; montar(); }
    porEstilo();
  }).observe(document.documentElement, { childList: true });
  if (document.documentElement) vigiar();
  else document.addEventListener("DOMContentLoaded", vigiar, { once: true });
})();
