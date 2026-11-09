import { describe, expect, it } from "vitest";
import {
  fileIcon,
  fileSizeLabel,
  fileTypeLabel,
  isPreviewImage,
  opensInline,
} from "@/lib/file-kinds";

/*
 * Como cada arquivo aparece: miniatura na conversa (imagem que o navegador
 * mostra), aberto na aba (foto e PDF) ou baixado. SVG vira miniatura, mas
 * nunca abre como página (pode trazer código).
 */
describe("tipos de arquivo", () => {
  it("miniatura só para imagens que o navegador mostra", () => {
    for (const mime of [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/svg+xml",
      "IMAGE/JPEG",
    ])
      expect(isPreviewImage(mime)).toBe(true);
    for (const mime of [
      "image/tiff",
      "image/heic",
      "image/vnd.adobe.photoshop",
      "application/pdf",
      "video/mp4",
    ])
      expect(isPreviewImage(mime)).toBe(false);
  });

  it("abre na aba: foto e PDF; SVG, vídeo, planilha e o resto baixam", () => {
    expect(opensInline("image/jpeg")).toBe(true);
    expect(opensInline("image/heic")).toBe(true);
    expect(opensInline("application/pdf")).toBe(true);
    expect(opensInline("image/svg+xml")).toBe(false);
    expect(opensInline("image/svg+xml; charset=utf-8")).toBe(false);
    expect(opensInline("video/mp4")).toBe(false);
    expect(opensInline("text/xml")).toBe(false);
    expect(opensInline("application/zip")).toBe(false);
  });

  it("tipo, tamanho e ícone para a linha do anexo", () => {
    expect(fileTypeLabel("amostra final.MOV")).toBe("MOV");
    expect(fileTypeLabel("sem-extensao")).toBe("");
    expect(fileSizeLabel(850 * 1024, "pt-BR")).toBe("850 KB");
    expect(fileSizeLabel(4.25 * 1024 * 1024, "pt-BR")).toBe("4,3 MB");
    expect(fileSizeLabel(0, "pt-BR")).toBe("");
    expect(fileIcon("amostra.mp4")).toBe("🎬");
    expect(fileIcon("proposta.pdf")).toBe("📄");
    expect(fileIcon("packing.xlsx")).toBe("📊");
    expect(fileIcon("contrato.docx")).toBe("📝");
    expect(fileIcon("arte.cdr")).toBe("📎");
  });
});
