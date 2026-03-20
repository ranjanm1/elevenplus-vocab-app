"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UserInfo = {
  email?: string;
  fullName?: string;
};

function makeSlug(word: string) {
  return word.trim().toLowerCase().replace(/\s+/g, "-");
}

export default function AdminUploadPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function loadSessionAndRole() {
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

      const { data: roleRow, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (roleError || !roleRow || roleRow.role !== "admin") {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    }

    loadSessionAndRole();
  }, [router]);

  async function handleProcessPastedContent() {
    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const lines = csvText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        setErrorMessage("Please paste at least one CSV row.");
        setSubmitting(false);
        return;
      }

      const records = lines.map((line, index) => {
        const parts = line.split(",").map((part) => part.trim());

        if (parts.length < 11) {
          throw new Error(
            `Row ${index + 1} does not have 11 columns. Please check the format.`
          );
        }

        const [
          word,
          definition,
          difficulty,
          example_sentence,
          synonyms,
          antonyms,
          topic,
          premium_only,
          quiz_option_1,
          quiz_option_2,
          quiz_option_3,
        ] = parts;

        return {
          word,
          slug: makeSlug(word),
          definition,
          difficulty,
          example_sentence,
          synonyms,
          antonyms,
          topic,
          premium_only: premium_only.toLowerCase() === "true",
          quiz_option_1,
          quiz_option_2,
          quiz_option_3,
          active: true,
        };
      });

      const { error } = await supabase
        .from("vocabulary_words")
        .upsert(records, { onConflict: "slug" });

      if (error) {
        setErrorMessage(error.message);
        setSubmitting(false);
        return;
      }

      setSuccessMessage(`${records.length} word(s) uploaded successfully.`);
      setCsvText("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Upload failed."
      );
    }

    setSubmitting(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-slate-600">Loading upload page...</p>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
            <h1 className="text-3xl font-bold text-slate-900">Access denied</h1>
            <p className="mt-3 text-slate-600">
              Only admin users can upload vocabulary content.
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

  const displayName = user?.fullName || user?.email || "Admin";

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-green-950">
            Upload Vocabulary
          </h1>
          <p className="mt-2 text-slate-700">
            Welcome, {displayName}. Add new vocabulary using a CSV file or by
            pasting structured text below.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              CSV template
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Use the following columns in this exact order:
            </p>

            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              word, definition, difficulty, example_sentence, synonyms,
              antonyms, topic, premium_only, quiz_option_1, quiz_option_2,
              quiz_option_3
            </div>

            <p className="mt-4 text-sm text-slate-600">Example row:</p>

            <div className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              benevolent, kind and generous, easy, The benevolent teacher helped every student., kind; generous, cruel, character, false, selfish and unkind, very loud and sudden, full of anger
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Upload file
            </h2>

            <div className="mt-4">
              <label
                htmlFor="csvFile"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Choose CSV file
              </label>
              <input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setSelectedFileName(file ? file.name : "");
                }}
                className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm file:mr-4 file:rounded-md file:border-0 file:bg-green-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
              />
            </div>

            {selectedFileName && (
              <p className="mt-3 text-sm text-slate-600">
                Selected file: <span className="font-medium">{selectedFileName}</span>
              </p>
            )}

            <button
              type="button"
              className="mt-6 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
            >
              Upload CSV
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Paste CSV content
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            You can also paste CSV rows directly here for quick admin entry.
          </p>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste CSV rows here..."
            rows={10}
            className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
          />

          {errorMessage && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleProcessPastedContent}
            disabled={submitting}
            className="mt-4 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Processing..." : "Process pasted content"}
          </button>
        </div>
      </section>
    </main>
  );
}