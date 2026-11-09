import { describe, expect, it } from "vitest";
import { BUCKET_EXTENSIONS, BUCKET_MAX_BYTES } from "@/lib/db/schema";
import {
  ALLOWED_MIME,
  CHAT_EXTRA_MIME,
  MAX_DOCUMENT_BYTES,
} from "@/lib/services/documents";
import { storageFileName } from "@/lib/file-kinds";
import config from "../../appwrite.config.json";

/*
 * O armazenamento (Appwrite) só aceita as extensões da lista do bucket e
 * recusa as outras com "File extension not allowed". O portal aceitava vídeo,
 * Word, PowerPoint, texto, GIF e XML que o bucket recusava: aqui todo tipo
 * aceito nos documentos e no chat precisa ter a sua extensão na lista (e na
 * configuração gerada para o Appwrite).
 */

/** Extensões de cada tipo aceito (o .zip do Windows, o MOV do iPhone...). */
const EXTENSIONS: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg", "jfif"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "image/heif": ["heif"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.ms-excel.sheet.macroenabled.12": ["xlsm"],
  "application/vnd.ms-excel": ["xls"],
  "text/csv": ["csv"],
  "application/xml": ["xml"],
  "text/xml": ["xml"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  // Qualquer arquivo sem tipo conhecido: vale a extensão de cada um.
  "application/octet-stream": [],
  "application/postscript": ["eps", "ai", "ps"],
  "image/svg+xml": ["svg"],
  "image/vnd.adobe.photoshop": ["psd"],
  "application/x-photoshop": ["psd"],
  "application/illustrator": ["ai"],
  "application/cdr": ["cdr"],
  "application/x-cdr": ["cdr"],
  "image/x-cdr": ["cdr"],
  "image/tiff": ["tif", "tiff"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "docx",
  ],
  "application/vnd.ms-powerpoint": ["ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "pptx",
  ],
  "text/plain": ["txt"],
  "image/gif": ["gif"],
  "video/mp4": ["mp4", "m4v"],
  "video/quicktime": ["mov", "qt"],
  "video/webm": ["webm"],
  "video/3gpp": ["3gp"],
};

describe("extensões do armazenamento", () => {
  it("todo tipo aceito no portal tem a extensão na lista do bucket", () => {
    const bucket = new Set<string>(BUCKET_EXTENSIONS);
    for (const mime of [...ALLOWED_MIME, ...CHAT_EXTRA_MIME]) {
      // Tipo novo sem extensão aqui: acrescente aqui e no bucket.
      expect(EXTENSIONS[mime], mime).toBeDefined();
      for (const ext of EXTENSIONS[mime])
        expect(bucket.has(ext), `${mime} → .${ext}`).toBe(true);
    }
  });

  it("vídeo do iPhone e do Android, Word, PowerPoint, texto, GIF e XML entram", () => {
    for (const ext of [
      "mp4",
      "mov",
      "m4v",
      "webm",
      "3gp",
      "doc",
      "docx",
      "ppt",
      "pptx",
      "txt",
      "gif",
      "xml",
    ])
      expect(BUCKET_EXTENSIONS).toContain(ext);
  });

  it("a configuração gerada para o Appwrite é a mesma lista e o mesmo teto", () => {
    const [bucket] = config.buckets;
    expect(bucket.allowedFileExtensions).toEqual([...BUCKET_EXTENSIONS]);
    expect(bucket.maximumFileSize).toBe(BUCKET_MAX_BYTES);
    expect(MAX_DOCUMENT_BYTES).toBeLessThanOrEqual(BUCKET_MAX_BYTES);
    // A lista é em minúsculas: o nome guardado leva a extensão em minúsculas.
    for (const ext of BUCKET_EXTENSIONS) expect(ext).toBe(ext.toLowerCase());
    expect(storageFileName("IMG_0042.MOV")).toBe("IMG_0042.mov");
    expect(storageFileName("Relatório Final.PDF")).toBe("Relatório Final.pdf");
    expect(storageFileName("sem-extensao")).toBe("sem-extensao");
    expect(storageFileName("a.b.JPG")).toBe("a.b.jpg");
  });
});
