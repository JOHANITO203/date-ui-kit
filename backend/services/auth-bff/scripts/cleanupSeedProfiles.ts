import { config as loadEnv } from "dotenv";
import { createClient, type User } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../../../");
const serviceDir = path.resolve(__dirname, "..");

loadEnv({ path: path.join(rootDir, ".env") });
loadEnv({ path: path.join(serviceDir, ".env") });
loadEnv();

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE"] as const;
for (const key of requiredEnv) {
  if (!process.env[key] || process.env[key]!.trim().length === 0) {
    throw new Error(`Missing required env: ${key}`);
  }
}

const bucket = process.env.STORAGE_PROFILE_PHOTOS_BUCKET?.trim() || "profile-photos";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const isSeedEmail = (email: string | undefined) =>
  Boolean(email && /^seed\.(moscow|saint-petersburg|voronezh|sochi)\.\d+@exotic\.local$/i.test(email));

const listAllUsers = async (): Promise<User[]> => {
  const all: User[] = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users ?? [];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
};

const main = async () => {
  const users = await listAllUsers();
  const seedUsers = users.filter((user) => isSeedEmail(user.email));
  const seedIds = seedUsers.map((user) => user.id);

  if (seedIds.length === 0) {
    console.log("[seed:cleanup] no seed users found");
    return;
  }

  // Cleanup seeded interaction artifacts from anchor users (conversation/message ids prefixed by seed-).
  await supabase
    .from("chat_messages")
    .delete()
    .like("message_id", "seed-msg-%");

  await supabase
    .from("chat_conversations")
    .delete()
    .like("conversation_id", "seed-conv-%");

  await supabase
    .from("safety_reports")
    .delete()
    .like("report_id", "seed-report-%");

  // Remove rows where seed users were peers in safety tables.
  await supabase
    .from("safety_blocks")
    .delete()
    .in("blocked_user_id", seedIds);

  await supabase
    .from("safety_reports")
    .delete()
    .in("reported_user_id", seedIds);

  // Collect and remove storage objects first.
  const photosResult = await supabase
    .from("profile_photos")
    .select("storage_path")
    .in("user_id", seedIds);
  if (photosResult.error) throw photosResult.error;
  const storagePaths = (photosResult.data ?? [])
    .map((row) => row.storage_path)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (storagePaths.length > 0) {
    await supabase.storage.from(bucket).remove(storagePaths);
  }

  // Delete seed auth users (cascades profiles/settings/profile_photos/other FK-based rows).
  let deletedUsers = 0;
  for (const user of seedUsers) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.warn(`[seed:cleanup] failed delete ${user.email ?? user.id}: ${error.message}`);
      continue;
    }
    deletedUsers += 1;
  }

  console.log(`[seed:cleanup] done seedUsers=${seedIds.length} deleted=${deletedUsers} storageObjects=${storagePaths.length}`);
};

main().catch((error) => {
  console.error("[seed:cleanup] failed", error);
  process.exit(1);
});

