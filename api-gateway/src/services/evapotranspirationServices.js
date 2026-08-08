import { v4 as uuidv4 } from "uuid";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

let lastActionIndex = 2;
let last_water_before = -999;
let last_volume_applied = -999;

class PlantingBedStore {
  constructor() {
    this.plantingBeds = new Map();
  }

  set(plantingBed) {
    if (plantingBed?.id) {
      this.plantingBeds.set(plantingBed.id, plantingBed);
    }
  }

  get(plantingBedId) {
    return this.plantingBeds.get(plantingBedId);
  }

  has(plantingBedId) {
    return this.plantingBeds.has(plantingBedId);
  }

  delete(plantingBedId) {
    return this.plantingBeds.delete(plantingBedId);
  }

  clear() {
    this.plantingBeds.clear();
  }
}

const plantingBedStore = new PlantingBedStore();

const verifyEvapotranspiration = async (plantingBedId, reads) => {
  try {
    const now = new Date();
    let hour = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    }).format(now);

    let minute = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      minute: "numeric",
      hour12: false,
    }).format(now);

    await Promise.all(
      reads.map(async (read) => {
        const sensor = await prisma.sensor.findUnique({
          where: { id: read.sensor_id },
        });
        read.is_valid = sensor ? sensor.enabled : false;
        read.sensor = sensor;
      }),
    );
    //filtro dos registros validos atuais
    const validReads = reads.filter(
      (read) => read.is_valid === true && read.sensor?.order !== 3,
    );
    const underGRead = reads.find(
      (read) => read.sensor?.order === 3 && read.is_valid === true,
    );
    console.log(
      "Sensor de umidade subterrâneo:",
      underGRead ? underGRead.value : "N/A",
    );

    let avgSensor;
    const surfaceAvg =
      validReads.reduce((sum, read) => sum + read.value, 0) / validReads.length; // media da superficie
    if (underGRead) {
      avgSensor = surfaceAvg * 0.4 + underGRead.value * 0.6; //usa a média ponderada entre o sensor de superfície e o sensor subterrâneo, dando mais peso para o subterrâneo, por ser mais representativo da umidade real disponível para as raízes
    } else {
      avgSensor = surfaceAvg; //se o sensor subterrâneo não for válido, usa a média dos sensores de superfície
    }

    const plantingBed = await prisma.planting_bed.findUnique({
      where: { id: plantingBedId },
      include: { stage: true, plant: true },
    });
    plantingBedStore.set(plantingBed);
    const fc = plantingBed.field_capacity;
    const wp = plantingBed.wilting_point;
    const V = plantingBed.volume;
    const p = plantingBed.plant.depletion_fraction;

    const water_percent = avgSensor * 0.01;

    const water_level = parseFloat((water_percent * fc).toFixed(2)); //agua mm no solo

    const OWPayload = await openWeatherData();

    //corrige a antiga
    const lastEtcPrediction = await prisma.evapotranspiration.findFirst({
      where: { bed_id: plantingBedId },
      orderBy: { date: "desc" },
    });
    if (lastEtcPrediction != null) {
      let lastSensorReads;
      lastSensorReads = await prisma.reads.findMany({
        //não filtra por is_valid, por causa do 'take' e 'skip', poderia pegar registro de outro periodo
        where: {
          bed_id: plantingBedId,
        },
        orderBy: { date: "desc" },
        skip: 4, //decartas as 4 primeiras, porque chegaram agora
        take: 4,
      });
      if (lastSensorReads.length == 0) {
        lastSensorReads = await prisma.reads.findMany({
          where: {
            bed_id: plantingBedId,
          },
          orderBy: { date: "desc" },
          take: 4, //não descarta, porque tem somente 4 registros
        });
      }
      //filtra os registros antigos válidos
      const filteredLastSensorReads = lastSensorReads.filter(
        (read) => read.is_valid === true,
      );

      const avgLastSensorValue =
        filteredLastSensorReads.length > 0
          ? filteredLastSensorReads.reduce((sum, read) => sum + read.value, 0) /
            filteredLastSensorReads.length
          : 0;

      const lastWaterLevel = parseFloat(
        ((avgLastSensorValue / 100) * fc).toFixed(2),
      );
      let realEtc = 0;

      if (IrrigatedSoil(hour, minute)) {
        //compensar nivel se houve irrigação na ultima verificação, ou seja 12:00 ou 21:00
        const lastIrrigation = await prisma.irrigation.findFirst({
          where: { bed_id: plantingBedId },
          orderBy: { date: "desc" },
        });
        const initialVolume =
          lastIrrigation.water_before + lastIrrigation.water_added;

        const lostVolume = initialVolume - water_level;
        realEtc = parseFloat((lostVolume / plantingBed.area).toFixed(3));
      } else {
        //se não, calcular normalmente

        realEtc = parseFloat(
          ((lastWaterLevel - water_level) / plantingBed.area).toFixed(3),
        );

        console.log(realEtc);
      }

      await prisma.evapotranspiration.update({
        where: { id: lastEtcPrediction.id },
        data: {
          real_etc: realEtc,
        },
      });
    }

    //faz outra previsão
    const predictedEtc = await predictEvapotranspiration(
      plantingBed,
      OWPayload.hourly.slice(0, 3), // predição de 3 horas
    ); // mm

    const newEtcRecord = await prisma.evapotranspiration.create({
      data: {
        id: uuidv4(),
        date: new Date(),
        bed: {
          connect: { id: plantingBedId },
        },
        expected_etc: predictedEtc,
        real_etc: null,
      },
    });

    //ajuste pra considerar os tempo de dessincronização do esp32
    if (allowedHours(Number(hour), Number(minute))) {
      return await verifyIrrigation(
        OWPayload,
        plantingBed,
        water_percent,
        Number(hour),
      );
    }
    return 0;
  } catch (err) {
    console.log("Erro ao calcular ETc: ", err);
    throw err;
  }
};

const predictEvapotranspiration = async (plantingBed, OWPayload) => {
  try {
    const rsArray = await getNasaPowerData(); //0 - 23
    let penmannEtoSum = 0;

    for (const hour of OWPayload) {
      const hourDate = new Date(hour.dt * 1000);
      const hourOfDay = hourDate.getHours();

      const clearSkyRs = rsArray[hourOfDay] || 0;

      const cloud_factor = Math.max(0.25, 1 - hour.clouds / 100);

      const Rs = clearSkyRs * cloud_factor;

      penmannEtoSum += penmanMonteithHour({
        temp: hour.temp,
        humidity: hour.humidity,
        wind: hour.wind_speed,
        rs: Rs,
      });
    }

    const Kc = plantingBed.stage.kc;
    const ETc = penmannEtoSum * Kc;

    return parseFloat(ETc.toFixed(3));
  } catch (err) {
    console.error("Error calculating evapotranspiration:", err);
    throw err;
  }
};
const verifyIrrigationTraining = async (
  WC,
  plantingBedId,
  ETc,
  air_temperature,
  air_humidity,
  isFirst,
  isLast,
  stage,
) => {
  try {
    let plantingBed = plantingBedStore.get(plantingBedId);
    if (!plantingBed) {
      plantingBed = await prisma.planting_bed.findUnique({
        where: { id: plantingBedId },
        select: {
          field_capacity: true,
          wilting_point: true,
          area: true,
          volume: true,
          plant: { select: { depletion_fraction: true } },
        },
      });
      plantingBedStore.set(plantingBed);
    }
    console.log(WC + " " + stage);

    const fc = plantingBed.field_capacity;
    const wp = plantingBed.wilting_point;
    const p = plantingBed.plant.depletion_fraction;
    const water_percent = WC * 0.01;

    const TAW = fc - wp;
    const RAW = TAW * p;

    const water_level = parseFloat(
      (water_percent * plantingBed.volume).toFixed(3),
    ); //agua ml no solo

    const raw_inferior_level = fc - RAW;
    const margin = 0.1 * RAW; //margem de segurança de 10% da água facilmente disponível
    let target_water_level = raw_inferior_level + margin; //nivel agua ideal (RAW + margem)
    let necessary_water = target_water_level - water_level; //quantia necessária pra irrigar até o ideal

    const predictedEtcLiters = ETc * plantingBed.area;

    //não aprende se for o primeiro registro, não tem referencia
    if (!isFirst) {
      const body = {
        moisture_before: last_water_before, //
        hour_before: 9,
        temp: air_temperature,
        air_humidity: air_humidity,
        action_idx: lastActionIndex,
        volume_applied: last_volume_applied, //
        moisture_after: water_level,
        hour_after: 9,
        target_raw: target_water_level,
        stage: stage,
      };

      const url = process.env.IA_URL + "/learn";
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.error("Erro ao ensinar IA: ", err);
      }
    }
    if (isLast) {
      //se for o último encerra por aqui
      return 0;
    }

    let action = 2; // 2 = sem interferencia da IA
    let finalVolume = necessary_water;

    if (water_level < plantingBed.field_capacity) {
      necessary_water = necessary_water + predictedEtcLiters; // agua pra irrigar até o ideal + previsão de ETc

      if (necessary_water <= 0) {
        //solo com agua acima do necessário
        necessary_water = 0;
        finalVolume = 0;
        last_water_before = water_level;
        last_volume_applied = 0;
        lastActionIndex = 2;
      } else {
        //solo com agua abaixo do necessário, acionar a IA
        try {
          //post pra /decide
          const body = {
            moisture: water_level,
            hour: 9,
            temp: air_temperature,
            air_humidity: air_humidity,
            volume_ab: necessary_water,
            stage: stage,
          };
          const url = process.env.IA_URL + "/decide";
          const IAresponse = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          const IaData = await IAresponse.json();
          action = IaData.action_idx;
          finalVolume = parseFloat(
            (IaData.volume_final / plantingBed.area).toFixed(3),
          ); // converter de L para mm
          lastActionIndex = action;
          last_water_before = water_level;
          last_volume_applied = finalVolume;
        } catch (err) {
          finalVolume = parseFloat(
            (necessary_water / plantingBed.area).toFixed(3),
          ); // converter de L para mm
          last_water_before = water_level;
          last_volume_applied = finalVolume;
          lastActionIndex = 2;
        }
      }
      return finalVolume;
    }
    return 0;
  } catch (err) {
    console.error("Erro ao calcular irrigação:", err);
    throw err;
  }
};

const verifyIrrigationPenmann = async (
  WC, // %
  plantingBedId,
  ETc, // mm
) => {
  try {
    let plantingBed = plantingBedStore.get(plantingBedId);
    if (!plantingBed) {
      plantingBed = await prisma.planting_bed.findUnique({
        where: { id: plantingBedId },
        select: {
          field_capacity: true,
          wilting_point: true,
          area: true,
          volume: true,
          plant: { select: { depletion_fraction: true } },
        },
      });
      plantingBedStore.set(plantingBed);
    }

    const fc = plantingBed.field_capacity; // Litros
    const wp = plantingBed.wilting_point; // Litros
    const p = plantingBed.plant.depletion_fraction;
    const water_percent = WC * 0.01; // decimal 0.xx

    const TAW = fc - wp; // Litros
    const RAW = TAW * p; // Litros

    const water_level = parseFloat(
      (water_percent * plantingBed.volume).toFixed(3),
    ); // Litros
    console.log("Nível de água no solo (L):", water_level);

    const raw_inferior_level = fc - RAW; // Litros
    const margin = 0.1 * RAW;
    let target_water_level = raw_inferior_level + margin; // Litros
    let necessary_water = target_water_level - water_level; // Litros

    const predictedEtc = ETc; // mm

    if (water_level < plantingBed.field_capacity) {
      necessary_water = necessary_water + predictedEtc * plantingBed.area; // L
      if (necessary_water < 0) {
        return 0;
      }
      return necessary_water / plantingBed.area; // Retorna perfeitamente em mm
    }
    return 0;
  } catch (err) {
    console.error("Erro ao calcular irrigação:", err);
    throw err;
  }
};

const calculateReward = async (
  WC, // %
  index,
  plantingBedId,
  air_temperature,
  air_humidity,
  stage,
  volume_applied, // mm (Recebido perfeitamente em mm do Python agora!)
  moisture_before, // %
) => {
  console.log(`Calculando reward para WC pós-rega: ${WC}%`);

  let plantingBed = plantingBedStore.get(plantingBedId);
  if (!plantingBed) {
    plantingBed = await prisma.planting_bed.findUnique({
      where: { id: plantingBedId },
      select: {
        field_capacity: true,
        wilting_point: true,
        area: true,
        volume: true,
        plant: { select: { depletion_fraction: true } },
      },
    });
    plantingBedStore.set(plantingBed);
  }

  const fc = plantingBed.field_capacity; // litros
  const wp = plantingBed.wilting_point; // litros
  const p = plantingBed.plant.depletion_fraction;
  const volume = plantingBed.volume; // litros

  const TAW = fc - wp; // litros
  const RAW = TAW * p; // litros
  const water_percent = WC * 0.01; // decimal 0.xx

  const water_level = parseFloat(
    (water_percent * plantingBed.volume).toFixed(3),
  );  // litros

  const raw_inferior_level = fc - RAW; // litros
  const margin = 0.1 * RAW; // litros
  let target_water_level = raw_inferior_level + margin; // litros
  
  // Sincronizado: mm * área_m² = Litros exatos aplicados
  const volume_appliedLiters = volume_applied * plantingBed.area;
  const moisture_before_perc = (moisture_before * 0.01) * volume; 

  const body = {
    moisture_before: moisture_before_perc, // Litros
    temp: air_temperature,
    air_humidity: air_humidity,
    action_idx: index, 
    volume_applied: volume_appliedLiters, // Litros
    moisture_after: water_level, // Litros
    target_raw: target_water_level, // litros
    stage: stage,
  };

  const url = process.env.IA_URL + "/learn";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.reward;
  } catch (err) {
    console.error("Erro ao ensinar IA na rota /reward: ", err);
    return 0.0;
  }
};

const changeHistoryValues = async (
  WC,
  index,
  plantingBedId,
  air_temperature,
  air_humidity,
  stage,
  volume_applied,
) => {
  let lastActionIndex = 2;
  let last_water_before = -999;
  let last_volume_applied = -999;
  console.log(WC);
  let plantingBed = plantingBedStore.get(plantingBedId);
  if (!plantingBed) {
    plantingBed = await prisma.planting_bed.findUnique({
      where: { id: plantingBedId },
      select: {
        field_capacity: true,
        wilting_point: true,
        area: true,
        volume: true,
        plant: { select: { depletion_fraction: true } },
      },
    });
    plantingBedStore.set(plantingBed);
  }

  const fc = plantingBed.field_capacity;
  const wp = plantingBed.wilting_point;
  const p = plantingBed.plant.depletion_fraction;
  const volumeApplied = volume_applied;

  const TAW = fc - wp;
  const RAW = TAW * p;
  const water_percent = WC * 0.01;

  const water_level = parseFloat(
    (water_percent * plantingBed.volume).toFixed(3),
  ); //agua ml no solo

  const raw_inferior_level = fc - RAW;
  const margin = 0.1 * RAW;
  let target_water_level = raw_inferior_level + margin;

  const body = {
    moisture_before: last_water_before,
    hour_before: 9,
    temp: air_temperature,
    air_humidity: air_humidity,
    action_idx: index,
    volume_applied: volume_applied,
    moisture_after: water_level,
    hour_after: 9,
    target_raw: target_water_level,
    stage: stage,
  };

  const url = process.env.IA_URL + "/learn";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.reward;
  } catch (err) {
    console.error("Erro ao ensinar IA: ", err);
  }
};

const verifyIrrigation = async (
  OWPayload,
  plantingBed,
  water_percent,
  hours,
) => {
  try {
    let plantingBed = plantingBedStore.get(plantingBedId);
    if (!plantingBed) {
      plantingBed = await prisma.planting_bed.findUnique({
        where: { id: plantingBedId },
        select: {
          field_capacity: true,
          wilting_point: true,
          area: true,
          volume: true,
          plant: { select: { depletion_fraction: true } },
        },
      });
      plantingBedStore.set(plantingBed);
    }

    const fc = plantingBed.field_capacity;
    const wp = plantingBed.wilting_point;
    const p = plantingBed.plant.depletion_fraction;

    const TAW = fc - wp;
    const RAW = TAW * p;

    const water_level = parseFloat((water_percent * fc).toFixed(3)); //agua ml no solo

    const raw_inferior_level = fc - RAW;
    const margin = 0.1 * RAW; //margem de segurança de 10% da água facilmente disponível
    let target_water_level = raw_inferior_level + margin; //agua necessária pra chegar no limite inferior da zona de água disponível pra planta em questão + margem de segurança
    let necessary_water = target_water_level - water_level;
    const nextPeriodHours = hours === 9 ? 9 : 15;
    const lastPeriodHours = hours === 9 ? 15 : 9;

    const lastIrrigation = await prisma.irrigation.findFirst({
      where: { bed_id: plantingBed.id },
      orderBy: { date: "desc" },
    });
    const predictedEtc = await predictEvapotranspiration(
      plantingBed,
      OWPayload.hourly.slice(0, nextPeriodHours), // predição de x horas
    ); // mm
    if (lastIrrigation != null) {
      //--> envia /learn pra IA

      const irrigationDate = new Date(lastIrrigation.date);

      const startOfHour = new Date(irrigationDate);
      startOfHour.setMinutes(0, 0, 0);

      const endOfHour = new Date(irrigationDate);
      endOfHour.setMinutes(59, 59, 999);

      const lastIrrigationAirData = await prisma.air_data.findFirst({
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
        moisture_before: lastIrrigation.water_before,
        hour_before: lastPeriodHours === 9 ? 9 : 18,
        temp: lastIrrigationAirData.air_temperature,
        air_humidity: lastIrrigationAirData.air_humidity,
        action_idx: lastIrrigation.action_idx,
        volume_applied: lastIrrigation.water_added,
        moisture_after: water_level,
        hour_after: nextPeriodHours === 9 ? 9 : 18,
        target_raw: lastIrrigation.target_water_level,
      };

      const url = process.env.IA_URL + "/learn";
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.error("Erro ao enviar dados para IA: ", err);
      }

      const initialVolume =
        lastIrrigation.water_before + lastIrrigation.water_added; //lt
      const lostVolume = initialVolume - water_level;
      const realEtc = parseFloat((lostVolume / plantingBed.area).toFixed(3));

      //atualiza o real gasto de etc

      await prisma.irrigation.update({
        where: { id: lastIrrigation.id },
        data: {
          real_etc: realEtc,
          water_after: water_level,
        },
      });
    }
    //logica de pausa de acordo com a cultura
    if (plantingBed.stage.pause_periods > 0) {
      const last_irrigations = await prisma.irrigation.aggregate({
        where: { bed_id: plantingBed.id },
        orderBy: { date: "desc" },
        take: plantingBed.stage.pause_periods,
        _sum: {
          water_added: true,
        },
      });
      if (last_irrigations._sum.water_added > 0) {
        console.log("Cultura em período de pausa, irrigação não necessária.");
        await prisma.irrigation.create({
          data: {
            id: uuidv4(),
            date: new Date(),
            bed: {
              connect: { id: plantingBed.id },
            },
            duration: 0,
            water_added: 0,
            expected_etc: predictedEtc,
            target_water_level: parseFloat(target_water_level.toFixed(3)),
            flow_rate: plantingBed.flow_rate,
            real_etc: null,
            water_before: water_level,
            water_after: null,
            stage: {
              connect: { id: plantingBed.stage.id },
            },
            pause: true,
            action_idx: 2,
          },
        });
        return 0;
      }
      console.log(
        "Cultura voltando de período de pausa, irrigação será calculada normalmente.",
      );
    }
    let necessary_seconds = 0;
    let action = 2; // 2 = sem interferencia da IA
    let finalVolume = necessary_water;
    const pump_offset = 2; //segundos de offset para compensar o tempo de resposta da bomba

    if (water_level < plantingBed.field_capacity) {
      necessary_water = necessary_water + predictedEtc * plantingBed.area; // agua necessária pra irrigar + previsão de evapotranspiração  //em Litros
      console.log(
        "Evapotranspiração prevista (L): ",
        predictedEtc * plantingBed.area,
      );
      //solo com agua acima do necessário
      if (necessary_water <= 0) {
        console.log("Solo saturado, ou com umidade adequada");
        console.log("Litros acima do necessário: ", necessary_water * -1);
        necessary_seconds = 0;
        necessary_water = 0;
        finalVolume = 0;
      } else {
        //solo com agua abaixo do necessário, acionar a IA
        try {
          //post pra /decide
          const airData = await prisma.air_data.findFirst({
            orderBy: { date: "desc" },
          });
          const body = {
            moisture: water_level,
            hour: nextPeriodHours === 9 ? 9 : 18,
            temp: airData.air_temperature,
            air_humidity: airData.air_humidity,
            volume_ab: necessary_water,
          };
          const url = process.env.IA_URL + "/decide";
          const IAresponse = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          const IaData = await IAresponse.json();
          action = IaData.action_idx;
          finalVolume = IaData.volume_final;

          console.log(
            "Decisão da IA:",
            IaData.action_idx,
            "Volume final recomendado pela IA (L): ",
            finalVolume,
          );
        } catch (err) {
          console.error(
            "Erro ao comunicar com a IA, usando decisão padrão. ",
            err,
          );
          action = 2;
          finalVolume = necessary_water;
        }
        necessary_seconds =
          parseFloat((finalVolume / plantingBed.flow_rate).toFixed(2)) +
          pump_offset; // milissegundos necessários pra irrigar a quantidade de água necessária + segundo de offset
      }

      await prisma.irrigation.create({
        data: {
          id: uuidv4(),
          date: new Date(),
          bed: {
            connect: { id: plantingBed.id },
          },
          duration: necessary_seconds * 1000,
          water_added: parseFloat(finalVolume.toFixed(3)),
          expected_etc: predictedEtc,
          flow_rate: plantingBed.flow_rate,
          real_etc: null,
          target_water_level: parseFloat(target_water_level.toFixed(3)),
          water_before: water_level,
          water_after: null,
          stage: {
            connect: { id: plantingBed.stage.id },
          },
          pause: false,
          action_idx: action, //ação decidida pela IA
        },
      });
      console.log(
        "Água necessária para irrigação (L): ",
        finalVolume,
        "Duração necessária para irrigação (s): ",
        necessary_seconds,
      );
      return necessary_seconds;
    }
    console.log("Solo saturado, sem necessidade de irrigação.");
    return 0;
  } catch (err) {
    console.error("Erro ao calcular irrigação:", err);
    throw err;
  }
};
const IrrigatedSoil = (hour, minute) => {
  // Janela da manhã: 08:55 até 09:59
  const morningIrrigation = (hour === 11 && minute >= 55) || hour === 12;

  // Janela da tarde: 17:55 até 18:59
  const eveningIrrigation = (hour === 20 && minute >= 55) || hour === 21;

  if (morningIrrigation || eveningIrrigation) {
    return true;
  }

  console.log(`Hora atual: ${hour}:${minute}, fora do horário de irrigação`);
  return false;
};
const allowedHours = (hour, minute) => {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;

  try {
    if (verifySchedule(hour, day, month)) {
      console.log("Irrigação agendada para este horário.");
      return true;
    }
  } catch (err) {
    console.error("Erro ao verificar schedule: ", err);
  }
  // Janela da manhã: 08:55 até 09:59
  const morningWindow = (hour === 8 && minute >= 55) || hour === 9;

  // Janela da tarde: 17:55 até 18:59
  const eveningWindow = (hour === 17 && minute >= 55) || hour === 18;

  if (morningWindow || eveningWindow || verifySchedule(hour, day, month)) {
    return true;
  }

  console.log(`Hora atual: ${hour}:${minute}, fora do horário de irrigação`);
  return false;
};
const openWeatherData = async () => {
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${process.env.LATITUDE}&lon=${process.env.LONGITUDE}&exclude=current,minutely,alerts,daily&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`,
    );
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Error fetching OpenWeather data:", err);
    throw err;
  }
};

const getNasaPowerData = async () => {
  try {
    const now = new Date();
    const day = now.getDate().toString();
    const month = now.getMonth().toString() + 1;
    const year = now.getFullYear().toString() - 1; //ano passado

    const response = await fetch(
      `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=CLRSKY_SFC_SW_DWN&community=AG&longitude=${process.env.LONGITUDE}&latitude=${process.env.LATITUDE}&start=${year + month + day}&end=${year + month + day}&format=JSON`,
    );
    const data = await response.json();
    return data.properties.parameter.CLRSKY_SFC_SW_DWN;
  } catch (err) {
    console.error("Error fetching NASA POWER data:", err);
    throw err;
  }
};

function penmanMonteithHour({ temp, humidity, wind, rs }) {
  try {
    const gamma = 0.066; //constante psicrométrica, alteração por altitude é irrelevante
    const albedo = 0.23; //media de albedo, valor aceitável

    const es = 0.6108 * Math.exp((17.27 * temp) / (temp + 237.3));
    const ea = es * (humidity / 100);
    const delta = (4098 * es) / Math.pow(temp + 237.3, 2);

    const rn = (1 - albedo) * rs;
    const g = 0.1 * rn;

    const num =
      0.408 * delta * (rn - g) + gamma * (37 / (temp + 273)) * wind * (es - ea);

    const den = delta + gamma * (1 + 0.34 * wind);

    const mm = Math.max(0, num / den); // mm/h
    return mm;
  } catch (err) {
    console.error("Erro no calculo de Penman-Monteith:", err);
    return 0;
  }
}

function uviToRs(uvi, clouds) {
  try {
    //mesmo com 100% de nuvens, o piso é 25%
    let rs = uvi * 25; // W/m²
    rs = rs * (1 - clouds / 100);

    return rs * 0.0036; // MJ/m²/h
  } catch (err) {
    console.error("Erro no calculo de uvi para Rs:", err);
    return 0;
  }
}
function verifySchedule(hour, day, month) {
  if (
    schedule.some((s) => s.hour === hour && s.day === day && s.month === month)
  ) {
    console.log("Irrigação agendada para este horário.");
    schedule = schedule.filter(
      (s) => !(s.hour === hour && s.day === day && s.month === month),
    );
    return true;
  }
  return false;
}

function scheduleIrrigation(hour, day, month) {
  if (
    schedule.some((s) => s.hour === hour && s.day === day && s.month === month)
  ) {
    console.log("Irrigação já agendada para este horário.");
    return;
  }
  schedule.push({ hour, day, month });
  console.log(schedule);
}
function deleteSchedules() {
  schedule = [];
}
function getSchedule() {
  return schedule;
}
export default {
  verifyEvapotranspiration,
  verifyIrrigationTraining,
  verifyIrrigationPenmann,
  calculateReward,
  getNasaPowerData,
  scheduleIrrigation,
  deleteSchedules,
  getSchedule,
};
