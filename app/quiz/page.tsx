"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type QuizWord = {
  id: string;
  word: string;
  definition: string;
  quiz_option_1: string | null;
  quiz_option_2: string | null;
  quiz_option_3: string | null;
};

const TOTAL_QUESTIONS = 10;

function shuffleArray<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export default function QuizPage() {
  const router = useRouter();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [word, setWord] = useState<QuizWord | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasScoredCurrentQuestion, setHasScoredCurrentQuestion] = useState(false);

  const [score, setScore] = useState(0);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [usedWordIds, setUsedWordIds] = useState<string[]>([]);
  const [quizComplete, setQuizComplete] = useState(false);
  const [resultSaved, setResultSaved] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadQuestion(nextUsedWordIds?: string[]) {
    setLoading(true);
    setError("");
    setSelectedAnswer(null);
    setHasScoredCurrentQuestion(false);

    const { data, error } = await supabase
      .from("vocabulary_words")
      .select("id, word, definition, quiz_option_1, quiz_option_2, quiz_option_3")
      .eq("active", true);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setError("No quiz words available.");
      setLoading(false);
      return;
    }

    const validWords = data.filter(
      (item) =>
        item.definition &&
        item.quiz_option_1 &&
        item.quiz_option_2 &&
        item.quiz_option_3
    ) as QuizWord[];

    if (validWords.length === 0) {
      setError("No quiz-ready words found. Please add quiz options.");
      setLoading(false);
      return;
    }

    const alreadyUsed = nextUsedWordIds ?? usedWordIds;

    let availableWords = validWords.filter(
      (item) => !alreadyUsed.includes(item.id)
    );

    let refreshedUsedIds = alreadyUsed;

    if (availableWords.length === 0) {
      availableWords = validWords;
      refreshedUsedIds = [];
      setUsedWordIds([]);
    }

    const randomWord =
      availableWords[Math.floor(Math.random() * availableWords.length)];

    const shuffledOptions = shuffleArray([
      randomWord.definition,
      randomWord.quiz_option_1!,
      randomWord.quiz_option_2!,
      randomWord.quiz_option_3!,
    ]);

    setWord(randomWord);
    setOptions(shuffledOptions);
    setLoading(false);

    setUsedWordIds((prev) => {
      const baseIds = nextUsedWordIds ?? refreshedUsedIds ?? prev;
      return [...baseIds, randomWord.id];
    });
  }

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);
      setCurrentUserId(session.user.id);
      await loadQuestion([]);
    }

    checkSession();
  }, []);

  const answerState = useMemo(() => {
    if (!selectedAnswer || !word) return null;
    return selectedAnswer === word.definition ? "correct" : "incorrect";
  }, [selectedAnswer, word]);

  function handleAnswerSelect(option: string) {
    if (!word || selectedAnswer || quizComplete) return;

    setSelectedAnswer(option);

    if (!hasScoredCurrentQuestion && option === word.definition) {
      setScore((prev) => prev + 1);
      setHasScoredCurrentQuestion(true);
    } else if (!hasScoredCurrentQuestion) {
      setHasScoredCurrentQuestion(true);
    }
  }

  async function saveQuizResult(finalScore: number) {
    if (!currentUserId || resultSaved) return;

    const percentage = Math.round((finalScore / TOTAL_QUESTIONS) * 100);

    const { error } = await supabase.from("quiz_results").insert({
      user_id: currentUserId,
      score: finalScore,
      total_questions: TOTAL_QUESTIONS,
      percentage,
    });

    if (!error) {
      setResultSaved(true);
    }
  }

  async function handleNextQuestion() {
    if (questionNumber >= TOTAL_QUESTIONS) {
      setQuizComplete(true);
      await saveQuizResult(score);
      return;
    }

    setQuestionNumber((prev) => prev + 1);
    await loadQuestion();
  }

  async function handleRestartQuiz() {
    setScore(0);
    setQuestionNumber(1);
    setUsedWordIds([]);
    setQuizComplete(false);
    setSelectedAnswer(null);
    setHasScoredCurrentQuestion(false);
    setResultSaved(false);
    await loadQuestion([]);
  }

  const percentage = Math.round((score / TOTAL_QUESTIONS) * 100);

  if (isAuthenticated === false) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
            <h1 className="text-3xl font-bold text-slate-900">
              Quiz is for registered users
            </h1>
            <p className="mt-3 text-slate-600">
              Please sign in to access quizzes, save your results, and track progress.
            </p>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
              >
                Go to login
              </Link>

              <button
                type="button"
                onClick={() => router.push("/signup")}
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Create account
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-green-950">Vocabulary Quiz</h1>
          <p className="mt-2 text-slate-700">
            Test your understanding of key 11+ vocabulary words.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          {loading && <p className="text-slate-600">Loading question...</p>}

          {error && <p className="text-red-600">Error: {error}</p>}

          {!loading && !error && quizComplete && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-800">
                {score}/{TOTAL_QUESTIONS}
              </div>

              <h2 className="text-3xl font-bold text-slate-900">
                Quiz complete
              </h2>

              <p className="mt-3 text-slate-600">
                You scored <span className="font-semibold">{score}</span> out of{" "}
                <span className="font-semibold">{TOTAL_QUESTIONS}</span>.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Accuracy: {percentage}%
              </p>

              {resultSaved && (
                <p className="mt-3 text-sm font-medium text-green-700">
                  Your quiz result has been saved.
                </p>
              )}

              <div className="mt-8">
                <button
                  type="button"
                  onClick={handleRestartQuiz}
                  className="rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
                >
                  Restart quiz
                </button>
              </div>
            </div>
          )}

          {!loading && !error && !quizComplete && word && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                  Question {questionNumber} of {TOTAL_QUESTIONS}
                </span>
                <span className="text-sm font-medium text-slate-600">
                  Score: {score}
                </span>
              </div>

              <h2 className="text-2xl font-bold text-slate-900">
                What is the meaning of the word &quot;{word.word}&quot;?
              </h2>

              <div className="mt-6 grid gap-3">
                {options.map((option) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrect = option === word.definition;

                  let buttonClass =
                    "border-slate-200 bg-white text-slate-800 hover:border-green-300 hover:bg-green-50";

                  if (selectedAnswer) {
                    if (isCorrect) {
                      buttonClass =
                        "border-green-600 bg-green-50 text-green-900";
                    } else if (isSelected) {
                      buttonClass = "border-red-500 bg-red-50 text-red-700";
                    }
                  } else if (isSelected) {
                    buttonClass =
                      "border-green-600 bg-green-50 text-green-900";
                  }

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleAnswerSelect(option)}
                      disabled={!!selectedAnswer}
                      className={`rounded-xl border px-4 py-4 text-left text-sm font-medium transition ${buttonClass}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex items-center justify-between gap-4">
                <div>
                  {!selectedAnswer && (
                    <p className="text-sm text-slate-500">
                      Select the best meaning for the word.
                    </p>
                  )}

                  {answerState === "correct" && (
                    <p className="text-sm font-medium text-green-700">
                      Correct — well done!
                    </p>
                  )}

                  {answerState === "incorrect" && (
                    <p className="text-sm font-medium text-red-700">
                      Not quite. The correct answer is: {word.definition}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  disabled={!selectedAnswer}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {questionNumber === TOTAL_QUESTIONS
                    ? "Finish quiz"
                    : "Next question"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}