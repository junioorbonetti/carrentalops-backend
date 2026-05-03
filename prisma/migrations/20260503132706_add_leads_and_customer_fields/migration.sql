/*
  Warnings:

  - You are about to drop the column `simNumber` on the `Tracker` table. All the data in the column will be lost.
  - Made the column `vehicleId` on table `Tracker` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Tracker" DROP CONSTRAINT "Tracker_vehicleId_fkey";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "hasWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappNumber" TEXT;

-- AlterTable
ALTER TABLE "Tracker" DROP COLUMN "simNumber",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "simCard" TEXT,
ALTER COLUMN "vehicleId" SET NOT NULL,
ALTER COLUMN "active" SET DEFAULT true;

-- CreateTable
CREATE TABLE "LeadRequest" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "dlPhone" TEXT,
    "hasWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "whatsappNumber" TEXT,
    "vehicleId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "convertedToId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LeadRequest" ADD CONSTRAINT "LeadRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tracker" ADD CONSTRAINT "Tracker_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
