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
  // Aplicativo (PWA): convite para instalar (src/components/pwa-install.tsx).
  "pwa.install.title": "Instale o aplicativo Wellmix",
  "pwa.install.body":
    "Abre direto da tela inicial, em tela cheia, como um aplicativo.",
  "pwa.install.button": "Instalar",
  "pwa.install.ios":
    "No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.",
  "pwa.install.mac":
    "No Safari, abra o menu Arquivo e escolha “Adicionar ao Dock”.",
  "pwa.install.dismiss": "Agora não",
};

export const en: Record<keyof typeof pt, string> = {
  "intro.title": "Wellmix opening",
  "intro.skip": "Skip",
  "intro.map.brazil": "BRAZIL",
  "intro.map.china": "CHINA",
  "intro.map.caption": "BRAZIL ↔ CHINA · SINCE 2010",
  "pwa.install.title": "Install the Wellmix app",
  "pwa.install.body":
    "Opens straight from your home screen, full screen, like an app.",
  "pwa.install.button": "Install",
  "pwa.install.ios": "In Safari, tap Share and then “Add to Home Screen”.",
  "pwa.install.mac": "In Safari, open the File menu and choose “Add to Dock”.",
  "pwa.install.dismiss": "Not now",
};

export const zh: Record<keyof typeof pt, string> = {
  "intro.title": "Wellmix 开场动画",
  "intro.skip": "跳过",
  "intro.map.brazil": "巴西",
  "intro.map.china": "中国",
  "intro.map.caption": "巴西 ↔ 中国 · 始于 2010 年",
  "pwa.install.title": "安装 Wellmix 应用",
  "pwa.install.body": "从主屏幕直接打开，全屏显示，像应用一样使用。",
  "pwa.install.button": "安装",
  "pwa.install.ios": "在 Safari 中点按“分享”，然后选择“添加到主屏幕”。",
  "pwa.install.mac": "在 Safari 中打开“文件”菜单，选择“添加到程序坞”。",
  "pwa.install.dismiss": "暂不",
};
