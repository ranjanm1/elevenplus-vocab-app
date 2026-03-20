"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UserInfo = {
  email?: string;
  fullName?: string;
};

type VocabularyWord = {
  id: string;
  word: string;
  slug: string;
  definition: string;
  difficulty: string | null;
  topic: string | null;
  premium_only: boolean;
  active: boolean;
};

export default function AdminWordsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
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
      await loadWords();
      setLoading(false);
    }

    loadSessionAndRole();
  }, [router]);

  async function loadWords() {
    const { data, error } = await supabase
      .from("vocabulary_words")
      .select(
        "id, word, slug, definition, difficulty, topic, premium_only, active"
      )
      .order("word", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setWords((data as VocabularyWord[]) || []);
  }

  async function handleToggleActive(wordId: string, currentActive: boolean) {
    setActionLoadingId(wordId);
    setSuccessMessage("");
    setErrorMessage("");

    const { error } = await supabase
      .from("vocabulary_words")
      .update({ active: !currentActive })
      .eq("id", wordId);

    if (error) {
      setErrorMessage(error.message);
      setActionLoadingId(null);
      return;
    }

    setSuccessMessage(
      currentActive ? "Word archived successfully." : "Word activated successfully."
    );
    await loadWords();
    setActionLoadingId(null);
  }

  async function handleDeleteWord(wordId: string, wordName: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${wordName}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setActionLoadingId(wordId);
    setSuccessMessage("");
    setErrorMessage("");

    const { error } = await supabase
      .from("vocabulary_words")
      .delete()
      .eq("id", wordId);

    if (error) {
      setErrorMessage(error.message);
      setActionLoadingId(null);
      return;
    }

    setSuccessMessage(`"${wordName}" deleted successfully.`);
    await loadWords();
    setActionLoadingId(null);
  }

  const summary = useMemo(() => {
    const total = words.length;
    const free = words.filter((w) => !w.premium_only).length;
    const premium = words.filter((w) => w.premium_only).length;
    const active = words.filter((w) => w.active).length;
    const archived = words.filter((w) => !w.active).length;

    const easy = words.filter(
      (w) => (w.difficulty || "").toLowerCase() === "easy"
    ).length;
    const medium = words.filter(
      (w) => (w.difficulty || "").toLowerCase() === "medium"
    ).length;
    const hard = words.filter(
      (w) => (w.difficulty || "").toLowerCase() === "hard"
    ).length;
    const difficult = words.filter(
      (w) => (w.difficulty || "").toLowerCase() === "difficult"
    ).length;

    return {
      total,
      free,
      premium,
      active,
      archived,
      easy,
      medium,
      hard,
      difficult,
    };
  }, [words]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-slate-600">Loading words manager...</p>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h1 className="text-3xl font-bold text-slate-900">Access denied</h1>
            <p className="mt-3 text-slate-600">
              Only admin users can manage vocabulary words.
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
          <h1 className="text-3xl font-bold text-green-950">Manage Words</h1>
          <p className="mt-2 text-slate-700">
            Welcome, {displayName}. Review, archive, activate, delete, and monitor vocabulary entries.
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total words</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{summary.total}</p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Free words</p>
            <p className="mt-2 text-3xl font-bold text-green-700">{summary.free}</p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Premium words</p>
            <p className="mt-2 text-3xl font-bold text-amber-700">{summary.premium}</p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Active</p>
            <p className="mt-2 text-3xl font-bold text-green-700">{summary.active}</p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Archived</p>
            <p className="mt-2 text-3xl font-bold text-slate-700">{summary.archived}</p>
          </div>
        </div>

        <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Difficulty breakdown
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Easy</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{summary.easy}</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Medium</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{summary.medium}</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Hard</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{summary.hard}</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Difficult</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{summary.difficult}</p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-medium">Word</th>
                  <th className="px-4 py-3 font-medium">Difficulty</th>
                  <th className="px-4 py-3 font-medium">Topic</th>
                  <th className="px-4 py-3 font-medium">Access</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {words.map((word) => (
                  <tr key={word.id} className="border-t">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{word.word}</p>
                        <p className="mt-1 text-xs text-slate-500">{word.slug}</p>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {word.difficulty || "—"}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {word.topic || "—"}
                    </td>

                    <td className="px-4 py-4">
                      {word.premium_only ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                          Premium
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          Free
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {word.active ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                          Archived
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(word.id, word.active)}
                          disabled={actionLoadingId === word.id}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionLoadingId === word.id
                            ? "Working..."
                            : word.active
                            ? "Archive"
                            : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteWord(word.id, word.word)}
                          disabled={actionLoadingId === word.id}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {words.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No vocabulary words found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}