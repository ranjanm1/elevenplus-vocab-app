import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { requireAdminUser } from "@/lib/server-auth";

type AssignmentRow = {
  id: string;
  assigned_at: string;
  available_from: string | null;
  due_at: string | null;
  max_attempts: number | null;
  status: string;
  student_id: string;
  assessment_definition_id: string;
  assessment_definitions: Array<{
    id: string;
    title: string;
    type: string;
    description: string | null;
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

type AttemptRow = {
  id: string;
  assignment_id: string | null;
  attempt_number: number;
  status: string;
  created_at: string;
  started_at: string | null;
  submitted_at: string | null;
  final_score: number | null;
  max_score: number | null;
  percentage: number | null;
  feedback: string | null;
};

type ResponseRow = {
  attempt_id: string;
  assessment_item_id: string;
  response: {
    selected_answer?: string;
    word_id?: string;
  } | null;
  is_correct: boolean | null;
  final_score: number | null;
  feedback: string | null;
};

type AssessmentItemRow = {
  id: string;
  item_order: number;
  prompt: string | null;
  answer_key: {
    word_id?: string;
  } | null;
};

type AssessmentItemWordRow = {
  assessment_item_id: string;
  word_id: string;
};

type VocabularyWordRow = {
  id: string;
  word: string;
  definition: string;
};

function formatAssignmentSummary(
  assignment: AssignmentRow,
  student: StudentRow | undefined,
  parent: ProfileRow | undefined,
  attempts: AttemptRow[]
) {
  const latestAttempt = attempts[0];
  const bestPercentage = attempts.reduce<number | null>((best, attempt) => {
    if (attempt.percentage === null) return best;
    if (best === null) return attempt.percentage;
    return Math.max(best, attempt.percentage);
  }, null);

  const completedAttempts = attempts.filter(
    (attempt) => attempt.status === "submitted" || attempt.status === "reviewed"
  ).length;

  return {
    id: assignment.id,
    assigned_at: assignment.assigned_at,
    available_from: assignment.available_from,
    due_at: assignment.due_at,
    max_attempts: assignment.max_attempts,
    status: assignment.status,
    student_id: assignment.student_id,
    student_name: student?.full_name ?? null,
    parent_name: parent?.full_name ?? null,
    parent_email: parent?.email ?? null,
    assessment_definition_id: assignment.assessment_definition_id,
    assessment_title:
      assignment.assessment_definitions?.[0]?.title ?? "Assigned assessment",
    assessment_type: assignment.assessment_definitions?.[0]?.type ?? null,
    assessment_description:
      assignment.assessment_definitions?.[0]?.description ?? null,
    attempt_count: attempts.length,
    completed_attempt_count: completedAttempts,
    latest_attempt_at: latestAttempt?.submitted_at ?? latestAttempt?.created_at ?? null,
    latest_percentage: latestAttempt?.percentage ?? null,
    latest_score: latestAttempt?.final_score ?? null,
    latest_max_score: latestAttempt?.max_score ?? null,
    best_percentage: bestPercentage,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request.headers.get("authorization"));

    const adminSupabase = createAdminSupabaseClient();
    const assignmentId = request.nextUrl.searchParams.get("assignmentId")?.trim();

    if (assignmentId) {
      const { data: assignmentData, error: assignmentError } = await adminSupabase
        .from("assessment_assignments")
        .select(
          "id, assigned_at, available_from, due_at, max_attempts, status, student_id, assessment_definition_id, assessment_definitions(id, title, type, description)"
        )
        .eq("id", assignmentId)
        .maybeSingle();

      if (assignmentError) {
        throw new Error(assignmentError.message);
      }

      if (!assignmentData) {
        return NextResponse.json(
          { error: "Assessment assignment not found." },
          { status: 404 }
        );
      }

      const assignment = assignmentData as AssignmentRow;

      const [{ data: studentData, error: studentError }, { data: attemptData, error: attemptError }] =
        await Promise.all([
          adminSupabase
            .from("students")
            .select("id, parent_user_id, full_name")
            .eq("id", assignment.student_id)
            .maybeSingle(),
          adminSupabase
            .from("assessment_attempts")
            .select(
              "id, assignment_id, attempt_number, status, created_at, started_at, submitted_at, final_score, max_score, percentage, feedback"
            )
            .eq("assignment_id", assignment.id)
            .order("attempt_number", { ascending: false }),
        ]);

      if (studentError) {
        throw new Error(studentError.message);
      }

      if (attemptError) {
        throw new Error(attemptError.message);
      }

      const student = (studentData as StudentRow | null) ?? null;
      let parent: ProfileRow | null = null;

      if (student?.parent_user_id) {
        const { data: profileData, error: profileError } = await adminSupabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", student.parent_user_id)
          .maybeSingle();

        if (profileError) {
          throw new Error(profileError.message);
        }

        parent = (profileData as ProfileRow | null) ?? null;
      }

      const attempts = (attemptData as AttemptRow[]) || [];
      const attemptIds = attempts.map((attempt) => attempt.id);

      const [
        { data: responseData, error: responseError },
        { data: itemData, error: itemError },
      ] = await Promise.all([
        attemptIds.length > 0
          ? adminSupabase
              .from("assessment_responses")
              .select(
                "attempt_id, assessment_item_id, response, is_correct, final_score, feedback"
              )
              .in("attempt_id", attemptIds)
          : Promise.resolve({ data: [], error: null }),
        adminSupabase
          .from("assessment_items")
          .select("id, item_order, prompt, answer_key")
          .eq("assessment_definition_id", assignment.assessment_definition_id)
          .order("item_order", { ascending: true }),
      ]);

      if (responseError) {
        throw new Error(responseError.message);
      }

      if (itemError) {
        throw new Error(itemError.message);
      }

      const items = (itemData as AssessmentItemRow[]) || [];
      const itemIds = items.map((item) => item.id);

      const { data: linkData, error: linkError } = itemIds.length
        ? await adminSupabase
            .from("assessment_item_words")
            .select("assessment_item_id, word_id")
            .in("assessment_item_id", itemIds)
        : { data: [], error: null };

      if (linkError) {
        throw new Error(linkError.message);
      }

      const itemLinks = (linkData as AssessmentItemWordRow[]) || [];
      const wordIds = Array.from(
        new Set(
          [
            ...itemLinks.map((link) => link.word_id),
            ...items
              .map((item) => item.answer_key?.word_id)
              .filter((wordId): wordId is string => Boolean(wordId)),
          ].filter(Boolean)
        )
      );

      const { data: wordData, error: wordError } = wordIds.length
        ? await adminSupabase
            .from("vocabulary_words")
            .select("id, word, definition")
            .in("id", wordIds)
        : { data: [], error: null };

      if (wordError) {
        throw new Error(wordError.message);
      }

      const itemMap = new Map<string, AssessmentItemRow>();
      for (const item of items) {
        itemMap.set(item.id, item);
      }

      const linkedWordByItem = new Map<string, string>();
      for (const link of itemLinks) {
        linkedWordByItem.set(link.assessment_item_id, link.word_id);
      }

      const wordMap = new Map<string, VocabularyWordRow>();
      for (const word of (wordData as VocabularyWordRow[]) || []) {
        wordMap.set(word.id, word);
      }

      const responsesByAttempt = new Map<string, ResponseRow[]>();
      for (const response of (responseData as ResponseRow[]) || []) {
        const current = responsesByAttempt.get(response.attempt_id) || [];
        current.push(response);
        responsesByAttempt.set(response.attempt_id, current);
      }

      return NextResponse.json({
        assignment: formatAssignmentSummary(
          assignment,
          student ?? undefined,
          parent ?? undefined,
          attempts
        ),
        attempts: attempts.map((attempt) => ({
          id: attempt.id,
          attempt_number: attempt.attempt_number,
          status: attempt.status,
          created_at: attempt.created_at,
          started_at: attempt.started_at,
          submitted_at: attempt.submitted_at,
          final_score: attempt.final_score,
          max_score: attempt.max_score,
          percentage: attempt.percentage,
          feedback: attempt.feedback,
          responses: (responsesByAttempt.get(attempt.id) || [])
            .map((response) => {
              const item = itemMap.get(response.assessment_item_id);
              const wordId =
                response.response?.word_id ||
                linkedWordByItem.get(response.assessment_item_id) ||
                item?.answer_key?.word_id ||
                null;
              const word = wordId ? wordMap.get(wordId) : undefined;

              return {
                assessment_item_id: response.assessment_item_id,
                item_order: item?.item_order ?? null,
                prompt: item?.prompt ?? null,
                word: word?.word ?? null,
                selected_answer: response.response?.selected_answer ?? null,
                correct_answer: word?.definition ?? null,
                is_correct: response.is_correct,
                final_score: response.final_score,
                feedback: response.feedback,
              };
            })
            .sort((left, right) => (left.item_order ?? 0) - (right.item_order ?? 0)),
        })),
      });
    }

    const { data: assignmentData, error: assignmentError } = await adminSupabase
      .from("assessment_assignments")
      .select(
        "id, assigned_at, available_from, due_at, max_attempts, status, student_id, assessment_definition_id, assessment_definitions(id, title, type, description)"
      )
      .order("assigned_at", { ascending: false })
      .limit(100);

    if (assignmentError) {
      throw new Error(assignmentError.message);
    }

    const assignments = (assignmentData as AssignmentRow[]) || [];
    const studentIds = Array.from(new Set(assignments.map((assignment) => assignment.student_id)));
    const assignmentIds = assignments.map((assignment) => assignment.id);

    const [
      { data: studentData, error: studentError },
      { data: attemptData, error: attemptError },
    ] = await Promise.all([
      studentIds.length > 0
        ? adminSupabase
            .from("students")
            .select("id, parent_user_id, full_name")
            .in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      assignmentIds.length > 0
        ? adminSupabase
            .from("assessment_attempts")
            .select(
              "id, assignment_id, attempt_number, status, created_at, started_at, submitted_at, final_score, max_score, percentage, feedback"
            )
            .in("assignment_id", assignmentIds)
            .order("attempt_number", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (studentError) {
      throw new Error(studentError.message);
    }

    if (attemptError) {
      throw new Error(attemptError.message);
    }

    const students = (studentData as StudentRow[]) || [];
    const attempts = (attemptData as AttemptRow[]) || [];

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

    const attemptsByAssignment = new Map<string, AttemptRow[]>();
    for (const attempt of attempts) {
      if (!attempt.assignment_id) continue;
      const current = attemptsByAssignment.get(attempt.assignment_id) || [];
      current.push(attempt);
      attemptsByAssignment.set(attempt.assignment_id, current);
    }

    return NextResponse.json({
      assignments: assignments.map((assignment) => {
        const student = studentMap.get(assignment.student_id);
        const parent = student ? profileMap.get(student.parent_user_id) : undefined;
        const relatedAttempts = attemptsByAssignment.get(assignment.id) || [];

        return formatAssignmentSummary(assignment, student, parent, relatedAttempts);
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load assessment results.";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden"
          ? 403
          : message === "Assessment assignment not found."
            ? 404
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
