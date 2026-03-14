-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('pending', 'rejected', 'ready', 'expired', 'burn_confirmed', 'attested', 'minting', 'completed', 'mint_failed', 'refunding', 'refunded', 'refund_failed');

-- CreateTable
CREATE TABLE "transfers" (
    "id" UUID NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'pending',
    "source_chain" VARCHAR(10) NOT NULL,
    "source_address" VARCHAR(100) NOT NULL,
    "burn_tx_hash" VARCHAR(100),
    "burn_confirmed_at" TIMESTAMPTZ,
    "dest_chain" VARCHAR(10) NOT NULL,
    "dest_address" VARCHAR(100) NOT NULL,
    "mint_tx_hash" VARCHAR(100),
    "mint_confirmed_at" TIMESTAMPTZ,
    "amount" DECIMAL(20,6) NOT NULL,
    "attestation" BYTEA,
    "message_hash" VARCHAR(66),
    "refund_tx_hash" VARCHAR(100),
    "refund_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_log" TEXT,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "used_nonces" (
    "transfer_id" UUID NOT NULL,
    "chain" VARCHAR(10) NOT NULL,
    "used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "used_nonces_pkey" PRIMARY KEY ("transfer_id")
);

-- CreateTable
CREATE TABLE "chain_status" (
    "chain" VARCHAR(10) NOT NULL,
    "is_healthy" BOOLEAN NOT NULL DEFAULT true,
    "last_block" BIGINT,
    "last_checked_at" TIMESTAMPTZ,
    "error_message" TEXT,

    CONSTRAINT "chain_status_pkey" PRIMARY KEY ("chain")
);

-- CreateIndex
CREATE INDEX "transfers_status_idx" ON "transfers"("status");

-- CreateIndex
CREATE INDEX "idx_transfers_source" ON "transfers"("source_address", "source_chain");

-- CreateIndex
CREATE INDEX "idx_transfers_dest" ON "transfers"("dest_address", "dest_chain");

-- AddForeignKey
ALTER TABLE "used_nonces" ADD CONSTRAINT "used_nonces_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
