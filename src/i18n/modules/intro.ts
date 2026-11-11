/**
 * Dicionário da abertura do portal (src/components/intro-player.tsx): mesmas
 * chaves em pt, en e zh. Os textos do mapa são desenhados no canvas em caixa
 * alta, com espaçamento largo; a legenda fica embaixo da rota Brasil ↔ China.
 */
export const pt = {
  "intro.title": "Abertura Wellmix",
  "intro.skip": "Pular",
  "intro.map.brazil": "BRASIL",
  "intro.map.china": "CHINA",
  "intro.map.caption": "BRASIL ↔ CHINA · DESDE 2010",
};

export const en: Record<keyof typeof pt, string> = {
  "intro.title": "Wellmix opening",
  "intro.skip": "Skip",
  "intro.map.brazil": "BRAZIL",
  "intro.map.china": "CHINA",
  "intro.map.caption": "BRAZIL ↔ CHINA · SINCE 2010",
};

export const zh: Record<keyof typeof pt, string> = {
  "intro.title": "Wellmix 开场动画",
  "intro.skip": "跳过",
  "intro.map.brazil": "巴西",
  "intro.map.china": "中国",
  "intro.map.caption": "巴西 ↔ 中国 · 始于 2010 年",
};
