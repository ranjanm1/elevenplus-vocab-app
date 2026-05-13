import { NextRequest, NextResponse } from "next/server";
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
  metadata: {
    word_count?: number;
  } | null;
  assessment_definitions: Array<{
    title: string;
    description: string | null;
    type: string;
  }> | null;
};

type AttemptSummaryRow = {
  assignment_id: string | null;
  created_at: string;
  percentage: number | null;
};

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request.headers.get("authorization"));
    const adminSupabase = createAdminSupabaseClient();

    const { data: studentRow, error: studentError } = await adminSupabase
      .from("students")
      .select("id, full_name")
      .eq("parent_user_id", user.id)
      .eq("is_primary", true)
      .maybeSingle();

    if (studentError) {
      throw new Error(studentError.message);
    }

    if (!studentRow) {
      return NextResponse.json({ assignments: [] });
    }

    const { data: assignmentRows, error: assignmentError } = await adminSupabase
      .from("assessment_assignments")
      .select(
        "id, assigned_at, available_from, due_at, status, max_attempts, student_id, assessment_definition_id, metadata, assessment_definitions(title, description, type)"
      )
      .eq("student_id", studentRow.id)
      .order("assigned_at", { ascending: false });

    if (assignmentError) {
      throw new Error(assignmentError.message);
    }

    const assignments = (assignmentRows as AssignmentRow[]) || [];
    const assignmentIds = assignments.map((assignment) => assignment.id);

    let attempts: AttemptSummaryRow[] = [];
    if (assignmentIds.length > 0) {
      const { data: attemptRows, error: attemptError } = await adminSupabase
        .from("assessment_attempts")
        .select("assignment_id, created_at, percentage")
        .in("assignment_id", assignmentIds)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (attemptError) {
        throw new Error(attemptError.message);
      }

      attempts = (attemptRows as AttemptSummaryRow[]) || [];
    }

    const attemptsByAssignment = new Map<
      string,
      { count: number; latestPercentage: number | null; latestCreatedAt: string | null }
    >();

    for (const attempt of attempts) {
      if (!attempt.assignment_id) continue;

      const current = attemptsByAssignment.get(attempt.assignment_id) || {
        count: 0,
        latestPercentage: null,
        latestCreatedAt: null,
      };

      attemptsByAssignment.set(attempt.assignment_id, {
        count: current.count + 1,
        latestPercentage: current.latestPercentage ?? attempt.percentage,
        latestCreatedAt: current.latestCreatedAt ?? attempt.created_at,
      });
    }

    return NextResponse.json({
      student: {
        id: studentRow.id,
        full_name: studentRow.full_name,
      },
      assignments: assignments.map((assignment) => {
        const attemptSummary = attemptsByAssignment.get(assignment.id);
        const definition = assignment.assessment_definitions?.[0] || null;
        return {
          id: assignment.id,
          assigned_at: assignment.assigned_at,
          available_from: assignment.available_from,
          due_at: assignment.due_at,
          status: assignment.status,
          max_attempts: assignment.max_attempts,
          word_count: assignment.metadata?.word_count ?? null,
          assessment_title: definition?.title ?? "Assigned assessment",
          assessment_description: definition?.description ?? null,
          assessment_type: definition?.type ?? null,
          attempt_count: attemptSummary?.count ?? 0,
          latest_percentage: attemptSummary?.latestPercentage ?? null,
          latest_attempt_at: attemptSummary?.latestCreatedAt ?? null,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load assignments.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
