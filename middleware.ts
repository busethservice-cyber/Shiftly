import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { useMockData } from "@/app/lib/runtimeConfig";

export async function middleware(req: NextRequest) {
  // If mock data is enabled, skip auth entirely.
  if (useMockData) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login")) return NextResponse.next();
  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname.startsWith("/favicon")) return NextResponse.next();

  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role gating: employees are redirected to /ansattportal
  const { data: roleRow, error: roleError } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (roleError) {
    // Keep it safe: if we can't check role, treat as employee.
    console.error("Failed to check role in middleware.", roleError);
  }

  const role = roleRow?.role === "admin" ? "admin" : "employee";
  if (role === "employee" && !pathname.startsWith("/ansattportal")) {
    const url = req.nextUrl.clone();
    url.pathname = "/ansattportal";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

