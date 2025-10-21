-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('READ', 'COMMENT', 'EDIT');

-- CreateEnum
CREATE TYPE "TranscriptionMethod" AS ENUM ('OPENAI', 'WHISPER_LOCAL', 'WHISPER_DOCKER');

-- CreateEnum
CREATE TYPE "ProcessingLocation" AS ENUM ('CLOUD', 'LOCAL', 'CONTAINER');

-- CreateEnum
CREATE TYPE "BatchJobStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "BatchItemStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "TranscriptStatus" NOT NULL DEFAULT 'QUEUED',
    "audioUrl" TEXT,
    "transcriptionMethod" "TranscriptionMethod" NOT NULL DEFAULT 'OPENAI',
    "whisperModel" TEXT,
    "processingLocation" "ProcessingLocation" NOT NULL DEFAULT 'CLOUD',
    "processingStats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "speakerId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptComment" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "segmentId" TEXT,
    "content" TEXT NOT NULL,
    "timestampPosition" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TranscriptComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptShare" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "sharedWithId" TEXT,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'READ',
    "shareToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultTranscriptionMethod" "TranscriptionMethod" NOT NULL DEFAULT 'OPENAI',
    "defaultWhisperModel" TEXT NOT NULL DEFAULT 'base',
    "autoDownloadModels" BOOLEAN NOT NULL DEFAULT false,
    "privacyMode" BOOLEAN NOT NULL DEFAULT false,
    "preferredProcessingLocation" "ProcessingLocation" NOT NULL DEFAULT 'CLOUD',
    "maxFileSize" INTEGER NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BatchJobStatus" NOT NULL DEFAULT 'DRAFT',
    "concurrency" INTEGER NOT NULL DEFAULT 3,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "estimatedTimeRemaining" INTEGER,
    "throughputMbps" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BatchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchItem" (
    "id" TEXT NOT NULL,
    "batchJobId" TEXT NOT NULL,
    "transcriptId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "status" "BatchItemStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "eta" INTEGER,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Transcript_userId_idx" ON "Transcript"("userId");

-- CreateIndex
CREATE INDEX "Transcript_status_idx" ON "Transcript"("status");

-- CreateIndex
CREATE INDEX "Transcript_createdAt_idx" ON "Transcript"("createdAt");

-- CreateIndex
CREATE INDEX "Transcript_transcriptionMethod_idx" ON "Transcript"("transcriptionMethod");

-- CreateIndex
CREATE INDEX "Transcript_processingLocation_idx" ON "Transcript"("processingLocation");

-- CreateIndex
CREATE INDEX "Transcript_userId_status_idx" ON "Transcript"("userId", "status");

-- CreateIndex
CREATE INDEX "Transcript_userId_transcriptionMethod_idx" ON "Transcript"("userId", "transcriptionMethod");

-- CreateIndex
CREATE INDEX "TranscriptSegment_transcriptId_idx" ON "TranscriptSegment"("transcriptId");

-- CreateIndex
CREATE INDEX "TranscriptSegment_startTime_endTime_idx" ON "TranscriptSegment"("startTime", "endTime");

-- CreateIndex
CREATE INDEX "TranscriptComment_transcriptId_idx" ON "TranscriptComment"("transcriptId");

-- CreateIndex
CREATE INDEX "TranscriptComment_userId_idx" ON "TranscriptComment"("userId");

-- CreateIndex
CREATE INDEX "TranscriptComment_segmentId_idx" ON "TranscriptComment"("segmentId");

-- CreateIndex
CREATE INDEX "TranscriptComment_createdAt_idx" ON "TranscriptComment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptShare_shareToken_key" ON "TranscriptShare"("shareToken");

-- CreateIndex
CREATE INDEX "TranscriptShare_shareToken_idx" ON "TranscriptShare"("shareToken");

-- CreateIndex
CREATE INDEX "TranscriptShare_transcriptId_idx" ON "TranscriptShare"("transcriptId");

-- CreateIndex
CREATE INDEX "TranscriptShare_sharedById_idx" ON "TranscriptShare"("sharedById");

-- CreateIndex
CREATE INDEX "TranscriptShare_sharedWithId_idx" ON "TranscriptShare"("sharedWithId");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptShare_transcriptId_sharedWithId_key" ON "TranscriptShare"("transcriptId", "sharedWithId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE INDEX "UserPreferences_userId_idx" ON "UserPreferences"("userId");

-- CreateIndex
CREATE INDEX "BatchJob_userId_idx" ON "BatchJob"("userId");

-- CreateIndex
CREATE INDEX "BatchJob_status_idx" ON "BatchJob"("status");

-- CreateIndex
CREATE INDEX "BatchJob_createdAt_idx" ON "BatchJob"("createdAt");

-- CreateIndex
CREATE INDEX "BatchJob_userId_status_idx" ON "BatchJob"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BatchItem_transcriptId_key" ON "BatchItem"("transcriptId");

-- CreateIndex
CREATE INDEX "BatchItem_batchJobId_idx" ON "BatchItem"("batchJobId");

-- CreateIndex
CREATE INDEX "BatchItem_status_idx" ON "BatchItem"("status");

-- CreateIndex
CREATE INDEX "BatchItem_batchJobId_status_idx" ON "BatchItem"("batchJobId", "status");

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptComment" ADD CONSTRAINT "TranscriptComment_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptComment" ADD CONSTRAINT "TranscriptComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptComment" ADD CONSTRAINT "TranscriptComment_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "TranscriptSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptShare" ADD CONSTRAINT "TranscriptShare_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptShare" ADD CONSTRAINT "TranscriptShare_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptShare" ADD CONSTRAINT "TranscriptShare_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchJob" ADD CONSTRAINT "BatchJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchItem" ADD CONSTRAINT "BatchItem_batchJobId_fkey" FOREIGN KEY ("batchJobId") REFERENCES "BatchJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchItem" ADD CONSTRAINT "BatchItem_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE SET NULL ON UPDATE CASCADE;
