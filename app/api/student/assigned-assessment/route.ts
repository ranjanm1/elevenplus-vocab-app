import { NextRequest, NextResponse } from "next/server";
import {
  buildDefinitionMatchQuestions,
  type AssessmentQuizQuestion,
  type QuizWord,
} from "@/lib/assessment-quiz";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { requireAuthenticatedUser } from "@/lib/server-auth";

type AssignmentRow = {
  id: string;
  assigned_at: string;
  available_from: string | null;
  due_at: string | null;
  status: string;
  max_attempts: number | null;
  student_id: string;
  assessment_definition_id: string;
  assessment_definitions: Array<{
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    type: string;
  }> | null;
};

type StudentRow = {
  id: string;
  full_name: string | null;
};

type AssessmentItemRow = {
  id: string;
  item_order: number;
};

type AssessmentItemWordRow = {
  assessment_item_id: string;
  word_id: string;
};

type SubmitAnswer = {
  itemId: string;
  wordId: string;
  selectedAnswer: string;
};

type SubmitRequestBody = {
  assignmentId?: string;
  answers?: SubmitAnswer[];
  startedAt?: string | null;
};

function isUnavailable(availableFrom: string | null, dueAt: string | null) {
  const now = Date.now();
  if (availableFrom && new Date(availableFrom).getTime() > now) {
    return "This assessment is not available yet.";
  }

  if (dueAt && new Date(dueAt).getTime() < now) {
    return "This assessment is past its due date.";
  }

  return null;
}

async function loadOwnedAssignment(assignmentId: string, userId: string) {
  const adminSupabase = createAdminSupabaseClient();

  const { data: studentRow, error: studentError } = await adminSupabase
    .from("students")
    .select("id, full_name")
    .eq("parent_user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();

  if (studentError) {
    throw new Error(studentError.message);
  }

  if (!studentRow) {
    throw new Error("Student profile not found.");
  }

  const { data: assignmentRow, error: assignmentError } = await adminSupabase
    .from("assessment_assignments")
    .select(
      "id, assigned_at, available_from, due_at, status, max_attempts, student_id, assessment_definition_id, assessment_definitions(id, title, description, instructions, type)"
    )
    .eq("id", assignmentId)
    .eq("student_id", studentRow.id)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  if (!assignmentRow) {
    throw new Error("Assessment assignment not found.");
  }

  return {
    adminSupabase,
    assignment: assignmentRow as AssignmentRow,
    student: studentRow as StudentRow,
  };
}

async function loadAssignmentQuestions(
  assignmentId: string,
  userId: string
): Promise<{
  assignment: AssignmentRow;
  student: StudentRow;
  questions: AssessmentQuizQuestion[];
}> {
  const { adminSupabase, assignment, student } = await loadOwnedAssignment(
    assignmentId,
    userId
  );

  const unavailableReason = isUnavailable(assignment.available_from, assignment.due_at);
  if (unavailableReason) {
    throw new Error(unavailableReason);
  }

  const { data: itemRows, error: itemError } = await adminSupabase
    .from("assessment_items")
    .select("id, item_order")
    .eq("assessment_definition_id", assignment.assessment_definition_id)
    .order("item_order", { ascending: true });

  if (itemError) {
    throw new Error(itemError.message);
  }

  const items = (itemRows as AssessmentItemRow[]) || [];
  if (items.length === 0) {
    throw new Error("No quiz items were found for this assessment.");
  }

  const itemIds = items.map((item) => item.id);
  const { data: linkRows, error: linkError } = await adminSupabase
    .from("assessment_item_words")
    .select("assessment_item_id, word_id")
    .in("assessment_item_id", itemIds);

  if (linkError) {
    throw new Error(linkError.message);
  }

  const links = (linkRows as AssessmentItemWordRow[]) || [];
  const wordIds = Array.from(new Set(links.map((link) => link.word_id)));

  const [{ data: selectedWordRows, error: selectedWordsError }, { data: poolWordRows, error: poolWordsError }] =
    await Promise.all([
      adminSupabase
        .from("vocabulary_words")
        .select("id, word, definition")
        .in("id", wordIds),
      adminSupabase
        .from("vocabulary_words")
        .select("id, word, definition")
        .eq("active", true)
        .eq("premium_only", false)
        .limit(200),
    ]);

  if (selectedWordsError) {
    throw new Error(selectedWordsError.message);
  }

  if (poolWordsError) {
    throw new Error(poolWordsError.message);
  }

  const selectedWordMap = new Map<string, QuizWord>();
  for (const word of (selectedWordRows as QuizWord[]) || []) {
    selectedWordMap.set(word.id, word);
  }

  const selectedWords = items
    .map((item) => {
      const link = links.find((candidate) => candidate.assessment_item_id === item.id);
      if (!link) return null;
      const word = selectedWordMap.get(link.word_id);
      if (!word) return null;

      return {
        ...word,
        itemId: item.id,
      };
    })
    .filter(Boolean) as Array<QuizWord & { itemId: string }>;

  if (selectedWords.length !== items.length) {
    throw new Error("Assessment words are incomplete or unavailable.");
  }

  const poolWords = ((poolWordRows as QuizWord[]) || []).filter(
    (word) => word.word && word.definition
  );
  const questions = buildDefinitionMatchQuestions(selectedWords, poolWords);

  return {
    assignment,
    student,
    questions,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request.headers.get("authorization"));
    const assignmentId = request.nextUrl.searchParams.get("assignmentId")?.trim();

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
    }

    const { assignment, student, questions } = await loadAssignmentQuestions(
      assignmentId,
      user.id
    );

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        title:
          assignment.assessment_definitions?.[0]?.title ?? "Assigned assessment",
        description: assignment.assessment_definitions?.[0]?.description ?? null,
        instructions: assignment.assessment_definitions?.[0]?.instructions ?? null,
        due_at: assignment.due_at,
        available_from: assignment.available_from,
        status: assignment.status,
        max_attempts: assignment.max_attempts,
      },
      student,
      questions,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load assigned assessment.";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Assessment assignment not found."
          ? 404
          : message === "assignmentId is required."
            ? 400
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request.headers.get("authorization"));
    const body = (await request.json()) as SubmitRequestBody;
    const assignmentId = body.assignmentId?.trim();

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
    }

    const answers = Array.isArray(body.answers) ? body.answers : [];
    if (answers.length === 0) {
      return NextResponse.json({ error: "At least one answer is required." }, { status: 400 });
    }

    const { adminSupabase, assignment, student } = await loadOwnedAssignment(
      assignmentId,
      user.id
    );
    const unavailableReason = isUnavailable(assignment.available_from, assignment.due_at);
    if (unavailableReason) {
      return NextResponse.json({ error: unavailableReason }, { status: 400 });
    }

    const { questions } = await loadAssignmentQuestions(assignmentId, user.id);
    const questionMap = new Map<string, AssessmentQuizQuestion>();
    for (const question of questions) {
      questionMap.set(question.itemId, question);
    }

    const latestAnswerByItem = new Map<string, SubmitAnswer>();
    for (const answer of answers) {
      if (typeof answer?.itemId !== "string" || typeof answer?.selectedAnswer !== "string") {
        continue;
      }

      latestAnswerByItem.set(answer.itemId, {
        itemId: answer.itemId,
        wordId: answer.wordId,
        selectedAnswer: answer.selectedAnswer,
      });
    }

    const normalizedAnswers = Array.from(latestAnswerByItem.values()).filter((answer) =>
      questionMap.has(answer.itemId)
    );

    if (normalizedAnswers.length !== questions.length) {
      return NextResponse.json(
        { error: "Submit answers for every question before finishing the assessment." },
        { status: 400 }
      );
    }

    const { count: attemptCount, error: attemptCountError } = await adminSupabase
      .from("assessment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", assignmentId)
      .eq("user_id", user.id);

    if (attemptCountError) {
      throw new Error(attemptCountError.message);
    }

    if (
      assignment.max_attempts !== null &&
      assignment.max_attempts !== undefined &&
      (attemptCount || 0) >= assignment.max_attempts
    ) {
      return NextResponse.json(
        { error: "This assignment has reached its maximum number of attempts." },
        { status: 400 }
      );
    }

    const scoredAnswers = normalizedAnswers.map((answer) => {
      const question = questionMap.get(answer.itemId)!;
      const isCorrect = answer.selectedAnswer === question.correctAnswer;
      return {
        ...answer,
        question,
        isCorrect,
      };
    });

    const score = scoredAnswers.filter((answer) => answer.isCorrect).length;
    const totalQuestions = questions.length;
    const percentage = totalQuestions
      ? Math.round((score / totalQuestions) * 100)
      : 0;
    const submittedAt = new Date().toISOString();
    const startedAt = body.startedAt || submittedAt;

    const { data: attemptRow, error: attemptInsertError } = await adminSupabase
      .from("assessment_attempts")
      .insert({
        assignment_id: assignmentId,
        assessment_definition_id: assignment.assessment_definition_id,
        student_id: student.id,
        user_id: user.id,
        attempt_number: (attemptCount || 0) + 1,
        status: "submitted",
        started_at: startedAt,
        submitted_at: submittedAt,
        auto_score: score,
        final_score: score,
        max_score: totalQuestions,
        percentage,
        metadata: {
          source: "assigned_quiz",
        },
      })
      .select("id")
      .single();

    if (attemptInsertError || !attemptRow) {
      throw new Error(attemptInsertError?.message || "Failed to save assessment attempt.");
    }

    const { error: responsesInsertError } = await adminSupabase
      .from("assessment_responses")
      .insert(
        scoredAnswers.map((answer) => ({
          attempt_id: attemptRow.id,
          assessment_item_id: answer.itemId,
          response: {
            selected_answer: answer.selectedAnswer,
            word_id: answer.question.wordId,
          },
          auto_score: answer.isCorrect ? 1 : 0,
          final_score: answer.isCorrect ? 1 : 0,
          is_correct: answer.isCorrect,
        }))
      );

    if (responsesInsertError) {
      throw new Error(responsesInsertError.message);
    }

    const { error: assignmentUpdateError } = await adminSupabase
      .from("assessment_assignments")
      .update({
        status: "submitted",
      })
      .eq("id", assignmentId);

    if (assignmentUpdateError) {
      throw new Error(assignmentUpdateError.message);
    }

    const { error: quizResultError } = await adminSupabase.from("quiz_results").insert({
      user_id: user.id,
      score,
      total_questions: totalQuestions,
      percentage,
    });

    if (quizResultError) {
      throw new Error(quizResultError.message);
    }

    return NextResponse.json({
      result: {
        attempt_id: attemptRow.id,
        score,
        total_questions: totalQuestions,
        percentage,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit assigned assessment.";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "assignmentId is required." || message.includes("At least one answer")
          ? 400
          : message === "Assessment assignment not found."
            ? 404
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
