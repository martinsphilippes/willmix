import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { canAccessDocument } from "@/lib/services/documents";
import { recordAck } from "@/lib/services/acknowledgements";
import { opensInline } from "@/lib/file-kinds";

export const dynamic = "force-dynamic";

/** Download controlado: exige sessão e permissão sobre o documento. */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/files/[id]">,
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const store = getStore();
  const doc = await store.get("documents", id);
  if (!doc || !(await canAccessDocument(user, doc))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Em fluxo: arquivos grandes (arte da embalagem) não passam inteiros pela memória.
  const file = await store.streamFile(doc.storageKey);
  if (!file) return NextResponse.json({ error: "missing" }, { status: 404 });
  // Trilha: quem abriu o documento e quando ("visualizou" nunca vale como "confirmou").
  // Só documentos do fluxo (pedido/solicitação) e nunca para quem os enviou:
  // miniaturas de sourcing e catálogo não geram ruído.
  if ((doc.orderId || doc.requestId) && doc.uploadedByUserId !== user.id) {
    try {
      await recordAck(user, "document", id, "viewed");
    } catch (error) {
      console.error("recordAck(document.viewed) failed", error);
    }
  }
  // Foto e PDF abrem na aba; o resto (SVG inclusive) baixa.
  const inline = opensInline(doc.mime);
  const pdf = doc.mime.toLowerCase().startsWith("application/pdf");
  return new NextResponse(file.body, {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      // Arquivo nunca muda (versão nova = documento novo): o navegador guarda
      // por 1 h e não baixa de novo a cada tela. "private": só neste navegador.
      "Cache-Control": "private, max-age=3600",
      // O navegador não "adivinha" outro tipo (um texto virar página).
      "X-Content-Type-Options": "nosniff",
      // Aberto na aba, o arquivo fica isolado: nenhum código dele roda como o
      // portal (arquivo enviado por fornecedor, cliente ou parceiro). O PDF
      // fica de fora porque o leitor de PDF do Chrome não abre isolado; o
      // código de um PDF já roda à parte, no próprio leitor.
      ...(pdf
        ? {}
        : {
            "Content-Security-Policy":
              "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
          }),
    },
  });
}
