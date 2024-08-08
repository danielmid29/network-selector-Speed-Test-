const { runSpeedTest, EventEmitter } = require("./custom-speedtest");

process.on("message", async (message) => {
  if (message.type === "run-test") {
    const emitter = new EventEmitter();

    emitter.on("progress", (progress) => {
      process.send({ type: "progress", data: progress });
    });

    try {
      const result = await runSpeedTest(emitter);
      process.send({ type: "result", data: result });
    } catch (error) {
      process.send({ type: "error", data: error.message });
    }
  }
});
