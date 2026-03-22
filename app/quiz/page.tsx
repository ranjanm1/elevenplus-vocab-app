"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type QuizWord = {
  id: string;
  word: string;
  definition: string;
};

type QuizQuestion = {
  id: string;
  word: string;
  correctAnswer: string;
  options: string[];
};

const QUIZ_SIZE = 10;
const WORD_POOL_SIZE = 80;

function shuffleArray<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export default function QuizPage() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [savingResult, setSavingResult] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      setCheckingAccess(true);
      setErrorMessage("");

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw new Error(error.message);
        }

        if (!session?.user) {
          setIsLoggedIn(false);
          return;
        }

        setIsLoggedIn(true);
        await loadQuizQuestions();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to check access."
        );
      } finally {
        setCheckingAccess(false);
      }
    }

    checkAccess();
  }, []);

  async function loadQuizQuestions() {
    setLoadingQuiz(true);
    setErrorMessage("");

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

      const pool = shuffleArray((data as QuizWord[]) || []).filter(
        (item) => item.word && item.definition
      );

      if (pool.length < QUIZ_SIZE) {
        throw new Error("Not enough words available to generate a quiz.");
      }

      const selectedWords = pool.slice(0, QUIZ_SIZE);

      const generatedQuestions = selectedWords.map((item) => {
        const distractors = shuffleArray(
          pool
            .filter((candidate) => candidate.id !== item.id)
            .map((candidate) => candidate.definition)
            .filter(
              (definition, index, arr) =>
                definition &&
                definition !== item.definition &&
                arr.indexOf(definition) === index
            )
        ).slice(0, 3);

        return {
          id: item.id,
          word: item.word,
          correctAnswer: item.definition,
          options: shuffleArray([item.definition, ...distractors]),
        };
      });

      setQuestions(generatedQuestions);
      setCurrentQuestionIndex(0);
      setSelectedAnswer("");
      setSubmitted(false);
      setScore(0);
      setQuizFinished(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load quiz."
      );
    } finally {
      setLoadingQuiz(false);
    }
  }

  async function saveQuizResult(finalScore: number) {
    setSavingResult(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      const percentage = Math.round((finalScore / questions.length) * 100);

      const { error } = await supabase.from("quiz_results").insert({
        user_id: session.user.id,
        score: finalScore,
        total_questions: questions.length,
        percentage,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save quiz result."
      );
    } finally {
      setSavingResult(false);
    }
  }

  function handleSubmitAnswer() {
    if (!selectedAnswer) return;
    setSubmitted(true);
  }

  async function handleNextQuestion() {
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    const newScore = isCorrect ? score + 1 : score;

    if (isCorrect) {
      setScore(newScore);
    }

    if (currentQuestionIndex === questions.length - 1) {
      setQuizFinished(true);
      await saveQuizResult(newScore);
      return;
    }

    setCurrentQuestionIndex((prev) => prev + 1);
    setSelectedAnswer("");
    setSubmitted(false);
  }

  async function handleRestartQuiz() {
    await loadQuizQuestions();
  }

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-4xl px-6 py-10">
          <p className="text-slate-600">Checking access...</p>
        </section>
      </main>
    );
  }

  if (!isLoggedIn) {
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
            <button
              type="button"
              onClick={handleRestartQuiz}
              className="mt-6 rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
            >
              Try again
            </button>
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
            <h1 className="text-3xl font-bold text-slate-900">Quiz complete</h1>
            <p className="mt-4 text-lg text-slate-700">
              You scored {score} out of {questions.length}
            </p>
            <p className="mt-2 text-slate-600">
              Accuracy: {Math.round((score / questions.length) * 100)}%
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
                Restart quiz
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
  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Vocabulary Quiz</h1>
            <p className="text-sm text-slate-600">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>

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
                  ? "Finish quiz"
                  : "Next question"}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}