"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

export default function AdminPage() {
  const { user, authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (user) {
      loadRole();
    } else if (!authLoading) {
      setIsAdmin(false);
    }
  }, [user, authLoading]);

  async function loadRole() {
    if (!user) return;

    setLoadingRole(true);
    setErrorMessage("");

    try {
      const { data: roleRow, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      setIsAdmin(roleRow?.role === "admin");
    } catch (error) {
      setIsAdmin(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load admin panel."
      );
    } finally {
      setLoadingRole(false);
    }
  }

  if (authLoading || loadingRole) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-slate-600">Loading admin panel...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
            <h1 className="text-3xl font-bold text-slate-900">Login required</h1>
            <p className="mt-3 text-slate-600">
              Please log in to access the admin area.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
            >
              Go to login
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (errorMessage && !isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
            <h1 className="text-3xl font-bold text-slate-900">Something went wrong</h1>
            <p className="mt-3 text-slate-600">{errorMessage}</p>
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

  const displayName = user.user_metadata?.full_name || user.email || "Admin";

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
              Student Progress
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Review learner performance, trends, and risk status.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
