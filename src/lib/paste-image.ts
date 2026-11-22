import type { ClipboardEvent } from "react";

/**
 * Imagem colada num campo de mensagem (dono, 22/11/2026;
 * docs/SUPPLIER_SAMPLING.md, "Imagens na tela do item"): vai para o campo de
 * arquivo do formulário, como anexo da mensagem. Devolve o nome do arquivo
 * ou nulo (não havia imagem; o texto colado segue normalmente).
 */
export function attachPastedImage(
  event: ClipboardEvent<HTMLTextAreaElement>,
  input: HTMLInputElement | null,
): string | null {
  const image = Array.from(event.clipboardData?.files ?? []).find((f) =>
    f.type.startsWith("image/"),
  );
  if (!image || !input) return null;
  event.preventDefault();
  const ext = image.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const file = new File([image], image.name || `imagem-colada.${ext}`, {
    type: image.type,
  });
  const data = new DataTransfer();
  data.items.add(file);
  input.files = data.files;
  return file.name;
}
