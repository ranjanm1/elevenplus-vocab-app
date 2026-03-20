"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UserInfo = {
  email?: string;
  fullName?: string;
};

type QuizResult = {
  id: string;
  score: number;
  total_questions: number;
  percentage: number;
  created_at: string;
};

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [latestResult, setLatestResult] = useState<QuizResult | null>(null);
  const [quizCount, setQuizCount] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadSessionAndResults() {
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

      const { data: results } = await supabase
        .from("quiz_results")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (results && results.length > 0) {
        setLatestResult(results[0]);
        setQuizCount(results.length);
        setBestScore(Math.max(...results.map((r) => r.percentage)));
      } else {
        setLatestResult(null);
        setQuizCount(0);
        setBestScore(null);
      }

      setLoading(false);
    }

    loadSessionAndResults();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-slate-600">Loading dashboard...</p>
        </section>
      </main>
    );
  }

  const displayName = user?.fullName || user?.email || "Parent";

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-green-950">
            Welcome, {displayName}
          </h1>
          <p className="mt-2 text-slate-700">
            Track vocabulary progress, review quiz performance, and continue learning.
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-slate-500">Quizzes completed</h2>
            <p className="mt-2 text-3xl font-bold text-slate-900">{quizCount}</p>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-slate-500">Best score</h2>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {bestScore !== null ? `${bestScore}%` : "—"}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-slate-500">Latest result</h2>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {latestResult
                ? `${latestResult.score}/${latestResult.total_questions}`
                : "—"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/words"
            className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">Browse Words</h2>
            <p className="mt-2 text-sm text-slate-600">
              Explore vocabulary lists and revise key 11+ words.
            </p>
          </Link>

          <Link
            href="/quiz"
            className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">Start Quiz</h2>
            <p className="mt-2 text-sm text-slate-600">
              Practise vocabulary with quiz-based learning.
            </p>
          </Link>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Account</h2>
            <p className="mt-2 text-sm text-slate-600">
              Signed in as: {user?.email}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Recent quiz summary</h2>

          {!latestResult ? (
            <p className="mt-3 text-sm text-slate-600">
              No quiz attempts yet. Start your first quiz to see progress here.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="text-sm font-medium text-slate-500">Score</h3>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {latestResult.score}/{latestResult.total_questions}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="text-sm font-medium text-slate-500">Accuracy</h3>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {latestResult.percentage}%
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="text-sm font-medium text-slate-500">Completed</h3>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {new Date(latestResult.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}