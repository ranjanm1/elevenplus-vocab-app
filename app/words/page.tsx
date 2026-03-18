"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

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
};

export default function WordsPage() {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");

  useEffect(() => {
    async function loadWords() {
      setLoading(true);

      const { data, error } = await supabase
        .from("vocabulary_words")
        .select("*")
        .order("word", { ascending: true });

      if (error) {
        setError(error.message);
      } else {
        setWords((data as VocabularyWord[]) || []);
      }

      setLoading(false);
    }

    loadWords();
  }, []);

  const filteredWords = useMemo(() => {
    return words.filter((word) => {
      const matchesSearch =
        word.word.toLowerCase().includes(search.toLowerCase()) ||
        word.definition.toLowerCase().includes(search.toLowerCase()) ||
        (word.topic || "").toLowerCase().includes(search.toLowerCase());

      const matchesDifficulty =
        difficulty === "all" || (word.difficulty || "") === difficulty;

      const matchesAccess =
        accessFilter === "all" ||
        (accessFilter === "free" && !word.premium_only) ||
        (accessFilter === "premium" && word.premium_only);

      return matchesSearch && matchesDifficulty && matchesAccess;
    });
  }, [words, search, difficulty, accessFilter]);

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
                placeholder="Search words, definitions, topics..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-green-600"
              >
                <option value="all">All</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
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
                onChange={(e) => setAccessFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-green-600"
              >
                <option value="all">All</option>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Showing <span className="font-semibold">{filteredWords.length}</span>{" "}
            word{filteredWords.length === 1 ? "" : "s"}
          </p>
        </div>

        {loading && (
          <p className="text-slate-600">Loading vocabulary words...</p>
        )}

        {error && <p className="mb-4 text-red-600">Error: {error}</p>}

        {!loading && !error && filteredWords.length === 0 && (
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
          {filteredWords.map((word) => (
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
                  <span
                    className={`rounded px-2 py-1 ${
                      word.difficulty === "easy"
                        ? "bg-green-100 text-green-700"
                        : word.difficulty === "medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
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
      </section>
    </main>
  );
}