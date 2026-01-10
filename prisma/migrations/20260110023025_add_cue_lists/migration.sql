-- CreateTable
CREATE TABLE "cue_lists" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "user_id" INTEGER,
    "current_position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "cue_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cue_list_cues" (
    "id" SERIAL NOT NULL,
    "cue_list_id" INTEGER NOT NULL,
    "cue_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cue_list_cues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cue_lists_user_id_idx" ON "cue_lists"("user_id");

-- CreateIndex
CREATE INDEX "cue_list_cues_cue_list_id_idx" ON "cue_list_cues"("cue_list_id");

-- CreateIndex
CREATE INDEX "cue_list_cues_cue_id_idx" ON "cue_list_cues"("cue_id");

-- CreateIndex
CREATE UNIQUE INDEX "cue_list_cues_cue_list_id_cue_id_key" ON "cue_list_cues"("cue_list_id", "cue_id");

-- CreateIndex
CREATE UNIQUE INDEX "cue_list_cues_cue_list_id_order_key" ON "cue_list_cues"("cue_list_id", "order");

-- AddForeignKey
ALTER TABLE "cue_list_cues" ADD CONSTRAINT "cue_list_cues_cue_list_id_fkey" FOREIGN KEY ("cue_list_id") REFERENCES "cue_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cue_list_cues" ADD CONSTRAINT "cue_list_cues_cue_id_fkey" FOREIGN KEY ("cue_id") REFERENCES "cues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
