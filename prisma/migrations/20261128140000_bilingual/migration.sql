-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "nameEn" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "City" ADD COLUMN     "nameEn" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'ar';

-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "instructionsEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "nameEn" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "descriptionEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "nameEn" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "nameEn" TEXT NOT NULL DEFAULT '';

