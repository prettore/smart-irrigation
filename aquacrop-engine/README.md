# AquaCrop Engine (`aquacrop-engine`)

## Visão Geral

Este módulo é o motor de simulação e treinamento do projeto. Como o treinamento de algoritmos de Aprendizado por Reforço no mundo real consome muito tempo e pode resultar em perdas severas de recursos hídricos e vegetais devido à exploração estocástica, este motor utiliza o simulador agronômico **AquaCrop** (desenvolvido pela FAO) para simular ciclos completos de cultivo em minutos.

## Como Funciona

O software AquaCrop foi originalmente projetado para simular ciclos completos de cultivo, sem suporte nativo a iterações passo a passo (dia a dia) via API. 

Para contornar isso, este motor (escrito em Python e Node.js) implementa um mecanismo de "reprodutibilidade determinística":
1. Ele escreve os arquivos de configuração do AquaCrop (`.PRO`, `.IRR`) com o histórico de irrigações até o dia $X$.
2. Executa o executável `aquacrop.exe` via linha de comando.
3. Lê os arquivos de saída (`.OUT`) para extrair a umidade do solo no dia $X$.
4. Envia esse estado para o `ai-service`, recebe a ação, calcula o volume de água e adiciona ao arquivo `.IRR` para o dia $X+1$.
5. Repete o processo.

## Estratégias de Treinamento

O código suporta duas estratégias principais de treinamento:

- **Softmax:** Utiliza uma política de exploração estocástica com decaimento de temperatura. O agente explora ações aleatórias inicialmente e vai se tornando mais "guloso" com o tempo. Exige muitos ciclos de simulação para convergir, mas tem maior probabilidade de encontrar o ótimo global.
- **Beam Search:** Utiliza uma busca heurística em árvore (com largura $k=3$). Em vez de explorar aleatoriamente, ele simula os resultados de todas as ações possíveis no AquaCrop, avalia as recompensas e mantém apenas as trajetórias mais promissoras. Permite convergência rápida e segura.

## Como Executar (Apenas Windows)

**Atenção:** O AquaCrop fornecido pela FAO em versão CLI roda nativamente em ambiente Windows.

1. Baixe e extraia o AquaCrop versão plugin/CMD em `C:\AquaCrop_CMD\`.
2. Copie os arquivos da pasta `data/` deste repositório para as respectivas pastas dentro do AquaCrop (`DATA/`, `LIST/`, etc).
3. Instale as dependências Python:
   ```bash
   pip install -r requirements.txt
   ```
4. Execute o script de treinamento desejado (certifique-se de que o `api-gateway` e o `ai-service` estejam rodando localmente):
   ```bash
   python main.py
   ```
   *(Ou execute `node main.js` dependendo do script de automação que deseja rodar).*
