import Database from "better-sqlite3";

const db = new Database("SamplePortfolioDecisionMart.db");

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

console.log("--- Database Tables ---");
tables.forEach((table: any) => {
  console.log(`\nTable: ${table.name}`);
  try {
    const rows = db.prepare(`SELECT * FROM ${table.name} LIMIT 5`).all();
    console.table(rows);
  } catch (e) {
    console.log(`Could not read table ${table.name}`);
  }
});
