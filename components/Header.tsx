"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

export default function Header() {
  const { user, authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement | null>(null);

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

    loadRole();
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
    <header className="sticky top-0 z-50 border-b border-green-200 bg-green-100 shadow-sm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-2xl font-bold text-green-950">
          11+ Succeed
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/dashboard" className="text-slate-800 hover:text-green-900">
            Dashboard
          </Link>

          <Link href="/words" className="text-slate-800 hover:text-green-900">
            Words
          </Link>

          <Link href="/quiz" className="text-slate-800 hover:text-green-900">
            Quiz
          </Link>

          {isAdmin && (
            <div className="relative" ref={adminMenuRef}>
              <button
                type="button"
                onClick={() => setAdminMenuOpen((prev) => !prev)}
                className="rounded-lg px-3 py-2 text-slate-800 hover:bg-green-200 hover:text-green-950"
              >
                Admin ▾
              </button>

              {adminMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                  <Link
                    href="/admin"
                    onClick={() => setAdminMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                  >
                    Admin Dashboard
                  </Link>

                  <Link
                    href="/admin/words"
                    onClick={() => setAdminMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                  >
                    Manage Words
                  </Link>

                  <Link
                    href="/admin/upload"
                    onClick={() => setAdminMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                  >
                    Upload Words
                  </Link>
                </div>
              )}
            </div>
          )}

          {authLoading ? (
            <span className="text-slate-600">Loading...</span>
          ) : user ? (
            <div className="flex items-center gap-3">
              <span className="text-slate-700">{user.email}</span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutLoading}
                className="rounded-lg bg-green-700 px-3 py-2 text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {logoutLoading ? "Logging out..." : "Logout"}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-green-700 px-3 py-2 text-white hover:bg-green-800"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}