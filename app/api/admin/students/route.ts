import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { requireAdminUser } from "@/lib/server-auth";

type StudentRow = {
  id: string;
  parent_user_id: string;
  full_name: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request.headers.get("authorization"));

    const adminSupabase = createAdminSupabaseClient();
    const { data: studentsData, error: studentsError } = await adminSupabase
      .from("students")
      .select("id, parent_user_id, full_name, created_at")
      .eq("is_primary", true)
      .order("created_at", { ascending: false })
      .limit(250);

    if (studentsError) {
      throw new Error(studentsError.message);
    }

    const students = (studentsData as StudentRow[]) || [];
    const parentUserIds = Array.from(
      new Set(students.map((student) => student.parent_user_id))
    );

    let profiles: ProfileRow[] = [];
    if (parentUserIds.length > 0) {
      const { data: profilesData, error: profilesError } = await adminSupabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", parentUserIds);

      if (profilesError) {
        throw new Error(profilesError.message);
      }

      profiles = (profilesData as ProfileRow[]) || [];
    }

    const profileMap = new Map<string, ProfileRow>();
    for (const profile of profiles) {
      profileMap.set(profile.id, profile);
    }

    return NextResponse.json({
      students: students.map((student) => {
        const parent = profileMap.get(student.parent_user_id);
        return {
          id: student.id,
          full_name: student.full_name,
          parent_user_id: student.parent_user_id,
          parent_name: parent?.full_name ?? null,
          parent_email: parent?.email ?? null,
          created_at: student.created_at,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load students.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
