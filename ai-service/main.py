# main.py
import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from brain import QLearningAgent
import numpy as np
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
agent = QLearningAgent()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React Vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Histórico e Logs
LOG_FILE = "ia_history.txt"
REWARD_FILE = "rewards.txt"
ERROR_FILE = "error.txt"
MOISTURE_FILE="moisture.txt"
INDEX_FILE="index.txt"
WATER_FILE = "water.txt"

def logger(message: str):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {message}\n")

def log_reward(reward: float, error: float, before: float, after: float,volume_applied: float, index: int):
    with open(REWARD_FILE, "a", encoding="utf-8") as f:
        f.write(f"{reward}\n")
    with open(ERROR_FILE, "a", encoding="utf-8") as f:
        f.write(f"{error}\n")
    with open(MOISTURE_FILE, "a", encoding="utf-8") as f:
        f.write(f"{before} + {volume_applied} => {after}\n")
    with open(INDEX_FILE, "a", encoding="utf-8") as f:
        f.write(f"{index}\n")     


# Função de Recompensa (Reward)
def compute_reward(moisture_after, target_raw):
    error = moisture_after - target_raw
    abs_error = abs(error)

    outer_margin = 0.5  # ±500ml
    inner_margin = 0.25 # ±250ml

    if abs_error <= outer_margin:
        reward = 10
        if abs_error <= inner_margin:
            reward += 1
        return float(reward)

    if error < 0:
        penalty = 1.0 * (abs_error**2)  # Falta de água severa
    else:
        penalty = 1.5 * (abs_error**2)  # Excesso de água

    reward = 10 - penalty
    return float(np.clip(reward, -10, 11))

# Schemas Pydantic
class DecideData(BaseModel):
    moisture: float
    stage: int
    temp: float
    air_humidity: float
    volume_ab: float
    treino: bool = False  # <--- NOVA FLAG: Controla se deve usar Softmax ou ArgMax

class LearnData(BaseModel):
    moisture_before: float
    stage: int
    temp: float
    air_humidity: float
    action_idx: int
    moisture_after: float
    target_raw: float
    volume_applied: float

# Endpoints
@app.post("/decide")
async def decide(req: DecideData):
    # modo_treino alterna a entre softmax e argmax, pra IA treinar ou responder
    modo_treino = False
    idx, factor = agent.decide(req.moisture, req.stage, req.temp, req.air_humidity, modo_treino)

    v_final = round(req.volume_ab * factor, 3)
    tipo = "TREINO (Softmax)" if req.treino else "TESTE (ArgMax)"

    logger(f"[{tipo}] Ação: {idx} | fator: {factor} | volume: {v_final}")
    return {"action_idx": int(idx), "volume_final": v_final}



@app.post("/learn")
async def learn(req: LearnData):
    state_before = agent.get_state(req.moisture_before, req.stage, req.temp, req.air_humidity)
    state_after = agent.get_state(req.moisture_after, req.stage, req.temp, req.air_humidity)
    #se nao houver irrigação, não tem porque calcular recompensa pois não houve impacto no solo
    if(req.volume_applied > 0):
        
        reward = compute_reward(req.moisture_after, req.target_raw)
        error = req.moisture_after - req.target_raw

        agent.learn(state_before, req.action_idx, reward, state_after)

        log_reward(reward, error, req.moisture_before, req.moisture_after,req.volume_applied, req.action_idx)
        alerta = "⚠️ PUNICAÇÃO" if reward <= -15 else "✅ OK"
        logger(f"[{alerta}] Ação: {req.action_idx} | reward: {reward:.2f} | erro: {error:.2f}")

        return {"status": "learned", "reward": reward, "error": error}
    else:
        # recompensa 10 somente pro arquivo de recompensa, o modelo não computa este aprendizado
        log_reward(10 , 0, req.moisture_before, req.moisture_after,req.volume_applied, req.action_idx  )
        return {"status": "no_learning", "reward": 0, "error": 0}

@app.delete("/reset-agent")
async def reset_agent():
    try:
        agent.reset_memory()
        logger("Memória resetada")
        return {"status": "ok"}
    except Exception as e:
        logger(f"Erro reset: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard")
async def dashboard():
    qt = agent.q_table
    total_cells = qt.size
    learned = np.count_nonzero(qt != 0)
    coverage = (learned / total_cells) * 100

    q_stats = {
        "min": float(np.min(qt)),
        "max": float(np.max(qt)),
        "mean": float(np.mean(qt)),
    }

    mask = np.any(qt != 0, axis=-1)
    valid_actions = np.argmax(qt, axis=-1)[mask]

    if valid_actions.size > 0:
        unique, counts = np.unique(valid_actions, return_counts=True)
        actions = {int(u): int(c) for u, c in zip(unique, counts)}
    else:
        actions = {}

    return {
        "porcentagem_aprendizado": round(coverage, 4),
        "q_stats": q_stats,
        "acoes": actions,
        "temperatura": agent.temperature
    }

@app.get("/reward-cycles")
async def reward_cycles():
    try:
        with open(REWARD_FILE, "r") as f:
            rewards = [float(line.strip()) for line in f if line.strip()]

        cycle_size = 74 
        cycles = [
            rewards[i : i + cycle_size]
            for i in range(0, len(rewards), cycle_size)
            if len(rewards[i : i + cycle_size]) == cycle_size
        ]

        data = []
        for step in range(cycle_size):
            point = {"step": step + 1}
            for c_idx, cycle in enumerate(cycles):
                point[f"cycle_{c_idx}"] = cycle[step]
            data.append(point)

        return {"cycles": len(cycles), "data": data}
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/error-index")
async def error_cycles():
    try:
        with open(ERROR_FILE, "r") as f:
            rewards = [float(line.strip()) for line in f if line.strip()]

        cycle_size = 74 
        cycles = [
            rewards[i : i + cycle_size]
            for i in range(0, len(rewards), cycle_size)
            if len(rewards[i : i + cycle_size]) == cycle_size
        ]

        data = []
        for step in range(cycle_size):
            point = {"step": step + 1}
            for c_idx, cycle in enumerate(cycles):
                point[f"cycle_{c_idx}"] = cycle[step]
            data.append(point)

        return {"cycles": len(cycles), "data": data}
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/moisture-index")
async def moisture_index():
    try:
        with open(MOISTURE_FILE, "r") as f:
            moisture_lines = [line.strip() for line in f if line.strip()]

        with open(INDEX_FILE, "r") as f:
            indexes = [int(line.strip()) for line in f if line.strip()]

        cycle_size = 74

        moisture_cycles = []
        index_cycles = []

        for i in range(0, len(moisture_lines), cycle_size):
            m_slice = moisture_lines[i:i+cycle_size]
            idx_slice = indexes[i:i+cycle_size]

            if len(m_slice) == cycle_size and len(idx_slice) == cycle_size:
                moisture_cycles.append(m_slice)
                index_cycles.append(idx_slice)

        last_idx = len(moisture_cycles) - 1

        data = []

        for step in range(cycle_size):
            data.append({
                "step": step + 1,
                "moisture": moisture_cycles[last_idx][step],  # 👈 string pura
                "index": index_cycles[last_idx][step]
            })

        return {
            "cycles": len(moisture_cycles),
            "data": data
        }

    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))