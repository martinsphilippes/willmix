/*
 * Mapa-múndi dos vídeos institucionais: gera film/assets/world.json com os
 * contornos (Natural Earth 110m, pacote world-atlas) já projetados para um
 * quadro de 1920 × 1080, e os pontos das rotas (várias origens no exterior →
 * Brasil, como a abertura do portal mostra). Rodar: node map.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { geoNaturalEarth1, geoPath } from "d3-geo";

const topo = JSON.parse(
  readFileSync(
    new URL("./node_modules/world-atlas/countries-110m.json", import.meta.url),
  ),
);
const countries = feature(topo, topo.objects.countries).features.filter(
  (f) => f.properties.name !== "Antarctica",
);
const projection = geoNaturalEarth1().fitExtent(
  [
    [110, 120],
    [1810, 960],
  ],
  { type: "FeatureCollection", features: countries },
);
const path = geoPath(projection).digits(1);

const pick = (name) => countries.find((f) => f.properties.name === name);
const pt = (lon, lat) =>
  projection([lon, lat]).map((n) => Math.round(n * 10) / 10);

const out = {
  width: 1920,
  height: 1080,
  land: countries
    .filter((f) => !["China", "Brazil"].includes(f.properties.name))
    .map((f) => path(f))
    .filter(Boolean),
  china: path(pick("China")),
  brazil: path(pick("Brazil")),
  points: {
    // Portos e praças reais do fluxo (longitude, latitude).
    shenzhen: pt(114.06, 22.54),
    // Outras origens (a Wellmix não importa só da China): pontos sem rótulo,
    // em regiões que a vinheta do portal também mostra.
    hoChiMinh: pt(106.66, 10.82),
    mumbai: pt(72.88, 19.08),
    istanbul: pt(28.98, 41.01),
    genoa: pt(8.93, 44.41),
    yiwu: pt(120.07, 29.31),
    shanghai: pt(121.47, 31.23),
    santos: pt(-46.33, -23.96),
    saoPaulo: pt(-46.63, -23.55),
    // Rota marítima China → Brasil (pelo Índico e o Cabo): pontos de passagem.
    singapore: pt(103.82, 1.29),
    cape: pt(18.42, -35.5),
    midAtlantic: pt(-15, -30),
  },
};
// film/assets não é versionada (só tem arquivos gerados): cria na primeira vez.
mkdirSync(new URL("./film/assets/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("./film/assets/world.json", import.meta.url),
  JSON.stringify(out),
);
console.log(
  "world.json",
  out.land.length,
  "países,",
  JSON.stringify(out.points),
);
