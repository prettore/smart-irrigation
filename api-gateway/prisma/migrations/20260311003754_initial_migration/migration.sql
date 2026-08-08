-- CreateTable
CREATE TABLE "public"."planting_bed" (
    "id" TEXT NOT NULL,
    "field_capacity" INTEGER NOT NULL DEFAULT 0,
    "size" INTEGER NOT NULL DEFAULT 0,
    "plant_id" TEXT,

    CONSTRAINT "planting_bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sensor" (
    "id" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'soil_moisture',
    "dry_reference_adc" INTEGER NOT NULL DEFAULT 4095,
    "wet_reference_adc" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reads" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sensor_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "raw_value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crop_stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "kc" DOUBLE PRECISION NOT NULL,
    "crop_id" TEXT NOT NULL,

    CONSTRAINT "crop_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crops" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "crops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."air_data" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "air_temperature" DOUBLE PRECISION NOT NULL,
    "air_humidity" INTEGER NOT NULL,

    CONSTRAINT "air_data_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."planting_bed" ADD CONSTRAINT "planting_bed_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "public"."crops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sensor" ADD CONSTRAINT "sensor_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "public"."planting_bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reads" ADD CONSTRAINT "reads_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."crop_stages" ADD CONSTRAINT "crop_stages_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
