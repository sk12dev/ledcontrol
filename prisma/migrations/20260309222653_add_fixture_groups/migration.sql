-- CreateTable
CREATE TABLE "dmx_fixture_groups" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "dmx_fixture_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DmxFixtureToDmxFixtureGroup" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_DmxFixtureToDmxFixtureGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DmxFixtureToDmxFixtureGroup_B_index" ON "_DmxFixtureToDmxFixtureGroup"("B");

-- AddForeignKey
ALTER TABLE "_DmxFixtureToDmxFixtureGroup" ADD CONSTRAINT "_DmxFixtureToDmxFixtureGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "dmx_fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DmxFixtureToDmxFixtureGroup" ADD CONSTRAINT "_DmxFixtureToDmxFixtureGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "dmx_fixture_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
