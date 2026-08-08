/*
  Warnings:

  - You are about to drop the column `size` on the `planting_bed` table. All the data in the column will be lost.
  - You are about to alter the column `raw_value` on the `reads` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to drop the column `bedId` on the `sensor` table. All the data in the column will be lost.
  - Added the required column `bed_id` to the `reads` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bed_id` to the `sensor` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."sensor" DROP CONSTRAINT "sensor_bedId_fkey";

-- AlterTable
ALTER TABLE "public"."planting_bed" DROP COLUMN "size",
ADD COLUMN     "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "field_capacity" SET DEFAULT 0,
ALTER COLUMN "field_capacity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."reads" ADD COLUMN     "bed_id" TEXT NOT NULL,
ALTER COLUMN "raw_value" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "public"."sensor" DROP COLUMN "bedId",
ADD COLUMN     "bed_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."irrigation" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bed_id" TEXT NOT NULL,
    "water_added" DOUBLE PRECISION NOT NULL,
    "irrigation_duration" INTEGER NOT NULL,

    CONSTRAINT "irrigation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."sensor" ADD CONSTRAINT "sensor_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "public"."planting_bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reads" ADD CONSTRAINT "reads_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "public"."planting_bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."irrigation" ADD CONSTRAINT "irrigation_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "public"."planting_bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
