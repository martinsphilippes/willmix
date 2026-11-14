import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Foto do produto do Sankhya pelo código (docs/SANKHYA.md, "Fotos dos
 * produtos"): /produto/23756.jpg (TGFPRO.IMAGEM), /produto/23756-mini.jpg
 * (miniatura), /produto/23756-arte800.jpg (AD_IMAGEM05), -china
 * (AD_IMAGEM02), -arte (AD_IMAGEM03), -balanca (AD_IMAGEM04); com "-mini"
 * no fim, a miniatura daquela. Leva a /api/files, que exige sessão e confere
 * o acesso ao documento.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/produto/[file]">,
) {
  const { file } = await context.params;
  const { parseImageLink, sankhyaImageDocument } =
    await import("@/lib/integrations/sankhya-images");
  const link = parseImageLink(file);
  if (!link) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { getCurrentUser } = await import("@/lib/auth/session");
  if (!(await getCurrentUser()))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const documentId = await sankhyaImageDocument(link.code, link.column);
  if (!documentId)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const target = new URL(`/api/files/${documentId}`, request.url);
  if (link.thumb) target.searchParams.set("thumb", "1");
  return NextResponse.redirect(target, 302);
}
