-- CreateTable
CREATE TABLE "art_net_nodes" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "subnet" INTEGER NOT NULL DEFAULT 0,
    "universe" INTEGER NOT NULL DEFAULT 0,
    "last_seen" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "art_net_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dmx_fixtures" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "art_net_node_id" INTEGER NOT NULL,
    "start_address" INTEGER NOT NULL,
    "channel_count" INTEGER NOT NULL,
    "channel_purposes" JSONB NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "dmx_fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cue_step_fixtures" (
    "id" SERIAL NOT NULL,
    "cue_step_id" INTEGER NOT NULL,
    "fixture_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cue_step_fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "art_net_nodes_ip_address_key" ON "art_net_nodes"("ip_address");

-- CreateIndex
CREATE INDEX "art_net_nodes_ip_address_idx" ON "art_net_nodes"("ip_address");

-- CreateIndex
CREATE INDEX "dmx_fixtures_art_net_node_id_idx" ON "dmx_fixtures"("art_net_node_id");

-- CreateIndex
CREATE INDEX "cue_step_fixtures_cue_step_id_idx" ON "cue_step_fixtures"("cue_step_id");

-- CreateIndex
CREATE INDEX "cue_step_fixtures_fixture_id_idx" ON "cue_step_fixtures"("fixture_id");

-- CreateIndex
CREATE UNIQUE INDEX "cue_step_fixtures_cue_step_id_fixture_id_key" ON "cue_step_fixtures"("cue_step_id", "fixture_id");

-- AddForeignKey
ALTER TABLE "dmx_fixtures" ADD CONSTRAINT "dmx_fixtures_art_net_node_id_fkey" FOREIGN KEY ("art_net_node_id") REFERENCES "art_net_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cue_step_fixtures" ADD CONSTRAINT "cue_step_fixtures_cue_step_id_fkey" FOREIGN KEY ("cue_step_id") REFERENCES "cue_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cue_step_fixtures" ADD CONSTRAINT "cue_step_fixtures_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "dmx_fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
