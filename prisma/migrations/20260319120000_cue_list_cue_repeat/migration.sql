-- AlterTable
ALTER TABLE "cue_list_cues" ADD COLUMN "repeat_interval_seconds" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "cue_list_cues" ADD COLUMN "repeat_total_plays" INTEGER;
