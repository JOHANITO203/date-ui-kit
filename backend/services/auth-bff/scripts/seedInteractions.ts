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

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const anchorEmails = (
  process.env.SEED_INTERACTIONS_ANCHOR_EMAILS ??
  "johaneoyaraht@gmail.com,johanito203@gmail.com"
)
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const parseSeedEmail = (email: string | undefined) =>
  Boolean(email && /^seed\.(moscow|saint-petersburg|voronezh|sochi)\.\d+@exotic\.local$/i.test(email));

const listUsers = async (): Promise<User[]> => {
  let page = 1;
  const perPage = 200;
  const all: User[] = [];
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

const nowIso = () => new Date().toISOString();

const ageFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return 24;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return 24;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return Math.max(18, Math.min(45, age));
};

const relationStateForIndex = (index: number): "active" | "blocked_by_me" | "blocked_me" => {
  if (index % 7 === 0) return "blocked_by_me";
  if (index % 11 === 0) return "blocked_me";
  return "active";
};

const main = async () => {
  const users = await listUsers();
  const byEmail = new Map(
    users
      .filter((u) => u.email)
      .map((u) => [u.email!.toLowerCase(), u.id] as const),
  );

  const anchors = anchorEmails
    .map((email) => ({ email, userId: byEmail.get(email) }))
    .filter((entry): entry is { email: string; userId: string } => Boolean(entry.userId));

  if (anchors.length === 0) {
    throw new Error(`None of anchor emails found: ${anchorEmails.join(", ")}`);
  }

  const seedPeers = users.filter((u) => parseSeedEmail(u.email));
  if (seedPeers.length === 0) {
    throw new Error("No seed users found. Run `npm run seed:profiles` first.");
  }

  const peerIds = seedPeers.map((peer) => peer.id);
  const profileRowsResult = await supabase
    .from("profiles")
    .select("user_id,first_name,birth_date,city")
    .in("user_id", peerIds)
    .limit(500);
  if (profileRowsResult.error) throw profileRowsResult.error;

  const peerProfileByUserId = new Map(
    (profileRowsResult.data ?? []).map((row) => [row.user_id, row]),
  );

  const seededConversations: Array<{ anchor: string; conversationId: string; peerId: string }> = [];

  for (const anchor of anchors) {
    const peersForAnchor = seedPeers.slice(0, 18);

    for (let i = 0; i < peersForAnchor.length; i += 1) {
      const peer = peersForAnchor[i];
      if (peer.id === anchor.userId) continue;
      const peerProfile = peerProfileByUserId.get(peer.id);
      const peerName = peerProfile?.first_name ?? "Profile";
      const peerAge = ageFromBirthDate(peerProfile?.birth_date ?? null);
      const conversationId = `seed-conv-${anchor.userId.slice(0, 8)}-${peer.id.slice(0, 8)}`;
      const relationState = relationStateForIndex(i);
      const lastText =
        relationState === "active"
          ? `Hi ${peerName}, welcome to Exotic.`
          : relationState === "blocked_by_me"
            ? "You blocked this conversation."
            : "This user blocked you.";
      const ts = nowIso();

      const { error: convoError } = await supabase.from("chat_conversations").upsert(
        {
          user_id: anchor.userId,
          conversation_id: conversationId,
          peer_profile_id: peer.id,
          unread_count: relationState === "active" ? (i % 3 === 0 ? 1 : 0) : 0,
          last_message_preview: lastText,
          last_message_at: ts,
          relation_state: relationState,
          relation_state_updated_at: ts,
          received_superlike_trace_at: i % 5 === 0 ? ts : null,
        },
        { onConflict: "user_id,conversation_id" },
      );
      if (convoError) throw convoError;

      const { error: msgInError } = await supabase.from("chat_messages").upsert(
        {
          user_id: anchor.userId,
          message_id: `seed-msg-in-${anchor.userId.slice(0, 8)}-${peer.id.slice(0, 8)}`,
          conversation_id: conversationId,
          sender_user_id: peer.id,
          direction: "incoming",
          original_text:
            relationState === "active"
              ? `Hi, I am ${peerName}, ${peerAge}.`
              : relationState === "blocked_by_me"
                ? "Conversation blocked by you."
                : "Conversation restricted by peer.",
          translated: false,
          created_at: ts,
        },
        { onConflict: "user_id,message_id" },
      );
      if (msgInError) throw msgInError;

      const { error: msgOutError } = await supabase.from("chat_messages").upsert(
        {
          user_id: anchor.userId,
          message_id: `seed-msg-out-${anchor.userId.slice(0, 8)}-${peer.id.slice(0, 8)}`,
          conversation_id: conversationId,
          sender_user_id: anchor.userId,
          direction: "outgoing",
          original_text: relationState === "active" ? "Nice to meet you too." : "State synced.",
          translated: false,
          created_at: ts,
          read_at: relationState === "active" ? ts : null,
        },
        { onConflict: "user_id,message_id" },
      );
      if (msgOutError) throw msgOutError;

      seededConversations.push({ anchor: anchor.email, conversationId, peerId: peer.id });
    }

    const blockedPeers = peersForAnchor.slice(0, 3);
    for (const blocked of blockedPeers) {
      await supabase.from("safety_blocks").upsert(
        {
          user_id: anchor.userId,
          blocked_user_id: blocked.id,
          created_at: nowIso(),
        },
        { onConflict: "user_id,blocked_user_id" },
      );
    }

    const reportPeer = peersForAnchor[3];
    if (reportPeer) {
      await supabase.from("safety_reports").upsert(
        {
          user_id: anchor.userId,
          report_id: `seed-report-${anchor.userId.slice(0, 8)}-${reportPeer.id.slice(0, 8)}`,
          reported_user_id: reportPeer.id,
          reason: "other",
          note: "Seed report for QA scenarios",
          created_at: nowIso(),
        },
        { onConflict: "user_id,report_id" },
      );
    }
  }

  console.log("[seed:interactions] done");
  console.log(`[seed:interactions] anchors=${anchors.length}`);
  console.log(`[seed:interactions] conversations_upserted=${seededConversations.length}`);
  console.table(seededConversations.slice(0, 12));
};

main().catch((error) => {
  console.error("[seed:interactions] failed", error);
  process.exit(1);
});

