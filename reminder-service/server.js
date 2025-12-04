import express from "express";
import helmet from "helmet";
import {dbPool} from "./db/pool.js";
import remindersRouter from "./routes/reminders.js"; 
import { requireAuth } from "./middlewares/auth.js";
import 'dotenv/config';

const app = express();
app.use(helmet());
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => res.send("ok"));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/readyz", async (_req, res) => {
  try { await dbPool.query("SELECT 1"); res.send("ready"); }
  catch (e) { res.status(503).send("not ready"); console.log(e)}
});
app.get("/allz", async (_req, res) => {
  try { const reminders = await dbPool.query("SELECT * FROM reminders.reminder_list"); res.status(200).json({ reminders })}
  catch (e) { res.status(503).send(e); console.log(e)}
});

// Root route
app.get("/", (_req, res) => res.send("API is running"));

// Actual
app.use("/reminder", /*requireAuth,*/ remindersRouter);

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error(err);
  logPgError(err, "Error: ");

  // Filter bubbled errors into specific messages
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: "ValidationError", details: err.message });
  }

  if (err.code === "23505") { // PostgreSQL unique violation
    return res.status(409).json({ error: "Conflict", details: "Email already exists" });
  }

  if (err.name === "UnauthorizedError") {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.status(500).json({ details: err.message });
});

function logPgError(e, ctx = "") {
  console.error(`error?: ${ctx}`);
  console.error("message:", e.message);
  console.error("code:", e.code);
  console.error("detail:", e.detail);
  console.error("hint:", e.hint);
  console.error("position:", e.position);
  console.error("where:", e.where);
  console.error("schema:", e.schema, "table:", e.table, "column:", e.column);
  console.error("stack:", e.stack);
}


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Service listening on :${PORT}`));