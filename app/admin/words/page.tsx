"use client";

import { useEffect, useMemo, useState } from "react";
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

type EditFormState = {
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

function makeSlug(word: string) {
  return word.trim().toLowerCase().replace(/\s+/g, "-");
}

export default function AdminWordsPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
        "id, word, slug, definition, difficulty, example_sentence, synonyms, antonyms, topic, premium_only, active, quiz_option_1, quiz_option_2, quiz_option_3"
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

    if (editingWordId === wordId) {
      setEditingWordId(null);
      setEditForm(null);
    }

    await loadWords();
    setActionLoadingId(null);
  }

  function handleEditClick(word: VocabularyWord) {
    setSuccessMessage("");
    setErrorMessage("");
    setEditingWordId(word.id);

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
  }

  function handleEditFieldChange(
    field: keyof EditFormState,
    value: string | boolean
  ) {
    if (!editForm) return;

    setEditForm({
      ...editForm,
      [field]: value,
    });
  }

  async function handleSaveEdit() {
    if (!editForm) return;

    setSavingEdit(true);
    setSuccessMessage("");
    setErrorMessage("");

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
      setErrorMessage(error.message);
      setSavingEdit(false);
      return;
    }

    setSuccessMessage(`"${editForm.word}" updated successfully.`);
    await loadWords();
    setSavingEdit(false);
  }

  const filteredWords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return words;

    return words.filter((word) => {
      return (
        word.word.toLowerCase().includes(q) ||
        word.definition.toLowerCase().includes(q) ||
        (word.topic || "").toLowerCase().includes(q) ||
        (word.difficulty || "").toLowerCase().includes(q)
      );
    });
  }, [words, searchTerm]);

  const summary = useMemo(() => {
    return {
      total: words.length,
      free: words.filter((w) => !w.premium_only).length,
      premium: words.filter((w) => w.premium_only).length,
      active: words.filter((w) => w.active).length,
      archived: words.filter((w) => !w.active).length,
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
            Welcome, {displayName}. Search, edit, archive, or delete vocabulary entries.
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total words</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{summary.total}</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Free</p>
            <p className="mt-2 text-3xl font-bold text-green-700">{summary.free}</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Premium</p>
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

        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <label
            htmlFor="wordSearch"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Search words
          </label>
          <input
            id="wordSearch"
            type="text"
            placeholder="Search by word, definition, topic, or difficulty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
          />
          <p className="mt-2 text-sm text-slate-500">
            Showing {filteredWords.length} of {words.length} words
          </p>
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
                {filteredWords.map((word) => (
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
                          onClick={() => handleEditClick(word)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Edit
                        </button>

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

                {filteredWords.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No vocabulary words found for this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {editForm && (
          <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-900">
                Edit word: {editForm.word}
              </h2>

              <button
                type="button"
                onClick={() => {
                  setEditingWordId(null);
                  setEditForm(null);
                }}
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
                  type="text"
                  value={editForm.word}
                  onChange={(e) => handleEditFieldChange("word", e.target.value)}
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
                    handleEditFieldChange("difficulty", e.target.value)
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
                value={editForm.definition}
                onChange={(e) =>
                  handleEditFieldChange("definition", e.target.value)
                }
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Example sentence
              </label>
              <textarea
                value={editForm.example_sentence}
                onChange={(e) =>
                  handleEditFieldChange("example_sentence", e.target.value)
                }
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Synonyms
                </label>
                <input
                  type="text"
                  value={editForm.synonyms}
                  onChange={(e) =>
                    handleEditFieldChange("synonyms", e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Antonyms
                </label>
                <input
                  type="text"
                  value={editForm.antonyms}
                  onChange={(e) =>
                    handleEditFieldChange("antonyms", e.target.value)
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
                type="text"
                value={editForm.topic}
                onChange={(e) => handleEditFieldChange("topic", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Quiz option 1
                </label>
                <input
                  type="text"
                  value={editForm.quiz_option_1}
                  onChange={(e) =>
                    handleEditFieldChange("quiz_option_1", e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Quiz option 2
                </label>
                <input
                  type="text"
                  value={editForm.quiz_option_2}
                  onChange={(e) =>
                    handleEditFieldChange("quiz_option_2", e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Quiz option 3
                </label>
                <input
                  type="text"
                  value={editForm.quiz_option_3}
                  onChange={(e) =>
                    handleEditFieldChange("quiz_option_3", e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.premium_only}
                  onChange={(e) =>
                    handleEditFieldChange("premium_only", e.target.checked)
                  }
                />
                Premium only
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) =>
                    handleEditFieldChange("active", e.target.checked)
                  }
                />
                Active
              </label>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingEdit ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}