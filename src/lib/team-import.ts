import type { JobLevel, WellmixFunction } from "@/lib/db/schema";
import {
  areaNameKey,
  cleanAreaName,
  findAreaByName,
  isHeaderLine,
  type AreaLike,
} from "./team-areas";
import { findPositionByName, type PositionLike } from "./team-positions";

/*
 * Importar equipe (Equipe Acessos e Parceiros → Equipe → "Importar da
 * planilha"; dono, 16/11/2026; docs/ACCESS.md, "Importar equipe"). Regras
 * sem banco (a prévia, a importação e os testes usam as mesmas):
 *
 * - Uma pessoa por linha: Nome, Cargo, Área e Email, separados por
 *   tabulação (colado da planilha) ou ";". A linha de títulos manda na ordem
 *   das colunas; sem ela, vale Nome, Cargo, Área, Email.
 * - Cargo e área pelo nome cadastrado (sem contar maiúsculas, acentos e
 *   pontuação). O cargo com área manda na área da pessoa (como em Editar
 *   acessos); a área da planilha vale quando o cargo não tem área.
 * - Funções e nível sugeridos pelo cargo (tabela abaixo). O que não dá para
 *   afirmar fica "a conferir", com o motivo, para o detalhamento à mão.
 */

export interface TeamImportLine {
  /** Número da linha no texto colado (1 = a primeira). */
  line: number;
  name: string;
  position: string;
  area: string;
  email: string;
  /** Marca que veio junto do e-mail na planilha (ex.: "*"); a conferir. */
  emailNote?: string | null;
}

export interface TeamImportParse {
  rows: TeamImportLine[];
  header: string | null;
  /** Linhas recusadas: sem nome, sem e-mail válido ou repetidas. */
  invalid: { line: number; text: string; reason: "name" | "email" }[];
  repeated: { line: number; email: string }[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** E-mail com marca no fim ("fulano@x.com *"): o e-mail e a marca. */
const MARKED_EMAIL = /^([^\s@]+@[^\s@]+\.[^\s@*]+)\s*(\*+)$/;

type Column = "name" | "position" | "area" | "email";
const DEFAULT_ORDER: (Column | null)[] = ["name", "position", "area", "email"];

/** A coluna pelo título ("Nome", "Cargo", "Área", "E-mail"). */
function columnOf(title: string): Column | null {
  const key = areaNameKey(title);
  if (/^(nome|name|colaborador|funcionario|pessoa)\b/.test(key)) return "name";
  if (/^(cargo|cargos|position|funcao)\b/.test(key)) return "position";
  if (/^(area|areas|setor|departamento)\b/.test(key)) return "area";
  if (/^(e ?mail|email|login)\b/.test(key)) return "email";
  return null;
}

const cells = (line: string) =>
  (line.includes("\t") ? line.split("\t") : line.split(";")).map(cleanAreaName);

/** Lê o texto colado: as pessoas, o título e as linhas recusadas. */
export function parseTeamImport(text: string): TeamImportParse {
  const out: TeamImportParse = {
    rows: [],
    header: null,
    invalid: [],
    repeated: [],
  };
  const lines = text.split(/\r?\n/);
  let order = DEFAULT_ORDER;
  const seen = new Set<string>();
  lines.forEach((raw, index) => {
    if (!raw.trim()) return;
    const parts = cells(raw);
    // Títulos: a primeira linha com palavras de título (Nome, Cargo...).
    if (!out.header && !out.rows.length && !out.invalid.length) {
      const titles = parts.map(columnOf);
      if (
        titles.filter(Boolean).length >= 2 ||
        (parts.length === 1 && isHeaderLine(parts[0]))
      ) {
        out.header = parts.join(" | ");
        // Coluna sem título conhecido (Matrícula, Telefone...) fica de fora.
        if (titles.filter(Boolean).length >= 2) order = titles;
        return;
      }
    }
    const pick = (c: Column) => {
      const at = order.indexOf(c);
      return at >= 0 ? (parts[at] ?? "") : "";
    };
    let email = pick("email").toLowerCase();
    let emailNote: string | null = null;
    // E-mail com "*" no fim (marca da planilha): entra sem o "*", a conferir.
    const marked = MARKED_EMAIL.exec(email);
    if (marked) {
      email = marked[1];
      emailNote = `E-mail com ${marked[2]} na planilha`;
    }
    // E-mail fora do lugar: a célula que tem "@".
    if (!EMAIL.test(email))
      email = (
        parts.find((p) => EMAIL.test(p.toLowerCase())) ?? email
      ).toLowerCase();
    const row: TeamImportLine = {
      line: index + 1,
      name: pick("name"),
      position: pick("position"),
      area: pick("area"),
      email,
      ...(emailNote ? { emailNote } : {}),
    };
    if (row.name.length < 2) {
      out.invalid.push({ line: row.line, text: raw.trim(), reason: "name" });
      return;
    }
    if (!EMAIL.test(row.email)) {
      out.invalid.push({ line: row.line, text: raw.trim(), reason: "email" });
      return;
    }
    if (seen.has(row.email)) {
      out.repeated.push({ line: row.line, email: row.email });
      return;
    }
    seen.add(row.email);
    out.rows.push(row);
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Funções e nível sugeridos pelo cargo                                */
/* ------------------------------------------------------------------ */

export interface PositionSuggestion {
  functions: WellmixFunction[];
  level: JobLevel;
  /** Certo o bastante para não pedir conferência da função. */
  sure: boolean;
  /** O que conferir (quando não é certo). */
  doubt: string | null;
}

interface Rule {
  /** Palavras (na chave do nome do cargo) que ligam a regra. */
  match: RegExp;
  functions: WellmixFunction[];
  sure: boolean;
  doubt?: string;
}

/*
 * Do mais específico ao mais geral: a primeira regra que bate vale. As
 * funções são as do portal (Equipe → Funções e acessos).
 */
const RULES: Rule[] = [
  {
    match: /\bgerente nacional de vendas\b/,
    functions: ["sales"],
    sure: false,
    doubt: "Vendas; conferir se precisa também de aprovações ou painéis",
  },
  {
    match: /\b(vendedor|vendedora|vendas|key accounts|comercial)\b/,
    functions: ["sales"],
    sure: true,
  },
  { match: /\bcompras\b/, functions: ["buyer"], sure: true },
  {
    match: /\bplanejamento\b/,
    functions: ["planner"],
    sure: false,
    doubt:
      "Planner; conferir: o Planner do portal aprova o pré-custo e acompanha ETD, containers e fretes",
  },
  {
    match: /\b(importacao|comex)\b/,
    functions: ["comex_internal"],
    sure: true,
  },
  { match: /\bdesigner\b/, functions: ["designer"], sure: true },
  {
    match: /\bembalage(m|ns)\b/,
    functions: ["designer"],
    sure: false,
    doubt: "Designer (embalagens); conferir se é isso",
  },
  {
    match: /\b(financeiro|contas a pagar)\b/,
    functions: ["finance"],
    sure: true,
  },
  {
    match: /\b(contas a receber|credito|cobranca)\b/,
    functions: ["finance"],
    sure: false,
    doubt:
      "Financeiro; conferir: no portal o Financeiro valida e paga o numerário",
  },
  {
    match: /\bfiscal\b/,
    functions: [],
    sure: false,
    doubt: "sem função; conferir se precisa de Cadastro (NCM) ou Financeiro",
  },
  {
    match: /\bdiretor(a)?\b/,
    functions: ["executive_director"],
    sure: false,
    doubt: "Diretoria executiva; conferir se é Diretoria de compras",
  },
  {
    match: /\b(trade marketing|merchandising|eventos|marketing)\b/,
    functions: [],
    sure: false,
    doubt: "sem função; conferir se precisa de Designer ou Gerente de produto",
  },
  {
    match: /\b(operacoes|processos|pmo)\b/,
    functions: [],
    sure: false,
    doubt: "sem função; conferir se precisa de Planner ou Comex interno",
  },
  {
    match: /\b(ti|automacao|bi)\b/,
    functions: [],
    sure: false,
    doubt: "sem função; conferir o que a pessoa precisa abrir",
  },
];

/** Nível pelo cargo: Diretor, Gerente, Coordenador, Supervisor ou Analista. */
export function levelOfPosition(name: string): JobLevel {
  const key = areaNameKey(name);
  if (/\bdiretor(a)?\b/.test(key)) return "director";
  if (/\bgerente\b/.test(key)) return "manager";
  if (/\bcoordenador(a)?\b/.test(key)) return "coordinator";
  if (/\bsupervisor(a)?\b/.test(key)) return "supervisor";
  return "analyst";
}

/** Funções e nível sugeridos pelo nome do cargo. */
export function suggestFromPosition(name: string): PositionSuggestion {
  const key = areaNameKey(name);
  const level = levelOfPosition(name);
  if (!key)
    return {
      functions: [],
      level,
      sure: false,
      doubt: "sem cargo; conferir cargo, área e funções",
    };
  const rule = RULES.find((r) => r.match.test(key));
  if (!rule)
    return {
      functions: [],
      level,
      sure: false,
      doubt: "sem função; conferir o que a pessoa precisa abrir",
    };
  return {
    functions: [...rule.functions],
    level,
    sure: rule.sure,
    doubt: rule.sure ? null : (rule.doubt ?? null),
  };
}

/* ------------------------------------------------------------------ */
/* A proposta para cada pessoa                                         */
/* ------------------------------------------------------------------ */

export interface TeamImportProposal extends TeamImportLine {
  positionId: string | null;
  /** Nome do cargo como está cadastrado (ou o da planilha, se não achou). */
  positionName: string;
  areaId: string | null;
  areaName: string | null;
  functions: WellmixFunction[];
  level: JobLevel;
  /** O que conferir à mão; vazio = nada a conferir. */
  review: string[];
}

/**
 * A área da planilha entre as cadastradas: o mesmo nome ou, se não houver,
 * a área cujo nome é o começo do da planilha ("Showroom Recife" → Showroom,
 * "Comercial ADM Vendas" → Comercial; o começo mais longo vale).
 */
export function matchSheetArea<T extends AreaLike>(
  name: string,
  areas: T[],
): T | null {
  const exact = findAreaByName(name, areas);
  if (exact) return exact;
  const key = areaNameKey(name);
  if (!key) return null;
  return (
    areas
      .filter((a) => a.active)
      .map((a) => ({ a, k: areaNameKey(a.name) }))
      .filter(({ k }) => k && key.startsWith(`${k} `))
      .sort((x, y) => y.k.length - x.k.length)[0]?.a ?? null
  );
}

/** A proposta de cada linha: cargo, área, funções, nível e o que conferir. */
export function proposeTeamImport(
  rows: TeamImportLine[],
  positions: PositionLike[],
  areas: AreaLike[],
): TeamImportProposal[] {
  return rows.map((row) => {
    const review: string[] = [];
    const position = row.position
      ? findPositionByName(row.position, positions)
      : null;
    if (row.position && !position)
      review.push(`Cargo "${row.position}" não está cadastrado em Cargos`);
    if (position && !position.active)
      review.push(`Cargo "${position.name}" está desativado`);
    if (row.emailNote) review.push(`${row.emailNote}: conferir o e-mail`);
    const sheetArea = row.area ? matchSheetArea(row.area, areas) : null;
    if (row.area && !sheetArea)
      review.push(`Área "${row.area}" não está cadastrada em Áreas`);
    let areaId: string | null = null;
    let areaName: string | null = null;
    const positionArea = position?.areaId
      ? (areas.find((a) => a.id === position.areaId) ?? null)
      : null;
    if (positionArea) {
      areaId = positionArea.id;
      areaName = positionArea.name;
      if (sheetArea && sheetArea.id !== positionArea.id)
        review.push(
          `Área na planilha: "${sheetArea.name}"; o cargo está em "${positionArea.name}"`,
        );
    } else if (sheetArea) {
      areaId = sheetArea.id;
      areaName = sheetArea.name;
    }
    const suggestion = suggestFromPosition(position?.name ?? row.position);
    if (suggestion.doubt) review.push(`Função: ${suggestion.doubt}`);
    return {
      ...row,
      positionId: position?.id ?? null,
      positionName: position?.name ?? row.position,
      areaId,
      areaName,
      functions: suggestion.functions,
      level: suggestion.level,
      review,
    };
  });
}

/** O texto do "a conferir" gravado no login (até 500 caracteres). */
export function reviewNoteOf(review: string[]): string | null {
  const text = review.join(". ").trim();
  return text ? text.slice(0, 500) : null;
}

/** Chave do e-mail (para achar quem já tem login). */
export const emailKey = (email: string) => email.trim().toLowerCase();

export { areaNameKey };
