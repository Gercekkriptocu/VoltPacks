import { NextResponse, NextRequest } from "next/server";

export default async function middleware(request: NextRequest) {
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const url = new URL("/api/logger", request.url);
  const requestId = crypto.randomUUID();

  try {
    await fetch(url.toString(), {
      method: "POST",
      body: JSON.stringify({
        level: "info",
        requestId,
        request: {
          url: request.url,
          method: request.method,
          path: request.nextUrl.pathname,
          referrerPolicy: request.referrerPolicy,
          headers: Object.fromEntries(request.headers.entries()),
          cookies: request.cookies.getAll().reduce((acc, cookie) => {
            acc[cookie.name] = cookie.value;
            return acc;
          }, {} as Record<string, string>),
        },
      }),
    });
  } catch (error) {
    console.error("Error logging request:", error);
  }

  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);

  if (!isApiRoute) {
    response.cookies.set("x-request-id", requestId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax", // Changed from strict to lax for better cross-domain compatibility
      maxAge: 60,
      secure: request.url.startsWith("https"), // Only secure if on HTTPS
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/image|_next/static|api/logger|favicon.ico).*)"],
};
