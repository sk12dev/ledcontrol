-- CreateTable
CREATE TABLE "shows" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shows_user_id_idx" ON "shows"("user_id");

-- Create a default show for existing data
INSERT INTO "shows" ("name", "description", "user_id", "created_at", "updated_at")
VALUES ('Default Show', 'Default show for existing cues and cue lists', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add show_id column to cues table (nullable first)
ALTER TABLE "cues" ADD COLUMN "show_id" INTEGER;

-- Backfill show_id for existing cues with the default show
UPDATE "cues" SET "show_id" = (SELECT "id" FROM "shows" WHERE "name" = 'Default Show' LIMIT 1) WHERE "show_id" IS NULL;

-- Make show_id NOT NULL after backfill
ALTER TABLE "cues" ALTER COLUMN "show_id" SET NOT NULL;

-- Add show_id column to cue_lists table (nullable first)
ALTER TABLE "cue_lists" ADD COLUMN "show_id" INTEGER;

-- Backfill show_id for existing cue_lists with the default show
UPDATE "cue_lists" SET "show_id" = (SELECT "id" FROM "shows" WHERE "name" = 'Default Show' LIMIT 1) WHERE "show_id" IS NULL;

-- Make show_id NOT NULL after backfill
ALTER TABLE "cue_lists" ALTER COLUMN "show_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "cues_show_id_idx" ON "cues"("show_id");

-- CreateIndex
CREATE INDEX "cue_lists_show_id_idx" ON "cue_lists"("show_id");

-- AddForeignKey
ALTER TABLE "cues" ADD CONSTRAINT "cues_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cue_lists" ADD CONSTRAINT "cue_lists_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
