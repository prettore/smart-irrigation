# Guia de Configuração e Primeiro Commit

Este guia descreve como criar o repositório no GitHub e enviar o código pela primeira vez.

## 1. Criar o Repositório no GitHub

Acesse [github.com/new](https://github.com/new) e preencha:

- **Repository name:** `smart-irrigation`
- **Description:** `Smart Irrigation – Smart Agriculture Project | Sistema de irrigação inteligente com IoT, Penman-Monteith e Aprendizado por Reforço (Q-Learning). Parte do projeto SiR.AI.`
- **Visibility:** Public (ou Private, conforme preferência)
- **NÃO** marque "Add a README file" (já existe um neste pacote)

Clique em **Create repository**.

## 2. Inicializar e Enviar o Código

Com o repositório criado, abra um terminal na pasta raiz deste projeto e execute os comandos abaixo, substituindo `SEU_USUARIO` pelo seu nome de usuário do GitHub:

```bash
# Inicializar o repositório Git local
git init

# Adicionar todos os arquivos ao stage
git add .

# Criar o commit inicial
git commit -m "feat: initial commit – consolidate API, ESP32, AI Service and AquaCrop Engine"

# Renomear a branch para 'main' (padrão do GitHub)
git branch -M main

# Adicionar o repositório remoto
git remote add origin https://github.com/SEU_USUARIO/smart-irrigation.git

# Enviar o código
git push -u origin main
```

## 3. Estrutura do Repositório

Após o push, o repositório terá a seguinte estrutura:

```
smart-irrigation/
├── README.md                   ← Visão geral do projeto e arquitetura
├── SETUP.md                    ← Este arquivo
├── .gitignore                  ← Arquivos ignorados pelo Git
│
├── api-gateway/                ← Backend Node.js (Express + Prisma + PostgreSQL)
│   ├── README.md
│   ├── main.js
│   ├── package.json
│   ├── .env.example            ← Template de variáveis de ambiente
│   ├── prisma/
│   │   ├── schema.prisma       ← Modelo do banco de dados
│   │   └── migrations/         ← Histórico de migrações SQL
│   └── src/
│       ├── controllers/        ← Rotas e lógica de decisão
│       ├── services/           ← Penman-Monteith, leituras, irrigação
│       └── middleware/         ← Autenticação
│
├── esp32-firmware/             ← Firmware C++ para ESP32 (PlatformIO)
│   ├── README.md
│   ├── platformio.ini          ← Configuração da placa e bibliotecas
│   ├── include/
│   │   └── config.h.example    ← Template de credenciais Wi-Fi/servidor
│   └── src/
│       └── main.cpp            ← Código principal do firmware
│
├── ai-service/                 ← Serviço de IA em Python (FastAPI + Q-Learning)
│   ├── README.md
│   ├── main.py                 ← Endpoints da API de IA
│   ├── brain.py                ← Implementação do agente Q-Learning
│   └── requirements.txt
│
└── aquacrop-engine/            ← Motor de simulação e treinamento (Python + Node.js)
    ├── README.md
    ├── main.py                 ← Orquestrador de treinamento (Softmax/Beam Search)
    ├── main.js                 ← Script auxiliar de simulação em lote
    ├── ETo.py                  ← Parser de dados de evapotranspiração
    ├── Temp.py                 ← Parser de dados de temperatura
    ├── humidity.py             ← Parser de dados de umidade
    ├── requirements.txt
    └── data/                   ← Arquivos de configuração do AquaCrop
        ├── ZLettuce.CRO        ← Parâmetros da cultura (alface)
        ├── ZSoloRavena.SOL     ← Parâmetros do solo
        ├── ZRavena.CLI         ← Dados climáticos históricos
        ├── project.PRO         ← Arquivo de projeto do AquaCrop
        └── ...
```

## 4. Configuração por Módulo

### api-gateway
Renomeie `.env.example` para `.env` e preencha:
```env
PORT=3000
HOST=0.0.0.0
DATABASE_URL="postgresql://usuario:senha@localhost:5432/smart_irrigation"
DIRECT_URL="postgresql://usuario:senha@localhost:5432/smart_irrigation"
OPENWEATHER_API_KEY="sua_chave_openweather"
LATITUDE="-19.8157"
LONGITUDE="-43.9542"
```

### esp32-firmware
Renomeie `include/config.h.example` para `include/config.h` e preencha com suas credenciais de Wi-Fi e a URL do servidor.

### ai-service
Nenhuma variável de ambiente necessária. O arquivo `q_table.npy` (política aprendida) será gerado automaticamente na primeira execução ou pode ser adicionado manualmente após o treinamento.

### aquacrop-engine
Edite os caminhos absolutos no início de `main.py` e `main.js` para apontar para a instalação local do AquaCrop no Windows.
