const WebSocket = require("ws");
const fs = require("fs");

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 16000 * 0.35;

function generateClientId() {
  const chars = "ABCDEF0123456789";
  let clientId = "";
  for (let i = 0; i < 32; i++) {
    clientId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return clientId;
}

function startWebsocketConnection() {
  const clientID = generateClientId();
  const url = `wss://demo.trytoby.com/ws/socket.io/?EIO=4&transport=websocket&t=${new Date().getTime()}&clientID=${clientID}`;
  const ws = new WebSocket(url);

  ws.on("open", function open() {
    console.log("Connected to the server");
    updateLanguages(ws, clientID);
    sendAudioData(ws);
  });

  ws.on("message", function message(data) {
    console.log("Received message:", data);
    if (data === "2") {
      ws.send("3");
    }
  });

  ws.on("close", function close() {
    console.log("Disconnected from the server");
  });

  ws.on("error", function error(err) {
    console.error("An error occurred:", err);
  });
}

function updateLanguages(ws, clientID) {
  const languages = ["eng", "fra"];
  const config = {
    async_processing: true,
    buffer_limit: 1,
    channels: [1],
    client_id: clientID,
    debug: false,
    model_name: "Skopos",
    model_type: "s2s&t",
    rate: SAMPLE_RATE,
  };

  ws.send(
    JSON.stringify({
      event: "update_languages",
      languages: languages,
      config: config,
    }),
    (error) => {
      if (error) console.error("Send error:", error);
    }
  );

  console.log("Sent update_languages event:", languages, config);
}

function sendAudioData(ws) {
  fs.readFile("record.txt", "utf8", (error, data) => {
    if (error) {
      console.error("An error occurred:", error);
    } else {
      let audioBuffer = data.split("\n").map(Number);
      console.log(audioBuffer);

      function sendChunk() {
        if (audioBuffer.length >= BUFFER_SIZE) {
          const dataToSend = audioBuffer.slice(0, BUFFER_SIZE);
          audioBuffer = audioBuffer.slice(BUFFER_SIZE);

          if (dataToSend.every((sample) => Math.abs(sample) < 0.01)) {
            console.log("Skipping silent audio");
            sendChunk();
          } else {
            const int16Array = new Int16Array(dataToSend.length);
            for (let i = 0; i < dataToSend.length; i++) {
              const s = Math.max(-1, Math.min(1, dataToSend[i]));
              int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            const uint8Array = new Uint8Array(int16Array.buffer);

            ws.send(
              JSON.stringify({
                event: "incoming_audio",
                data: {
                  channel: 1,
                  audioData: uint8Array,
                },
              }),
              (response) => {
                console.log("Server response:", response);
                sendChunk();
              }
            );
          }
        }
      }

      sendChunk();
    }
  });
}

startWebsocketConnection();
