"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

type VocabularyWord = {
  id: string;
  word: string;
  slug: string;
  definition: string;
  difficulty: string | null;
  topic: string | null;
  premium_only: boolean;
  word_of_the_day: boolean;
  active: boolean;
};

const PAGE_SIZE = 25;

export default function WordOfTheDayPage() {
  const { user, authLoading } = useAuth();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);

  const [currentWord, setCurrentWord] = useState<VocabularyWord | null>(null);
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [settingWordId, setSettingWordId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadRole();
    } else if (!authLoading) {
      setIsAdmin(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (isAdmin) {
      loadCurrentWord();
      loadWords(page, search);
    }
  }, [isAdmin, page, search]);

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
        error instanceof Error ? error.message : "Failed to load page."
      );
    } finally {
      setLoadingRole(false);
    }
  }

  async function loadCurrentWord() {
    try {
      const { data, error } = await supabase
        .from("vocabulary_words")
        .select(
          "id, word, slug, definition, difficulty, topic, premium_only, word_of_the_day, active"
        )
        .eq("word_of_the_day", true)
        .eq("active", true)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      setCurrentWord((data as VocabularyWord | null) || null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load current Word of the Day."
      );
    }
  }

  async function loadWords(targetPage: number, searchText: string) {
    setLoadingWords(true);
    setErrorMessage("");

    try {
      let query = supabase
        .from("vocabulary_words")
        .select(
          "id, word, slug, definition, difficulty, topic, premium_only, word_of_the_day, active"
        )
        .eq("active", true)
        .order("word", { ascending: true });

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
        error instanceof Error ? error.message : "Failed to load words."
      );
    } finally {
      setLoadingWords(false);
    }
  }

  async function handleSetWordOfTheDay(wordId: string, wordName: string) {
    setSettingWordId(wordId);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase.rpc("set_word_of_the_day", {
        word_id: wordId,
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMessage(`"${wordName}" is now the Word of the Day.`);
      await loadCurrentWord();
      await loadWords(page, search);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update Word of the Day."
      );
    } finally {
      setSettingWordId(null);
    }
  }

  if (authLoading || loadingRole) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-slate-600">Loading Word of the Day page...</p>
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
              Please log in to manage Word of the Day.
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

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
            <h1 className="text-3xl font-bold text-slate-900">Access denied</h1>
            <p className="mt-3 text-slate-600">
              Only admin users can manage Word of the Day.
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
        <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-green-950">Word of the Day</h1>
          <p className="mt-2 text-slate-700">
            Search active words and choose which one should appear on the homepage.
          </p>
        </div>

        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Current selection</h2>

          {currentWord ? (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-green-950">
                    {currentWord.word}
                  </h3>
                  <p className="mt-2 text-slate-700">{currentWord.definition}</p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {currentWord.difficulty && (
                      <span className="rounded bg-white px-2 py-1 text-slate-600">
                        {currentWord.difficulty}
                      </span>
                    )}
                    {currentWord.topic && (
                      <span className="rounded bg-white px-2 py-1 text-slate-600">
                        {currentWord.topic}
                      </span>
                    )}
                    {currentWord.premium_only && (
                      <span className="rounded bg-amber-100 px-2 py-1 text-amber-700">
                        Premium
                      </span>
                    )}
                  </div>
                </div>

                <Link
                  href={`/words/${currentWord.slug}`}
                  className="shrink-0 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                >
                  View word
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              No Word of the Day is currently selected.
            </p>
          )}
        </div>

        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <label
            htmlFor="word-search"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Search word
          </label>
          <input
            id="word-search"
            type="text"
            placeholder="Search by word..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
          />

          <p className="mt-3 text-sm text-slate-600">Page {page}</p>
        </div>

        {loadingWords && (
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
                  <th className="px-4 py-3 font-medium">Current</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {words.map((word) => (
                  <tr key={word.id} className="border-t">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{word.word}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {word.definition}
                        </p>
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
                      {word.word_of_the_day ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          Selected
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          handleSetWordOfTheDay(word.id, word.word)
                        }
                        disabled={settingWordId === word.id || word.word_of_the_day}
                        className="rounded-lg bg-green-700 px-3 py-2 text-xs font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {settingWordId === word.id
                          ? "Saving..."
                          : word.word_of_the_day
                          ? "Current Word"
                          : "Set as Word of the Day"}
                      </button>
                    </td>
                  </tr>
                ))}

                {!loadingWords && words.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500"
                    >
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
      </section>
    </main>
  );
}