-- AlterTable
ALTER TABLE "public"."irrigation" ADD COLUMN     "stage_id" TEXT;

-- AddForeignKey
ALTER TABLE "public"."irrigation" ADD CONSTRAINT "irrigation_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."crop_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
