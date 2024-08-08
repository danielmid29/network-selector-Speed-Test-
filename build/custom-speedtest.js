const https = require("https");
const EventEmitter = require("events");
const axios = require("axios");
const { exec } = require("child_process");

const os = require("os");
function measureLatency(url) {
  return new Promise((resolve, reject) => {
    const platform = os.platform();

    if (platform === "win32") {
      const pingCmd = `ping -n 4 ${url}`;

      exec(pingCmd, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          const latencyMatch = stdout.match(/Average = ([0-9]+)ms/);
          if (latencyMatch) {
            resolve(parseFloat(latencyMatch[1]).toFixed(0));
          } else {
            resolve(new Error("Failed to parse latency. Output: " + stdout));
          }
        }
      });
    } else if (platform === "linux" || platform === "darwin") {
      const pingCmd = `ping -c 1 ${url} | grep 'time=' | awk -F'time=' '{print $2}' | awk '{print $1}'`;

      exec(pingCmd, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          const latency = stdout.trim(); // Remove any extraneous whitespace
          console.log(latency);
          if (latency) {
            resolve(latency);
          } else {
            reject(new Error("No latency response. Output: " + stdout));
          }
        }
      });
    }
  });
}

async function measureSpeed(url, duration = 5000, emitter, type) {
  return new Promise(async (resolve, reject) => {
    let downloaded = 0;
    const start = Date.now();

    if (type === "download") {
      const req = https
        .get(url, (res) => {
          res.on("data", (chunk) => {
            downloaded += chunk.length;
            const timeElapsed = Date.now() - start;
            const speed = (
              (downloaded * 8) /
              (timeElapsed / 1000) /
              1000000
            ).toFixed(2); // Mbps

            emitter.emit("progress", { type, speed });
            if (timeElapsed > duration) {
              req.destroy();
              resolve(speed);
            }
          });
        })
        .on("error", reject);
    } else {
      const formData = Buffer.alloc(30 * 1024 * 1024); // Create a buffer with 10MB of data

      try {
        let speed;
        await axios.post(url, formData, {
          headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/octet-stream",
          },
          maxRedirects: 0,
          onUploadProgress: (progressEvent) => {
            // Update the uploaded bytes
            uploaded = progressEvent.loaded;

            // Calculate the time elapsed and speed
            const timeElapsed = Date.now() - start;
            speed = ((uploaded * 8) / (timeElapsed / 1000) / 1000000).toFixed(
              2
            ); // Mbps

            if (timeElapsed < duration) {
              emitter.emit("progress", { type: "upload", speed });
            }

            // Check if the duration has passed
            if (timeElapsed > duration) {
              console.log("Upload completed");
              resolve(speed);
              return; // Exit the progress function
            }
          },
        });

        resolve(speed);
      } catch (error) {
        reject(error);
      }
    }
  });
}

async function runSpeedTest(emitter) {
  try {
    const downloadSpeed = await measureSpeed(
      "https://speed.cloudflare.com/__down?bytes=100000000",
      5000,
      emitter,
      "download"
    );
    const uploadSpeed = await measureSpeed(
      "https://speed.cloudflare.com/__up",
      5000,
      emitter,
      "upload"
    );
    let latency;
    try {
      latency = await measureLatency("www.google.com");
    } catch (e) {
      latency = "Couldn't calculate latency ping: " + e;
    }
    return {
      ping: { latency },
      download: { bandwidth: downloadSpeed },
      upload: { bandwidth: uploadSpeed },
      packetLoss: 0,
    };
  } catch (error) {
    throw new Error(`Speed test failed: ${error.message}`);
  }
}

module.exports = { runSpeedTest, EventEmitter };
