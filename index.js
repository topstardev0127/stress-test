const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const sleep = require("util").promisify(setTimeout);
const crypto = require("crypto");

const BUFFER_SIZE = 16000 * 0.35;
const CLIENT_COUNT = 5;

// Function to generate random client IDs
function generateClientId() {
  return crypto.randomBytes(16).toString("hex").toUpperCase();
}

function startWebSocketConnection() {
  const clientId = generateClientId();
  const ws = new WebSocket(
    `ws://35.232.33.243/ws/socket.io/?EIO=4&transport=websocket&t=1720563729&clientID=${clientId}`
  );

  ws.on("open", () => {
    ws.send("40");

    sleep(1000).then(() => {
      ws.send(
        `42["update_languages",["eng","eng"],{"async_processing":true,"buffer_limit":1,"channels":[1],"client_id":"${clientId}","debug":false,"model_name":"Skopos","model_type":"s2s&t","rate":16000}]`
      );
      ws.send(
        '451-0["incoming_audio",{"channel":1,"audioData":{"_placeholder":true,"num":0}}]'
      );

      fs.readFile("record.txt", "utf8", (error, data) => {
        if (error) {
          console.error("An error occurred:", error);
        } else {
          let audioBuffer = data.split("\n").map(Number);

          console.log(
            typeof audioBuffer,
            audioBuffer.length,
            audioBuffer[1000],
            audioBuffer
          );

          while (audioBuffer.length >= BUFFER_SIZE) {
            const dataToSend = audioBuffer.slice(0, BUFFER_SIZE);
            audioBuffer = audioBuffer.slice(BUFFER_SIZE);

            if (dataToSend.every((sample) => Math.abs(sample) < 0.01)) {
              console.log("Skipping silent audio");
            } else {
              const int16Array = new Int16Array(dataToSend.length);
              for (let i = 0; i < dataToSend.length; i++) {
                const s = Math.max(-1, Math.min(1, dataToSend[i]));
                int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
              }

              const uint8Array = new Uint8Array(int16Array.buffer);

              ws.send(
                `451-0["incoming_audio",{"channel":1,"audioData":${JSON.stringify(
                  Array.from(uint8Array)
                )}}]`
              );
            }
          }

          ws.send("3");
        }
      });
    });
  });

  ws.on("message", (data) => {
    console.log(`Server response for ${clientId}:`, data);
    if (data === "2") {
      ws.send("3");
    }
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
  });

  ws.on("close", () => {
    console.log(`WebSocket closed for ${clientId}, reconnecting...`);
    startWebSocketConnection();
  });
}

for (let i = 0; i < CLIENT_COUNT; i++) {
  startWebSocketConnection();
}
