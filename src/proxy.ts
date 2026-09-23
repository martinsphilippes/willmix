import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "__session";

/**
 * Checagem otimista: rotas em /app exigem cookie de sessão.
 * A validação real do token acontece no servidor (getCurrentUser).
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
