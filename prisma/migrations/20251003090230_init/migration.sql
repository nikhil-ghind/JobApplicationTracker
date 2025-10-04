-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('Applied', 'InReview', 'Assessment', 'PhoneScreen', 'Interview', 'Onsite', 'Offer', 'Rejected', 'Withdrawn', 'Ghosted');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gmail',
    "email_address" TEXT NOT NULL,
    "provider_sub" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_account_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT,
    "source" TEXT,
    "status" "ApplicationStatus" NOT NULL,
    "applied_at" TIMESTAMP(3),
    "last_update_at" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION,
    "dedupe_key_raw" TEXT NOT NULL,
    "dedupe_key_hash" TEXT NOT NULL,
    "extra" JSONB,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL,
    "job_application_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "email_account_id" TEXT NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "subject" TEXT,
    "from_addr" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "snippet" TEXT,
    "headers" JSONB,
    "body_pointer" TEXT,
    "parsed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_dedupe_key_hash_key" ON "JobApplication"("dedupe_key_hash");

-- CreateIndex
CREATE INDEX "JobApplication_dedupe_key_raw_idx" ON "JobApplication"("dedupe_key_raw");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_email_account_id_provider_message_id_key" ON "EmailMessage"("email_account_id", "provider_message_id");

-- AddForeignKey
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_email_account_id_fkey" FOREIGN KEY ("email_account_id") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_email_account_id_fkey" FOREIGN KEY ("email_account_id") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
