"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  buildDefinitionMatchQuestions,
  type AssessmentQuizQuestion,
  type QuizWord,
} from "@/lib/assessment-quiz";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

type StudentRow = {
  id: string;
  full_name: string | null;
};

type AssignedAssessmentInfo = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  due_at: string | null;
  available_from: string | null;
  status: string;
  max_attempts: number | null;
};

type SubmittedAnswer = {
  itemId: string;
  wordId: string;
  selectedAnswer: string;
};

const QUIZ_SIZE = 10;
const WORD_POOL_SIZE = 80;

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50">
          <section className="mx-auto max-w-4xl px-6 py-10">
            <p className="text-slate-600">Loading quiz...</p>
          </section>
        </main>
      }
    >
      <QuizPageContent />
    </Suspense>
  );
}

function QuizPageContent() {
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignment")?.trim() || "";
  const { user, session, authLoading } = useAuth();

  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [questions, setQuestions] = useState<AssessmentQuizQuestion[]>([]);
  const [assignmentInfo, setAssignmentInfo] = useState<AssignedAssessmentInfo | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedAnswers, setSubmittedAnswers] = useState<SubmittedAnswer[]>([]);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [startedAt, setStartedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    if (assignmentId) {
      void loadAssignedQuiz(assignmentId);
      return;
    }

    void loadPracticeQuiz();
    void loadStudentName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, session, user]);

  function resetQuizState() {
    setCurrentQuestionIndex(0);
    setSelectedAnswer("");
    setSubmitted(false);
    setSubmittedAnswers([]);
    setScore(0);
    setQuizFinished(false);
    setStartedAt(new Date().toISOString());
  }

  async function loadStudentName() {
    if (!user) return;

    const { data, error } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("parent_user_id", user.id)
      .eq("is_primary", true)
      .maybeSingle();

    if (error || !data) {
      setStudentName("");
      return;
    }

    setStudentName((data as StudentRow).full_name || "");
  }

  async function loadPracticeQuiz() {
    setLoadingQuiz(true);
    setErrorMessage("");
    setAssignmentInfo(null);

    try {
      const { data, error } = await supabase
        .from("vocabulary_words")
        .select("id, word, definition")
        .eq("active", true)
        .eq("premium_only", false)
        .limit(WORD_POOL_SIZE);

      if (error) {
        throw new Error(error.message);
      }

      const pool = ((data as QuizWord[]) || []).filter(
        (item) => item.word && item.definition
      );

      if (pool.length < QUIZ_SIZE) {
        throw new Error("Not enough words available to generate a quiz.");
      }

      const selectedWords = pool
        .sort(() => Math.random() - 0.5)
        .slice(0, QUIZ_SIZE);

      setQuestions(buildDefinitionMatchQuestions(selectedWords, pool));
      resetQuizState();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load quiz."
      );
      setQuestions([]);
    } finally {
      setLoadingQuiz(false);
    }
  }

  async function loadAssignedQuiz(targetAssignmentId: string) {
    if (!session?.access_token) {
      setErrorMessage("Your session expired. Please log in again.");
      return;
    }

    setLoadingQuiz(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/student/assigned-assessment?assignmentId=${encodeURIComponent(
          targetAssignmentId
        )}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const payload = (await response.json()) as {
        assignment?: AssignedAssessmentInfo;
        student?: StudentRow;
        questions?: AssessmentQuizQuestion[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load assigned assessment.");
      }

      setAssignmentInfo(payload.assignment || null);
      setStudentName(payload.student?.full_name || "");
      setQuestions(payload.questions || []);
      resetQuizState();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load assigned assessment."
      );
      setQuestions([]);
    } finally {
      setLoadingQuiz(false);
    }
  }

  async function savePracticeQuizResult(finalScore: number) {
    if (!user) return;

    const percentage = Math.round((finalScore / questions.length) * 100);
    const { error } = await supabase.from("quiz_results").insert({
      user_id: user.id,
      score: finalScore,
      total_questions: questions.length,
      percentage,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async function saveAssignedQuizResult(finalAnswers: SubmittedAnswer[]) {
    if (!session?.access_token || !assignmentId) {
      throw new Error("Assigned quiz submission is unavailable.");
    }

    const response = await fetch("/api/student/assigned-assessment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        assignmentId,
        answers: finalAnswers,
        startedAt,
      }),
    });

    const payload = (await response.json()) as {
      result?: {
        score: number;
        total_questions: number;
        percentage: number;
      };
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || "Failed to save assigned assessment.");
    }

    return payload.result || null;
  }

  function handleSubmitAnswer() {
    if (!selectedAnswer) return;
    setSubmitted(true);
  }

  async function handleNextQuestion() {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    const nextScore = isCorrect ? score + 1 : score;
    const nextAnswers = [
      ...submittedAnswers,
      {
        itemId: currentQuestion.itemId,
        wordId: currentQuestion.wordId,
        selectedAnswer,
      },
    ];

    if (isCorrect) {
      setScore(nextScore);
    }

    if (currentQuestionIndex === questions.length - 1) {
      setQuizFinished(true);
      setSubmittedAnswers(nextAnswers);
      setSavingResult(true);

      try {
        if (assignmentId) {
          await saveAssignedQuizResult(nextAnswers);
        } else {
          await savePracticeQuizResult(nextScore);
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to save quiz result."
        );
      } finally {
        setSavingResult(false);
      }

      return;
    }

    setSubmittedAnswers(nextAnswers);
    setCurrentQuestionIndex((prev) => prev + 1);
    setSelectedAnswer("");
    setSubmitted(false);
  }

  async function handleRestartQuiz() {
    if (assignmentId) {
      await loadAssignedQuiz(assignmentId);
      return;
    }

    await loadPracticeQuiz();
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-4xl px-6 py-10">
          <p className="text-slate-600">Checking access...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h1 className="text-3xl font-bold text-slate-900">
              Quiz is for registered users
            </h1>
            <p className="mt-3 text-slate-600">
              Please log in to access the vocabulary quiz and save progress.
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

  if (loadingQuiz) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-4xl px-6 py-10">
          <p className="text-slate-600">Loading quiz...</p>
        </section>
      </main>
    );
  }

  if (errorMessage && questions.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">Quiz unavailable</h1>
            <p className="mt-3 text-slate-600">{errorMessage}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRestartQuiz}
                className="rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
              >
                Try again
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (quizFinished) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h1 className="text-3xl font-bold text-slate-900">
              {assignmentId ? "Assessment complete" : "Quiz complete"}
            </h1>
            <p className="mt-4 text-lg text-slate-700">
              You scored {score} out of {questions.length}
            </p>
            <p className="mt-2 text-slate-600">
              Accuracy: {questions.length ? Math.round((score / questions.length) * 100) : 0}%
            </p>

            {savingResult && (
              <p className="mt-4 text-sm text-slate-500">Saving result...</p>
            )}

            {errorMessage && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleRestartQuiz}
                className="rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
              >
                {assignmentId ? "Retry assigned quiz" : "Restart quiz"}
              </button>

              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  if (!currentQuestion) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">Quiz unavailable</h1>
            <p className="mt-3 text-slate-600">
              No quiz question is available right now.
            </p>
            <button
              type="button"
              onClick={handleRestartQuiz}
              className="mt-6 rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
            >
              Reload quiz
            </button>
          </div>
        </section>
      </main>
    );
  }

  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
  const title = assignmentInfo?.title || "Vocabulary Quiz";
  const subtitle = assignmentInfo?.instructions || "What is the meaning of this word?";

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              {studentName && (
                <p className="mt-1 text-sm text-slate-600">Student: {studentName}</p>
              )}
              {assignmentInfo?.due_at && (
                <p className="mt-1 text-xs text-slate-500">
                  Due: {new Date(assignmentInfo.due_at).toLocaleString()}
                </p>
              )}
            </div>
            <p className="text-sm text-slate-600">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>

          {assignmentInfo && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-700">
                  Assigned assessment
                </span>
                {assignmentInfo.max_attempts !== null && (
                  <span>Max attempts: {assignmentInfo.max_attempts}</span>
                )}
                {assignmentInfo.status && <span>Status: {assignmentInfo.status}</span>}
              </div>
              {assignmentInfo.description && (
                <p className="mt-3 text-sm text-slate-600">
                  {assignmentInfo.description}
                </p>
              )}
            </div>
          )}

          <p className="mb-2 text-sm text-slate-500">{subtitle}</p>
          <p className="mb-6 text-lg text-slate-700">
            What is the meaning of{" "}
            <span className="font-bold text-slate-900">{currentQuestion.word}</span>?
          </p>

          <div className="space-y-3">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedAnswer === option;
              const isRightAnswer = option === currentQuestion.correctAnswer;

              let className =
                "w-full rounded-lg border px-4 py-3 text-left text-sm transition ";

              if (submitted) {
                if (isRightAnswer) {
                  className += "border-green-500 bg-green-50 text-green-800";
                } else if (isSelected) {
                  className += "border-red-500 bg-red-50 text-red-800";
                } else {
                  className += "border-slate-300 bg-white text-slate-700";
                }
              } else if (isSelected) {
                className += "border-green-600 bg-green-50 text-slate-900";
              } else {
                className +=
                  "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
              }

              return (
                <button
                  key={option}
                  type="button"
                  disabled={submitted}
                  onClick={() => setSelectedAnswer(option)}
                  className={className}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {!submitted ? (
            <button
              type="button"
              onClick={handleSubmitAnswer}
              disabled={!selectedAnswer}
              className="mt-6 rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit answer
            </button>
          ) : (
            <div className="mt-6">
              <p
                className={`mb-4 text-sm font-medium ${
                  isCorrect ? "text-green-700" : "text-red-700"
                }`}
              >
                {isCorrect
                  ? "Correct!"
                  : `Incorrect. Correct answer: ${currentQuestion.correctAnswer}`}
              </p>

              <button
                type="button"
                onClick={handleNextQuestion}
                className="rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
              >
                {currentQuestionIndex === questions.length - 1
                  ? assignmentId
                    ? "Finish assessment"
                    : "Finish quiz"
                  : "Next question"}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
