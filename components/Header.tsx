"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type UserInfo = {
  email?: string;
  fullName?: string;
};

export default function Header() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser({
          email: session.user.email,
          fullName: session.user.user_metadata?.full_name,
        });
      } else {
        setUser(null);
      }

      setLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          email: session.user.email,
          fullName: session.user.user_metadata?.full_name,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const displayName = user?.fullName || user?.email || "Account";

  return (
    <header className="sticky top-0 z-50 border-b bg-green-50 shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-green-900">11+ Vocabulary</h1>
          <p className="text-sm text-green-700">ElevenPlusSucceed</p>
        </div>

        <div className="flex items-center gap-6">
          <nav className="flex gap-4 text-sm font-medium text-green-800">
            <Link href="/" className="hover:text-green-900">
              Home
            </Link>
            <Link href="/words" className="hover:text-green-900">
              Words
            </Link>
            <Link href="/quiz" className="hover:text-green-900">
              Quiz
            </Link>
            {user && (
              <Link href="/dashboard" className="hover:text-green-900">
                Dashboard
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            {!loading && user ? (
              <>
                <span className="rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                  {displayName}
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-lg bg-green-700 px-3 py-2 font-medium text-white hover:bg-green-800"
                >
                  Logout
                </button>
              </>
            ) : !loading ? (
              <Link
                href="/login"
                className="rounded-lg bg-green-700 px-3 py-2 font-medium text-white hover:bg-green-800"
              >
                Login
              </Link>
            ) : (
              <span className="text-slate-500">Loading...</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}