// Confere os módulos de treinamento (docs/treinamento/modulos/**/*.yaml).
// Uso: node scripts/treinamento-validar.mjs [pasta-ou-arquivo]
// Regras: docs/treinamento/FORMATO.md.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import yaml from "js-yaml";

const root = process.argv[2] ?? "docs/treinamento/modulos";
const TIPOS = ["unica", "multipla", "vf", "ordem"];
const LETRAS = ["a", "b", "c", "d", "e"];

function arquivos(p) {
  if (statSync(p).isFile()) return [p];
  return readdirSync(p).flatMap((n) => arquivos(join(p, n)));
}
const seg = (t) => {
  const m = /^(\d+):([0-5]\d)$/.exec(String(t ?? ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

let erros = 0;
let avisos = 0;
let perguntasTotal = 0;
let modulos = 0;
const ids = new Set();

for (const f of arquivos(root)
  .filter((x) => x.endsWith(".yaml"))
  .sort()) {
  const err = [];
  const aviso = [];
  const e = (m) => err.push(m);
  let d;
  try {
    d = yaml.load(readFileSync(f, "utf8"));
  } catch (x) {
    console.error(`✗ ${f}: YAML inválido: ${x.message.split("\n")[0]}`);
    erros++;
    continue;
  }
  modulos++;
  const id = basename(f, ".yaml");
  if (d?.episodio !== id)
    e(`episodio "${d?.episodio}" != nome do arquivo "${id}"`);
  for (const c of ["titulo", "serie", "papel", "duracao"])
    if (!d?.[c]) e(`falta ${c}`);
  if (d?.serie && !id.startsWith(d.serie + "-"))
    e(`serie ${d.serie} não bate com ${id}`);
  const dur = seg(d?.duracao);
  if (dur === null) e(`duracao "${d?.duracao}" fora de m:ss`);
  const idiomas = d?.idiomas ?? [];
  if (!idiomas.includes("pt")) e("idiomas deve conter pt");
  const multi = idiomas.filter((i) => i !== "pt");

  // capítulos
  const caps = d?.capitulos ?? [];
  if (caps.length < 2 || caps.length > 4)
    e(`${caps.length} capítulos (devem ser de 2 a 4)`);
  const capIds = new Set();
  let ultimo = 0;
  caps.forEach((c, i) => {
    if (!c.id?.startsWith(`${id}-C`))
      e(`capítulo ${i + 1}: id "${c.id}" deve começar com ${id}-C`);
    if (capIds.has(c.id)) e(`capítulo repetido ${c.id}`);
    capIds.add(c.id);
    if (!c.titulo) e(`${c.id}: falta titulo`);
    if (!c.resumo) e(`${c.id}: falta resumo`);
    const a = seg(c.inicio);
    const b = seg(c.fim);
    if (a === null || b === null) return e(`${c.id}: inicio/fim fora de m:ss`);
    if (b <= a) e(`${c.id}: fim antes do início`);
    if (b - a < 30) aviso.push(`${c.id}: capítulo de ${b - a}s (curto)`);
    if (b - a > 150) aviso.push(`${c.id}: capítulo de ${b - a}s (longo)`);
    if (i === 0 && a !== 0) e(`${c.id}: o primeiro capítulo começa em 0:00`);
    if (i > 0 && a !== ultimo)
      e(
        `${c.id}: começa em ${c.inicio}, mas o anterior termina em ${Math.floor(ultimo / 60)}:${String(ultimo % 60).padStart(2, "0")}`,
      );
    ultimo = b;
    if (
      !Array.isArray(c.cenas) ||
      c.cenas.length !== 2 ||
      c.cenas[0] > c.cenas[1]
    )
      e(`${c.id}: cenas deve ser [de, até]`);
    for (const l of multi)
      for (const k of ["titulo", "resumo"])
        if (!c[`${k}_${l}`]) e(`${c.id}: falta ${k}_${l}`);
  });
  if (dur !== null && caps.length && Math.abs(ultimo - dur) > 20)
    e(
      `capítulos terminam em ${ultimo}s, mas a duração é ${dur}s (diferença maior que 20 s)`,
    );
  const cenaMax = Math.max(0, ...caps.map((c) => c.cenas?.[1] ?? 0));

  // perguntas
  const ps = d?.perguntas ?? [];
  const esperado = id === "GER-00" ? 10 : 8;
  if (ps.length !== esperado)
    e(`${ps.length} perguntas (devem ser ${esperado})`);
  const nivel = { 1: 0, 2: 0, 3: 0 };
  let longest = 0;
  const posicao = {};
  ps.forEach((p, i) => {
    const q = p.id ?? `pergunta ${i + 1}`;
    perguntasTotal++;
    if (ids.has(p.id)) e(`${q}: id repetido`);
    ids.add(p.id);
    if (p.id !== `${id}-Q${i + 1}`) e(`${q}: id esperado ${id}-Q${i + 1}`);
    if (!TIPOS.includes(p.tipo)) e(`${q}: tipo "${p.tipo}"`);
    if (![1, 2, 3].includes(p.nivel)) e(`${q}: nivel "${p.nivel}"`);
    else nivel[p.nivel]++;
    if (!capIds.has(p.capitulo)) e(`${q}: capitulo "${p.capitulo}" não existe`);
    const cap = caps.find((c) => c.id === p.capitulo);
    if (cap && (p.cena < cap.cenas?.[0] || p.cena > cap.cenas?.[1]))
      e(
        `${q}: cena ${p.cena} fora das cenas do capítulo ${p.capitulo} (${cap.cenas})`,
      );
    if (!Number.isInteger(p.cena) || p.cena < 1 || p.cena > cenaMax)
      e(`${q}: cena "${p.cena}" inválida`);
    if (!p.enunciado || String(p.enunciado).length < 10)
      e(`${q}: enunciado ausente`);
    if (!p.explicacao || String(p.explicacao).length < 20)
      e(`${q}: explicacao ausente ou curta`);
    const ops = p.opcoes ?? {};
    const letras = Object.keys(ops);
    const n = letras.length;
    if (letras.some((l, k) => l !== LETRAS[k]))
      e(`${q}: opcoes devem ser a, b, c… em ordem`);
    if (letras.some((l) => !String(ops[l] ?? "").trim()))
      e(`${q}: opção vazia`);
    const c = p.correta ?? [];
    if (!Array.isArray(c) || !c.length) e(`${q}: correta vazia`);
    else if (c.some((l) => !letras.includes(l)))
      e(`${q}: correta cita letra inexistente`);
    else if (new Set(c).size !== c.length) e(`${q}: correta repete letra`);
    if (p.tipo === "unica" && (n < 3 || n > 4 || c.length !== 1))
      e(`${q}: unica pede 3-4 opções e 1 correta`);
    if (
      p.tipo === "multipla" &&
      (n < 4 || n > 5 || c.length < 2 || c.length >= n)
    )
      e(`${q}: multipla pede 4-5 opções e 2 ou mais corretas (não todas)`);
    if (p.tipo === "vf" && (n !== 2 || c.length !== 1))
      e(`${q}: vf pede 2 opções e 1 correta`);
    if (p.tipo === "ordem" && (n < 3 || n > 5 || c.length !== n))
      e(`${q}: ordem pede 3-5 passos e a sequência completa`);
    if (/todas as anteriores|nenhuma das anteriores/i.test(JSON.stringify(ops)))
      e(`${q}: "todas/nenhuma das anteriores" não vale`);
    if (p.tipo === "unica" && c.length === 1) {
      posicao[c[0]] = (posicao[c[0]] ?? 0) + 1;
      const maior = Math.max(...letras.map((l) => String(ops[l]).length));
      if (String(ops[c[0]]).length === maior) longest++;
    }
    for (const l of multi) {
      const t = p.traducoes?.[l];
      if (!t) e(`${q}: falta traducoes.${l}`);
      else {
        if (!t.enunciado || !t.explicacao)
          e(`${q}: traducoes.${l} sem enunciado/explicacao`);
        if (letras.some((k) => !String(t.opcoes?.[k] ?? "").trim()))
          e(`${q}: traducoes.${l} sem todas as opções`);
      }
    }
  });
  if (ps.length === esperado) {
    if (nivel[1] < 2) e(`só ${nivel[1]} pergunta(s) de nível 1 (mínimo 2)`);
    if (nivel[3] < 3) e(`só ${nivel[3]} pergunta(s) de nível 3 (mínimo 3)`);
  }
  const unicas = Object.values(posicao).reduce((a, b) => a + b, 0);
  if (unicas >= 4) {
    if (Math.max(...Object.values(posicao)) / unicas > 0.6)
      aviso.push(
        `a mesma letra é a certa em mais de 60% das perguntas únicas (${JSON.stringify(posicao)})`,
      );
    if (longest / unicas > 0.6)
      aviso.push(
        `a certa é a mais longa em ${longest} de ${unicas} perguntas únicas`,
      );
  }

  if (err.length) {
    erros += err.length;
    console.error(`✗ ${f}`);
    err.forEach((m) => console.error(`    ${m}`));
  }
  if (aviso.length) {
    avisos += aviso.length;
    console.warn(`! ${f}`);
    aviso.forEach((m) => console.warn(`    ${m}`));
  }
}

// trilhas: todo módulo citado precisa existir; avisa os módulos fora de qualquer trilha
if (root === "docs/treinamento/modulos") {
  const trilhas =
    yaml.load(readFileSync("docs/treinamento/trilhas.yaml", "utf8")) ?? [];
  const existentes = new Set(
    arquivos(root)
      .filter((x) => x.endsWith(".yaml"))
      .map((x) => basename(x, ".yaml")),
  );
  const usados = new Set();
  for (const t of trilhas) {
    for (const m of t.modulos ?? []) {
      usados.add(m);
      if (!existentes.has(m)) {
        console.error(`✗ trilha ${t.chave}: módulo ${m} não existe`);
        erros++;
      }
    }
    if (new Set(t.modulos).size !== (t.modulos ?? []).length) {
      console.error(`✗ trilha ${t.chave}: módulo repetido`);
      erros++;
    }
  }
  for (const m of existentes)
    if (!usados.has(m)) {
      console.warn(`! módulo ${m} não está em nenhuma trilha`);
      avisos++;
    }
  console.log(`${trilhas.length} trilhas conferidas.`);
}

console.log(
  `\n${modulos} módulos, ${perguntasTotal} perguntas, ${erros} erro(s), ${avisos} aviso(s).`,
);
process.exit(erros ? 1 : 0);
