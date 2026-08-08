from datetime import date
import httpx
import asyncio
import subprocess
import time  

#  Arquivos relacionados ao ano de 2025
from humidity import HumidityFile  
from Temp import TempFile  
from ETo import EToFile  
BASE_DATE = date(2025, 1, 1)
BASE_ORDINAL = 45292

client = httpx.AsyncClient()

class State:
    def __init__(self):
        self.dap = 1
        self.day = 1
        self.month = 1
        self.start_month = 1  
        self.month_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


state = State()

def printToday(result, kc):
    print(f"\n--- DAP {state.dap} ---")
    if len(result) >= (state.dap - 1):
        print("Wc: ", result[state.dap - 2][2])
        print("Previsão ETo * Kc: ", (result[state.dap - 1][3] * kc), " Temp:", result[state.dap - 2][4])


def get_month_start_ordinal(month):
    offset = sum(state.month_days[: month - 1])
    return BASE_ORDINAL + offset


def get_last_day_ordinal(first, duration=75):
    end_of_year = BASE_ORDINAL + sum(state.month_days) - 1
    return min(first + duration, end_of_year)


def resetPROheader():
    file_path = "C:\\aquacrop_CMD\\LIST\\project.PRO"
    new_header = (
        "main project\n"
        "      7.1       : AquaCrop Version (August 2023)\n"
        "      1         : Year number of cultivation (Seeding/planting year)\n"
        "  45292         : First day of simulation period - 1 January 2025\n"
        "  45401         : Last day of simulation period - 20 April 2025\n"
        "  45292         : First day of cropping period - 1 January 2025\n"
        "  45401         : Last day of cropping period - 20 April 2025\n"
    )

    with open(file_path, "r") as f:
        lines = f.readlines()

    remaining = lines[7:]

    with open(file_path, "w") as f:
        f.write(new_header)
        f.writelines(remaining)


def update_header_for_month(target_month):
    state.start_month = target_month
    state.month = target_month
    state.day = 1
    state.dap = 1

    file_path = "C:\\aquacrop_CMD\\LIST\\project.PRO"

    with open(file_path, "r") as f:
        lines = f.readlines()

    first = get_month_start_ordinal(target_month)
    last = get_last_day_ordinal(first)

    for i, line in enumerate(lines):
        if "First day of simulation period" in line:
            lines[i] = f"{first:>5}         : First day of simulation period\n"
        elif "Last day of simulation period" in line:
            lines[i] = f"{last:>5}         : Last day of simulation period\n"
        elif "First day of cropping period" in line:
            lines[i] = f"{first:>5}         : First day of cropping period\n"
        elif "Last day of cropping period" in line:
            lines[i] = f"{last:>5}         : Last day of cropping period\n"

    with open(file_path, "w") as f:
        f.writelines(lines)


def run_aquacrop():
    subprocess.run(
        ["C:\\aquacrop_CMD\\aquacrop.exe"],
        cwd="C:\\aquacrop_CMD",
        stdout=subprocess.DEVNULL,
    )
    time.sleep(0.015)


def readInitialWC():
    file_path = "data/Zstart.SW0"
    with open(file_path, "r") as f:
        lines = f.readlines()

    for i, line in enumerate(lines):
        if "Thickness layer" in line:
            data_line = lines[i + 2].strip()
            parts = data_line.split()
            return float(parts[1])


def eraseIRR():
    file_path = "data/Zmanual.IRR"
    with open(file_path, "r") as f:
        lines = f.readlines()

    cutoff = len(lines)
    for i, line in enumerate(lines):
        if "====" in line:
            cutoff = i + 1
            break

    with open(file_path, "w") as f:
        f.writelines(lines[:cutoff])


def insertIRR(day, mm, rain=0):
    file_path = "data/Zmanual.IRR"

    with open(file_path, "r") as f:
        lines = f.readlines()

    cutoff = len(lines)
    for i, line in enumerate(lines):
        if "====" in line:
            cutoff = i + 1
            break

    clean_lines = lines[:cutoff]
    
    existing_records = []
    for line in lines[cutoff:]:
        if line.strip():
            parts = line.split()
            if len(parts) >= 2 and int(parts[0]) != day: 
                existing_records.append(line)

    new_line = f"{day:>6}\t{mm}\t\t{rain}\n"
    
    with open(file_path, "w") as f:
        f.writelines(clean_lines)
        f.writelines(existing_records)
        f.writelines([new_line])


def parse_file(path):
    out = []
    with open(path, "r") as f:
        lines = f.readlines()[3:]
    for line in lines:
        if "mm" in line or not line.strip():
            continue
        p = line.split()
        out.append(
            (
                int(p[0]),    # Day
                int(p[3]),    # DAP
                float(p[5]),  # WC
                float(p[36]), # ETo
                float(p[38]), # Tavg
            )
        )
    return out


def advance_day():
    state.day += 1
    state.dap += 1
    if state.day > state.month_days[state.month - 1]:
        state.day = 1
        state.month += 1
        if state.month > 12:
            state.month = 1


def getStage():
    if state.dap <= 20:
        return 1
    elif state.dap <= 50:
        return 2
    elif state.dap <= 65:
        return 3
    return 4


def getKc():
    stage1, stage2, stage3, stage4 = 20, 50, 65, 75
    if state.dap <= stage1:
        return 0.7
    elif state.dap <= stage2:
        return 0.7 + (state.dap - stage1) * (1.0 - 0.7) / (stage2 - stage1)
    elif state.dap <= stage3:
        return 1.0
    return 0.95


async def runSingle():
    kc = getKc()
    wc = readInitialWC()
    ETo = EToFile[(state.month, state.day)]
    ur = HumidityFile[(state.month, state.day)]
    temp = TempFile[(state.month, state.day)]

    ETc = kc * ETo

    payload_initial = {
        "plantingBedId": "5d30626c-6855-4462-8b8a-f9226b19e70f",
        "WC": wc,
        "ETc": ETc,
        "air_temperature": temp,
        "air_humidity": ur,
        "isFirst": True,
        "isLast": False,
        "stage": 1,
    }

    try:
        resp = await client.post(
            "http://localhost:3000/train", json=payload_initial, 
        )
        resp.raise_for_status()
        mm = round(float(resp.text.strip()), 3)
        insertIRR(state.dap, mm)
        run_aquacrop()
    except Exception as e:
        print("ERRO DIA 1:", e)

    advance_day()
    simulation_end = 75  + 1

    while state.dap <= simulation_end:
        kc = getKc()
        result = parse_file("C:\\aquacrop_CMD\\OUTP\\projectPROday.out")

        wcmm = result[state.dap - 2][2] 
        
        wc = ((wcmm) / 140.0) * 100  
        ur = HumidityFile[(state.month, state.day)]
        ETo = EToFile[(state.month, state.day)] 
        temp = TempFile[(state.month, state.day)] 
        isLast = state.dap == simulation_end

        payload = {
            "plantingBedId": "5d30626c-6855-4462-8b8a-f9226b19e70f",
            "WC": wc,
            "ETc": kc * ETo,
            "air_temperature": temp,
            "air_humidity": ur,
            "isFirst": False,
            "isLast": isLast,
            "stage": getStage(),
        }
        try:
            resp = await client.post(
                "http://localhost:3000/train", json=payload,
            )
            if isLast == False:
                mm = round(float(resp.text.strip()), 3)
                print(f"Rega decidida para DAP {state.dap}: {mm} mm")
                insertIRR(state.dap, mm)
                run_aquacrop()
        except Exception as e:
            print(f"ERRO DAP {state.dap}:", e)

        advance_day()

async def runMultiple():

    resetPROheader() 
    total_voltas = 3 # 3 voltas x 10 meses = 30 simulações totais
    volta = 1

    while volta <= total_voltas:
        print(f"       INICIANDO VOLTA NO ANO Nº {volta} / {total_voltas}      ")

        # O loop dos meses roda dentro da mesma sessão assíncrona
        for target_month in range(1, 11):
            print(f"\n--- INICIANDO CICLO DE TREINO NO MÊS: {target_month} ---")


           
            eraseIRR()
            update_header_for_month(target_month)

            # Executa o ciclo 
            await runSingle()

        volta += 1

    print("\n Treinamento de 150 simulações concluído com sucesso!")

#   10 simulações (1 lote)
# if __name__ == "__main__": 
#     inicio = time.perf_counter()
#     for x in range(10):
#         print(x+1)
#         update_header_for_month(x+1)
#         eraseIRR()
#         asyncio.run(runSingle())
#     print("\n🏁 Ciclo de treino isolado concluído!")
#     fim = time.perf_counter()
#     tempo_execucao_ms = (fim - inicio) * 1000  
#     print(f"Tempo de execução: {tempo_execucao_ms:.3f} ms")


#    X simulações de X lotes
# if __name__ == "__main__":
#     inicio = time.perf_counter()
#     asyncio.run(runMultiple())
#     print("\n🏁 Ciclo de treino isolado concluído!")
#     fim = time.perf_counter()
#     tempo_execucao_ms = (fim - inicio) * 1000  
#     print(f"Tempo de execução: {tempo_execucao_ms:.3f} ms")

#   somente uma simulação 
# if __name__ == "__main__":
#     inicio = time.perf_counter()
#     update_header_for_month(1)
#     eraseIRR()
#     asyncio.run(runSingle())
#     fim = time.perf_counter()
#     tempo_execucao_ms = (fim - inicio) * 1000  
#     print(f"Tempo de execução: {tempo_execucao_ms:.3f} ms")