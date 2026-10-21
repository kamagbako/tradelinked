import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { logError } from "@/lib/logger";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (error) {
    // Auth backend unreachable or misconfigured. Fail closed for private areas, open for the auth pages
    // themselves so the user still sees a page (and any real error) instead of a blank 500.
    logError("middleware", error, { path: request.nextUrl.pathname });

    const isProtected = PROTECTED_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
    if (isProtected) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }
}

// Only auth-aware routes need a session check; public pages (landing, etc.) skip it.
export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register"],
};
