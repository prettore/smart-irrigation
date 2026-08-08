/*
  Warnings:

  - You are about to drop the column `irrigation_duration` on the `irrigation` table. All the data in the column will be lost.
  - Added the required column `duration` to the `irrigation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."crops" ADD COLUMN     "depletion_fraction" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."irrigation" DROP COLUMN "irrigation_duration",
ADD COLUMN     "duration" INTEGER NOT NULL,
ADD COLUMN     "expected_Etc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "flow_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "real_Etc" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."planting_bed" ADD COLUMN     "area" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "flow_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'preparation',
ADD COLUMN     "wilting_point" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."reads" ADD COLUMN     "is_valid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rainfall" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "value" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "public"."evapotranspiration" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "bed_id" TEXT NOT NULL,
    "etc_model" DOUBLE PRECISION NOT NULL,
    "etc_real" DOUBLE PRECISION,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "evapotranspiration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evapotranspiration_bed_id_date_idx" ON "public"."evapotranspiration"("bed_id", "date");

-- CreateIndex
CREATE INDEX "reads_bed_id_date_idx" ON "public"."reads"("bed_id", "date");

-- AddForeignKey
ALTER TABLE "public"."evapotranspiration" ADD CONSTRAINT "evapotranspiration_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "public"."planting_bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
