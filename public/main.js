const { app, BrowserWindow } = require("electron");
const { ipcMain } = require("electron/main");
const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);

const os = require("os");
const wifi = require("node-wifi");
const path = require("path");
const logPath = path.join(__dirname, "logs", "main.log");
const fs = require("fs");
const { fork } = require("child_process");

require("@electron/remote/main").initialize();

function logToFile(message) {
  fs.appendFile(logPath, message + "\n", (err) => {
    if (err) throw err;
  });
}

const logDir = path.join(__dirname, "logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

async function createWindow() {
  const { default: isDev } = await import("electron-is-dev");
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // win.webContents.openDevTools();
  win.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );
}

app.on("ready", createWindow);
ipcMain.on("get-wwan-networks", async (event) => {
  console.log("get wwan networks");
  try {
    const { stdout } = await execAsync("nmcli -t -f NAME connection show");
    const networks = stdout.split("\n").filter(Boolean);
    event.reply("wwan-networks", networks);

    console.log(networks);
  } catch (error) {
    console.log("Error", error);
    event.reply("speed-error", "Error fetching network details: " + error);
  }
});

let networkResults = [];

ipcMain.on("connect-to-network", async (event, selectedNetworks) => {
  networkResults = [];
  console.log(selectedNetworks);

  try {
    // Deactivate all active connections

    for (const network of Object.keys(selectedNetworks)) {
      await deactivateAllConnections(event);
      console.log("network", network);
      if (network) {
        event.reply("reset", "");
        event.reply("set-status", "Connecting to network: " + network);
        await connectNetwork(event, network, false);
      }
    }

    event.reply("reset", "");
    if (networkResults.length > 0) {
      const bestNetwork = await connectToBest(event);
      event.reply(
        "set-status",
        `Connecting to best network: ${bestNetwork.ssid}`
      );
      const currentActiveNetwork = await getCurrentActiveNetwork();

      console.log(bestNetwork.ssid);

      if (currentActiveNetwork === bestNetwork.ssid) {
        event.reply(
          "set-status",
          `Connected to best network: ${bestNetwork.ssid}`
        );
      } else {
        await deactivateAllConnections(event);
        await connectNetwork(event, bestNetwork.ssid, true);
      }

      event.reply(
        "set-status",
        `Connected to best network: ${bestNetwork.ssid}`
      );
    }
  } catch (error) {
    event.reply("speed-error", "Error in connection process: " + error);
  } finally {
    event.reply("reset", "");
  }
});

async function getCurrentActiveNetwork() {
  try {
    const { stdout } = await execAsync(
      "nmcli -t -f NAME connection show --active"
    );
    const activeConnections = stdout.split("\n").filter(Boolean);
    return activeConnections[0]; // Assuming the first active connection is the current one
  } catch (error) {
    throw new Error("Failed to get current active network: " + error);
  }
}

async function deactivateAllConnections(event) {
  try {
    const { stdout } = await execAsync(
      "nmcli -t -f NAME connection show --active"
    );
    const activeConnections = stdout.split("\n").filter(Boolean);

    for (const connection of activeConnections) {
      event.reply("set-status", "Deactivating connection: " + connection);
      await execAsync(`nmcli connection down "${connection}"`);
    }

    // Wait a bit to ensure all connections are down
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error) {
    throw new Error("Failed to deactivate connections: " + error);
  }
}

async function connectNetwork(event, network, final) {
  return new Promise((resolve, reject) => {
    execAsync(`nmcli connection up "${network}"`)
      .then(() => {
        waitForInternetConnection(async (err, connected) => {
          if (err) {
            event.reply(
              `speed-error", "Connection error ${network}:` + err.message
            );
            resolve(err);
          } else {
            if (final) {
              event.reply(
                "set-status",
                "Connected to best network: " + network.ssid
              );
              console.log("Connected to best network: " + network);

              resolve();
            } else {
              event.reply("set-status", "Connected network: " + network);
              await testSpeed(event, network)
                .then((result) => {
                  console.log("Internet connection established.");
                  resolve(network);
                })
                .catch((error) => {
                  event.reply(
                    "speed-error",
                    "Error connecting to network: " + error
                  );

                  resolve(error);
                });
            }
          }
        });
      })
      .catch((error) => {
        event.reply("speed-error", "Error connecting to network: " + error);
        console.error("Error connecting to network:", error);
        resolve();
      });
  });
}

function isConnectedToInternet(callback) {
  const platform = os.platform();
  if (platform === "win32") {
    exec("ping -n 1 google.com", (err) => {
      callback(!err);
    });
  } else {
    exec("ping -c 1 google.com", (err) => {
      callback(!err);
    });
  }
}

function waitForInternetConnection(callback, timeout = 30000, interval = 2000) {
  const startTime = Date.now();

  function checkConnection() {
    isConnectedToInternet((connected) => {
      if (connected) {
        callback(null, true);
      } else if (Date.now() - startTime >= timeout) {
        callback(new Error("Timeout: Unable to connect to the internet"));
      } else {
        setTimeout(checkConnection, interval);
      }
    });
  }

  checkConnection();
}

async function testSpeed(event, ssid) {
  console.log("get-speed");
  event.reply("set-status", "Testing network: " + ssid);

  return new Promise((resolve, reject) => {
    const child = fork(path.join(__dirname, "network.js"));

    child.on("message", (message) => {
      if (message.type === "progress") {
        event.reply("speed-progress", message.data);
      } else if (message.type === "result") {
        const result = message.data;
        result.ssid = ssid;
        networkResults.push(result);
        console.log(result);
        event.reply("speed-result", result);
        resolve(result);
      } else if (message.type === "error") {
        const errorMessage = `Connection error speedtest "${ssid}": ${message.data}`;
        event.reply("speed-error", errorMessage);
        console.log(errorMessage);
        logToFile(errorMessage);
        resolve(new Error(errorMessage));
      }
    });

    child.on("error", (error) => {
      const errorMessage = `Connection error speedtest "${ssid}": ${error}`;
      event.reply("speed-error", errorMessage);
      console.error("Child process error:", error);
      resolve(error);
    });

    child.on("exit", (code, signal) => {
      if (code !== 0) {
        resolve(new Error(`Child process exited with code ${code}`));
      }
    });

    child.send({ type: "run-test" });
  });
}

const calculateWeightedScore = (network) => {
  // Define weights for each criterion
  const downloadWeight = 3.5;
  const latencyWeight = 2;
  const uploadWeight = 2;

  // Calculate weighted scores
  const downloadScore = network.download.bandwidth * downloadWeight;
  const latencyScore = (1 / network.ping.latency) * latencyWeight; // Inverse to favor lower latency
  const uploadScore = network.upload.bandwidth * uploadWeight;

  // Total score
  return downloadScore + latencyScore + uploadScore;
};

const connectToBest = async (event) => {
  const bestNetwork = await networkResults.reduce((best, current) => {
    if (best === null) return current;

    // Skip networks with zero download or upload speeds
    if (current.download.bandwidth === 0 || current.upload.bandwidth === 0)
      return best;
    if (best.download.bandwidth === 0 || best.upload.bandwidth === 0)
      return current;

    // Calculate scores
    const bestScore = calculateWeightedScore(best);
    const currentScore = calculateWeightedScore(current);

    // Choose the network with the highest score
    return currentScore > bestScore ? current : best;
  }, null);

  event.reply(
    "set-status",
    "Connecting to best network : " + bestNetwork?.ssid
  );
  return bestNetwork;
};
// Quit when all windows are closed.
app.on("window-all-closed", function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
