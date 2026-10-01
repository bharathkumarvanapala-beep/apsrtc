const store = require("../services/fleetStore");

function registerSocketHandlers(io) {
  io.on("connection", socket => {
    socket.emit("fleet:snapshot", store.all());

    socket.on("fleet:subscribe", () => {
      socket.emit("fleet:snapshot", store.all());
    });
  });

  setInterval(() => {
    io.emit("fleet:update", store.all());
  }, 3000);
}

module.exports = { registerSocketHandlers };
