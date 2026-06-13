-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "google_sub" VARCHAR(255),
    "role" VARCHAR(50) NOT NULL DEFAULT 'member',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_otps" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "locale" VARCHAR(16),
    "bio" TEXT,
    "birth_date" VARCHAR(20),
    "gender" VARCHAR(50),
    "city" VARCHAR(120),
    "origin_country" VARCHAR(120),
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intent" VARCHAR(50),
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photos_count" INTEGER NOT NULL DEFAULT 0,
    "verified_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_version" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "language" VARCHAR(10),
    "target_lang" VARCHAR(10),
    "auto_translate" BOOLEAN NOT NULL DEFAULT false,
    "auto_detect_language" BOOLEAN NOT NULL DEFAULT false,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "precise_location_enabled" BOOLEAN NOT NULL DEFAULT false,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'public',
    "hide_age" BOOLEAN NOT NULL DEFAULT false,
    "hide_distance" BOOLEAN NOT NULL DEFAULT false,
    "incognito" BOOLEAN NOT NULL DEFAULT false,
    "read_receipts" BOOLEAN NOT NULL DEFAULT true,
    "shadow_ghost" BOOLEAN NOT NULL DEFAULT false,
    "travel_pass_city" VARCHAR(50),
    "phone_country_code" VARCHAR(10),
    "phone_national_number" VARCHAR(20),
    "distance_km" INTEGER NOT NULL DEFAULT 50,
    "age_min" INTEGER NOT NULL DEFAULT 18,
    "age_max" INTEGER NOT NULL DEFAULT 45,
    "gender_preference" VARCHAR(20) NOT NULL DEFAULT 'everyone',
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_locations" (
    "user_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "city" VARCHAR(120),
    "country" VARCHAR(120),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_locations_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "profile_photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_selfie_submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "provider" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_selfie_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_entitlements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entitlement_snapshot" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "user_id" UUID NOT NULL,
    "conversation_id" VARCHAR(100) NOT NULL,
    "peer_profile_id" UUID NOT NULL,
    "relation_state" VARCHAR(30) NOT NULL DEFAULT 'active',
    "relation_state_updated_at" TIMESTAMP(3),
    "received_superlike_trace_at" TIMESTAMP(3),
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_preview" TEXT NOT NULL DEFAULT '',
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("user_id","conversation_id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "user_id" UUID NOT NULL,
    "message_id" VARCHAR(100) NOT NULL,
    "conversation_id" VARCHAR(100) NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "original_text" TEXT NOT NULL,
    "translated_text" TEXT,
    "translated" BOOLEAN NOT NULL DEFAULT false,
    "target_locale" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("user_id","message_id")
);

-- CreateTable
CREATE TABLE "discover_likes" (
    "id" UUID NOT NULL,
    "liker_user_id" UUID NOT NULL,
    "liked_user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "was_superlike" BOOLEAN NOT NULL DEFAULT false,
    "hidden_by_shadowghost" BOOLEAN NOT NULL DEFAULT false,
    "matched_at" TIMESTAMP(3),
    "passed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discover_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_boosts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "active_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_boosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discover_feed_events" (
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_swiped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_decision" VARCHAR(20),
    "seen_count" INTEGER NOT NULL DEFAULT 1,
    "last_feed_cursor" VARCHAR(100),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discover_feed_events_pkey" PRIMARY KEY ("user_id","profile_id")
);

-- CreateTable
CREATE TABLE "discover_like_unlocks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "like_id" UUID NOT NULL,
    "unlock_method" VARCHAR(50) NOT NULL,
    "consumed_item_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discover_like_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_consumptions" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" UUID NOT NULL,
    "item_type" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments_checkouts" (
    "checkout_id" VARCHAR(100) NOT NULL,
    "yookassa_payment_id" VARCHAR(100),
    "order_number" VARCHAR(200) NOT NULL,
    "user_id" UUID NOT NULL,
    "offer_id" VARCHAR(100) NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "attributed" BOOLEAN NOT NULL DEFAULT false,
    "entitlement_snapshot" JSONB,
    "provider_raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_checkouts_pkey" PRIMARY KEY ("checkout_id")
);

-- CreateTable
CREATE TABLE "in_app_offers" (
    "id" VARCHAR(100) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "tag" VARCHAR(100),
    "amount_minor" INTEGER NOT NULL,
    "currency_numeric" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "duration_hours" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "in_app_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_blocks" (
    "user_id" UUID NOT NULL,
    "blocked_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_blocks_pkey" PRIMARY KEY ("user_id","blocked_user_id")
);

-- CreateTable
CREATE TABLE "safety_reports" (
    "user_id" UUID NOT NULL,
    "report_id" VARCHAR(100) NOT NULL,
    "reported_user_id" UUID NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_reports_pkey" PRIMARY KEY ("user_id","report_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_otps_token_hash_key" ON "email_otps"("token_hash");

-- CreateIndex
CREATE INDEX "email_otps_email_idx" ON "email_otps"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_user_id_key" ON "settings"("user_id");

-- CreateIndex
CREATE INDEX "profile_photos_user_id_sort_order_idx" ON "profile_photos"("user_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "user_entitlements_user_id_key" ON "user_entitlements"("user_id");

-- CreateIndex
CREATE INDEX "chat_conversations_user_id_idx" ON "chat_conversations"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_user_id_conversation_id_idx" ON "chat_messages"("user_id", "conversation_id");

-- CreateIndex
CREATE INDEX "discover_likes_liked_user_id_status_idx" ON "discover_likes"("liked_user_id", "status");

-- CreateIndex
CREATE INDEX "discover_likes_liker_user_id_idx" ON "discover_likes"("liker_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "discover_likes_liker_user_id_liked_user_id_key" ON "discover_likes"("liker_user_id", "liked_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_boosts_user_id_key" ON "user_boosts"("user_id");

-- CreateIndex
CREATE INDEX "discover_feed_events_user_id_idx" ON "discover_feed_events"("user_id");

-- CreateIndex
CREATE INDEX "discover_like_unlocks_user_id_like_id_idx" ON "discover_like_unlocks"("user_id", "like_id");

-- CreateIndex
CREATE INDEX "entitlement_consumptions_user_id_idx" ON "entitlement_consumptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_checkouts_yookassa_payment_id_key" ON "payments_checkouts"("yookassa_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_checkouts_order_number_key" ON "payments_checkouts"("order_number");

-- CreateIndex
CREATE INDEX "payments_checkouts_user_id_status_attributed_idx" ON "payments_checkouts"("user_id", "status", "attributed");

-- CreateIndex
CREATE INDEX "safety_blocks_user_id_idx" ON "safety_blocks"("user_id");

-- CreateIndex
CREATE INDEX "safety_reports_user_id_idx" ON "safety_reports"("user_id");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_selfie_submissions" ADD CONSTRAINT "kyc_selfie_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

