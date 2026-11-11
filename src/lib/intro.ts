/**
 * Abertura do portal (animação em canvas, só no desktop). A decisão de tocar
 * é tomada por um script inline no `<head>` (INTRO_BOOT), antes do primeiro
 * quadro: assim a tela já nasce coberta e a página nunca pisca antes da
 * animação. Quem carrega e toca a animação (`public/intro/wellmix-intro.js`,
 * peça autocontida) é `src/components/intro-player.tsx`.
 *
 * Regras (documentadas em docs/ARQUITETURA.md, seção 6):
 * - só com janela de 1024 px ou mais (breakpoint `lg`): o celular nunca vê;
 * - uma vez por aba (sessionStorage), com "Pular", Esc, Enter ou espaço;
 * - nunca em navegador automatizado (`navigator.webdriver`: Playwright,
 *   Lighthouse), para o E2E e as auditorias não esperarem a animação;
 * - `?intro=always` força (ignora as regras acima), `?intro=off` não toca e
 *   `?intro=manual` deixa parado para gravar (`WellmixIntro.seek(ms)`).
 *
 * Em `<html>`, `data-wm-intro` conta a fase: `pending` (coberta, script a
 * caminho) → `playing` → `done` (a página "pousa", transição em globals.css)
 * → atributo removido.
 */

/** Marca de "já tocou" nesta aba (sessionStorage). */
export const INTRO_STORAGE_KEY = "wellmix-intro-played";
/** Janela mínima: o mesmo `lg` do Tailwind, onde o login vira duas colunas. */
export const INTRO_MEDIA = "(min-width: 1024px)";
/** Script da animação, servido estático. */
export const INTRO_SCRIPT_SRC = "/intro/wellmix-intro.js";
/** Atributo de fase em `<html>`. */
export const INTRO_ATTR = "data-wm-intro";

/**
 * Script inline do `<head>`: sem dependências, tolerante a navegador sem
 * storage (qualquer erro = não toca, a página aparece normalmente).
 */
export const INTRO_BOOT =
  "(function(){try{" +
  'var q=new URLSearchParams(location.search).get("intro");' +
  'if(q==="off")return;' +
  'if(q!=="always"&&q!=="manual"){' +
  "if(navigator.webdriver)return;" +
  `if(!matchMedia(${JSON.stringify(INTRO_MEDIA)}).matches)return;` +
  `if(sessionStorage.getItem(${JSON.stringify(INTRO_STORAGE_KEY)})==="1")return}` +
  `document.documentElement.setAttribute(${JSON.stringify(INTRO_ATTR)},"pending")` +
  "}catch(e){}})();";
