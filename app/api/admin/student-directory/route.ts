import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type StudentRow = {
  id: string;
  parent_user_id: string;
  full_name: string | null;
  is_primary: boolean;
};

type AuthFallbackProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type AuthFallbackStudent = {
  id: string;
  parent_user_id: string;
  full_name: string | null;
  is_primary: boolean;
};

function getAuthClient(authHeader: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase public env vars are missing");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const userIds = Array.isArray(body?.userIds)
      ? body.userIds.filter((value: unknown): value is string => typeof value === "string")
      : [];

    if (userIds.length === 0) {
      return NextResponse.json({ profiles: [], students: [] });
    }

    const authClient = getAuthClient(authHeader);
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleRow, error: roleError } = await authClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError || roleRow?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminSupabase = createAdminSupabaseClient();
    const [
      { data: profilesData, error: profilesError },
      { data: studentsByParentData, error: studentsByParentError },
      { data: studentsByIdData, error: studentsByIdError },
    ] = await Promise.all([
      adminSupabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds),
      adminSupabase
        .from("students")
        .select("id, parent_user_id, full_name, is_primary")
        .in("parent_user_id", userIds)
        .eq("is_primary", true),
      adminSupabase
        .from("students")
        .select("id, parent_user_id, full_name, is_primary")
        .in("id", userIds),
    ]);

    if (profilesError) {
      throw new Error(profilesError.message);
    }

    if (studentsByParentError) {
      throw new Error(studentsByParentError.message);
    }

    if (studentsByIdError) {
      throw new Error(studentsByIdError.message);
    }

    const studentsMap = new Map<string, StudentRow>();
    for (const student of [
      ...((studentsByParentData as StudentRow[]) || []),
      ...((studentsByIdData as StudentRow[]) || []),
    ]) {
      studentsMap.set(student.id, student);
      studentsMap.set(student.parent_user_id, student);
    }

    const profileMap = new Map<string, ProfileRow>();
    for (const profile of (profilesData as ProfileRow[]) || []) {
      profileMap.set(profile.id, profile);
    }

    const unresolvedUserIds = userIds.filter(
      (userId: string) => !profileMap.has(userId) && !studentsMap.has(userId)
    );

    for (const userId of unresolvedUserIds) {
      const { data, error } = await adminSupabase.auth.admin.getUserById(userId);

      if (error || !data.user) {
        continue;
      }

      const authProfile: AuthFallbackProfile = {
        id: data.user.id,
        full_name:
          typeof data.user.user_metadata?.full_name === "string"
            ? data.user.user_metadata.full_name.trim() || null
            : null,
        email: data.user.email ?? null,
      };
      profileMap.set(authProfile.id, authProfile);

      const studentName =
        typeof data.user.user_metadata?.student_name === "string"
          ? data.user.user_metadata.student_name.trim() || null
          : null;

      if (studentName) {
        const authStudent: AuthFallbackStudent = {
          id: data.user.id,
          parent_user_id: data.user.id,
          full_name: studentName,
          is_primary: true,
        };
        studentsMap.set(authStudent.id, authStudent);
        studentsMap.set(authStudent.parent_user_id, authStudent);
      }
    }

    return NextResponse.json({
      profiles: Array.from(profileMap.values()),
      students: Array.from(studentsMap.values()),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load student directory.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
