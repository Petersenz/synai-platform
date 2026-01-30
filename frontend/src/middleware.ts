import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes ที่ต้อง Login
const protectedRoutes = ["/chat", "/files", "/dashboard", "/settings"];

// Routes ที่ต้อง Logout (ไม่ให้เข้าถ้า Login แล้ว)
const authRoutes = ["/login", "/register"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ดึง token จาก cookie หรือ header
    const token = request.cookies.get("token")?.value;

    // ถ้าเป็น protected route และไม่มี token
    if (protectedRoutes.some((route) => pathname.startsWith(route))) {
        if (!token) {
            const loginUrl = new URL("/login", request.url);
            loginUrl.searchParams.set("redirect", pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // ถ้าเป็น auth route และมี token แล้ว ให้ไป chat
    if (authRoutes.includes(pathname)) {
        if (token) {
            return NextResponse.redirect(new URL("/chat", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/chat/:path*",
        "/files/:path*",
        "/dashboard/:path*",
        "/settings/:path*",
        "/login",
        "/register",
    ],
};
