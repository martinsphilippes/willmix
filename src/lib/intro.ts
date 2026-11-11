/**
 * Abertura do portal (animação em canvas, só no desktop). A decisão de tocar
 * é tomada por um script inline no `<head>` (INTRO_BOOT), antes do primeiro
 * quadro: assim a tela já nasce coberta e a página nunca pisca antes da
 * animação. Quem carrega e toca a animação (`public/intro/wellmix-intro.js`,
 * peça autocontida) é `src/components/intro-player.tsx`.
 *
 * Regras (documentadas em docs/ARQUITETURA.md, seção 6):
 * - só com janela de 1024 px ou mais (breakpoint `lg`): o celular nunca vê;
 * - toca na primeira abertura do dia (localStorage, data local do navegador)
 *   e ao recarregar (F5) a página inicial (`/app` ou `/login`); navegar pelo
 *   menu ou abrir outra aba no mesmo dia não repete;
 * - "Pular", Esc, Enter ou espaço encerram na hora;
 * - nunca em navegador automatizado (`navigator.webdriver`: Playwright,
 *   Lighthouse), para o E2E e as auditorias não esperarem a animação;
 * - `?intro=always` força (ignora as regras acima e não marca o dia),
 *   `?intro=off` não toca e `?intro=manual` deixa parado para gravar
 *   (`WellmixIntro.seek(ms)`).
 *
 * Em `<html>`, `data-wm-intro` conta a fase: `pending` (coberta, script a
 * caminho) → `playing` → `done` (a página "pousa", transição em globals.css)
 * → atributo removido.
 */

/** Dia (local) em que a abertura já tocou neste navegador (localStorage). */
export const INTRO_DAY_KEY = "wellmix-intro-day";
/** Páginas iniciais: recarregar (F5) uma delas toca de novo. */
export const INTRO_HOME_PATHS = ["/app", "/login"] as const;
/** Janela mínima: o mesmo `lg` do Tailwind, onde o login vira duas colunas. */
export const INTRO_MEDIA = "(min-width: 1024px)";
/** Script da animação, servido estático. */
export const INTRO_SCRIPT_SRC = "/intro/wellmix-intro.js";
/** Atributo de fase em `<html>`. */
export const INTRO_ATTR = "data-wm-intro";

/**
 * Script inline do `<head>`: sem dependências, tolerante a navegador sem
 * storage ou sem Performance API (qualquer erro = não toca, a página aparece
 * normalmente). Marca o dia só quando decide tocar.
 */
export const INTRO_BOOT =
  "(function(){try{" +
  'var q=new URLSearchParams(location.search).get("intro");' +
  'if(q==="off")return;' +
  'if(q!=="always"&&q!=="manual"){' +
  "if(navigator.webdriver)return;" +
  `if(!matchMedia(${JSON.stringify(INTRO_MEDIA)}).matches)return;` +
  'var d=new Date(),today=d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();' +
  `if(localStorage.getItem(${JSON.stringify(INTRO_DAY_KEY)})===today){` +
  "var again=false;" +
  'try{var nav=performance.getEntriesByType("navigation")[0];' +
  `again=!!nav&&nav.type==="reload"&&${JSON.stringify([...INTRO_HOME_PATHS])}.indexOf(location.pathname)>-1}catch(e){}` +
  "if(!again)return}" +
  `localStorage.setItem(${JSON.stringify(INTRO_DAY_KEY)},today)}` +
  `document.documentElement.setAttribute(${JSON.stringify(INTRO_ATTR)},"pending")` +
  "}catch(e){}})();";
