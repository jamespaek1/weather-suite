import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import queriesRouter from "./routes/queries.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: "1mb" }));

// Permissive CORS so the React frontend (or any client) can call the API.
app.use("/api", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "weather-suite-backend", time: new Date().toISOString() });
});

app.use("/api", queriesRouter);

// Static test UI (lets you exercise the API from a browser).
app.use(express.static(join(__dirname, "..", "public")));

// 404 for unmatched /api routes.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Central error handler — turns thrown errors into clean JSON.
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Weather Suite backend running at http://localhost:${PORT}`);
  console.log(`Test UI:    http://localhost:${PORT}/`);
  console.log(`API health: http://localhost:${PORT}/api/health`);
});
