import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { requireAdminUser } from "@/lib/server-auth";

const PAGE_SIZE = 40;
const FILTER_LIMIT = 5000;

type VocabularyWordRow = {
  id: string;
  word: string;
  definition: string;
  difficulty: string | null;
  topic: string | null;
};

type FilterRow = {
  difficulty: string | null;
  topic: string | null;
};

function normalizeFilter(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed && trimmed !== "all" ? trimmed : null;
}

function escapeIlikeTerm(value: string) {
  return value.replace(/[%_,]/g, " ").replace(/,/g, " ").trim();
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request.headers.get("authorization"));

    const search = request.nextUrl.searchParams.get("search")?.trim() || "";
    const difficulty = normalizeFilter(
      request.nextUrl.searchParams.get("difficulty")
    );
    const topic = normalizeFilter(request.nextUrl.searchParams.get("topic"));
    const pageParam = Number(request.nextUrl.searchParams.get("page") || "1");
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

    const adminSupabase = createAdminSupabaseClient();

    let wordsQuery = adminSupabase
      .from("vocabulary_words")
      .select("id, word, definition, difficulty, topic", { count: "exact" })
      .eq("active", true)
      .eq("premium_only", false)
      .order("word", { ascending: true });

    if (difficulty) {
      wordsQuery = wordsQuery.eq("difficulty", difficulty);
    }

    if (topic) {
      wordsQuery = wordsQuery.eq("topic", topic);
    }

    if (search) {
      const safeSearch = escapeIlikeTerm(search);
      wordsQuery = wordsQuery.or(
        `word.ilike.%${safeSearch}%,definition.ilike.%${safeSearch}%`
      );
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const [
      { data: wordRows, error: wordsError, count },
      { data: filterRows, error: filtersError },
    ] = await Promise.all([
      wordsQuery.range(from, to),
      adminSupabase
        .from("vocabulary_words")
        .select("difficulty, topic")
        .eq("active", true)
        .eq("premium_only", false)
        .limit(FILTER_LIMIT),
    ]);

    if (wordsError) {
      throw new Error(wordsError.message);
    }

    if (filtersError) {
      throw new Error(filtersError.message);
    }

    const filterData = (filterRows as FilterRow[]) || [];
    const difficulties = Array.from(
      new Set(
        filterData
          .map((row) => row.difficulty?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((left, right) => left.localeCompare(right));

    const topics = Array.from(
      new Set(
        filterData
          .map((row) => row.topic?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((left, right) => left.localeCompare(right));

    const words = (wordRows as VocabularyWordRow[]) || [];
    const total = count || 0;

    return NextResponse.json({
      words,
      page,
      page_size: PAGE_SIZE,
      total,
      has_more: page * PAGE_SIZE < total,
      filters: {
        difficulties,
        topics,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load vocabulary words.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
