/*
  Warnings:

  - You are about to drop the column `expected_Etc` on the `irrigation` table. All the data in the column will be lost.
  - You are about to drop the column `real_Etc` on the `irrigation` table. All the data in the column will be lost.
  - You are about to drop the column `stage` on the `planting_bed` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."irrigation" DROP COLUMN "expected_Etc",
DROP COLUMN "real_Etc",
ADD COLUMN     "expected_etc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "real_etc" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."planting_bed" DROP COLUMN "stage",
ADD COLUMN     "stage_id" TEXT;

-- AddForeignKey
ALTER TABLE "public"."planting_bed" ADD CONSTRAINT "planting_bed_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."crop_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
