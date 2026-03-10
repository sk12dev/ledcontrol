-- CreateTable
CREATE TABLE "busking_patch_entries" (
    "id" SERIAL NOT NULL,
    "fixture_number" INTEGER NOT NULL,
    "device_id" INTEGER,
    "dmx_fixture_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "busking_patch_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "busking_patch_entries_fixture_number_key" ON "busking_patch_entries"("fixture_number");

-- CreateIndex
CREATE INDEX "busking_patch_entries_fixture_number_idx" ON "busking_patch_entries"("fixture_number");

-- AddForeignKey
ALTER TABLE "busking_patch_entries" ADD CONSTRAINT "busking_patch_entries_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "busking_patch_entries" ADD CONSTRAINT "busking_patch_entries_dmx_fixture_id_fkey" FOREIGN KEY ("dmx_fixture_id") REFERENCES "dmx_fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
