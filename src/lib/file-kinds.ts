/*
 * Como cada tipo de arquivo aparece no portal: miniatura na conversa (o
 * navegador mostra como imagem), aberto na própria aba (foto e PDF) ou só
 * baixado. SVG aparece em miniatura (dentro de <img> nenhum código roda), mas
 * nunca abre como página do portal, porque um SVG pode trazer código.
 */

const baseMime = (mime: string) => mime.toLowerCase().split(";")[0].trim();

/** Imagens que todo navegador mostra: viram miniatura na conversa. */
const PREVIEW_IMAGE = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

export function isPreviewImage(mime: string): boolean {
  return PREVIEW_IMAGE.has(baseMime(mime));
}

/**
 * Vídeos que tocam na própria conversa (MP4 e MOV do celular, WebM). 3GP
 * antigo e outros formatos aparecem como arquivo para baixar.
 */
const PLAYABLE_VIDEO = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

export function isPlayableVideo(mime: string): boolean {
  return PLAYABLE_VIDEO.has(baseMime(mime));
}

/** Abre na aba do navegador (foto e PDF); o resto baixa. SVG sempre baixa. */
export function opensInline(mime: string): boolean {
  const m = baseMime(mime);
  return (
    m === "application/pdf" || (m.startsWith("image/") && m !== "image/svg+xml")
  );
}

/** Tipo pela extensão, para a linha do anexo (PDF, JPG, MP4…). */
export function fileTypeLabel(name: string): string {
  const match = /\.([a-z0-9]{1,5})$/i.exec(name.trim());
  return match ? match[1].toUpperCase() : "";
}

/** Tamanho legível ("850 KB", "4,2 MB") no idioma da tela. */
export function fileSizeLabel(bytes: number, intl: string): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024)
    return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(intl)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString(intl, {
    maximumFractionDigits: 1,
  })} MB`;
}

/** Ícone do arquivo pela extensão (vídeo, PDF, planilha…). */
export function fileIcon(name: string): string {
  const ext = fileTypeLabel(name).toLowerCase();
  if (["mp4", "mov", "webm", "3gp", "m4v"].includes(ext)) return "🎬";
  if (ext === "pdf") return "📄";
  if (["xls", "xlsx", "xlsm", "csv"].includes(ext)) return "📊";
  if (["doc", "docx", "txt"].includes(ext)) return "📝";
  if (["ppt", "pptx"].includes(ext)) return "📽️";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  if (
    [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
      "heic",
      "heif",
      "tif",
      "tiff",
    ].includes(ext)
  )
    return "🖼️";
  return "📎";
}
