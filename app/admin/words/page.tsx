"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  example_sentence: string | null;
  synonyms: string | null;
  antonyms: string | null;
  topic: string | null;
  premium_only: boolean;
  active: boolean;
  quiz_option_1: string | null;
  quiz_option_2: string | null;
  quiz_option_3: string | null;
};

type EditForm = {
  id: string;
  word: string;
  definition: string;
  difficulty: string;
  example_sentence: string;
  synonyms: string;
  antonyms: string;
  topic: string;
  premium_only: boolean;
  active: boolean;
  quiz_option_1: string;
  quiz_option_2: string;
  quiz_option_3: string;
};

const PAGE_SIZE = 50;

function makeSlug(word: string) {
  return word.trim().toLowerCase().replace(/\s+/g, "-");
}

export default function AdminWordsPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function initialisePage() {
      setLoading(true);
      setErrorMessage("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

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
          .maybeSingle();

        if (roleError) {
          throw new Error(roleError.message);
        }

        const admin = roleRow?.role === "admin";
        setIsAdmin(admin);

        if (admin) {
          await loadWords(1, search, difficulty);
        }
      } catch (error) {
        setIsAdmin(false);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load words manager."
        );
      } finally {
        setLoading(false);
      }
    }

    initialisePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (isAdmin) {
      loadWords(page, search, difficulty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, difficulty, isAdmin]);

  async function loadWords(
    targetPage: number,
    searchText: string,
    difficultyFilter: string
  ) {
    setLoading(true);
    setErrorMessage("");

    try {
      let query = supabase
        .from("vocabulary_words")
        .select(
          "id, word, slug, definition, difficulty, example_sentence, synonyms, antonyms, topic, premium_only, active, quiz_option_1, quiz_option_2, quiz_option_3"
        )
        .order("word", { ascending: true });

      if (difficultyFilter !== "all") {
        query = query.eq("difficulty", difficultyFilter);
      }

      if (searchText.trim()) {
        query = query.ilike("word", `%${searchText.trim()}%`);
      }

      const from = (targetPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE;

      const { data, error } = await query.range(from, to);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data as VocabularyWord[]) || [];
      setHasNextPage(rows.length > PAGE_SIZE);
      setWords(rows.slice(0, PAGE_SIZE));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to reload words."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(word: VocabularyWord) {
    setSuccessMessage("");
    setErrorMessage("");

    setEditForm({
      id: word.id,
      word: word.word,
      definition: word.definition || "",
      difficulty: word.difficulty || "",
      example_sentence: word.example_sentence || "",
      synonyms: word.synonyms || "",
      antonyms: word.antonyms || "",
      topic: word.topic || "",
      premium_only: word.premium_only,
      active: word.active,
      quiz_option_1: word.quiz_option_1 || "",
      quiz_option_2: word.quiz_option_2 || "",
      quiz_option_3: word.quiz_option_3 || "",
    });

    setTimeout(() => {
      document.getElementById("edit-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  async function saveEdit() {
    if (!editForm) return;

    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("vocabulary_words")
        .update({
          word: editForm.word.trim(),
          slug: makeSlug(editForm.word),
          definition: editForm.definition.trim(),
          difficulty: editForm.difficulty.trim() || null,
          example_sentence: editForm.example_sentence.trim() || null,
          synonyms: editForm.synonyms.trim() || null,
          antonyms: editForm.antonyms.trim() || null,
          topic: editForm.topic.trim() || null,
          premium_only: editForm.premium_only,
          active: editForm.active,
          quiz_option_1: editForm.quiz_option_1.trim() || null,
          quiz_option_2: editForm.quiz_option_2.trim() || null,
          quiz_option_3: editForm.quiz_option_3.trim() || null,
        })
        .eq("id", editForm.id);

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMessage(`"${editForm.word}" updated successfully.`);
      setEditForm(null);
      await loadWords(page, search, difficulty);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save changes."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(wordId: string, wordName: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${wordName}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setSuccessMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("vocabulary_words")
        .delete()
        .eq("id", wordId);

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMessage(`"${wordName}" deleted successfully.`);
      if (editForm?.id === wordId) {
        setEditForm(null);
      }
      await loadWords(page, search, difficulty);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete word."
      );
    }
  }

  async function handleToggleActive(wordId: string, currentActive: boolean) {
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("vocabulary_words")
        .update({ active: !currentActive })
        .eq("id", wordId);

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMessage(
        currentActive ? "Word archived successfully." : "Word activated successfully."
      );
      await loadWords(page, search, difficulty);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update word status."
      );
    }
  }

  if (loading && !words.length && !errorMessage) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-slate-600">Loading words manager...</p>
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

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-6 text-3xl font-bold text-slate-900">Manage Words</h1>

        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="word-search"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Search word
              </label>
              <input
                id="word-search"
                type="text"
                placeholder="Search word..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
              />
            </div>

            <div>
              <label
                htmlFor="difficulty"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Difficulty
              </label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => {
                  setDifficulty(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
              >
                <option value="all">All</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="difficult">Difficult</option>
              </select>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-600">Page {page}</p>
        </div>

        {loading && (
          <p className="mb-4 text-slate-600">Refreshing words...</p>
        )}

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
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {words.map((w) => (
                  <tr key={w.id} className="border-t">
                    <td className="px-4 py-4 text-slate-900">{w.word}</td>
                    <td className="px-4 py-4 text-slate-700">
                      {w.difficulty || "—"}
                    </td>
                    <td className="px-4 py-4 text-slate-700">{w.topic || "—"}</td>
                    <td className="px-4 py-4">
                      {w.premium_only ? (
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
                      {w.active ? (
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
                          onClick={() => handleEdit(w)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(w.id, w.active)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {w.active ? "Archive" : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(w.id, w.word)}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && words.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No words found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <span className="text-sm text-slate-600">Page {page}</span>

          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={!hasNextPage}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>

        {editForm && (
          <div
            id="edit-panel"
            className="mt-8 rounded-xl border bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-900">
                Edit word: {editForm.word}
              </h2>

              <button
                type="button"
                onClick={() => setEditForm(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Word
                </label>
                <input
                  value={editForm.word}
                  onChange={(e) =>
                    setEditForm({ ...editForm, word: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Difficulty
                </label>
                <select
                  value={editForm.difficulty}
                  onChange={(e) =>
                    setEditForm({ ...editForm, difficulty: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                >
                  <option value="">Select difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="difficult">Difficult</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Definition
              </label>
              <textarea
                rows={3}
                value={editForm.definition}
                onChange={(e) =>
                  setEditForm({ ...editForm, definition: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Example sentence
              </label>
              <textarea
                rows={2}
                value={editForm.example_sentence}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    example_sentence: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Synonyms
                </label>
                <input
                  value={editForm.synonyms}
                  onChange={(e) =>
                    setEditForm({ ...editForm, synonyms: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Antonyms
                </label>
                <input
                  value={editForm.antonyms}
                  onChange={(e) =>
                    setEditForm({ ...editForm, antonyms: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Topic
              </label>
              <input
                value={editForm.topic}
                onChange={(e) =>
                  setEditForm({ ...editForm, topic: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Quiz option 1
                </label>
                <input
                  value={editForm.quiz_option_1}
                  onChange={(e) =>
                    setEditForm({ ...editForm, quiz_option_1: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Quiz option 2
                </label>
                <input
                  value={editForm.quiz_option_2}
                  onChange={(e) =>
                    setEditForm({ ...editForm, quiz_option_2: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Quiz option 3
                </label>
                <input
                  value={editForm.quiz_option_3}
                  onChange={(e) =>
                    setEditForm({ ...editForm, quiz_option_3: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.premium_only}
                  onChange={(e) =>
                    setEditForm({ ...editForm, premium_only: e.target.checked })
                  }
                />
                Premium only
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) =>
                    setEditForm({ ...editForm, active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}