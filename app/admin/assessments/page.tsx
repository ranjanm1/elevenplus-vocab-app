"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

type AdminStudent = {
  id: string;
  full_name: string | null;
  parent_name: string | null;
  parent_email: string | null;
};

type VocabularyWord = {
  id: string;
  word: string;
  definition: string;
  difficulty: string | null;
  topic: string | null;
};

type RecentAssignment = {
  id: string;
  assigned_at: string;
  due_at: string | null;
  status: string;
  student_name: string | null;
  parent_email: string | null;
  assessment_title: string;
};

type WordSearchResponse = {
  words?: VocabularyWord[];
  total?: number;
  has_more?: boolean;
  filters?: {
    difficulties?: string[];
    topics?: string[];
  };
  error?: string;
};

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function sortStudents(items: AdminStudent[]) {
  return [...items].sort((left, right) => {
    const leftLabel = left.full_name || left.parent_email || "";
    const rightLabel = right.full_name || right.parent_email || "";
    return leftLabel.localeCompare(rightLabel);
  });
}

export default function AdminAssessmentsPage() {
  const { user, session, authLoading } = useAuth();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);
  const [loadingWords, setLoadingWords] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [availableWords, setAvailableWords] = useState<VocabularyWord[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<RecentAssignment[]>([]);
  const [difficultyOptions, setDifficultyOptions] = useState<string[]>([]);
  const [topicOptions, setTopicOptions] = useState<string[]>([]);
  const [wordTotal, setWordTotal] = useState(0);
  const [hasMoreWords, setHasMoreWords] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState(
    "Choose the correct definition for each vocabulary word."
  );
  const [studentId, setStudentId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [wordSearch, setWordSearch] = useState("");
  const [wordDifficulty, setWordDifficulty] = useState("all");
  const [wordTopic, setWordTopic] = useState("all");
  const [wordPage, setWordPage] = useState(1);
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [selectedWordMap, setSelectedWordMap] = useState<Record<string, VocabularyWord>>({});

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (user) {
      void loadRole();
    } else if (!authLoading) {
      setIsAdmin(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadStudents();
    void loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const timeoutId = window.setTimeout(() => {
      void loadWords(1, false);
    }, 250);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session?.access_token, wordSearch, wordDifficulty, wordTopic]);

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
        error instanceof Error ? error.message : "Failed to load assessments page."
      );
    } finally {
      setLoadingRole(false);
    }
  }

  async function loadWords(targetPage: number, append: boolean) {
    if (!session?.access_token) return;

    setLoadingWords(true);

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        search: wordSearch,
        difficulty: wordDifficulty,
        topic: wordTopic,
      });

      const response = await fetch(`/api/admin/assessment-words?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = (await response.json()) as WordSearchResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load vocabulary words.");
      }

      const nextWords = payload.words || [];
      setAvailableWords((current) =>
        append
          ? [
              ...current,
              ...nextWords.filter(
                (nextWord) => !current.some((word) => word.id === nextWord.id)
              ),
            ]
          : nextWords
      );
      setDifficultyOptions(payload.filters?.difficulties || []);
      setTopicOptions(payload.filters?.topics || []);
      setWordTotal(payload.total || 0);
      setHasMoreWords(Boolean(payload.has_more));
      setWordPage(targetPage);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load vocabulary words."
      );
    } finally {
      setLoadingWords(false);
    }
  }

  async function loadStudents() {
    if (!session?.access_token) return;

    setLoadingStudents(true);

    try {
      const response = await fetch("/api/admin/students", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = (await response.json()) as {
        students?: AdminStudent[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load students.");
      }

      setStudents(sortStudents(payload.students || []));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load students."
      );
    } finally {
      setLoadingStudents(false);
    }
  }

  async function loadAssignments() {
    if (!session?.access_token) return;

    setLoadingAssignments(true);

    try {
      const response = await fetch("/api/admin/assessments", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = (await response.json()) as {
        assignments?: RecentAssignment[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load recent assignments.");
      }

      setRecentAssignments(payload.assignments || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load recent assignments."
      );
    } finally {
      setLoadingAssignments(false);
    }
  }

  function toggleWord(wordId: string) {
    const word = availableWords.find((item) => item.id === wordId);

    setSelectedWordIds((current) => {
      if (current.includes(wordId)) {
        return current.filter((id) => id !== wordId);
      }

      return [...current, wordId];
    });

    setSelectedWordMap((current) => {
      if (current[wordId]) {
        const next = { ...current };
        delete next[wordId];
        return next;
      }

      if (!word) return current;
      return {
        ...current,
        [wordId]: word,
      };
    });
  }

  async function handleLoadMoreWords() {
    await loadWords(wordPage + 1, true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token) {
      setErrorMessage("Your session expired. Please log in again.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/admin/assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title,
          description,
          instructions,
          studentId,
          wordIds: selectedWordIds,
          dueAt: toIsoOrNull(dueAt),
          maxAttempts: Number(maxAttempts || "1"),
        }),
      });

      const payload = (await response.json()) as {
        assignment?: {
          assessment_title: string;
          student_name: string | null;
          word_count: number;
        };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to create assignment.");
      }

      setSuccessMessage(
        `Assigned "${payload.assignment?.assessment_title || title}" to ${
          payload.assignment?.student_name || "the selected student"
        } with ${payload.assignment?.word_count || selectedWordIds.length} words.`
      );
      setTitle("");
      setDescription("");
      setInstructions("Choose the correct definition for each vocabulary word.");
      setStudentId("");
      setDueAt("");
      setMaxAttempts("1");
      setSelectedWordIds([]);
      setSelectedWordMap({});
      setWordSearch("");
      setWordDifficulty("all");
      setWordTopic("all");
      await loadAssignments();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create assignment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedWords = useMemo(
    () =>
      selectedWordIds
        .map((wordId) => selectedWordMap[wordId])
        .filter(Boolean) as VocabularyWord[],
    [selectedWordIds, selectedWordMap]
  );

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === studentId) || null,
    [studentId, students]
  );

  const filteredWords = useMemo(
    () => availableWords.filter((word) => !selectedWordIds.includes(word.id)),
    [availableWords, selectedWordIds]
  );

  if (authLoading || loadingRole) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-slate-600">Loading assessment tools...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h1 className="text-3xl font-bold text-slate-900">Login required</h1>
            <p className="mt-3 text-slate-600">
              Please log in to manage assessments.
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
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h1 className="text-3xl font-bold text-slate-900">Access denied</h1>
            <p className="mt-3 text-slate-600">
              Only admin users can create assessments.
            </p>
            <Link
              href="/admin"
              className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
            >
              Back to admin
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-green-950">Assessment Assignments</h1>
            <p className="mt-2 max-w-3xl text-slate-700">
              Create a fixed-word vocabulary assessment and assign it directly to a
              student.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-900 hover:bg-green-100"
          >
            Back to admin
          </Link>
        </div>

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

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-slate-900">
              Create assigned vocabulary assessment
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Assessment title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                  placeholder="Week 4 Vocabulary Review"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                  placeholder="Optional note for the student or parent."
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Instructions
                </label>
                <textarea
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Student
                </label>
                <select
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                  required
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name || "Unnamed student"}
                      {student.parent_email ? ` (${student.parent_email})` : ""}
                    </option>
                  ))}
                </select>
                {loadingStudents && (
                  <p className="mt-2 text-xs text-slate-500">Loading students...</p>
                )}
                {selectedStudent && (
                  <p className="mt-2 text-xs text-slate-500">
                    Parent contact: {selectedStudent.parent_email || "No email on file"}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Due date
                </label>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Max attempts
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxAttempts}
                  onChange={(event) => setMaxAttempts(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Add vocabulary words
                    </h3>
                    <p className="text-sm text-slate-600">
                      Pick the exact words you want in this assessment.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {selectedWordIds.length} selected
                  </span>
                </div>

                <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {selectedStudent ? (
                    <p>
                      Building this assessment for{" "}
                      <span className="font-medium text-slate-900">
                        {selectedStudent.full_name || "Unnamed student"}
                      </span>
                      {selectedWordIds.length > 0
                        ? ` with ${selectedWordIds.length} selected words.`
                        : "."}
                    </p>
                  ) : (
                    <p>Select a student and choose at least 4 words to enable assignment.</p>
                  )}
                </div>

                <input
                  type="text"
                  value={wordSearch}
                  onChange={(event) => setWordSearch(event.target.value)}
                  placeholder="Search by word or definition"
                  className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <select
                    value={wordDifficulty}
                    onChange={(event) => setWordDifficulty(event.target.value)}
                    className="rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                  >
                    <option value="all">All difficulties</option>
                    {difficultyOptions.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>
                        {difficulty}
                      </option>
                    ))}
                  </select>

                  <select
                    value={wordTopic}
                    onChange={(event) => setWordTopic(event.target.value)}
                    className="rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
                  >
                    <option value="all">All topics</option>
                    {topicOptions.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p>
                    {wordTotal > 0
                      ? `Showing ${filteredWords.length} of ${wordTotal} matching words`
                      : "No matching words found yet"}
                  </p>
                  {(wordSearch || wordDifficulty !== "all" || wordTopic !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setWordSearch("");
                        setWordDifficulty("all");
                        setWordTopic("all");
                      }}
                      className="text-xs font-medium text-green-800 hover:text-green-900"
                    >
                      Clear filters
                    </button>
                  )}
                </div>

                <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
                  {loadingWords ? (
                    <p className="text-sm text-slate-500">Searching full vocabulary library...</p>
                  ) : filteredWords.length === 0 ? (
                    <p className="text-sm text-slate-500">No matching words found.</p>
                  ) : (
                    <>
                      {filteredWords.map((word) => (
                        <button
                          key={word.id}
                          type="button"
                          onClick={() => toggleWord(word.id)}
                          className="w-full rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-green-300 hover:bg-green-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">{word.word}</p>
                              <p className="mt-1 text-sm text-slate-600">{word.definition}</p>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                              {word.difficulty && (
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                                  {word.difficulty}
                                </span>
                              )}
                              {word.topic && (
                                <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                                  {word.topic}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}

                      {hasMoreWords && (
                        <button
                          type="button"
                          onClick={() => void handleLoadMoreWords()}
                          className="w-full rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:border-green-300 hover:bg-green-50"
                        >
                          Load more words
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-900">
                  Selected words
                </h3>
                <p className="text-sm text-slate-600">
                  At least 4 words are required.
                </p>

                <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
                  {selectedWords.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No words selected yet.
                    </p>
                  ) : (
                    selectedWords.map((word, index) => (
                      <div
                        key={word.id}
                        className="rounded-lg border border-slate-200 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">
                              {index + 1}. {word.word}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {word.definition}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleWord(word.id)}
                            className="text-xs font-medium text-red-700 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || loadingStudents || selectedWordIds.length < 4}
              className="mt-8 rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating assignment..." : "Create and assign assessment"}
            </button>
          </form>

          <aside className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Recent assignments</h2>
            <p className="mt-2 text-sm text-slate-600">
              A quick view of the most recent assessment assignments.
            </p>

            <div className="mt-6 space-y-3">
              {loadingAssignments ? (
                <p className="text-sm text-slate-500">Loading recent assignments...</p>
              ) : recentAssignments.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No assessment assignments created yet.
                </p>
              ) : (
                recentAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {assignment.assessment_title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {assignment.student_name || "Unnamed student"}
                          {assignment.parent_email ? ` • ${assignment.parent_email}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {assignment.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>
                        Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                      </span>
                      {assignment.due_at && (
                        <span>Due {new Date(assignment.due_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
