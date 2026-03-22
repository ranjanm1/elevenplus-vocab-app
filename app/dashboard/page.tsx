"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

type QuizResult = {
  id: string;
  score: number;
  total_questions: number;
  percentage: number;
  created_at: string;
};

export default function DashboardPage() {
  const { user, authLoading } = useAuth();

  const [latestResult, setLatestResult] = useState<QuizResult | null>(null);
  const [quizCount, setQuizCount] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (user) {
      loadResults();
    }
  }, [user]);

  async function loadResults() {
    if (!user) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const { data: results, error } = await supabase
        .from("quiz_results")
        .select("id, score, total_questions, percentage, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (results as QuizResult[]) || [];

      if (rows.length > 0) {
        setLatestResult(rows[0]);
        setQuizCount(rows.length);
        setBestScore(Math.max(...rows.map((r) => r.percentage)));
      } else {
        setLatestResult(null);
        setQuizCount(0);
        setBestScore(null);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-slate-600">Loading dashboard...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard unavailable</h1>
            <p className="mt-3 text-slate-600">
              Please log in to view your dashboard and quiz progress.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
            >
              Go to login
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const displayName =
    user.user_metadata?.full_name || user.email || "Parent";

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

        {loading && (
          <p className="mb-4 text-slate-600">Refreshing dashboard...</p>
        )}

        {errorMessage && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

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
              Signed in as: {user.email}
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