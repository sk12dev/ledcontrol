-- AlterTable
ALTER TABLE "cue_steps" ADD COLUMN     "turn_off" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "shows" ALTER COLUMN "updated_at" DROP DEFAULT;
