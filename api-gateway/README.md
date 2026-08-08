# API Gateway (`api-gateway`)

## Visão Geral

Este módulo é o servidor backend principal (desenvolvido em Node.js com Express) responsável por orquestrar o fluxo de dados do projeto Smart Irrigation. Ele atua como uma ponte entre o hardware no campo (ESP32), as APIs externas de clima e o serviço de Inteligência Artificial.

## Principais Responsabilidades

1. **Recepção de Telemetria:** Recebe as leituras de umidade do solo, temperatura e umidade do ar enviadas pelo ESP32 e as salva no banco de dados PostgreSQL.
2. **Cálculo Físico-Matemático:** Consulta as APIs do OpenWeather e NASA POWER para obter dados climáticos e calcula a Evapotranspiração da Cultura ($ET_c$) teórica usando o modelo de Penman-Monteith.
3. **Orquestração da IA:** Envia o estado atualizado do canteiro para o módulo `ai-service` e recebe a decisão de irrigação (fator de ajuste).
4. **Comando de Atuação:** Converte o volume de água decidido em tempo de acionamento (segundos) com base na vazão da bomba, respondendo à requisição HTTP do ESP32.
5. **Agendamento:** Verifica as janelas de irrigação permitidas para evitar desperdícios e proliferação de patógenos.

## Estrutura do Banco de Dados (Prisma)

O esquema relacional (Prisma) armazena:
- `planting_bed`: Canteiros de cultivo, com parâmetros como Capacidade de Campo e Ponto de Murcha.
- `sensor`: Cadastro dos sensores instalados.
- `reads`: Histórico de leituras dos sensores.
- `crops` e `crop_stages`: Dados fenológicos da cultura (ex: Alface Americana) e seus coeficientes ($K_c$).
- `irrigation`: Histórico de irrigações realizadas, volume aplicado e ação escolhida pela IA.

## Como Executar

### Pré-requisitos
- Node.js v18+
- Banco de dados PostgreSQL rodando (local ou nuvem).

### Passos

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente:
   Renomeie o arquivo `.env.example` para `.env` e preencha as variáveis obrigatórias:
   ```env
   PORT=3000
   HOST=0.0.0.0
   DATABASE_URL="postgresql://user:password@localhost:5432/smart_irrigation"
   OPENWEATHER_API_KEY="sua_chave_aqui"
   LATITUDE="-19.8157"
   LONGITUDE="-43.9542"
   ```

3. Configure o Banco de Dados:
   Execute as migrações do Prisma para criar as tabelas:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

4. Inicie o servidor:
   ```bash
   npm start
   ```
   O servidor rodará na porta definida no `.env`.
