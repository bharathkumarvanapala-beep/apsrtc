require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");

const healthRoutes = require("./routes/health");
const busRoutes = require("./routes/buses");
const journeyRoutes = require("./routes/journey");
const complaintRoutes = require("./routes/complaints");
const trackingRoutes = require("./routes/tracking");
const adminRoutes = require("./routes/admin");
const { registerSocketHandlers } = require("./sockets/socket");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || "*", methods: ["GET", "POST"] }
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({
    name: "APSRTC SmartTrack API",
    version: "1.0.0",
    demoMode: process.env.DEMO_MODE === "true"
  });
});

app.use("/health", healthRoutes);
app.use("/api/v1/buses", busRoutes);
app.use("/api/v1/journey", journeyRoutes);
app.use("/api/v1/complaints", complaintRoutes);
app.use("/api/v1/tracking", trackingRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

registerSocketHandlers(io);

const PORT = Number(process.env.PORT || 5000);
server.listen(PORT, () => {
  console.log(`APSRTC SmartTrack backend running on http://localhost:${PORT}`);
});
