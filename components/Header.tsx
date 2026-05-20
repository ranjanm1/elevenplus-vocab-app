"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

const homeLinks = [
  { href: "/", label: "Home" },
  { href: "/quiz", label: "Quiz Platform" },
  { href: "/#services", label: "Our Services" },
  { href: "/#about", label: "About Us" },
  { href: "/#contact", label: "Contact Us" },
];

const appLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/words", label: "Words" },
  { href: "/quiz", label: "Quiz" },
];

const adminLinks = [
  { href: "/admin", label: "Admin Dashboard" },
  { href: "/admin/words", label: "Manage Words" },
  { href: "/admin/assessments", label: "Assign Assessments" },
  { href: "/admin/results", label: "Student Progress" },
  { href: "/admin/upload", label: "Upload Words" },
  { href: "/admin/help", label: "Admin Help" },
];

function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`inline-block border-b-2 border-[color:var(--brand-sky)] pb-1 text-[2.2rem] font-extrabold leading-none tracking-[-0.04em] ${
        dark ? "text-white" : "text-[color:var(--brand-navy)]"
      }`}
    >
      11+Succeed
    </span>
  );
}

export default function Header() {
  const pathname = usePathname();
  const { user, authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement | null>(null);
  const isHomePage = pathname === "/";
  const links = isHomePage ? homeLinks : appLinks;

  useEffect(() => {
    async function loadRole() {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsAdmin(data?.role === "admin");
    }

    void loadRole();
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        adminMenuRef.current &&
        !adminMenuRef.current.contains(event.target as Node)
      ) {
        setAdminMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setLogoutLoading(true);

    const fallback = setTimeout(() => {
      window.location.href = "/login";
    }, 2500);

    try {
      await supabase.auth.signOut({ scope: "local" });
      clearTimeout(fallback);
      window.location.href = "/login";
    } catch {
      clearTimeout(fallback);
      window.location.href = "/login";
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      {isHomePage ? (
        <>
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 text-xs text-slate-600 md:px-8">
            <div className="hidden rounded border border-[color:var(--line)] px-3 py-1 font-semibold md:block">
              Temporary Vercel preview for the new homepage
            </div>

            <Link
              href="/"
              className="mx-auto md:mx-0"
              onClick={() => setMobileMenuOpen(false)}
            >
              <BrandMark />
            </Link>

            <div className="hidden items-center gap-3 md:flex">
              <Link
                href="/quiz"
                className="rounded-full border border-[color:var(--brand-navy)] px-4 py-2 font-semibold text-[color:var(--brand-navy)] transition hover:bg-slate-50"
              >
                Quiz Login
              </Link>
            </div>
          </div>

          <div className="bg-[color:var(--brand-navy)]">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 md:px-8">
              <div className="hidden flex-1 items-center justify-center gap-8 lg:flex">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`border-b-2 px-2 py-3 text-sm font-semibold transition ${
                      pathname === link.href
                        ? "border-[color:var(--brand-sky)] text-white"
                        : "border-transparent text-slate-100 hover:border-[color:var(--brand-sky)] hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="ml-auto py-3 text-sm font-semibold text-white lg:hidden"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle navigation"
              >
                {mobileMenuOpen ? "Close" : "Menu"}
              </button>
            </nav>
          </div>
        </>
      ) : (
        <div className="bg-[color:var(--brand-navy)] text-white">
          <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              <BrandMark dark />
            </Link>

            <div className="hidden items-center gap-6 lg:flex">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-semibold text-slate-100 transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              {isAdmin && (
                <div className="relative" ref={adminMenuRef}>
                  <button
                    type="button"
                    onClick={() => setAdminMenuOpen((prev) => !prev)}
                    className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Admin
                  </button>

                  {adminMenuOpen && (
                    <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-[color:var(--line)] bg-white p-2 text-slate-700 shadow-xl">
                      {adminLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => {
                            setAdminMenuOpen(false);
                            setMobileMenuOpen(false);
                          }}
                          className="block rounded-xl px-4 py-3 text-sm transition hover:bg-slate-50 hover:text-[color:var(--brand-navy)]"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {authLoading ? (
                <span className="text-sm text-slate-200">Checking account...</span>
              ) : user ? (
                <>
                  <span className="max-w-44 truncate text-sm text-slate-200 xl:max-w-none">
                    {user.email}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={logoutLoading}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand-navy)] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {logoutLoading ? "Logging out..." : "Logout"}
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand-navy)] transition hover:bg-slate-100"
                >
                  Student login
                </Link>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="text-sm font-semibold text-white lg:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? "Close" : "Menu"}
            </button>
          </nav>
        </div>
      )}

      {mobileMenuOpen && (
        <div className={`${isHomePage ? "bg-[color:var(--brand-navy)]" : "bg-[color:var(--brand-navy-dark)]"} px-4 pb-4 lg:hidden md:px-8`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold text-white"
              >
                {link.label}
              </Link>
            ))}

            {isAdmin &&
              adminLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                >
                  {link.label}
                </Link>
              ))}

            {authLoading ? (
              <div className="rounded-lg bg-white/10 px-4 py-3 text-sm text-slate-100">
                Checking account...
              </div>
            ) : user ? (
              <>
                <div className="rounded-lg bg-white/10 px-4 py-3 text-sm text-slate-100">
                  Signed in as {user.email}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[color:var(--brand-navy)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {logoutLoading ? "Logging out..." : "Logout"}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[color:var(--brand-navy)]"
              >
                Student login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
