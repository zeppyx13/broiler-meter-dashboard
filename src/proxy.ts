import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
    const token = req.cookies.get("coasther_token")?.value;
    const userCookie = req.cookies.get("coasther_user")?.value;
    const pathname = req.nextUrl.pathname;

    const isDashboardRoute = pathname.startsWith("/dashboard");
    const isLoginPage = pathname === "/";

    if (isDashboardRoute && !token) {
        return NextResponse.redirect(new URL("/", req.url));
    }

    if (isDashboardRoute && userCookie) {
        try {
            const user = JSON.parse(userCookie);

            if (!["admin", "manager"].includes(user.role)) {
                return NextResponse.redirect(new URL("/", req.url));
            }
        } catch {
            return NextResponse.redirect(new URL("/", req.url));
        }
    }

    if (isLoginPage && token) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/", "/dashboard/:path*"],
};