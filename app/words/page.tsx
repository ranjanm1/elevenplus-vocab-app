"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type VocabularyWord = {
  id: string;
  word: string;
  slug: string;
  definition: string;
  difficulty: string | null;
  example_sentence: string | null;
  topic: string | null;
  premium_only: boolean;
  active: boolean;
};

const PAGE_SIZE = 50;

export default function WordsPage() {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    async function loadWords() {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from("vocabulary_words")
          .select(
            "id, word, slug, definition, difficulty, example_sentence, topic, premium_only, active"
          )
          .eq("active", true)
          .order("word", { ascending: true });

        if (difficulty !== "all") {
          query = query.eq("difficulty", difficulty);
        }

        if (accessFilter === "free") {
          query = query.eq("premium_only", false);
        }

        if (accessFilter === "premium") {
          query = query.eq("premium_only", true);
        }

        if (search.trim()) {
          query = query.ilike("word", `%${search.trim()}%`);
        }

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE;

        const { data, error } = await query.range(from, to);

        if (error) {
          throw new Error(error.message);
        }

        const rows = (data as VocabularyWord[]) || [];
        setHasNextPage(rows.length > PAGE_SIZE);
        setWords(rows.slice(0, PAGE_SIZE));
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to load words."
        );
      } finally {
        setLoading(false);
      }
    }

    loadWords();
  }, [search, difficulty, accessFilter, page]);

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Vocabulary List</h1>
          <p className="mt-2 text-sm text-slate-600">
            Search, filter, and explore all available 11+ vocabulary words.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="search"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Search
              </label>
              <input
                id="search"
                type="text"
                placeholder="Search words..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
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
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
              >
                <option value="all">All</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="difficult">Difficult</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="access"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Access
              </label>
              <select
                id="access"
                value={accessFilter}
                onChange={(e) => {
                  setAccessFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
              >
                <option value="all">All</option>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">Page {page}</p>
        </div>

        {loading && <p className="text-slate-600">Loading vocabulary words...</p>}

        {error && <p className="mb-4 text-red-600">Error: {error}</p>}

        {!loading && !error && words.length === 0 && (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              No words found
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Try changing your search or filters to see more words.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {words.map((word) => (
            <Link
              key={word.id}
              href={`/words/${word.slug}`}
              className="block rounded-xl border bg-white p-5 shadow-sm transition hover:scale-[1.01] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {word.word}
                </h2>

                {word.premium_only && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    Premium
                  </span>
                )}
              </div>

              <p className="mt-2 text-slate-700">{word.definition}</p>

              {word.example_sentence && (
                <p className="mt-3 text-sm text-slate-500">
                  Example: {word.example_sentence}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {word.difficulty && (
                  <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                    {word.difficulty}
                  </span>
                )}

                {word.topic && (
                  <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                    {word.topic}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {!loading && !error && (
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
        )}
      </section>
    </main>
  );
}