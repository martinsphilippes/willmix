// Gera, a partir dos módulos de treinamento e dos roteiros, dois documentos de leitura:
//   docs/treinamento/livro/<SÉRIE>.md   as perguntas e os capítulos de cada vídeo, legíveis
//   docs/treinamento/PLANO-DE-PRODUCAO.md   um quadro com tudo o que se precisa para gravar cada vídeo
// Uso: node scripts/treinamento-livro.mjs   (rode de novo depois de editar módulos ou roteiros)
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

const MODULOS = "docs/treinamento/modulos";
const LIVRO = "docs/treinamento/livro";
const VIDEOS = "docs/videos";

const arquivos = (p) =>
  statSync(p).isFile()
    ? [p]
    : readdirSync(p)
        .sort()
        .flatMap((n) => arquivos(join(p, n)));

const modulos = arquivos(MODULOS)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => yaml.load(readFileSync(f, "utf8")))
  .sort((a, b) => a.episodio.localeCompare(b.episodio));

const trilhas = yaml.load(
  readFileSync("docs/treinamento/trilhas.yaml", "utf8"),
);
const trilhasDe = (id) =>
  trilhas.filter((t) => t.modulos.includes(id)).map((t) => t.nome);

// fichas dos roteiros
const fichas = {};
for (const f of readdirSync(VIDEOS).filter((n) => /^\d\d-.*\.md$/.test(n))) {
  const txt = readFileSync(join(VIDEOS, f), "utf8");
  const partes = txt.split(/^## (?=[A-Z]{3}-\d\d · )/m).slice(1);
  for (const p of partes) {
    const id = p.slice(0, 6);
    const ficha = {};
    for (const m of p.matchAll(/^\| ([^|]+?) +\| (.+?) +\|$/gm))
      ficha[m[1].trim()] = m[2].trim();
    fichas[id] = { ...ficha, arquivo: f };
  }
}

const NOMES = {
  GER: "Primeiros passos",
  CLI: "Cliente",
  FOR: "Fornecedor",
  AGE: "Agência",
  DES: "Despachante",
  COM: "Comex (assessoria)",
  LOG: "Agente de carga",
  MAR: "Companhia marítima",
  TRA: "Transportador",
  JUR: "Jurídico",
  OCP: "OCP (certificação)",
  WBK: "Wellmix · Booking e produto",
  WSO: "Wellmix · Solicitação, cotação e proposta",
  WPE: "Wellmix · Pedido",
  WLO: "Wellmix · Logística e estoque",
  WCA: "Wellmix · Cadastros",
  WGE: "Wellmix · Gestão",
};
const TIPO = {
  unica: "uma resposta",
  multipla: "várias respostas",
  vf: "verdadeiro ou falso",
  ordem: "colocar na ordem",
};
const NIVEL = { 1: "lembrar", 2: "aplicar", 3: "decidir" };
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

// ---- livro por série
mkdirSync(LIVRO, { recursive: true });
const series = [...new Set(modulos.map((m) => m.serie))];
for (const s of series) {
  const ms = modulos.filter((m) => m.serie === s);
  let out = `# Livro de perguntas · ${NOMES[s] ?? s}\n\n`;
  out += `> Gerado por \`node scripts/treinamento-livro.mjs\` a partir de \`docs/treinamento/modulos/${s}/\`. **Não edite aqui:** edite o YAML do módulo e gere de novo. A letra marcada com ✔ é a resposta certa.\n\n`;
  out +=
    ms
      .map(
        (m) =>
          `- [${m.episodio} · ${m.titulo}](#${m.episodio.toLowerCase()}-${m.titulo
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9 -]/g, "")
            .trim()
            .replace(/ +/g, "-")})`,
      )
      .join("\n") + "\n\n";
  for (const m of ms) {
    out += `---\n\n## ${m.episodio} · ${m.titulo}\n\n`;
    out += `**Duração** ${m.duracao} · **Capítulos** ${m.capitulos.length} · **Perguntas** ${m.perguntas.length} · **Idiomas** ${m.idiomas.join(", ")}\n\n`;
    const tr = trilhasDe(m.episodio);
    out += `**Quem assiste:** ${tr.length ? tr.join("; ") : "(nenhuma trilha)"}\n\n`;
    out += `### Capítulos (mini vídeos)\n\n`;
    for (const c of m.capitulos)
      out += `${m.capitulos.indexOf(c) + 1}. \`${c.inicio}–${c.fim}\` · **${c.titulo}** (cenas ${c.cenas[0]} a ${c.cenas[1]}): ${c.resumo}\n`;
    out += `\n### Perguntas\n\n`;
    for (const p of m.perguntas) {
      const cap = m.capitulos.findIndex((c) => c.id === p.capitulo) + 1;
      out += `**${p.id.replace(`${m.episodio}-`, "")}** · nível ${p.nivel} (${NIVEL[p.nivel]}) · ${TIPO[p.tipo]} · capítulo ${cap}, cena ${p.cena}\n\n${p.enunciado}\n\n`;
      if (p.tipo === "ordem") {
        const certa = p.correta;
        for (const k of Object.keys(p.opcoes))
          out += `- ${k.toUpperCase()}) ${p.opcoes[k]}\n`;
        out += `\nOrdem certa: ${certa.map((k) => k.toUpperCase()).join(" → ")}\n`;
      } else {
        for (const k of Object.keys(p.opcoes))
          out += `- ${p.correta.includes(k) ? "✔ " : ""}${k.toUpperCase()}) ${p.opcoes[k]}\n`;
      }
      out += `\n> ${p.explicacao}\n\n`;
    }
  }
  writeFileSync(join(LIVRO, `${s}.md`), out);
}

// ---- plano de produção
let plano = `# Plano de produção dos vídeos de treinamento\n\n`;
plano += `> Gerado por \`node scripts/treinamento-livro.mjs\` a partir dos módulos e das fichas dos roteiros. Para gravar um vídeo, abra o roteiro dele (coluna **Roteiro**) e o ponto de salvamento indicado. A ordem de gravação da Jornada da Jarra está em [docs/videos/README.md](../videos/README.md).\n\n`;
const total = modulos.reduce((a, m) => {
  const [x, y] = m.duracao.split(":");
  return a + +x * 60 + +y;
}, 0);
plano += `**${modulos.length} vídeos**, ${Math.floor(total / 3600)} h ${Math.round((total % 3600) / 60)} min, ${modulos.reduce((a, m) => a + m.capitulos.length, 0)} capítulos, ${modulos.reduce((a, m) => a + m.perguntas.length, 0)} perguntas.\n\n`;
plano += `## Quadro geral\n\n| Série | Vídeo | Duração | Cap. | Perg. | Idiomas | Conta de gravação | Quem assiste |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n`;
for (const m of modulos) {
  const f = fichas[m.episodio] ?? {};
  plano += `| ${m.serie} | [${m.episodio}](livro/${m.serie}.md) · ${esc(m.titulo)} | ${m.duracao} | ${m.capitulos.length} | ${m.perguntas.length} | ${m.idiomas.join(", ")} | ${esc(f["Conta de gravação"] ?? "")} | ${esc(trilhasDe(m.episodio).join("; "))} |\n`;
}
plano += `\n## O que cada vídeo precisa\n\nPara cada vídeo: as telas e rotas que aparecem, os dados que precisam estar prontos antes de gravar, onde ele cai na jornada e o que fica pronto para o próximo.\n\n`;
for (const s of series) {
  plano += `### ${NOMES[s] ?? s}\n\n`;
  for (const m of modulos.filter((x) => x.serie === s)) {
    const f = fichas[m.episodio] ?? {};
    plano += `#### ${m.episodio} · ${m.titulo}\n\n`;
    plano += `- **Roteiro:** [${f.arquivo}](../videos/${f.arquivo}) · ${m.duracao}\n`;
    for (const k of [
      "Ponto da jornada",
      "Conta de gravação",
      "Telas e rotas",
      "Dados antes de gravar",
      "Depois deste vídeo",
      "Antes · Próximo",
    ])
      if (f[k]) plano += `- **${k}:** ${f[k]}\n`;
    plano += `- **Capítulos:** ${m.capitulos.map((c) => `${c.inicio} ${c.titulo}`).join(" · ")}\n\n`;
  }
}
writeFileSync("docs/treinamento/PLANO-DE-PRODUCAO.md", plano);
console.log(`${series.length} livros e o plano de produção gerados.`);
