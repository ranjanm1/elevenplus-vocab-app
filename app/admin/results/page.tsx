"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

type QuizResultRow = {
  id: string;
  user_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type StudentRow = {
  id: string;
  parent_user_id: string;
  full_name: string | null;
  is_primary: boolean;
};

type StudentSummary = {
  userId: string;
  attempts: number;
  avgPercentage: number;
  bestPercentage: number;
  latestPercentage: number;
  lastActive: string;
  trendDelta: number | null;
  status: "On Track" | "Watch" | "At Risk";
};

const RANGE_OPTIONS = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function daysSince(dateIso: string) {
  const dateMs = new Date(dateIso).getTime();
  const nowMs = Date.now();
  const diffMs = Math.max(0, nowMs - dateMs);
  return diffMs / (1000 * 60 * 60 * 24);
}

function getStatus(avgPercentage: number, lastActiveIso: string): StudentSummary["status"] {
  const inactiveDays = daysSince(lastActiveIso);
  if (avgPercentage < 60 || inactiveDays > 14) return "At Risk";
  if (avgPercentage < 80 || inactiveDays > 7) return "Watch";
  return "On Track";
}

function toStartIso(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days + 1);
  return date.toISOString();
}

function userLabel(userId: string) {
  if (!userId) return "Unknown";
  return `Student ${userId.slice(0, 8)}`;
}

function isMissingTableError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("relation") && lower.includes("does not exist")
  ) || lower.includes("profiles") || lower.includes("students");
}

export default function AdminResultsPage() {
  const { user, authLoading } = useAuth();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false);

  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [searchText, setSearchText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [summaries, setSummaries] = useState<StudentSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedAttempts, setSelectedAttempts] = useState<QuizResultRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileRow>>({});
  const [studentMap, setStudentMap] = useState<Record<string, StudentRow>>({});

  useEffect(() => {
    if (user) {
      loadRole();
    } else if (!authLoading) {
      setIsAdmin(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (isAdmin) {
      loadResults();
    }
  }, [isAdmin, rangeKey]);

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
        error instanceof Error ? error.message : "Failed to load results page."
      );
    } finally {
      setLoadingRole(false);
    }
  }

  async function loadResults() {
    const range = RANGE_OPTIONS.find((option) => option.key === rangeKey);
    if (!range) return;

    setLoadingData(true);
    setErrorMessage("");

    const currentStartIso = toStartIso(range.days);
    const previousStartIso = toStartIso(range.days * 2);

    try {
      const [{ data: currentRows, error: currentError }, { data: previousRows, error: previousError }] =
        await Promise.all([
          supabase
            .from("quiz_results")
            .select("id, user_id, score, total_questions, percentage, created_at")
            .gte("created_at", currentStartIso)
            .order("created_at", { ascending: false }),
          supabase
            .from("quiz_results")
            .select("user_id, percentage, created_at")
            .gte("created_at", previousStartIso)
            .lt("created_at", currentStartIso),
        ]);

      if (currentError) throw new Error(currentError.message);
      if (previousError) throw new Error(previousError.message);

      const current = (currentRows as QuizResultRow[]) || [];
      const previous = (previousRows as Pick<QuizResultRow, "user_id" | "percentage" | "created_at">[]) || [];

      const userIds = Array.from(new Set(current.map((row) => row.user_id)));
      let profileRows: ProfileRow[] = [];
      let studentRows: StudentRow[] = [];
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        if (profilesError) {
          if (!isMissingTableError(profilesError.message)) {
            throw new Error(profilesError.message);
          }
        } else {
          profileRows = (profilesData as ProfileRow[]) || [];
        }

        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select("id, parent_user_id, full_name, is_primary")
          .in("parent_user_id", userIds)
          .eq("is_primary", true);

        if (studentsError) {
          if (!isMissingTableError(studentsError.message)) {
            throw new Error(studentsError.message);
          }
        } else {
          studentRows = (studentsData as StudentRow[]) || [];
        }
      }

      const nextProfileMap: Record<string, ProfileRow> = {};
      for (const profile of profileRows) {
        nextProfileMap[profile.id] = profile;
      }
      setProfileMap(nextProfileMap);

      const nextStudentMap: Record<string, StudentRow> = {};
      for (const student of studentRows) {
        nextStudentMap[student.parent_user_id] = student;
      }
      setStudentMap(nextStudentMap);

      const currentByUser = new Map<string, QuizResultRow[]>();
      for (const row of current) {
        const list = currentByUser.get(row.user_id) || [];
        list.push(row);
        currentByUser.set(row.user_id, list);
      }

      const previousByUser = new Map<string, number[]>();
      for (const row of previous) {
        const list = previousByUser.get(row.user_id) || [];
        list.push(row.percentage);
        previousByUser.set(row.user_id, list);
      }

      const nextSummaries: StudentSummary[] = Array.from(currentByUser.entries()).map(
        ([userId, rows]) => {
          const sorted = [...rows].sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const percentages = sorted.map((row) => row.percentage);
          const avgPercentage = average(percentages);
          const bestPercentage = Math.max(...percentages);
          const latestPercentage = sorted[0]?.percentage ?? 0;
          const lastActive = sorted[0]?.created_at ?? new Date(0).toISOString();

          const previousAvg = average(previousByUser.get(userId) || []);
          const trendDelta =
            (previousByUser.get(userId) || []).length > 0
              ? avgPercentage - previousAvg
              : null;

          return {
            userId,
            attempts: rows.length,
            avgPercentage,
            bestPercentage,
            latestPercentage,
            lastActive,
            trendDelta,
            status: getStatus(avgPercentage, lastActive),
          };
        }
      );

      nextSummaries.sort((a, b) => {
        const timeA = new Date(a.lastActive).getTime();
        const timeB = new Date(b.lastActive).getTime();
        return timeB - timeA;
      });

      setSummaries(nextSummaries);

      if (selectedUserId) {
        const stillExists = nextSummaries.some((item) => item.userId === selectedUserId);
        if (!stillExists) {
          setSelectedUserId(null);
          setSelectedAttempts([]);
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load quiz results."
      );
      setSummaries([]);
      setProfileMap({});
      setStudentMap({});
    } finally {
      setLoadingData(false);
    }
  }

  async function loadStudentDetail(userId: string) {
    setSelectedUserId(userId);
    setLoadingStudentDetail(true);

    try {
      const { data, error } = await supabase
        .from("quiz_results")
        .select("id, user_id, score, total_questions, percentage, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw new Error(error.message);

      setSelectedAttempts((data as QuizResultRow[]) || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load student detail."
      );
      setSelectedAttempts([]);
    } finally {
      setLoadingStudentDetail(false);
    }
  }

  const filteredSummaries = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return summaries;
    return summaries.filter((item) => {
      const idMatch = item.userId.toLowerCase().includes(query);
      const profile = profileMap[item.userId];
      const student = studentMap[item.userId];
      const name = (
        student?.full_name ||
        profile?.full_name ||
        userLabel(item.userId)
      ).toLowerCase();
      const email = (profile?.email || "").toLowerCase();
      return idMatch || name.includes(query) || email.includes(query);
    });
  }, [summaries, searchText, profileMap, studentMap]);

  const totalAttempts = summaries.reduce((sum, item) => sum + item.attempts, 0);
  const allAverages = summaries.map((item) => item.avgPercentage);
  const averageScore = allAverages.length ? average(allAverages) : 0;
  const activeStudents = summaries.filter(
    (item) => daysSince(item.lastActive) <= 7
  ).length;
  const atRiskStudents = summaries.filter(
    (item) => item.status === "At Risk"
  ).length;

  if (authLoading || loadingRole) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-slate-600">Loading student progress...</p>
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
              Please log in to access student progress analytics.
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

  if (errorMessage && !isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h1 className="text-3xl font-bold text-slate-900">Something went wrong</h1>
            <p className="mt-3 text-slate-600">{errorMessage}</p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
            >
              Back to dashboard
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
              Only admin users can view student progress.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
            >
              Back to dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-green-950">Student Progress</h1>
          <p className="mt-2 text-slate-700">
            Track learner activity, average scores, and at-risk students.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Active students (7d)</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{activeStudents}</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total quizzes</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{totalAttempts}</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Average score</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {Math.round(averageScore)}%
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">At-risk students</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{atRiskStudents}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setRangeKey(option.key)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  rangeKey === option.key
                    ? "bg-green-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by name, email, or id..."
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
          />
        </div>

        {errorMessage && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Last active</th>
                <th className="px-4 py-3 font-medium">Quizzes</th>
                <th className="px-4 py-3 font-medium">Avg %</th>
                <th className="px-4 py-3 font-medium">Best %</th>
                <th className="px-4 py-3 font-medium">Trend</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingData ? (
                <tr>
                  <td colSpan={8} className="px-4 py-5 text-slate-500">
                    Loading student progress...
                  </td>
                </tr>
              ) : filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-5 text-slate-500">
                    No quiz activity found for this period.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((student) => (
                  <tr key={student.userId} className="border-t">
                    <td className="px-4 py-3">
                      {(() => {
                        const profile = profileMap[student.userId];
                        const studentProfile = studentMap[student.userId];
                        const displayName =
                          studentProfile?.full_name?.trim() ||
                          profile?.full_name?.trim() ||
                          userLabel(student.userId);
                        return (
                          <>
                            <div className="font-medium text-slate-900">{displayName}</div>
                            <div className="text-xs text-slate-500">
                              {profile?.email || student.userId}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(student.lastActive).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{student.attempts}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {Math.round(student.avgPercentage)}%
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {Math.round(student.bestPercentage)}%
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {student.trendDelta === null
                        ? "—"
                        : `${student.trendDelta >= 0 ? "+" : ""}${Math.round(
                            student.trendDelta
                          )}%`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          student.status === "On Track"
                            ? "bg-green-100 text-green-800"
                            : student.status === "Watch"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => loadStudentDetail(student.userId)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedUserId && (
          <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
            {(() => {
              const profile = profileMap[selectedUserId];
              const studentProfile = studentMap[selectedUserId];
              const displayName =
                studentProfile?.full_name?.trim() ||
                profile?.full_name?.trim() ||
                userLabel(selectedUserId);
              return (
                <>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {displayName} details
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {profile?.email || selectedUserId}
                  </p>
                </>
              );
            })()}

            {loadingStudentDetail ? (
              <p className="mt-4 text-sm text-slate-600">Loading student detail...</p>
            ) : selectedAttempts.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                No attempts available for this student.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAttempts.map((attempt) => (
                      <tr key={attempt.id} className="border-t">
                        <td className="px-4 py-3 text-slate-700">
                          {new Date(attempt.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {attempt.score}/{attempt.total_questions}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {attempt.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
