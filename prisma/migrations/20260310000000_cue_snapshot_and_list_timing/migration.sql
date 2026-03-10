-- AlterTable: Remove timing from cue_steps (cue = snapshot only)
ALTER TABLE "cue_steps" DROP COLUMN IF EXISTS "time_offset";
ALTER TABLE "cue_steps" DROP COLUMN IF EXISTS "transition_duration";

-- AlterTable: Add per-cue timing to cue_list_cues
ALTER TABLE "cue_list_cues" ADD COLUMN "fade_in_seconds" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "cue_list_cues" ADD COLUMN "fade_out_seconds" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "cue_list_cues" ADD COLUMN "duration_seconds" DECIMAL(10,2);
