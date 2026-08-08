/*
  Warnings:

  - You are about to drop the column `etc_model` on the `evapotranspiration` table. All the data in the column will be lost.
  - Added the required column `expected_etc` to the `evapotranspiration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."evapotranspiration" DROP COLUMN "etc_model",
ADD COLUMN     "expected_etc" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "public"."irrigation" ALTER COLUMN "real_etc" DROP DEFAULT;
