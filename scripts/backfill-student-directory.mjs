import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = value;
  }
}

const projectRoot = process.cwd();
loadEnvFile(path.join(projectRoot, ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function fetchAllAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const batch = data?.users ?? [];
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

async function main() {
  const authUsers = await fetchAllAuthUsers();
  const userIds = authUsers.map((user) => user.id);

  const [{ data: profiles }, { data: students }] = await Promise.all([
    supabase.from("profiles").select("id").in("id", userIds),
    supabase
      .from("students")
      .select("id, parent_user_id, is_primary")
      .in("parent_user_id", userIds)
      .eq("is_primary", true),
  ]);

  const profileIds = new Set((profiles ?? []).map((profile) => profile.id));
  const studentParentIds = new Set(
    (students ?? []).map((student) => student.parent_user_id)
  );

  const profilesToInsert = [];
  const studentsToInsert = [];

  for (const user of authUsers) {
    const fullName = normalizeText(user.user_metadata?.full_name);
    const studentName = normalizeText(user.user_metadata?.student_name);
    const email = normalizeText(user.email).toLowerCase();

    if (!profileIds.has(user.id) && (fullName || email)) {
      profilesToInsert.push({
        id: user.id,
        full_name: fullName || null,
        email: email || null,
      });
    }

    if (!studentParentIds.has(user.id) && studentName) {
      studentsToInsert.push({
        parent_user_id: user.id,
        full_name: studentName,
        is_primary: true,
      });
    }
  }

  if (profilesToInsert.length > 0) {
    const { error } = await supabase
      .from("profiles")
      .upsert(profilesToInsert, { onConflict: "id" });

    if (error) {
      throw error;
    }
  }

  if (studentsToInsert.length > 0) {
    const { error } = await supabase.from("students").insert(studentsToInsert);

    if (error) {
      throw error;
    }
  }

  console.log(
    JSON.stringify(
      {
        authUsers: authUsers.length,
        profilesInserted: profilesToInsert.length,
        studentsInserted: studentsToInsert.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
