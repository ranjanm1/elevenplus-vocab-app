"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type UserInfo = {
  email?: string;
  fullName?: string;
};

export default function AdminPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadSessionAndRole() {
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

      const { data: roleRow, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (roleError || !roleRow || roleRow.role !== "admin") {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    }

    loadSessionAndRole();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-slate-600">Loading admin panel...</p>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
            <h1 className="text-3xl font-bold text-slate-900">Access denied</h1>
            <p className="mt-3 text-slate-600">
              This area is only available to admin users.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
            >
              Back to dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const displayName = user?.fullName || user?.email || "Admin";

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-green-950">Admin Panel</h1>
          <p className="mt-2 text-slate-700">
            Welcome, {displayName}. Manage vocabulary content, quiz settings,
            and learning data from one place.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/admin/upload"
            className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Upload Vocabulary
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Import new words from CSV or pasted content.
            </p>
          </Link>

          <Link
            href="/admin/words"
            className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Manage Words
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Edit, review, archive, or update vocabulary entries.
            </p>
          </Link>

          <Link
            href="/admin/word-of-the-day"
            className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Word of the Day
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose and schedule featured words for the homepage.
            </p>
          </Link>

          <Link
            href="/admin/results"
            className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Quiz Results
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Review learner performance and recent quiz activity.
            </p>
          </Link>
        </div>

        <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Admin overview
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            This area is your control centre for uploading vocabulary,
            managing content, setting Word of the Day, and reviewing learner
            activity.
          </p>
        </div>
      </section>
    </main>
  );
}