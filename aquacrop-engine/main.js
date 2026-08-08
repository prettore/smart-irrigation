const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const IRR_PATH = "C:\\Users\\hudso\\Desktop\\testes\\data\\teste.IRR";
const PRO_PATH = "C:\\aquacrop_CMD\\LIST\\Harvester.PRO";
const AQUACROP_DIR = "C:\\AquaCrop_CMD\\";

const OUT_FILE = "C:\\aquacrop_CMD\\OUTP\\HarvesterPROseason.out";
const DEST_FILE = path.join(__dirname, "resultados.out");

const P_VALUES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const CYCLE = 75;
const MAX_DAY = 365 - CYCLE;

function appendSeasonResult(p) {
  const content = fs.readFileSync(OUT_FILE, "utf8");
  if (!content.includes("Tot(")) {
    throw new Error("saida inválida");
  }
  const lines = content.split("\n");

  const dataLine = lines.find((l) => l.trim().startsWith("Tot("));

  if (!dataLine) {
    throw new Error("Erro na linha 'tot'");
  }
  const lineWithP = `${dataLine.trim()}\t${p}`;

  fs.appendFileSync(DEST_FILE, lineWithP + "\n");
}

function buildDayTable() {
  const months = [
    ["January", 31],
    ["February", 28],
    ["March", 31],
    ["April", 30],
    ["May", 31],
    ["June", 30],
    ["July", 31],
    ["August", 31],
    ["September", 30],
    ["October", 31],
    ["November", 30],
    ["December", 31],
  ];

  const table = new Array(366);
  let d = 1;

  for (const [name, days] of months) {
    for (let i = 1; i <= days; i++) {
      table[d++] = `${i} ${name}`;
    }
  }
  return table;
}

const DAY_STR = buildDayTable();

const MONTHS = [
  { name: "Jan", end: 31 },
  { name: "Fev", end: 59 },
  { name: "Mar", end: 90 },
  { name: "Abr", end: 120 },
  { name: "Mai", end: 151 },
  { name: "Jun", end: 181 },
  { name: "Jul", end: 212 },
  { name: "Ago", end: 243 },
  { name: "Set", end: 273 },
  { name: "Out", end: 304 },
  { name: "Nov", end: 334 },
  { name: "Dez", end: 365 },
];
const stages = [
  { name: "Ini", days: 20, Kc: 0.7 },
  { name: "Des", days: 30, Kc: 0.7 },
  { name: "Mid", days: 15, Kc: 1 },
  { name: "Fim", days: 10, Kc: 0.95 },
];

function getMonth(day) {
  return MONTHS.find((m) => day <= m.end)?.name;
}

function updateIRR(y) {
  const lines = fs.readFileSync(IRR_PATH, "utf8").split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Allowable depletion of RAW")) {
      lines[i] =
        `${y.toString().padStart(4)}     : Allowable depletion of RAW (%)`;
      break;
    }
  }

  fs.writeFileSync(IRR_PATH, lines.join("\n"), "utf8");
}

function updatePRO(x) {
  const lines = fs.readFileSync(PRO_PATH, "utf8").split("\n");

  const end = x + CYCLE;

  const startStr = DAY_STR[x];
  const endStr = DAY_STR[end];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("First day of simulation period")) {
      lines[i] =
        `${x.toString().padStart(4)}         : First day of simulation period - ${startStr}`;
    } else if (lines[i].includes("Last day of simulation period")) {
      lines[i] =
        `${end.toString().padStart(4)}         : Last day of simulation period - ${endStr}`;
    } else if (lines[i].includes("First day of cropping period")) {
      lines[i] =
        `${x.toString().padStart(4)}         : First day of cropping period - ${startStr}`;
    } else if (lines[i].includes("Last day of cropping period")) {
      lines[i] =
        `${end.toString().padStart(4)}         : Last day of cropping period - ${endStr}`;
    }
  }

  fs.writeFileSync(PRO_PATH, lines.join("\n"), "utf8");
}

function main() {
  let currentMonth = null;

  for (let x = 1; x <= MAX_DAY; x++) {
    const month = getMonth(x);

    if (month !== currentMonth) {
      currentMonth = month;
      console.log(`>>> ${month}`);
    }

    for (let p of P_VALUES) {
      try {
        execSync("aquacrop.exe", {
          cwd: AQUACROP_DIR,
        });
        appendSeasonResult(p);
      } catch (err) {
        console.error("STDERR:\n", err.stderr?.toString());
        console.error("STDOUT:\n", err.stdout?.toString());
        throw err;
      } finally {
        updateIRR(p);
      }
    }
    updatePRO(x);
  }
}

try {
  execSync("aquacrop.exe", {
    cwd: AQUACROP_DIR,
  });
  appendSeasonResult(p);
} catch (err) {
  console.error("STDERR:\n", err.stderr?.toString());
  console.error("STDOUT:\n", err.stdout?.toString());
  throw err;
}


// conversão:
// 2.0 × 0.6 × 0.15 = 0.18 m³ (180cm³)
// 180(volume) * WC01 = quantidade de água na única camada 


//passo 0: pegar a agua inicial no solo, temperatura e umidade -> calcular a agua a ser irritada (Irr)

// passo 1:enviar o payload pra API
// POST  /decide
// {
  // "plantingBedId": "5d30626c-6855-4462-8b8a-f9226b19e70f",
  // "sensor1": 1325,
  // "sensor2": 1257,
  // "sensor3": 1431,
  // "sensor4": 1680,
  // "air_temperature": 26.3,
  // "air_humidity": 30
// } em 75 registros


// passo 2: pegar cada registro de dia, e ensinar a IA quais foram os efeitos da /decide
// passo 3: dia de simulação ++, agua atual = agua inicial da proxima simulação
// repete passo 0