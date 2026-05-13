import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { requireAdminUser } from "@/lib/server-auth";

type CreateAssessmentRequest = {
  title?: string;
  description?: string;
  instructions?: string;
  studentId?: string;
  wordIds?: string[];
  dueAt?: string | null;
  availableFrom?: string | null;
  maxAttempts?: number | null;
};

type AssessmentAssignmentRow = {
  id: string;
  assigned_at: string;
  due_at: string | null;
  status: string;
  student_id: string;
  assessment_definition_id: string;
  assessment_definitions: Array<{
    id: string;
    title: string;
    type: string;
  }> | null;
};

type StudentRow = {
  id: string;
  parent_user_id: string;
  full_name: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

function normalizeText(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWordIds(wordIds: string[] | undefined) {
  return Array.from(
    new Set((wordIds || []).filter((wordId) => typeof wordId === "string" && wordId.trim()))
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request.headers.get("authorization"));

    const adminSupabase = createAdminSupabaseClient();
    const { data: assignmentsData, error: assignmentsError } = await adminSupabase
      .from("assessment_assignments")
      .select(
        "id, assigned_at, due_at, status, student_id, assessment_definition_id, assessment_definitions(id, title, type)"
      )
      .order("assigned_at", { ascending: false })
      .limit(20);

    if (assignmentsError) {
      throw new Error(assignmentsError.message);
    }

    const assignments = (assignmentsData as AssessmentAssignmentRow[]) || [];
    const studentIds = Array.from(new Set(assignments.map((assignment) => assignment.student_id)));

    let students: StudentRow[] = [];
    if (studentIds.length > 0) {
      const { data: studentData, error: studentError } = await adminSupabase
        .from("students")
        .select("id, parent_user_id, full_name")
        .in("id", studentIds);

      if (studentError) {
        throw new Error(studentError.message);
      }

      students = (studentData as StudentRow[]) || [];
    }

    const parentIds = Array.from(new Set(students.map((student) => student.parent_user_id)));
    let profiles: ProfileRow[] = [];
    if (parentIds.length > 0) {
      const { data: profileData, error: profileError } = await adminSupabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", parentIds);

      if (profileError) {
        throw new Error(profileError.message);
      }

      profiles = (profileData as ProfileRow[]) || [];
    }

    const studentMap = new Map<string, StudentRow>();
    for (const student of students) {
      studentMap.set(student.id, student);
    }

    const profileMap = new Map<string, ProfileRow>();
    for (const profile of profiles) {
      profileMap.set(profile.id, profile);
    }

    return NextResponse.json({
      assignments: assignments.map((assignment) => {
        const student = studentMap.get(assignment.student_id);
        const parent = student ? profileMap.get(student.parent_user_id) : null;
        const definition = assignment.assessment_definitions?.[0] || null;

        return {
          id: assignment.id,
          assigned_at: assignment.assigned_at,
          due_at: assignment.due_at,
          status: assignment.status,
          student_id: assignment.student_id,
          student_name: student?.full_name ?? null,
          parent_name: parent?.full_name ?? null,
          parent_email: parent?.email ?? null,
          assessment_definition_id: assignment.assessment_definition_id,
          assessment_title: definition?.title ?? "Untitled assessment",
          assessment_type: definition?.type ?? null,
        };
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load assessment assignments.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdminUser(request.headers.get("authorization"));
    const body = (await request.json()) as CreateAssessmentRequest;

    const title = normalizeText(body.title);
    const description = normalizeText(body.description) || null;
    const instructions =
      normalizeText(body.instructions) ||
      "Choose the correct definition for each vocabulary word.";
    const studentId = normalizeText(body.studentId);
    const wordIds = normalizeWordIds(body.wordIds);
    const dueAt = body.dueAt || null;
    const availableFrom = body.availableFrom || null;
    const maxAttempts =
      typeof body.maxAttempts === "number" && Number.isFinite(body.maxAttempts)
        ? Math.max(1, Math.floor(body.maxAttempts))
        : 1;

    if (!title) {
      return NextResponse.json({ error: "Assessment title is required." }, { status: 400 });
    }

    if (!studentId) {
      return NextResponse.json({ error: "Student selection is required." }, { status: 400 });
    }

    if (wordIds.length < 4) {
      return NextResponse.json(
        { error: "Select at least 4 words to create an assessment." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminSupabaseClient();

    const { data: studentRow, error: studentError } = await adminSupabase
      .from("students")
      .select("id, full_name")
      .eq("id", studentId)
      .eq("is_primary", true)
      .maybeSingle();

    if (studentError) {
      throw new Error(studentError.message);
    }

    if (!studentRow) {
      return NextResponse.json({ error: "Selected student was not found." }, { status: 404 });
    }

    const { data: wordRows, error: wordsError } = await adminSupabase
      .from("vocabulary_words")
      .select("id, word, definition")
      .in("id", wordIds)
      .eq("active", true);

    if (wordsError) {
      throw new Error(wordsError.message);
    }

    const words = wordRows || [];
    if (words.length !== wordIds.length) {
      return NextResponse.json(
        { error: "One or more selected words are unavailable or inactive." },
        { status: 400 }
      );
    }

    const { data: definitionRow, error: definitionError } = await adminSupabase
      .from("assessment_definitions")
      .insert({
        type: "vocab_quiz",
        title,
        description,
        instructions,
        active: true,
        created_by: user.id,
        config: {
          question_count: wordIds.length,
          selection_mode: "fixed_words",
          scoring_mode: "auto",
        },
      })
      .select("id, title")
      .single();

    if (definitionError || !definitionRow) {
      throw new Error(definitionError?.message || "Failed to create assessment definition.");
    }

    const orderedWords = wordIds
      .map((wordId) => words.find((word) => word.id === wordId))
      .filter(Boolean);

    const itemPayload = orderedWords.map((word, index) => ({
      assessment_definition_id: definitionRow.id,
      item_order: index + 1,
      item_type: "definition_match",
      prompt: `What is the meaning of ${word?.word}?`,
      metadata: {
        source: "vocabulary_words",
      },
      answer_key: {
        word_id: word?.id ?? null,
      },
      max_score: 1,
    }));

    const { data: itemRows, error: itemsError } = await adminSupabase
      .from("assessment_items")
      .insert(itemPayload)
      .select("id, item_order");

    if (itemsError || !itemRows) {
      throw new Error(itemsError?.message || "Failed to create assessment items.");
    }

    const linksPayload = itemRows.map((item) => {
      const word = orderedWords[item.item_order - 1];
      return {
        assessment_item_id: item.id,
        word_id: word?.id,
      };
    });

    const { error: linkError } = await adminSupabase
      .from("assessment_item_words")
      .insert(linksPayload);

    if (linkError) {
      throw new Error(linkError.message);
    }

    const { data: assignmentRow, error: assignmentError } = await adminSupabase
      .from("assessment_assignments")
      .insert({
        assessment_definition_id: definitionRow.id,
        student_id: studentId,
        assigned_by: user.id,
        due_at: dueAt,
        available_from: availableFrom,
        max_attempts: maxAttempts,
        status: "assigned",
        metadata: {
          word_count: wordIds.length,
        },
      })
      .select("id, assigned_at, due_at, status")
      .single();

    if (assignmentError || !assignmentRow) {
      throw new Error(assignmentError?.message || "Failed to create assessment assignment.");
    }

    return NextResponse.json({
      assignment: {
        id: assignmentRow.id,
        assigned_at: assignmentRow.assigned_at,
        due_at: assignmentRow.due_at,
        status: assignmentRow.status,
        assessment_definition_id: definitionRow.id,
        assessment_title: definitionRow.title,
        student_id: studentId,
        student_name: studentRow.full_name,
        word_count: wordIds.length,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create assessment assignment.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
