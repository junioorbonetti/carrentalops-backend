/*
  Warnings:

  - You are about to drop the column `dlPhone` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `hasWhatsapp` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `whatsappNumber` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Tracker` table. All the data in the column will be lost.
  - You are about to drop the column `simCard` on the `Tracker` table. All the data in the column will be lost.
  - You are about to drop the `LeadRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LeadRequest" DROP CONSTRAINT "LeadRequest_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "Tracker" DROP CONSTRAINT "Tracker_vehicleId_fkey";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "dlPhone",
DROP COLUMN "hasWhatsapp",
DROP COLUMN "whatsappNumber";

-- AlterTable
ALTER TABLE "Tracker" DROP COLUMN "notes",
DROP COLUMN "simCard",
ADD COLUMN     "simNumber" TEXT,
ALTER COLUMN "vehicleId" DROP NOT NULL,
ALTER COLUMN "active" SET DEFAULT false;

-- DropTable
DROP TABLE "LeadRequest";

-- AddForeignKey
ALTER TABLE "Tracker" ADD CONSTRAINT "Tracker_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
