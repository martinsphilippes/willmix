/*
 * Gerador mínimo de PDF (texto, linhas e caixas preenchidas; A4 em pé ou
 * deitado), sem dependências: serve para documentos simples como o do pedido
 * (docs/ORDER_SIGNATURE.md). Usa as
 * fontes padrão Helvetica e Helvetica-Bold com WinAnsi: cobre português e
 * inglês com acentos. Caracteres fora disso (chinês, por exemplo) são
 * omitidos: a página do portal continua sendo a versão completa.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;

/** Caracteres do WinAnsi que não estão no Latin-1 (0x80 a 0x9F). */
const WIN_ANSI_EXTRA: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "™": 0x99,
};

/** Texto → bytes WinAnsi dentro de um literal PDF "( … )". */
function pdfString(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63;
    let byte: number;
    if (code === 0x09) byte = 0x20;
    else if (code >= 0x20 && code <= 0x7e) byte = code;
    else if (code >= 0xa0 && code <= 0xff) byte = code;
    else if (WIN_ANSI_EXTRA[ch] !== undefined) byte = WIN_ANSI_EXTRA[ch];
    // Fora do WinAnsi (chinês, emoji): omitido.
    else continue;
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += "\\";
    out += String.fromCharCode(byte);
  }
  return out;
}

/** Largura aproximada do texto em Helvetica (em pontos). */
export function pdfTextWidth(text: string, size: number, bold = false): number {
  let em = 0;
  for (const ch of text) {
    if (/[0-9]/.test(ch)) em += 0.556;
    else if (/[ .,:;'|!ijl]/.test(ch)) em += 0.278;
    else if (/[A-ZÀ-Ý]/.test(ch)) em += 0.68;
    else if (/[mwMW@%]/.test(ch)) em += 0.86;
    else em += 0.53;
  }
  return em * size * (bold ? 1.06 : 1);
}

/** Quebra o texto em linhas que cabem na largura. */
export function pdfWrap(
  text: string,
  size: number,
  maxWidth: number,
  bold = false,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      // Palavra maior que a largura (código, link): quebra no meio.
      while (pdfTextWidth(word, size, bold) > maxWidth && word.length > 1) {
        let cut = word.length - 1;
        while (
          cut > 1 &&
          pdfTextWidth(word.slice(0, cut), size, bold) > maxWidth
        )
          cut--;
        if (line) lines.push(line);
        lines.push(word.slice(0, cut));
        line = "";
        word = word.slice(cut);
      }
      const next = line ? `${line} ${word}` : word;
      if (line && pdfTextWidth(next, size, bold) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

/** Cor RGB, cada canal de 0 a 1. */
export type PdfColor = [number, number, number];

export class SimplePdf {
  /** A4 em pé (o padrão); a instância diz o tamanho real da página dela. */
  static readonly width = PAGE_W;
  static readonly height = PAGE_H;
  readonly width: number;
  readonly height: number;
  private pages: string[][] = [[]];

  constructor(options: { landscape?: boolean } = {}) {
    this.width = options.landscape ? PAGE_H : PAGE_W;
    this.height = options.landscape ? PAGE_W : PAGE_H;
  }

  private get page() {
    return this.pages[this.pages.length - 1];
  }

  addPage() {
    this.pages.push([]);
  }

  get pageCount() {
    return this.pages.length;
  }

  /** Texto com a origem no canto de cima à esquerda (y cresce para baixo). */
  text(
    x: number,
    y: number,
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      /** "center": `x` é o meio do texto. */
      align?: "left" | "right" | "center";
      color?: PdfColor;
    } = {},
  ) {
    const size = opts.size ?? 10;
    const width = pdfTextWidth(text, size, opts.bold);
    const left =
      opts.align === "right"
        ? x - width
        : opts.align === "center"
          ? x - width / 2
          : x;
    const color = opts.color
      ? `${opts.color.map(n).join(" ")} rg `
      : "0 0 0 rg ";
    this.page.push(
      `BT ${color}/${opts.bold ? "F2" : "F1"} ${n(size)} Tf ${n(left)} ${n(this.height - y)} Td (${pdfString(text)}) Tj ET`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, width = 0.6) {
    this.page.push(
      `${n(width)} w ${n(x1)} ${n(this.height - y1)} m ${n(x2)} ${n(this.height - y2)} l S`,
    );
  }

  rect(x: number, y: number, w: number, h: number, width = 0.6) {
    this.page.push(
      `${n(width)} w ${n(x)} ${n(this.height - y - h)} ${n(w)} ${n(h)} re S`,
    );
  }

  /** Caixa preenchida (ex.: faixa cinza de título), sem contorno. */
  fillRect(x: number, y: number, w: number, h: number, color: PdfColor) {
    this.page.push(
      `${color.map(n).join(" ")} rg ${n(x)} ${n(this.height - y - h)} ${n(w)} ${n(h)} re f`,
    );
  }

  build(): Uint8Array {
    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };
    const catalogId = add("");
    const pagesId = add("");
    const f1 = add(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    );
    const f2 = add(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    );
    const kids: number[] = [];
    for (const ops of this.pages) {
      const stream = ops.join("\n");
      const contentId = add(
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      );
      kids.push(
        add(
          `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n(this.width)} ${n(this.height)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentId} 0 R >>`,
        ),
      );
    }
    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] =
      `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
    let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets)
      out += `${String(offset).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    // Cada caractere do texto montado é um byte (WinAnsi / Latin-1).
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
