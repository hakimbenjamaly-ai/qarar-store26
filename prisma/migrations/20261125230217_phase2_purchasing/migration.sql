-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "actualUnitCostLyd" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ADD COLUMN     "landedUnitCostLyd" DECIMAL(12,2),
ADD COLUMN     "receivedQty" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_entity_entityId_idx" ON "Attachment"("entity", "entityId");
