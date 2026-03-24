"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

function makeSlug(word: string) {
  return word.trim().toLowerCase().replace(/\s+/g, "-");
}

const EXPECTED_COLUMN_COUNT = 11;
const REQUIRED_HEADERS = [
  "word",
  "definition",
  "difficulty",
  "example_sentence",
  "synonyms",
  "antonyms",
  "topic",
  "premium_only",
  "quiz_option_1",
  "quiz_option_2",
  "quiz_option_3",
] as const;
const CANDIDATE_DELIMITERS = [",", ";", "\t", "|"] as const;

type VocabularyRecord = {
  word: string;
  slug: string;
  definition: string;
  difficulty: string;
  example_sentence: string;
  synonyms: string;
  antonyms: string;
  topic: string;
  premium_only: boolean;
  quiz_option_1: string;
  quiz_option_2: string;
  quiz_option_3: string;
  active: boolean;
};

export default function AdminUploadPage() {
  const { user, authLoading } = useAuth();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (user) {
      loadRole();
    } else if (!authLoading) {
      setIsAdmin(false);
    }
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
        error instanceof Error ? error.message : "Failed to load upload page."
      );
    } finally {
      setLoadingRole(false);
    }
  }

  function parseCsvRows(rawText: string): VocabularyRecord[] {
    function normalizeHeader(value: string) {
      return value.trim().toLowerCase().replace(/^\uFEFF/, "");
    }

    function parseWithDelimiter(delimiter: string) {
      return Papa.parse<string[]>(rawText, {
        delimiter,
        skipEmptyLines: true,
      });
    }

    const parseAttempts = CANDIDATE_DELIMITERS.map((delimiter) => ({
      delimiter,
      result: parseWithDelimiter(delimiter),
    }));

    const successfulAttempt = parseAttempts.find(
      ({ result }) => result.errors.length === 0
    );
    const bestAttempt =
      successfulAttempt ??
      parseAttempts.reduce((best, current) => {
        const bestRows = best.result.data;
        const currentRows = current.result.data;
        const bestWidth = Math.max(...bestRows.map((r) => r.length), 0);
        const currentWidth = Math.max(...currentRows.map((r) => r.length), 0);
        return currentWidth > bestWidth ? current : best;
      });

    if (!bestAttempt || bestAttempt.result.errors.length > 0) {
      const firstError = bestAttempt?.result.errors[0];
      throw new Error(
        `CSV parse error: ${firstError?.message ?? "Unable to parse file."}`
      );
    }

    let rows = bestAttempt.result.data;

    if (!rows.length) {
      throw new Error("No CSV rows found.");
    }

    // Excel may prepend `sep=,` as a delimiter hint row. Ignore it if present.
    const firstCell = String(rows[0][0] ?? "").trim().toLowerCase();
    if (/^sep\s*=/.test(firstCell)) {
      rows = rows.slice(1);
    }

    if (!rows.length) {
      throw new Error("CSV file has no data rows.");
    }

    const firstRow = rows[0].map((value) => normalizeHeader(String(value ?? "")));
    const hasHeader =
      firstRow.includes("word") && firstRow.includes("definition");

    const dataRows = hasHeader ? rows.slice(1) : rows;

    if (!dataRows.length) {
      throw new Error("CSV file has no data rows.");
    }

    if (hasHeader) {
      const headerIndex = new Map<string, number>();
      firstRow.forEach((key, index) => {
        if (key) headerIndex.set(key, index);
      });

      const missingHeaders = REQUIRED_HEADERS.filter(
        (header) => !headerIndex.has(header)
      );
      if (missingHeaders.length > 0) {
        throw new Error(
          `Missing required CSV header(s): ${missingHeaders.join(", ")}. Expected ${EXPECTED_COLUMN_COUNT} headers.`
        );
      }

      return dataRows.map((row, index) => {
        const values = row.map((value) => String(value ?? "").trim());
        const csvRowNumber = index + 2;

        if (values.length !== EXPECTED_COLUMN_COUNT) {
          throw new Error(
            `Row ${csvRowNumber} has ${values.length} column(s), expected ${EXPECTED_COLUMN_COUNT}. Please check the format.`
          );
        }

        const getValue = (header: string) => {
          const cellIndex = headerIndex.get(header);
          if (cellIndex === undefined) return "";
          return values[cellIndex] ?? "";
        };

        const word = getValue("word");
        const definition = getValue("definition");

        if (!word) {
          throw new Error(`Row ${csvRowNumber} is missing the word value.`);
        }

        if (!definition) {
          throw new Error(`Row ${csvRowNumber} is missing the definition value.`);
        }

        return {
          word,
          slug: makeSlug(word),
          definition,
          difficulty: getValue("difficulty"),
          example_sentence: getValue("example_sentence"),
          synonyms: getValue("synonyms"),
          antonyms: getValue("antonyms"),
          topic: getValue("topic"),
          premium_only: getValue("premium_only").toLowerCase() === "true",
          quiz_option_1: getValue("quiz_option_1"),
          quiz_option_2: getValue("quiz_option_2"),
          quiz_option_3: getValue("quiz_option_3"),
          active: true,
        };
      });
    }

    return dataRows.map((row, index) => {
      const values = row.map((value) => String(value ?? "").trim());

      if (values.length !== EXPECTED_COLUMN_COUNT) {
        throw new Error(
          `Row ${index + 1} has ${values.length} column(s), expected ${EXPECTED_COLUMN_COUNT}. Please check the format.`
        );
      }

      const word = values[0] ?? "";
      const definition = values[1] ?? "";
      const difficulty = values[2] ?? "";
      const example_sentence = values[3] ?? "";
      const synonyms = values[4] ?? "";
      const antonyms = values[5] ?? "";
      const topic = values[6] ?? "";
      const premium_only = values[7] ?? "";
      const quiz_option_1 = values[8] ?? "";
      const quiz_option_2 = values[9] ?? "";
      const quiz_option_3 = values[10] ?? "";

      if (!word) {
        throw new Error(`Row ${index + 1} is missing the word value.`);
      }

      if (!definition) {
        throw new Error(`Row ${index + 1} is missing the definition value.`);
      }

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
  }

  async function saveRecords(records: VocabularyRecord[]) {
    const { error } = await supabase
      .from("vocabulary_words")
      .upsert(records, { onConflict: "slug" });

    if (error) {
      throw new Error(error.message);
    }
  }

  async function handleProcessPastedContent() {
    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const records = parseCsvRows(csvText);
      await saveRecords(records);

      setSuccessMessage(`${records.length} word(s) uploaded successfully.`);
      setCsvText("");
    } catch (error) {
      console.error("Paste upload failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Upload failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadCsvFile() {
    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      if (!selectedFile) {
        throw new Error("Please choose a CSV file first.");
      }

      console.log("Uploading file:", selectedFile.name);

      const fileText = await selectedFile.text();
      console.log("File text preview:", fileText.slice(0, 500));

      const records = parseCsvRows(fileText);
      console.log("Parsed records:", records);

      await saveRecords(records);

      setSuccessMessage(`${records.length} word(s) uploaded successfully.`);
      setSelectedFile(null);
      setSelectedFileName("");
    } catch (error) {
      console.error("CSV upload failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "CSV upload failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loadingRole) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-slate-600">Loading upload page...</p>
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
              Please log in to access vocabulary upload tools.
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

  const displayName = user.user_metadata?.full_name || user.email || "Admin";

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-green-950">Upload Vocabulary</h1>
          <p className="mt-2 text-slate-700">
            Welcome, {displayName}. Add new vocabulary using a CSV file or by
            pasting structured text below.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">CSV template</h2>
            <p className="mt-3 text-sm text-slate-600">
              Use this exact 11-column order (required):
            </p>

            <div className="mt-4 overflow-x-auto rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              word,definition,difficulty,example_sentence,synonyms,antonyms,topic,premium_only,quiz_option_1,quiz_option_2,quiz_option_3
            </div>

            <p className="mt-4 text-sm text-slate-600">Example row:</p>

            <div className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              acquiesce,to accept something reluctantly but without
              protest,difficult,She acquiesced to the decision despite her
              doubts.,agree; consent,refuse; oppose,General,TRUE,comply
              willingly,resist firmly,question openly
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="/sample_upload_11_columns.csv"
                download
                className="inline-flex items-center rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
              >
                Download sample CSV
              </a>
              <span className="text-sm text-slate-600">
                You can download this sample, follow the structure, or copy and
                paste rows below.
              </span>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Upload file</h2>

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
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  setSelectedFileName(file ? file.name : "");
                  setSuccessMessage("");
                  setErrorMessage("");
                }}
                className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm file:mr-4 file:rounded-md file:border-0 file:bg-green-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
              />
            </div>

            {selectedFileName && (
              <p className="mt-3 text-sm text-slate-600">
                Selected file:{" "}
                <span className="font-medium">{selectedFileName}</span>
              </p>
            )}

            <button
              type="button"
              onClick={handleUploadCsvFile}
              disabled={submitting || !selectedFile}
              className="mt-6 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Uploading..." : "Upload CSV"}
            </button>

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
