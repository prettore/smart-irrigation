# AI Service (`ai-service`)

## Visão Geral

Este módulo é um microserviço em Python construído com o framework **FastAPI**. Ele hospeda o cérebro da Inteligência Artificial do sistema, baseado no algoritmo de Aprendizado por Reforço **Q-Learning**.

## Lógica do Agente (Q-Learning)

O objetivo do agente é manter a umidade do solo dentro de uma faixa ideal (Água Facilmente Disponível + margem de segurança) ao longo do ciclo de cultivo da planta, lidando com incertezas meteorológicas.

- **Estado ($S$):** O estado é composto por 4 variáveis discretizadas:
  1. Umidade do solo (litros).
  2. Estágio fenológico da cultura (4 estágios).
  3. Temperatura do ar (°C).
  4. Umidade do ar (%).
- **Ações ($A$):** O agente não decide o volume de água em litros, mas sim um fator multiplicador sobre o volume teórico de evapotranspiração ($ET_c$) calculado pelo modelo de Penman-Monteith. As 5 ações possíveis são:
  - $-30\%$, $-15\%$, $0\%$ (manter), $+15\%$, $+30\%$.
- **Memória:** O aprendizado é armazenado em uma matriz multidimensional (Q-Table) salva fisicamente no arquivo `q_table.npy`.

## Como Executar

### Pré-requisitos
- Python 3.9+

### Passos

1. Crie um ambiente virtual e ative-o:
   ```bash
   python -m venv venv
   # Linux/macOS
   source venv/bin/activate
   # Windows
   venv\Scripts\activate
   ```

2. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

3. Inicie o servidor:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
   
A API ficará disponível em `http://localhost:8000`. O `api-gateway` deve ser configurado para apontar para este endereço ao solicitar decisões de irrigação.

*Nota: O arquivo `q_table.npy` contém a política já aprendida durante os treinamentos. Caso seja deletado, o agente começará a aprender do zero.*
