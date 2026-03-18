import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type WordDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WordDetailPage({
  params,
}: WordDetailPageProps) {
  const { slug } = await params;

  const { data: word, error } = await supabase
    .from("vocabulary_words")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !word) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Word not found</h1>
          <p className="mt-2 text-slate-600">
            We could not find that vocabulary word.
          </p>
          <Link href="/words" className="mt-4 inline-block text-blue-600">
            Back to words
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-bold text-slate-900">{word.word}</h1>

            {word.premium_only && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                Premium
              </span>
            )}
          </div>

          <p className="mt-4 text-lg text-slate-700">{word.definition}</p>

          {word.example_sentence && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Example sentence
              </h2>
              <p className="mt-2 text-slate-700">{word.example_sentence}</p>
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Difficulty
              </h3>
              <p className="mt-1 text-slate-600">{word.difficulty || "—"}</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">Topic</h3>
              <p className="mt-1 text-slate-600">{word.topic || "—"}</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Synonyms
              </h3>
              <p className="mt-1 text-slate-600">{word.synonyms || "—"}</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Antonyms
              </h3>
              <p className="mt-1 text-slate-600">{word.antonyms || "—"}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}