-- AlterTable
ALTER TABLE "transfers" ADD COLUMN     "token" VARCHAR(10) NOT NULL DEFAULT 'tEURCV';

-- CreateIndex
CREATE INDEX "transfers_token_idx" ON "transfers"("token");
