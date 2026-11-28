-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointId" TEXT;

-- AlterTable
ALTER TABLE "DeliveryPartner" ADD COLUMN     "defaultFee" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DeliveryPoint" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Handover" ADD COLUMN     "number" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "number" TEXT NOT NULL,
ADD COLUMN     "reference" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'admin',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryEvent_deliveryId_idx" ON "DeliveryEvent"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "Handover_number_key" ON "Handover"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_number_key" ON "Settlement"("number");

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "DeliveryPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

