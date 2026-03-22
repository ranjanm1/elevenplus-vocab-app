import Link from "next/link";
import { supabase } from "../lib/supabase";

export default async function Home() {
  const { data: dailyWord, error: dailyWordError } = await supabase
    .from("vocabulary_words")
    .select(
      "id, word, slug, definition, difficulty, example_sentence, topic, premium_only"
    )
    .eq("word_of_the_day", true)
    .eq("active", true)
    .maybeSingle();

  const { data: words, error: wordsError } = await supabase
    .from("vocabulary_words")
    .select(
      "id, word, slug, definition, difficulty, example_sentence, topic, premium_only"
    )
    .eq("active", true)
    .order("word", { ascending: true })
    .limit(20);

  const errorMessage = dailyWordError?.message || wordsError?.message;

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-5xl px-6 py-10">
        {dailyWord && (
          <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
            <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-green-700">
              Word of the Day
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-green-950">
                  {dailyWord.word}
                </h2>

                <p className="mt-3 text-base text-slate-700">
                  {dailyWord.definition}
                </p>

                {dailyWord.example_sentence && (
                  <p className="mt-3 text-sm text-slate-600">
                    Example: {dailyWord.example_sentence}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                  {dailyWord.difficulty && (
                    <span className="rounded bg-white px-2 py-1">
                      Difficulty: {dailyWord.difficulty}
                    </span>
                  )}

                  {dailyWord.topic && (
                    <span className="rounded bg-white px-2 py-1">
                      Topic: {dailyWord.topic}
                    </span>
                  )}

                  {dailyWord.premium_only && (
                    <span className="rounded bg-amber-100 px-2 py-1 text-amber-700">
                      Premium
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                <Link
                  href={`/words/${dailyWord.slug}`}
                  className="inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                >
                  Learn this word
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold text-slate-900">
            Welcome to Eleven Plus Succeed Vocabulary
          </h2>
          <p className="text-slate-600">
            Build vocabulary, practise regularly, and track progress with
            child-friendly learning designed for 11+ preparation.
          </p>
        </div>

        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Vocabulary Preview
            </h3>
            <p className="text-sm text-slate-600">
              Showing a sample of words from your vocabulary bank.
            </p>
          </div>

          <Link
            href="/words"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-green-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            View all words
          </Link>
        </div>

        {errorMessage && (
          <p className="mb-4 text-red-600">Error: {errorMessage}</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {words?.map((word) => (
            <Link
              key={word.id}
              href={`/words/${word.slug}`}
              className="block rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-lg font-semibold text-slate-900">
                  {word.word}
                </h4>

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

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                {word.difficulty && (
                  <span className="rounded bg-slate-100 px-2 py-1">
                    Difficulty: {word.difficulty}
                  </span>
                )}

                {word.topic && (
                  <span className="rounded bg-slate-100 px-2 py-1">
                    Topic: {word.topic}
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