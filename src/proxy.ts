import { NextResponse, type NextRequest } from "next/server";

const APPWRITE_COOKIE = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "willmix"}`;
const MEMORY_COOKIE = "wm_session";

/**
 * Checagem otimista: rotas em /app exigem algum cookie de sessão.
 * A validação real acontece no servidor (getCurrentUser) em cada página e ação.
 */
export function proxy(request: NextRequest) {
  const has = request.cookies.has(APPWRITE_COOKIE) || request.cookies.has(MEMORY_COOKIE);
  if (!has) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
