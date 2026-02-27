import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = "SamplePortfolioDecisionMart.db";

// ---------- DB ----------
function initDb() {
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS Programs (
      Program_ID INTEGER PRIMARY KEY,
      Program_Name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Projects (
      Project_ID INTEGER PRIMARY KEY,
      Project_Name TEXT NOT NULL,
      Program_ID INTEGER
    );

    CREATE TABLE IF NOT EXISTS Benefit_Profiles (
      Project_ID INTEGER PRIMARY KEY,
      Planned_Benefit_Value REAL
    );

    CREATE TABLE IF NOT EXISTS Risk_Registers (
      Project_ID INTEGER PRIMARY KEY,
      Risk_Severity TEXT
    );

    CREATE TABLE IF NOT EXISTS Board_Decisions (
      decision_id TEXT PRIMARY KEY,
      initiative_id TEXT,
      composite_score REAL,
      decision_outcome TEXT,
      board_rationale TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

// ---------- SERVER ----------
async function startServer() {

  const app = express();
  const PORT = process.env.PORT || 3000;
  const db = initDb();

  app.use(express.json());

  // ----------- CLOUD RUN CORS FIX -----------
app.use((req, res, next) => {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  next();
});

// ⭐ THIS handles the preflight request AI Studio sends
app.options("/api/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  return res.status(204).end();
});
  // ---------- API ----------
  app.post("/api/queryPortfolio", (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT 
          pr.Project_ID as project_id,
          pr.Project_Name as project_name,
          bp.Planned_Benefit_Value as planned_benefit_value,
          rr.Risk_Severity as risk_severity
        FROM Projects pr
        JOIN Benefit_Profiles bp ON pr.Project_ID = bp.Project_ID
        JOIN Risk_Registers rr ON pr.Project_ID = rr.Project_ID
        LIMIT 100
      `).all();
      res.json(rows);
    } catch (e:any) {
      res.status(500).json({error:e.message});
    }
  });

  app.post("/api/writeBoardDecision", (req, res) => {
    try {
      const { decision_id, initiative_id, composite_score, decision_outcome, board_rationale } = req.body;
      db.prepare(`
        INSERT INTO Board_Decisions 
        (decision_id, initiative_id, composite_score, decision_outcome, board_rationale)
        VALUES (?, ?, ?, ?, ?)
      `).run(decision_id, initiative_id, composite_score, decision_outcome, board_rationale);
      res.json({status:"saved"});
    } catch (e:any) {
      res.status(500).json({error:e.message});
    }
  });

  app.post("/api/getBoardDecisions", (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT * FROM Board_Decisions
        ORDER BY timestamp DESC
      `).all();
      res.json(rows);
    } catch (e:any) {
      res.status(500).json({error:e.message});
    }
  });

  // ---------- PROXY ----------
  app.post("/api/proxy/:route", (req, res, next) => {
    req.url = "/api/" + req.params.route;
    next();
  });

  // ---------- VITE ----------
  if (process.env.NODE_ENV !== "production") {

    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);

  } else {

    app.use(express.static(path.join(__dirname, "dist")));

    // 🚨 DO NOT hijack API routes
    app.get("*", (req, res) => {

      if (req.path.startsWith("/api")) {
        return res.status(404).json({ error: "API route not found" });
      }

      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

}

startServer();
