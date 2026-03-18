"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type UserInfo = {
  email?: string;
  fullName?: string;
};

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      setUser({
        email: session.user.email,
        fullName: session.user.user_metadata?.full_name,
      });

      setLoading(false);
    }

    loadSession();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-slate-600">Loading dashboard...</p>
        </section>
      </main>
    );
  }

  const displayName = user?.fullName || user?.email || "Parent";

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-green-950">
            Welcome, {displayName}
          </h1>
          <p className="mt-2 text-slate-700">
            Here you will be able to track vocabulary progress, manage child
            profiles, and access personalised learning tools.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/words"
            className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">Browse Words</h2>
            <p className="mt-2 text-sm text-slate-600">
              Explore vocabulary lists and revise key 11+ words.
            </p>
          </Link>

          <Link
            href="/quiz"
            className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">Start Quiz</h2>
            <p className="mt-2 text-sm text-slate-600">
              Practise vocabulary with quiz-based learning.
            </p>
          </Link>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Account</h2>
            <p className="mt-2 text-sm text-slate-600">
              Signed in as: {user?.email}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}