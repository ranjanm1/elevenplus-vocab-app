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

type ExistingVocabularyRecord = {
  slug: string;
  word: string;
  definition: string;
  difficulty: string | null;
  example_sentence: string | null;
  synonyms: string | null;
  antonyms: string | null;
  topic: string | null;
  premium_only: boolean;
  quiz_option_1: string | null;
  quiz_option_2: string | null;
  quiz_option_3: string | null;
  active: boolean;
};

type ImportSummary = {
  templateCheckPassed: boolean;
  totalRowsInFile: number;
  insertedCount: number;
  updatedCount: number;
  duplicateCount: number;
  totalWordsAfterImport: number;
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
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importSource, setImportSource] = useState<"file" | "paste" | null>(null);
  const [databaseWordCount, setDatabaseWordCount] = useState<number | null>(null);
  const [wordCountLoading, setWordCountLoading] = useState(false);
  const [wordCountError, setWordCountError] = useState("");
  const [downloadingExport, setDownloadingExport] = useState(false);

  useEffect(() => {
    if (user) {
      void loadRole();
    } else if (!authLoading) {
      setIsAdmin(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  useEffect(() => {
    if (isAdmin) {
      void loadDatabaseWordCount();
    }
  }, [isAdmin]);

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

  async function loadDatabaseWordCount() {
    setWordCountLoading(true);
    try {
      const { count, error } = await supabase
        .from("vocabulary_words")
        .select("*", { count: "exact", head: true });

      if (error) {
        throw new Error(error.message);
      }

      setDatabaseWordCount(count ?? 0);
      setWordCountError("");
      return count ?? 0;
    } catch (error) {
      setWordCountError(
        error instanceof Error
          ? error.message
          : "Unable to load the current word count."
      );
      throw error;
    } finally {
      setWordCountLoading(false);
    }
  }

  async function insertRecords(records: VocabularyRecord[]) {
    if (!records.length) {
      return;
    }

    const { error } = await supabase.from("vocabulary_words").insert(records);

    if (error) {
      throw new Error(error.message);
    }
  }

  async function updateRecords(records: VocabularyRecord[]) {
    for (const record of records) {
      const { error } = await supabase
        .from("vocabulary_words")
        .update({
          word: record.word,
          slug: record.slug,
          definition: record.definition,
          difficulty: record.difficulty || null,
          example_sentence: record.example_sentence || null,
          synonyms: record.synonyms || null,
          antonyms: record.antonyms || null,
          topic: record.topic || null,
          premium_only: record.premium_only,
          quiz_option_1: record.quiz_option_1 || null,
          quiz_option_2: record.quiz_option_2 || null,
          quiz_option_3: record.quiz_option_3 || null,
          active: true,
        })
        .eq("slug", record.slug);

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  function normalizeNullableText(value: string | null | undefined) {
    return (value ?? "").trim();
  }

  function hasRecordChanged(
    incomingRecord: VocabularyRecord,
    existingRecord: ExistingVocabularyRecord
  ) {
    return (
      incomingRecord.word !== normalizeNullableText(existingRecord.word) ||
      incomingRecord.definition !== normalizeNullableText(existingRecord.definition) ||
      incomingRecord.difficulty !== normalizeNullableText(existingRecord.difficulty) ||
      incomingRecord.example_sentence !==
        normalizeNullableText(existingRecord.example_sentence) ||
      incomingRecord.synonyms !== normalizeNullableText(existingRecord.synonyms) ||
      incomingRecord.antonyms !== normalizeNullableText(existingRecord.antonyms) ||
      incomingRecord.topic !== normalizeNullableText(existingRecord.topic) ||
      incomingRecord.premium_only !== existingRecord.premium_only ||
      incomingRecord.quiz_option_1 !==
        normalizeNullableText(existingRecord.quiz_option_1) ||
      incomingRecord.quiz_option_2 !==
        normalizeNullableText(existingRecord.quiz_option_2) ||
      incomingRecord.quiz_option_3 !==
        normalizeNullableText(existingRecord.quiz_option_3) ||
      incomingRecord.active !== existingRecord.active
    );
  }

  async function fetchExistingRecords(slugs: string[]) {
    const existingRecords = new Map<string, ExistingVocabularyRecord>();
    const chunkSize = 200;

    for (let index = 0; index < slugs.length; index += chunkSize) {
      const chunk = slugs.slice(index, index + chunkSize);
      const { data, error } = await supabase
        .from("vocabulary_words")
        .select(
          "slug, word, definition, difficulty, example_sentence, synonyms, antonyms, topic, premium_only, quiz_option_1, quiz_option_2, quiz_option_3, active"
        )
        .in("slug", chunk);

      if (error) {
        throw new Error(error.message);
      }

      data?.forEach((row) => {
        if (row.slug) {
          existingRecords.set(row.slug, row as ExistingVocabularyRecord);
        }
      });
    }

    return existingRecords;
  }

  async function importRecords(records: VocabularyRecord[]) {
    const existingRecords = await fetchExistingRecords(
      records.map((record) => record.slug)
    );
    const seenIncomingSlugs = new Set<string>();
    const recordsToInsert: VocabularyRecord[] = [];
    const recordsToUpdate: VocabularyRecord[] = [];
    let duplicateCount = 0;

    for (const record of records) {
      if (seenIncomingSlugs.has(record.slug)) {
        duplicateCount += 1;
        continue;
      }

      seenIncomingSlugs.add(record.slug);

      const existingRecord = existingRecords.get(record.slug);

      if (existingRecord) {
        if (hasRecordChanged(record, existingRecord)) {
          recordsToUpdate.push(record);
        }
        continue;
      }

      recordsToInsert.push(record);
    }

    await insertRecords(recordsToInsert);
    await updateRecords(recordsToUpdate);
    const totalWordsAfterImport = await loadDatabaseWordCount();

    return {
      templateCheckPassed: true,
      totalRowsInFile: records.length,
      insertedCount: recordsToInsert.length,
      updatedCount: recordsToUpdate.length,
      duplicateCount,
      totalWordsAfterImport,
    } satisfies ImportSummary;
  }

  async function downloadWordBankCsv() {
    setDownloadingExport(true);
    setSuccessMessage("");
    setErrorMessage("");
    setImportSummary(null);
    setImportSource(null);

    try {
      const pageSize = 1000;
      let from = 0;
      const rows: Array<Record<(typeof REQUIRED_HEADERS)[number], string>> = [];

      while (true) {
        const { data, error } = await supabase
          .from("vocabulary_words")
          .select(
            "word, definition, difficulty, example_sentence, synonyms, antonyms, topic, premium_only, quiz_option_1, quiz_option_2, quiz_option_3"
          )
          .order("word", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) {
          throw new Error(error.message);
        }

        const batch = data ?? [];

        rows.push(
          ...batch.map((row) => ({
            word: row.word ?? "",
            definition: row.definition ?? "",
            difficulty: row.difficulty ?? "",
            example_sentence: row.example_sentence ?? "",
            synonyms: row.synonyms ?? "",
            antonyms: row.antonyms ?? "",
            topic: row.topic ?? "",
            premium_only: row.premium_only ? "TRUE" : "FALSE",
            quiz_option_1: row.quiz_option_1 ?? "",
            quiz_option_2: row.quiz_option_2 ?? "",
            quiz_option_3: row.quiz_option_3 ?? "",
          }))
        );

        if (batch.length < pageSize) {
          break;
        }

        from += pageSize;
      }

      const csvContent = Papa.unparse(rows, {
        columns: [...REQUIRED_HEADERS],
      });
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStamp = new Date().toISOString().slice(0, 10);

      link.href = url;
      link.download = `word-bank-export-${dateStamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccessMessage(
        `Downloaded ${rows.length} word${rows.length === 1 ? "" : "s"} in upload-ready CSV format.`
      );
    } catch (error) {
      console.error("Word bank download failed:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to download the word bank CSV."
      );
    } finally {
      setDownloadingExport(false);
    }
  }

  async function handleProcessPastedContent() {
    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");
    setImportSummary(null);
    setImportSource(null);

    try {
      const records = parseCsvRows(csvText);
      const summary = await importRecords(records);

      setSuccessMessage("CSV template check passed and import completed.");
      setImportSummary(summary);
      setImportSource("paste");
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
    setImportSummary(null);
    setImportSource(null);

    try {
      if (!selectedFile) {
        throw new Error("Please choose a CSV file first.");
      }

      console.log("Uploading file:", selectedFile.name);

      const fileText = await selectedFile.text();
      console.log("File text preview:", fileText.slice(0, 500));

      const records = parseCsvRows(fileText);
      console.log("Parsed records:", records);

      const summary = await importRecords(records);

      setSuccessMessage("CSV template check passed and import completed.");
      setImportSummary(summary);
      setImportSource("file");
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
            pasting structured text below, or download the full word bank in the
            same editable template.
          </p>
          <div className="mt-4 rounded-xl border border-green-300 bg-white/70 px-4 py-3">
            <p className="text-sm font-medium text-green-950">
              Live database word count:{" "}
              {wordCountLoading ? "Loading..." : databaseWordCount ?? 0}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Current total words stored in the vocabulary database.
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Re-uploaded CSV rows update existing entries when the word matches
              an existing record. If you change the word itself, it will be
              treated as a new entry.
            </p>
            {wordCountError && (
              <p className="mt-2 text-sm text-amber-700">{wordCountError}</p>
            )}
            <div className="mt-3">
              <button
                type="button"
                onClick={downloadWordBankCsv}
                disabled={downloadingExport}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {downloadingExport ? "Preparing CSV..." : "Download full word bank CSV"}
              </button>
            </div>
          </div>
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
                You can download the sample, export the live word bank above,
                follow the structure, or copy and paste rows below.
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
                  setImportSummary(null);
                  setImportSource(null);
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

            {importSummary && importSource === "file" && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-900">
                <p className="font-semibold">Import summary</p>
                <p className="mt-2">
                  CSV template check:{" "}
                  {importSummary.templateCheckPassed ? "Passed" : "Failed"}
                </p>
                <p className="mt-1">
                  Rows in file: {importSummary.totalRowsInFile}
                </p>
                <p className="mt-1">
                  New words inserted: {importSummary.insertedCount}
                </p>
                <p className="mt-1">
                  Existing words updated: {importSummary.updatedCount}
                </p>
                <p className="mt-1">
                  Duplicate rows in upload skipped: {importSummary.duplicateCount}
                </p>
                <p className="mt-1">
                  Current total words: {importSummary.totalWordsAfterImport}
                </p>
              </div>
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
            onChange={(e) => {
              setCsvText(e.target.value);
              setSuccessMessage("");
              setErrorMessage("");
              setImportSummary(null);
              setImportSource(null);
            }}
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

          {importSummary && importSource === "paste" && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-900">
              <p className="font-semibold">Import summary</p>
              <p className="mt-2">
                CSV template check:{" "}
                {importSummary.templateCheckPassed ? "Passed" : "Failed"}
              </p>
              <p className="mt-1">Rows in file: {importSummary.totalRowsInFile}</p>
              <p className="mt-1">
                New words inserted: {importSummary.insertedCount}
              </p>
              <p className="mt-1">
                Existing words updated: {importSummary.updatedCount}
              </p>
              <p className="mt-1">
                Duplicate rows in upload skipped: {importSummary.duplicateCount}
              </p>
              <p className="mt-1">
                Current total words: {importSummary.totalWordsAfterImport}
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
