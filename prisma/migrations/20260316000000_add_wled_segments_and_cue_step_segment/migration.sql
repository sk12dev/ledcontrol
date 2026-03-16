-- CreateTable
CREATE TABLE "wled_segments" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "wled_segment_index" INTEGER NOT NULL,
    "start" INTEGER,
    "stop" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "wled_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wled_segments_device_id_wled_segment_index_key" ON "wled_segments"("device_id", "wled_segment_index");

-- CreateIndex
CREATE INDEX "wled_segments_device_id_idx" ON "wled_segments"("device_id");

-- AddForeignKey
ALTER TABLE "wled_segments" ADD CONSTRAINT "wled_segments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add wled_segment_id to cue_step_devices
ALTER TABLE "cue_step_devices" DROP CONSTRAINT "cue_step_devices_cue_step_id_device_id_key";

ALTER TABLE "cue_step_devices" ADD COLUMN "wled_segment_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "cue_step_devices_cue_step_id_device_id_wled_segment_id_key" ON "cue_step_devices"("cue_step_id", "device_id", "wled_segment_id");

-- CreateIndex
CREATE INDEX "cue_step_devices_wled_segment_id_idx" ON "cue_step_devices"("wled_segment_id");

-- AddForeignKey
ALTER TABLE "cue_step_devices" ADD CONSTRAINT "cue_step_devices_wled_segment_id_fkey" FOREIGN KEY ("wled_segment_id") REFERENCES "wled_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
