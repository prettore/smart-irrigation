# ESP32 Firmware (`esp32-firmware`)

## Visão Geral

Este módulo contém o código-fonte (C++ para framework Arduino/PlatformIO) embarcado no microcontrolador ESP32. Ele é responsável pela interação direta com o ambiente físico do canteiro.

## Hardware Utilizado

- Placa de desenvolvimento ESP32 (NodeMCU-32S).
- 4x Sensores Capacitivos de Umidade do Solo (ligados às portas analógicas via um multiplexador ou direto nas portas ADC, dependendo do esquemático).
- 1x Sensor DHT11 (Temperatura e Umidade do ar).
- 1x Módulo Relé (para acionamento da bomba de água de 12V/24V).
- Abrigos meteorológicos impressos em 3D (PETG) para proteção dos componentes externos.

## Lógica de Funcionamento

O firmware foi projetado com foco em eficiência energética, utilizando o recurso de **Deep Sleep** do ESP32.

1. **Despertar e Sincronização:** O ESP32 acorda, conecta-se ao Wi-Fi e sincroniza o relógio via NTP (Network Time Protocol).
2. **Leitura dos Sensores:** Realiza leituras analógicas dos sensores capacitivos, aplicando um filtro de mediana para reduzir ruídos, e lê os dados do DHT11.
3. **Comunicação:** Monta um payload JSON com as leituras e envia via requisição HTTP POST para o `api-gateway`.
4. **Atuação:** A API responde com o tempo de acionamento da bomba em segundos. Se o valor for maior que zero, o ESP32 aciona o pino do relé pelo tempo estipulado.
5. **Suspensão:** O ESP32 calcula o tempo restante até a próxima janela de verificação (ex: a cada 3 horas ou em horários fixos alinhados) e entra em Deep Sleep, economizando bateria.

## Como Compilar e Enviar

### Pré-requisitos
- Visual Studio Code com a extensão **PlatformIO**.

### Passos

1. Abra a pasta `esp32-firmware` no VS Code.
2. Crie o arquivo `include/config.h` e defina suas credenciais de rede e a URL do servidor:
   ```cpp
   #ifndef CONFIG_H
   #define CONFIG_H

   #define WIFI_SSID "Sua_Rede_WiFi"
   #define WIFI_PASS "Sua_Senha"
   #define SERVER_URL "http://IP_DO_API_GATEWAY:3000/api/endpoint"

   #endif
   ```
3. Conecte o ESP32 via cabo USB.
4. No PlatformIO, clique no botão **Upload** (seta para a direita na barra inferior). O PlatformIO baixará automaticamente as bibliotecas necessárias (como `ArduinoJson` e `DHT sensor library for ESPx`) definidas no `platformio.ini` e fará a gravação no microcontrolador.
