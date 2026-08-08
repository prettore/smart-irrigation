# Smart Irrigation – Smart Agriculture Project

Bem-vindo ao repositório unificado do projeto **Smart Irrigation**, desenvolvido para o manejo hídrico otimizado na agricultura inteligente. Este sistema integra Internet das Coisas (IoT), modelos físico-matemáticos (Penman-Monteith) e Inteligência Artificial (Aprendizado por Reforço - Q-Learning) para garantir que a cultura receba a quantidade exata de água necessária, baseando-se em condições reais e simuladas.

Este projeto faz parte da iniciativa **SiR.AI (Sistemas Resilientes para Ambientes Inteligentes)**.

## Arquitetura do Sistema

O projeto é dividido em quatro módulos principais, agora consolidados neste repositório único (monorepo). Cada módulo possui sua própria responsabilidade dentro da arquitetura:

1. **[ESP32 Firmware (`esp32-firmware/`)](./esp32-firmware/README.md)**
   - Código embarcado (C++/Arduino) para o microcontrolador ESP32.
   - Responsável por ler sensores capacitivos de umidade do solo, sensor DHT11 (temperatura e umidade do ar) e controlar a bomba de irrigação via relé.
   - Envia dados de telemetria periodicamente (Deep Sleep) para o API Gateway.

2. **[API Gateway (`api-gateway/`)](./api-gateway/README.md)**
   - Backend em Node.js (Express) com banco de dados PostgreSQL (via Prisma ORM).
   - Recebe e armazena os dados de telemetria dos sensores.
   - Busca dados meteorológicos externos (OpenWeather e NASA POWER).
   - Calcula a evapotranspiração (Penman-Monteith).
   - Gerencia a comunicação com o serviço de Inteligência Artificial para tomada de decisão.

3. **[AI Service (`ai-service/`)](./ai-service/README.md)**
   - API em Python (FastAPI) que hospeda o modelo de Inteligência Artificial (Q-Learning).
   - Recebe o estado atual do canteiro (umidade, temperatura, estágio fenológico) e retorna a ação de irrigação (fator multiplicador sobre o volume teórico).
   - Mantém e atualiza a *Q-Table* (`q_table.npy`) com as políticas aprendidas.

4. **[AquaCrop Engine (`aquacrop-engine/`)](./aquacrop-engine/README.md)**
   - Motor de simulação e treinamento em Python/Node.js que integra o simulador agronômico AquaCrop (FAO) ao agente de IA.
   - Executa simulações iterativas (passo a passo diário) para treinar o agente de RL sem desperdiçar recursos no mundo real.
   - Implementa algoritmos de treinamento como *Beam Search* (busca heurística) e *Softmax* (exploração estocástica).

## Fluxo de Funcionamento

1. **Coleta de Dados:** O ESP32 desperta do modo de suspensão, lê os sensores do canteiro e envia os dados via requisição HTTP POST para a API Gateway.
2. **Processamento Físico:** A API Gateway registra as leituras, consulta APIs climáticas e calcula a Evapotranspiração da Cultura ($ET_c$) teórica para o dia.
3. **Decisão Inteligente:** A API Gateway envia o estado do canteiro para o AI Service. A IA avalia a *Q-Table* e decide qual ajuste (ação de $-30\%$ a $+30\%$) deve ser aplicado ao volume de água calculado.
4. **Acionamento:** A API Gateway converte a decisão em tempo de acionamento da bomba e responde ao ESP32.
5. **Irrigação:** O ESP32 aciona o relé da bomba pelo tempo estipulado e volta a dormir (*Deep Sleep*).

## Como Começar

Cada módulo possui seu próprio arquivo de configuração e dependências. Siga a ordem abaixo para subir o ambiente completo localmente:

1. **Configurar o Banco de Dados e API Gateway:**
   - Entre na pasta `api-gateway/`.
   - Copie o arquivo `.env.example` para `.env` e configure a string de conexão do PostgreSQL e as chaves de API (OpenWeather).
   - Rode `npm install` e `npm run setup` para rodar as migrações do Prisma.
   - Inicie o servidor com `npm start`.

2. **Iniciar o Serviço de IA:**
   - Entre na pasta `ai-service/`.
   - Crie um ambiente virtual: `python -m venv venv` e ative-o.
   - Instale as dependências: `pip install -r requirements.txt`.
   - Inicie a API da IA: `uvicorn main:app --host 0.0.0.0 --port 8000`.

3. **Configurar o ESP32:**
   - Entre na pasta `esp32-firmware/`.
   - Crie o arquivo `include/config.h` (ou renomeie o template, se houver) com suas credenciais de Wi-Fi e a URL do API Gateway.
   - Compile e faça o upload para o ESP32 usando o PlatformIO.

4. **(Opcional) Treinamento no Simulador:**
   - Se desejar treinar a IA do zero, entre em `aquacrop-engine/`.
   - Siga as instruções do README local para configurar os caminhos do executável AquaCrop no Windows e executar o script de treinamento.

## Tecnologias Utilizadas

- **Hardware:** ESP32, Sensores Capacitivos de Umidade, Sensor DHT11, Módulo Relé, Impressão 3D (PETG).
- **Backend:** Node.js, Express, Prisma ORM, PostgreSQL.
- **Inteligência Artificial:** Python, FastAPI, NumPy, Q-Learning (Reinforcement Learning).
- **Simulação Agronômica:** FAO AquaCrop.

## Licença e Autoria

Projeto desenvolvido por **Hudson Ferreira Luiz** (IFMG - Sabará) como parte da pesquisa de Iniciação Científica vinculada ao projeto **SiR.AI**. 

Contato: hudsonferreira2501@gmail.com
