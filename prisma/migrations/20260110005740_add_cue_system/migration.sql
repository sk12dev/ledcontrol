-- CreateTable
CREATE TABLE "cues" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "cues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cue_steps" (
    "id" SERIAL NOT NULL,
    "cue_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "time_offset" DECIMAL(10,2) NOT NULL,
    "transition_duration" DECIMAL(10,2) NOT NULL,
    "target_color" INTEGER[],
    "target_brightness" INTEGER,
    "start_color" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "start_brightness" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "cue_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cue_step_devices" (
    "id" SERIAL NOT NULL,
    "cue_step_id" INTEGER NOT NULL,
    "device_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cue_step_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cues_user_id_idx" ON "cues"("user_id");

-- CreateIndex
CREATE INDEX "cue_steps_cue_id_idx" ON "cue_steps"("cue_id");

-- CreateIndex
CREATE INDEX "cue_steps_cue_id_order_idx" ON "cue_steps"("cue_id", "order");

-- CreateIndex
CREATE INDEX "cue_step_devices_cue_step_id_idx" ON "cue_step_devices"("cue_step_id");

-- CreateIndex
CREATE INDEX "cue_step_devices_device_id_idx" ON "cue_step_devices"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "cue_step_devices_cue_step_id_device_id_key" ON "cue_step_devices"("cue_step_id", "device_id");

-- AddForeignKey
ALTER TABLE "cue_steps" ADD CONSTRAINT "cue_steps_cue_id_fkey" FOREIGN KEY ("cue_id") REFERENCES "cues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cue_step_devices" ADD CONSTRAINT "cue_step_devices_cue_step_id_fkey" FOREIGN KEY ("cue_step_id") REFERENCES "cue_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cue_step_devices" ADD CONSTRAINT "cue_step_devices_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
