/*
  Warnings:

  - You are about to drop the column `etc_real` on the `evapotranspiration` table. All the data in the column will be lost.
  - Added the required column `water_before` to the `irrigation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."evapotranspiration" DROP COLUMN "etc_real",
ADD COLUMN     "real_etc" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."irrigation" ADD COLUMN     "water_after" DOUBLE PRECISION,
ADD COLUMN     "water_before" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "real_etc" DROP NOT NULL;
