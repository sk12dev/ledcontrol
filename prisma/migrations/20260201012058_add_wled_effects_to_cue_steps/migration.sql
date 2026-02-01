-- AlterTable
ALTER TABLE "cue_steps" ADD COLUMN     "use_wled_effect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wled_effect_id" INTEGER,
ADD COLUMN     "wled_effect_intensity" INTEGER,
ADD COLUMN     "wled_effect_speed" INTEGER,
ADD COLUMN     "wled_palette_id" INTEGER;
