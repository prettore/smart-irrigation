import pkg from "@prisma/client";
import moment from "moment-timezone";
import evapotranspirationServices from "./evapotranspirationServices.js";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const storeSensorInfos = async (postBody) => {
  try {
    const {
      plantingBedId,
      sensor1,
      sensor2,
      sensor3,
      sensor4,
      air_temperature,
      air_humidity,
    } = postBody;

    console.log(new Date());
    console.log("Recebendo: ", postBody);

    if (air_temperature != null && air_humidity != null) {
      await prisma.air_data.create({
        data: {
          air_temperature: air_temperature,
          air_humidity: air_humidity,
        },
      });
    }

    if ([sensor1, sensor2, sensor3, sensor4].every((v) => v == null)) {
      throw new Error("Nenhum dado de sensor de umidade fornecido.");
    }

    const sensors = await prisma.sensor.findMany({
      where: { bed_id: plantingBedId, type: "soil_moisture" },
      orderBy: { order: "asc" },
    });

    const values = [sensor1, sensor2, sensor3, sensor4];
    const avg =
      values.reduce((sum, val) => sum + (val || 0), 0) /
      values.filter(Boolean).length;

    const readsToCreate = sensors
      .map((sensor, i) => {
        const raw = values[i];
        if (raw == null) return null;

        const dry = sensor.dry_reference_adc;
        const wet = sensor.wet_reference_adc;

        let percent = ((dry - raw) / (dry - wet)) * 100;
        percent = Math.max(0, Math.min(100, percent));

        return {
          sensor_id: sensor.id,
          bed_id: plantingBedId,
          raw_value: raw,
          value: Math.round(percent * 100) / 100,
          date: moment().tz("America/Sao_Paulo").format(),
        };
      })
      .filter(Boolean);
    const noAnchorReads = readsToCreate.toSpliced(2, 1);//tira o sensor ancora pra achar o valor de desvio
    const sortedReads = [...noAnchorReads].sort(
      (a, b) => a.raw_value - b.raw_value, // Ordena pelo RAW
    );
    const anchorAvg = sortedReads[1].raw_value;
    const avgMargin = anchorAvg * 0.2;

    const filteredReads = readsToCreate.map((read, i) => {
      const deviation = Math.abs(read.raw_value - anchorAvg);
      const isValid = deviation <= avgMargin ||  i == 2;

      if (!isValid) {
        console.log(`⚠️ Sensor ${sensors[i].order} Inválido (Outlier)`, {
          percent: read.value,
          raw: read.raw_value,
          anchorRaw: anchorAvg.toFixed(2),
          margin: avgMargin.toFixed(2),
        });
      }

      return {
        ...read,
        is_valid: isValid,
      };
    });
    await prisma.reads.createMany({
      data: filteredReads,
    });
    const irrigation_miliseconds =
      await evapotranspirationServices.verifyEvapotranspiration(
        plantingBedId,
        filteredReads,
      );

    return irrigation_miliseconds;
  } catch (e) {
    console.error("Erro ao salvar os dados:", e);
    return false;
  }
};

const validateAllowedHour = async (plantingBedId) => {
  console.log("Validando horario permitido para irrigação");
  console.log(moment().tz("America/Sao_Paulo").hour());
  const currentHour = moment().tz("America/Sao_Paulo").hour();
  const schedules = await prisma.schedule.findMany({
    where: { bed_id: plantingBedId },
  });
  const isAllowed = schedules.some(
    (s) => currentHour >= s.startHour && currentHour <= s.endHour,
  );
  if (isAllowed) {
    console.log("Horario permitido para irrigação");
    return true;
  }
  return false;
};
const validateUmidity = async (
  plantingBedId,
  sumSensores,
  numSensoresValidos,
) => {
  try {
    console.log(
      "Validando umidade com a media dos sensores:",
      sumSensores / numSensoresValidos,
    );
    const plantingBed = await prisma.plantingBed.findUnique({
      where: { id: plantingBedId },
    });
    if (
      sumSensores / numSensoresValidos > plantingBed.wateringLevel &&
      (await validateAllowedHour(plantingBedId))
    ) {
      console.log("irrigação permitida");
      return true;
    }
    return false;
  } catch (e) {
    console.error("Erro ao validar umidade:", e);
    return false;
  }
};
async function getReadInfos(bedId) {
  const sensors = await prisma.sensor.findMany({
    where: {
      bed_id: bedId,
    },
    select: {
      order: true,
      type: true,
      reads: {
        select: {
          value: true,
          date: true,
        },
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });
  return sensors;
}

async function teachIrrigationToIA(plantingBedId) {
  try {
    const irrigations = await prisma.irrigation.findMany({
      where: {
        bed_id: plantingBedId,
        learn: true,
        real_etc: { not: null },
      },
    });

    if (irrigations.length === 0) {
      console.log("Nenhuma irrigação para ensinar à IA.");
      return false;
    }
    await Promise.all(
      irrigations.map(async (irrigation) => {
        let hour_before = moment(irrigation.date)
          .tz("America/Sao_Paulo")
          .hour();

        if (hour_before === 8 || hour_before === 17) {
          hour_before += 1;
        }
        const irrigationDate = new Date(irrigation.date);

        const startOfHour = new Date(irrigationDate);
        startOfHour.setMinutes(0, 0, 0);

        const endOfHour = new Date(irrigationDate);
        endOfHour.setMinutes(59, 59, 999);

        const irrigationAirData = await prisma.air_data.findFirst({
          where: {
            date: {
              gte: startOfHour,
              lte: endOfHour,
            },
          },
          orderBy: {
            date: "desc",
          },
          take: 1,
        });
        const body = {
          moisture_before: irrigation.water_before,
          hour_before: hour_before,
          temp: irrigationAirData.air_temperature,
          air_humidity: irrigationAirData.air_humidity,
          action_idx: irrigation.action_idx,
          volume_applied: irrigation.water_added,
          moisture_after: irrigation.water_after,
          hour_after: hour_before === 9 ? 18 : 9,
          target_raw: irrigation.target_water_level,
        };

        const url = process.env.IA_URL + "/learn";
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      }),
    ).then(async () => {
      await prisma.irrigation.updateMany({
        where: {
          bed_id: plantingBedId,
          learn: true,
          real_etc: { not: null },
        },
        data: {
          learn: false,
        },
      });
    });
    return {
      status: true,
      message: irrigations.length + " registros ensinados.",
    };
  } catch (error) {
    console.error("Erro ao ensinar irrigação à IA:", error);
    return { status: false, message: "Erro ao ensinar irrigação à IA." };
  }
}
export default {
  storeSensorInfos,
  getReadInfos,
  teachIrrigationToIA,
};
