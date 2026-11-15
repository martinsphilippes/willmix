/*
 * Cenas do filme. Cada função recebe a cena da linha do tempo (props, e os
 * instantes `cue[i]` em que cada fala da narração começa, relativos à cena)
 * e devolve o HTML. As animações são classes de film.css com atraso `--at`.
 */
const at = (t, d) => `--at:${Number(t).toFixed(3)}s${d ? `;--d:${d}s` : ""}`;
/** Instante da fala `c` (mais `d` segundos); sem fala, cai num ritmo fixo. */
const when = (s, o, fallback = 0.8) =>
  (o?.c != null
    ? (s.cue[o.c] ?? s.cue.at(-1) ?? fallback)
    : (s.cue[0] ?? fallback)) + (o?.d ?? 0);

function browser(ctx, shot, style = "", extra = "") {
  return `<div class="browser" style="${style}">
    <div class="bar"><i></i><i></i><i></i><span class="url">${ctx.icon("lock")}Portal Wellmix</span></div>
    <div class="view"><img src="${ctx.shot(shot)}" alt="" />${extra}</div>
  </div>`;
}
const phone = (ctx, shot, style = "") =>
  `<div class="phone" style="${style}"><div class="view"><img src="${ctx.shot(shot)}" alt="" /></div></div>`;

/** Tela do computador ao lado do celular: começa com `before` e, na fala de
 *  `d`, passa (em fusão) para `shot`, já com o que o celular enviou. */
function mobileDesk(s, ctx, d) {
  const t = when(s, d);
  const frame = `--ox:${d.ox ?? "50%"};--oy:${d.oy ?? "20%"};--z0:${d.zoom0 ?? 1};--z1:${d.zoom ?? 1.08};--kd:${s.dur}s`;
  return `<div class="shot tilt" style="${at(0.45)};--float:${s.dur}s"><div class="browser" style="--w:${d.w ?? 760}px">
      <div class="bar"><i></i><i></i><i></i><span class="url">${ctx.icon("lock")}Portal Wellmix</span></div>
      <div class="view"><img src="${ctx.shot(d.before ?? d.shot)}" alt="" style="${frame}" />
        ${d.before ? `<div class="layer a a-fade" style="${at(t, 0.5)}"><img src="${ctx.shot(d.shot)}" alt="" style="${frame}" /></div>` : ""}</div></div>
    ${d.label ? `<div class="pill a a-pop" style="${at(1.1, 0.6)}">${ctx.icon(d.icon ?? "eye")}${ctx.esc(d.label)}</div>` : ""}</div>`;
}

const head = (ctx, p, t0 = 0.35, size = "h2") => `
  ${p.kicker ? `<div class="kicker a a-right" style="${at(t0)}">${ctx.esc(p.kicker)}</div>` : ""}
  <div class="${size}">${ctx.words(p.title, t0 + 0.15, 0.07)}</div>`;

const chip = (ctx, role, icon, t) =>
  `<div class="role-chip a a-right" style="${at(t)}"><span class="dot">${ctx.icon(icon)}</span>${ctx.esc(role)}</div>`;

/** Curva suave (Catmull-Rom → Bézier) pelos pontos. */
function smooth(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function worldMap(ctx, cls = "") {
  const w = ctx.world;
  return `<svg class="world ${cls}" viewBox="0 0 1920 1080">
    <g class="land">${[...w.land, w.china].map((d) => `<path d="${d}"/>`).join("")}</g>
    <path class="brazil" d="${w.brazil}"/>
  </svg>`;
}

export const SCENES = {
  /** Abertura: o mapa da vinheta volta, com rotas de várias origens no
   *  exterior até o Brasil (nenhum país de origem em destaque). */
  route(s, ctx) {
    const p = s.props;
    const P = ctx.world.points;
    // Rota principal (por mar, pelo Cabo): é nela que aparecem as mãos por
    // onde a carga passa.
    const d = smooth([
      P.shenzhen,
      P.singapore,
      [1052, 842],
      P.midAtlantic,
      P.santos,
    ]);
    // Demais origens: arcos até o Brasil, curvados para o lado indicado.
    const arc = (o, bend) => {
      const [x1, y1] = o;
      const [x2, y2] = P.santos;
      const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
      const [nx, ny] = [y2 - y1, x1 - x2]; // perpendicular ao trecho
      return `M${x1},${y1} Q${(mx + nx * bend).toFixed(1)},${(my + ny * bend).toFixed(1)} ${x2},${y2}`;
    };
    const others = [
      [P.hoChiMinh, 0.2],
      [P.mumbai, 0.22],
      [P.istanbul, 0.24],
      [P.dubai, 0.22],
    ];
    const t0 = 1.0;
    const hand = p.handoffsC != null ? s.cue[p.handoffsC] : (p.handoffsAt ?? 2);
    return `${s.cls?.includes("first") ? `<div class="paper"></div>` : ""}
      ${worldMap(ctx, "a a-fade")}
      <svg class="route" viewBox="0 0 1920 1080">
        ${others.map(([o, bend], i) => `<path class="arc a a-draw" pathLength="1" d="${arc(o, bend)}" style="${at(t0 + 0.15 + i * 0.16, 1.9)}"/>`).join("")}
        <path class="glow a a-draw" pathLength="1" d="${d}" style="${at(t0, 2.6)}"/>
        <path class="line a a-draw" pathLength="1" d="${d}" style="${at(t0, 2.6)}"/>
      </svg>
      <div class="ship" style="offset-path:path('${d}');${at(t0, 2.6)}"></div>
      ${[[P.shenzhen], ...others]
        .map(
          ([o], i) =>
            `<div class="origin" style="left:${o[0]}px;top:${o[1]}px"><i class="a a-pop" style="${at(0.65 + i * 0.09, 0.55)}"></i></div>`,
        )
        .join("")}
      <div class="pin br a a-pop" style="left:${P.santos[0]}px;top:${P.santos[1]}px;${at(t0 + 2.3, 0.6)}"><i></i><b>Brazil</b></div>
      ${p.handoffs
        .map((h, i) => {
          const f = [14, 30, 46, 62, 78, 91][i];
          return `<div class="handoff ${i % 2 ? "up" : ""} a a-pop" style="offset-path:path('${d}');offset-distance:${f}%;${at(hand + i * 0.42, 0.55)}"><span>${ctx.icon(h.icon)}</span><b>${ctx.esc(h.label)}</b></div>`;
        })
        .join("")}
      <div class="scrim"></div>
      <div class="copy">${head(ctx, p, 1.1, "h1")}</div>`;
  },

  /** Cada um no seu canal: ícones soltos, ligados por um emaranhado. */
  chaos(s, ctx) {
    const p = s.props;
    const T = [
      ["mail", "E-mail", 930, 150, -7, "37"],
      ["file-spreadsheet", "Spreadsheet", 1180, 110, 5, "v12"],
      ["message-circle", "Chat group", 1450, 170, -4, "99+"],
      ["phone", "Phone call", 1690, 120, 8, "5"],
      ["file-text", "PDF", 860, 400, 6, "8"],
      ["mail", "E-mail", 1090, 360, -5, "14"],
      ["message-circle", "Chat group", 1330, 420, 7, "63"],
      ["file-spreadsheet", "Spreadsheet", 1580, 380, -8, "v7"],
      ["paperclip", "Attachment", 1740, 560, 5, "21"],
      ["phone", "Phone call", 960, 650, -6, "3"],
      ["mail", "E-mail", 1210, 640, 4, "52"],
      ["file-spreadsheet", "Spreadsheet", 1460, 680, -3, "final"],
    ];
    const c = (i) => [T[i][2] + 60, T[i][3] + 60];
    const links = [
      [0, 6],
      [1, 9],
      [2, 10],
      [3, 5],
      [4, 7],
      [0, 11],
      [8, 1],
      [6, 9],
      [2, 4],
      [5, 8],
      [3, 10],
      [7, 11],
      [1, 6],
    ];
    return `<svg class="tangle" viewBox="0 0 1920 1080">${links
      .map(([a, b], i) => {
        const [x1, y1] = c(a);
        const [x2, y2] = c(b);
        const mx = (x1 + x2) / 2 + (i % 2 ? 120 : -120);
        const my = (y1 + y2) / 2 + (i % 3 ? -90 : 110);
        return `<path class="a a-draw" pathLength="1" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" style="${at(0.9 + i * 0.09, 1.1)}"/>`;
      })
      .join("")}</svg>
      <div class="cloud">${T.map(
        ([icon, label, x, y, r, n], i) =>
          `<div class="tile-pos" style="left:${x}px;top:${y}px"><div class="a a-pop" style="${at(0.35 + i * 0.09, 0.6)}"><div class="tile" style="--r:${r}deg;--fd:${(3.2 + (i % 5) * 0.7).toFixed(1)}s;--fx:${i % 2 ? 9 : -9}px;--fy:${i % 3 ? -12 : 10}px">
            ${ctx.icon(icon)}<em>${n}</em><b>${label}</b></div></div></div>`,
      ).join("")}</div>
      <div class="copy">${head(ctx, p, 0.4, "h2")}</div>`;
  },

  /** Todos no mesmo portal: a marca no centro, os papéis em volta. */
  hub(s, ctx) {
    const p = s.props;
    const [cx, cy, rx, ry] = [960, 532, 730, 282];
    const nodes = p.roles.map((r, i) => {
      const a = ((15 + i * 30 - 90) * Math.PI) / 180;
      return { ...r, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
    });
    return `<div class="top"><div class="h2">${ctx.words(p.title, 0.9, 0.08)}</div></div>
      <svg class="spokes" viewBox="0 0 1920 1080">${nodes
        .map(
          (n, i) =>
            `<path class="a a-draw" pathLength="1" d="M${cx},${cy} L${n.x.toFixed(1)},${n.y.toFixed(1)}" style="${at(0.75 + i * 0.07, 0.7)}"/>`,
        )
        .join("")}</svg>
      ${nodes
        .map(
          (n, i) =>
            `<i class="pulse" style="offset-path:path('M${n.x.toFixed(1)},${n.y.toFixed(1)} L${cx},${cy}');--pd:${(2.2 + (i % 4) * 0.35).toFixed(2)}s;--pat:${(1.6 + i * 0.19).toFixed(2)}s"></i>`,
        )
        .join("")}
      <div class="ring r1"></div><div class="ring r2"></div>
      <div class="core a a-pop" style="${at(0.15, 0.9)}"><img src="/brand/wellmix-logo.svg" alt="" /></div>
      ${nodes
        .map(
          (n, i) =>
            `<div class="node" style="left:${n.x.toFixed(1)}px;top:${n.y.toFixed(1)}px"><div class="a a-pop" style="${at(0.95 + i * 0.07, 0.6)}"><span>${ctx.icon(n.icon)}</span><b>${ctx.esc(n.label)}</b></div></div>`,
        )
        .join("")}
      ${p.note ? `<div class="note a a-up" style="${at(when(s, { c: p.noteC }), 0.7)}">${ctx.icon("shield-check")}${ctx.esc(p.note)}</div>` : ""}`;
  },

  /** A jornada em blocos, acesos um a um com a narração. */
  journey(s, ctx) {
    const p = s.props;
    const n = p.blocks.length;
    return `<div class="top">${head(ctx, p, 0.35, "h3")}</div>
      <div class="rail"><i class="a a-grow" style="${at(s.cue[1] ?? 1, (s.cue[n] ?? n + 1) - (s.cue[1] ?? 1) + 1.2)};animation-timing-function:linear"></i></div>
      <div class="blocks n${n}" style="--n:${n}">${p.blocks
        .map(
          (
            b,
            i,
          ) => `<div class="a a-up" style="${at(0.5 + i * 0.1, 0.7)}"><div class="blk" style="${at((s.cue[i + 1] ?? 1 + i) - 0.1)}">
            <div class="n">0${i + 1}</div><div class="ico">${ctx.icon(b.icon)}</div>
            <div class="name">${ctx.esc(b.name)}</div>
            <ul>${b.steps.map((t) => `<li>${ctx.esc(t)}</li>`).join("")}</ul></div></div>`,
        )
        .join("")}</div>
      <div class="foot">${p.footer
        .map(
          (f, i) =>
            `<div class="pill a a-pop" style="${at(when(s, { c: p.footerC }) + 0.5 + i * 0.5, 0.6)}">${ctx.icon(f.icon)}${ctx.esc(f.label)}</div>`,
        )
        .join("")}</div>`;
  },

  /** Um papel: o que ele faz, com a tela real que ele vê. */
  role(s, ctx) {
    const p = s.props;
    return `<div class="copy">
        ${chip(ctx, p.role, p.icon, 0.25)}
        <div class="h2">${ctx.words(p.title, 0.4, 0.07)}</div>
        <div class="bullets">${p.bullets
          .map(
            (b) =>
              `<div class="bullet a a-up" style="${at(when(s, b) - 0.1, 0.7)}"><span class="ck">${ctx.icon("check")}</span><span>${b.t}</span></div>`,
          )
          .join("")}</div>
      </div>
      <div class="shot tilt" style="${at(0.15)};--float:${s.dur}s">${browser(ctx, p.shot, `--ox:${p.ox ?? "50%"};--oy:${p.oy ?? "20%"};--z1:${p.zoom ?? 1.1};--kd:${s.dur}s`)}</div>
      ${p.phone ? `<div class="hand tilt" style="${at(when(s, { c: 1 }) - 0.5)};--float:${s.dur}s">${phone(ctx, p.phone)}</div>` : ""}`;
  },

  /** Dois papéis lado a lado. */
  duo(s, ctx) {
    const p = s.props;
    return `${p.items
      .map((it, i) => {
        const t = i === 0 ? 0.25 : when(s, it) - 0.25;
        return `<div class="half ${i ? "right" : "left"}">
          ${chip(ctx, it.role, it.icon, t)}
          <div class="h3">${ctx.words(it.title, t + 0.15, 0.06)}</div>
          <div class="a a-up" style="${at(t + 0.2, 1)}">${browser(ctx, it.shot, `--w:848px;--ar:16/9;--ox:50%;--oy:${it.oy ?? "20%"};--z1:1.08;--kd:${s.dur}s`)}</div>
        </div>`;
      })
      .join("")}
      ${p.note ? `<div class="note a a-pop" style="${at(when(s, { c: p.noteC }) + 0.2, 0.7)}">${ctx.icon("shield-check")}${ctx.esc(p.note)}</div>` : ""}`;
  },

  /** Funções internas da Wellmix: um quadro por função. */
  team(s, ctx) {
    const p = s.props;
    return `<div class="top">${head(ctx, p, 0.3, "h3")}</div>
      <div class="grid">${p.tiles
        .map(
          (
            t,
            i,
          ) => `<div class="a a-up" style="${at(0.45 + i * 0.08, 0.7)}"><div class="fn" style="${at(when(s, t) - 0.05)}">
            <span class="ico">${ctx.icon(t.icon)}</span>
            <div><b>${ctx.esc(t.name)}</b><p>${ctx.esc(t.text)}</p></div></div></div>`,
        )
        .join("")}</div>`;
  },

  /** Comunicação: a conversa acontece em cima do pedido. */
  comms(s, ctx) {
    const p = s.props;
    const fixed = [0.9, 1.7, 2.5];
    return `<div class="copy">${head(ctx, p, 0.3, "h2")}
        <div class="cards">${(p.cards ?? [])
          .map(
            (c) =>
              `<div class="card a a-right" style="${at(when(s, c), 0.7)}"><span class="ico">${ctx.icon(c.icon)}</span><div><small>${ctx.esc(c.label)}</small><b>${ctx.esc(c.value)}</b></div></div>`,
          )
          .join("")}</div>
      </div>
      <div class="shot tilt" style="${at(0.15)};--float:${s.dur}s">${browser(ctx, p.shot, `--w:1080px;--ox:${p.ox ?? "62%"};--oy:${p.oy ?? "15%"};--z0:${p.zoom0 ?? 1.12};--z1:${p.zoom ?? 1.3};--kd:${s.dur}s`)}</div>
      ${(p.bubbles ?? [])
        .map(
          (b, i) =>
            `<div class="bubble b${i} ${b.side} a a-pop" style="${at(b.c != null ? when(s, b) : fixed[i], 0.6)}"><span class="av">${ctx.icon(b.icon)}</span><div><small>${ctx.esc(b.who)}</small><p>${ctx.esc(b.text)}</p></div></div>`,
        )
        .join("")}`;
  },

  /** O chat do portal no lugar dos e-mails: a tela real de Mensagens e, na
   *  frente, a mesma conversa no celular de quem está do outro lado. */
  chat(s, ctx) {
    const p = s.props;
    return `<div class="copy">${head(ctx, p, 0.3, "h2")}
        <div class="gone">${p.gone
          .map((g, i) => {
            const t = when(s, g) + i * 0.24;
            return `<div class="old a a-pop" style="${at(t, 0.5)}"><span style="${at(t + 0.5)}">${ctx.icon(g.icon)}${ctx.esc(g.label)}</span><i class="a a-grow" style="${at(t + 0.45, 0.4)}"></i></div>`;
          })
          .join("")}</div>
        <div class="chips">${p.chips
          .map(
            (c) =>
              `<div class="pill a a-right" style="${at(when(s, c), 0.7)}">${ctx.icon(c.icon)}${ctx.esc(c.label)}</div>`,
          )
          .join("")}</div>
      </div>
      <div class="shot tilt" style="${at(0.15)};--float:${s.dur}s">${browser(ctx, p.shot, `--w:1090px;--ox:${p.ox ?? "70%"};--oy:${p.oy ?? "40%"};--z0:${p.zoom0 ?? 1.1};--z1:${p.zoom ?? 1.3};--kd:${s.dur}s`)}</div>
      ${p.phone ? `<div class="hand tilt" style="${at(when(s, p.phoneAt ?? { c: 2 }) - 0.4)};--float:${s.dur}s">${phone(ctx, p.phone)}</div>` : ""}`;
  },

  /** Um passo feito no celular: a tela real muda a cada toque (o ponto branco
   *  é o dedo) e, no fim, o que foi enviado aparece na tela da Wellmix. */
  mobile(s, ctx) {
    const p = s.props;
    // Ponto do toque em pixels da captura (janela de 390 × 844) → % da tela
    // do aparelho, que começa 6 % abaixo por causa da barra de status.
    const pos = ([x, y]) =>
      `left:${((x / 390) * 100).toFixed(2)}%;top:${(6 + (y / 844) * 100).toFixed(2)}%`;
    const t = p.screens.map((sc, i) => (i === 0 ? 0 : when(s, sc)));
    const screens = p.screens
      .map(
        (sc, i) =>
          `<img ${i ? `class="a a-fade" style="${at(t[i], 0.35)}"` : ""} src="${ctx.shot(sc.shot)}" alt="" />`,
      )
      .join("");
    // O toque acontece meio segundo antes de a tela seguinte entrar.
    const taps = p.screens
      .map((sc, i) =>
        sc.tap && t[i + 1] != null
          ? `<i class="tap" style="${pos(sc.tap)};${at(t[i + 1] - 0.55)}"><b></b><u></u></i>`
          : "",
      )
      .join("");
    return `<div class="copy">
        ${chip(ctx, p.role, p.icon, 0.25)}
        <div class="h2">${ctx.words(p.title, 0.4, 0.07)}</div>
        <div class="bullets">${p.bullets
          .map(
            (b) =>
              `<div class="bullet a a-up" style="${at(when(s, b) - 0.1, 0.7)}"><span class="ck">${ctx.icon("check")}</span><span>${b.t}</span></div>`,
          )
          .join("")}</div>
      </div>
      ${p.desk ? mobileDesk(s, ctx, p.desk) : ""}
      <div class="device tilt" style="${at(0.15)};--float:${s.dur}s"><div class="phone"><div class="view">${screens}${taps}</div></div></div>`;
  },

  /** A mesma tela em português, inglês e chinês. */
  trio(s, ctx) {
    const p = s.props;
    const L = [
      ["pt", "Português"],
      ["en", "English"],
      ["zh", "中文"],
    ];
    return `<div class="top">${head(ctx, p, 0.3, "h2")}</div>
      <div class="fan">${L.map(
        (
          [l, name],
          i,
        ) => `<div class="leaf l${i}"><div class="a a-up" style="${at(0.5 + [0.15, 0, 0.3][i], 1.1)}">
          <div class="lang">${ctx.icon("languages")}${name}</div>
          <div class="browser" style="--oy:14%;--z1:1.06;--kd:${s.dur}s">
            <div class="bar"><i></i><i></i><i></i><span class="url">${ctx.icon("lock")}Portal Wellmix</span></div>
            <div class="view"><img src="shots/${p.dirs?.[l] ?? l}/${p.shot}.png" alt="" /></div>
          </div></div></div>`,
      ).join("")}</div>`;
  },

  /** Acesso por papel: o que cada um vê e o que fica oculto. */
  access(s, ctx) {
    const p = s.props;
    const mark = s.cue[2] ?? 99;
    return `<div class="top">${head(ctx, p, 0.3, "h3")}</div>
      <div class="views">${p.views
        .map(
          (
            v,
            i,
          ) => `<div class="view-card a a-up" style="${at(when(s, v) - 0.1, 0.8)}">
            <div class="who"><span class="dot">${ctx.icon(v.icon)}</span>${ctx.esc(v.role)}</div>
            <small>Sees</small>
            ${v.sees.map((t) => `<div class="row ok">${ctx.icon("eye")}${ctx.esc(t)}</div>`).join("")}
            <small>Never sees</small>
            <div class="${i === 0 ? "locks hot" : "locks"}" style="${at(mark)}">${v.hidden.map((t) => `<div class="row no">${ctx.icon("lock")}${ctx.esc(t)}</div>`).join("")}</div>
          </div>`,
        )
        .join("")}</div>`;
  },

  /** Uma tela real em destaque, com os pontos da narração ao lado. */
  focus(s, ctx) {
    const p = s.props;
    // Cada tela seguinte entra por cima, em fusão, na fala dela.
    const imgs = p.shots
      .map((sh, i) => {
        const t = i === 0 ? 0 : when(s, sh) - 0.25;
        const img = `<img src="${ctx.shot(sh.shot)}" alt="" style="--ox:${sh.ox ?? "50%"};--oy:${sh.oy ?? "25%"};--z1:${sh.zoom ?? 1.1};--kat:${t.toFixed(2)}s;--kd:${(s.dur - t).toFixed(2)}s"/>`;
        return i
          ? `<div class="layer a a-fade" style="${at(t, 0.6)}">${img}</div>`
          : img;
      })
      .join("");
    return `<div class="copy">${head(ctx, p, 0.3, "h2")}
        <div class="chips">${(p.chips ?? [])
          .map(
            (c) =>
              `<div class="pill a a-right" style="${at(when(s, c), 0.7)}">${ctx.icon(c.icon)}${ctx.esc(c.label)}</div>`,
          )
          .join("")}</div>
      </div>
      <div class="shot tilt" style="${at(0.15)};--float:${s.dur}s"><div class="browser" style="--w:1090px">
        <div class="bar"><i></i><i></i><i></i><span class="url">${ctx.icon("lock")}Portal Wellmix</span></div>
        <div class="view">${imgs}</div></div></div>`;
  },

  /** No computador e no celular. */
  devices(s, ctx) {
    const p = s.props;
    return `<div class="copy">${head(ctx, p, 0.3, "h2")}
        <div class="chips"><div class="pill a a-right" style="${at(when(s, p.chip) + 0.3, 0.7)}">${ctx.icon(p.chip.icon)}${ctx.esc(p.chip.label)}</div></div>
      </div>
      <div class="shot tilt" style="${at(0.15)};--float:${s.dur}s">${browser(ctx, p.shot, `--w:960px;--oy:20%;--z1:1.05;--kd:${s.dur}s`)}</div>
      ${p.phones.map((ph, i) => `<div class="hand p${i} tilt" style="${at(0.7 + i * 0.35)};--float:${s.dur}s">${phone(ctx, ph)}</div>`).join("")}`;
  },

  /** Encerramento: as três frases, a marca e a assinatura. */
  end(s, ctx) {
    const p = s.props;
    const t1 = p.lines.length ? (s.cue[1] ?? s.dur * 0.45) : 0.55;
    return `${worldMap(ctx, "dim")}
      <div class="halo"></div>
      <div class="lines" style="${at(t1 - 0.5)}">${p.lines
        .map(
          (l, i) =>
            `<div class="h1 a a-blur" style="${at(0.5 + i * 0.75, 0.9)}">${ctx.esc(l)}</div>`,
        )
        .join("")}</div>
      <div class="sign">
        <img class="a a-pop" style="${at(t1 - 0.1, 0.9)}" src="/brand/wellmix-logo.svg" alt="" />
        <div class="tag a a-up" style="${at(t1 + 0.7, 0.8)}">${ctx.esc(p.tagline)}</div>
        ${p.sub ? `<div class="sub a a-up" style="${at(t1 + 1.5, 0.8)}">${ctx.esc(p.sub)}</div>` : ""}
      </div>`;
  },
};
