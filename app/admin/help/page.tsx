"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

type GuideSection = {
  id: string;
  title: string;
  href: string;
  summary: string;
  steps: string[];
  tips?: string[];
};

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "assessments",
    title: "Assign Assessments",
    href: "/admin/assessments",
    summary:
      "Create a fixed-word vocabulary assessment for one student and track recent assignments.",
    steps: [
      "Open Assign Assessments and enter a clear assessment title.",
      "Choose the student from the dropdown and optionally set a due date.",
      "Search for vocabulary words and select at least 4 words for the quiz.",
      "Review the selected words count, then click Create assignment.",
      "Check the Recent assignments list to confirm the assessment was created.",
    ],
    tips: [
      "Use a title like 'Week 3 synonyms review' so it is easy to spot later in results.",
      "If a student is missing from the dropdown, that parent account probably does not have a primary student row yet.",
    ],
  },
  {
    id: "results",
    title: "Student Progress",
    href: "/admin/results",
    summary:
      "Review quiz trends, activity, assigned assessment completion, and question-level mistakes.",
    steps: [
      "Use the top summary cards to monitor activity and average scores.",
      "In the first table, click View beside a student to inspect recent quiz attempts.",
      "Scroll to Assigned Assessment Results to review submitted assignments.",
      "Click View beside an assigned assessment to open its attempt review panel.",
      "By default, wrong answers appear first. Use Show all questions to inspect the full attempt.",
    ],
    tips: [
      "The assignment review panel highlights the selected row and scrolls into view automatically.",
      "If a student has not submitted yet, the assessment will still appear but without attempt data.",
    ],
  },
  {
    id: "upload",
    title: "Upload Vocabulary",
    href: "/admin/upload",
    summary:
      "Bulk import vocabulary from CSV or pasted data and review the import summary.",
    steps: [
      "Prepare a CSV with the expected headers such as word, definition, difficulty, example_sentence, topic, and quiz options.",
      "Upload the file or paste the CSV content into the import area.",
      "Run the import and wait for the summary showing inserted, updated, and duplicate rows.",
      "Use the export option if you want to inspect the current vocabulary data first.",
    ],
    tips: [
      "The import expects 11 columns and validates the header names.",
      "The system updates existing words by slug, so small spelling changes can create a new record.",
    ],
  },
  {
    id: "words",
    title: "Manage Words",
    href: "/admin/words",
    summary:
      "Search, filter, edit, archive, and delete vocabulary entries one by one.",
    steps: [
      "Search by word and optionally filter by difficulty.",
      "Click Edit on a row to open the edit panel.",
      "Update the definition, examples, synonyms, antonyms, topic, premium status, or quiz options.",
      "Save the changes and confirm the success message.",
      "Use deactivate or delete carefully because those changes affect quizzes and assignments.",
    ],
    tips: [
      "If a word is inactive it will not be offered in new assessment creation.",
      "Editing the word text also changes its slug automatically.",
    ],
  },
  {
    id: "wotd",
    title: "Word of the Day",
    href: "/admin/word-of-the-day",
    summary:
      "Choose the single active word that should be featured as Word of the Day.",
    steps: [
      "Open Word of the Day and review the current selection at the top.",
      "Search the active vocabulary list to find the replacement word.",
      "Click the set action on the word you want to feature.",
      "Confirm the success message and re-check the current selection card.",
    ],
    tips: [
      "Only one word can be the active Word of the Day at a time.",
      "If a word does not appear here, confirm it is marked active in Manage Words.",
    ],
  },
];

const FAQS = [
  {
    question: "Why can’t I see a student in Assign Assessments?",
    answer:
      "That account probably does not have a primary student profile in the students table yet. Once the student record exists, the dropdown should show them.",
  },
  {
    question: "Why does an assigned assessment show no results yet?",
    answer:
      "The student has either not opened the assignment or has not submitted it yet. Assigned items appear in results before attempt data exists.",
  },
  {
    question: "What is the difference between quiz results and assigned assessment results?",
    answer:
      "Quiz results summarize general quiz activity. Assigned assessment results are tied to a specific admin-created assignment and support question-by-question review.",
  },
  {
    question: "What should I do before importing a large vocabulary file?",
    answer:
      "Export the current vocabulary first, check your headers carefully, and test with a smaller sample import so duplicates or formatting issues are easier to spot.",
  },
];

export default function AdminHelpPage() {
  const { user, authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (user) {
      void loadRole();
    } else if (!authLoading) {
      setIsAdmin(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

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
        error instanceof Error ? error.message : "Failed to load admin help."
      );
    } finally {
      setLoadingRole(false);
    }
  }

  if (authLoading || loadingRole) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-slate-600">Loading admin help...</p>
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
              Please log in to access the admin guide.
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

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h1 className="text-3xl font-bold text-slate-900">Access denied</h1>
            <p className="mt-3 text-slate-600">
              Only admin users can view this guide.
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
          <h1 className="text-3xl font-bold text-green-950">Admin Help & FAQ</h1>
          <p className="mt-2 max-w-3xl text-slate-700">
            Use this guide as the admin operating manual for vocabulary, assignments,
            progress tracking, and publishing tasks.
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {GUIDE_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-base font-semibold text-slate-900">
                {section.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{section.summary}</p>
            </a>
          ))}
        </div>

        <div className="mb-10 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Quick Start</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-700">
            <li>1. Upload or review vocabulary so the content base is current.</li>
            <li>2. Assign assessments to students who need directed practice.</li>
            <li>3. Check Student Progress for quiz trends and assignment outcomes.</li>
            <li>4. Use Word of the Day for a featured learning focus on the homepage.</li>
          </ol>
        </div>

        <div className="space-y-6">
          {GUIDE_SECTIONS.map((section) => (
            <article
              key={section.id}
              id={section.id}
              className="rounded-2xl border bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {section.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-600">
                    {section.summary}
                  </p>
                </div>
                <Link
                  href={section.href}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                >
                  Open page
                </Link>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Step by step
                  </h3>
                  <ol className="mt-3 space-y-3 text-sm text-slate-700">
                    {section.steps.map((step, index) => (
                      <li key={step}>
                        {index + 1}. {step}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Helpful notes
                  </h3>
                  <div className="mt-3 space-y-3 text-sm text-slate-700">
                    {(section.tips || []).map((tip) => (
                      <p key={tip}>{tip}</p>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">
            Frequently Asked Questions
          </h2>
          <div className="mt-5 space-y-4">
            {FAQS.map((item) => (
              <div key={item.question} className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-900">
                  {item.question}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
