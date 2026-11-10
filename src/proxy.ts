import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
    const token = req.cookies.get("coasther_token")?.value;
    const pathname = req.nextUrl.pathname;

    const isDashboardRoute = pathname.startsWith("/dashboard");
    const isAuthPage = pathname === "/" || pathname === "/register";

    if (isDashboardRoute && !token) {
        return NextResponse.redirect(new URL("/", req.url));
    }

    if (isAuthPage && token) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/", "/register", "/dashboard/:path*"],
};
