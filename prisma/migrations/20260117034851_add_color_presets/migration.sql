-- CreateTable
CREATE TABLE "color_presets" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "color" INTEGER[],
    "user_id" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "color_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "color_presets_user_id_idx" ON "color_presets"("user_id");
