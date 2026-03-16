const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let contextPromise = null;
let context = null;

const MIGRATIONS = [
  (db) => {
    db.exec(`BEGIN;
      CREATE TABLE IF NOT EXISTS temp_companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        representative TEXT,
        biz_no TEXT,
        region TEXT,
        sipyung TEXT,
        performance3y TEXT,
        performance5y TEXT,
        debt_ratio TEXT,
        current_ratio TEXT,
        biz_years TEXT,
        credit_grade TEXT,
        women_owned TEXT,
        small_business TEXT,
        job_creation TEXT,
        quality_eval TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_temp_companies_name ON temp_companies(name);
      CREATE INDEX IF NOT EXISTS idx_temp_companies_biz_no ON temp_companies(biz_no);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_temp_companies_name_biz_no
      ON temp_companies(name, ifnull(biz_no, ''));
    COMMIT;`);
  },
  (db) => {
    try {
      const info = db.exec("PRAGMA table_info('temp_companies')");
      const columns = Array.isArray(info) && info.length > 0 && Array.isArray(info[0].values)
        ? info[0].values.map((row) => row?.[1]).filter(Boolean)
        : [];
      if (!columns.includes('industry')) {
        db.exec("ALTER TABLE temp_companies ADD COLUMN industry TEXT NOT NULL DEFAULT '';");
      }
      if (!columns.includes('manager_name')) {
        db.exec("ALTER TABLE temp_companies ADD COLUMN manager_name TEXT NOT NULL DEFAULT '';");
      }
    } catch (error) {
      console.error('[DB][temp-companies] Failed to ensure industry/manager_name columns:', error);
      throw error;
    }
  },
];

const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');

function getUserVersion(db) {
  const result = db.exec('PRAGMA user_version');
  if (!result || !result[0] || !result[0].values || !result[0].values.length) return 0;
  return Number(result[0].values[0][0]) || 0;
}

function setUserVersion(db, version) {
  db.exec(`PRAGMA user_version = ${version}`);
}

function runMigrations(db) {
  let current = getUserVersion(db);
  const target = MIGRATIONS.length;
  while (current < target) {
    const migration = MIGRATIONS[current];
    if (typeof migration === 'function') migration(db);
    current += 1;
    setUserVersion(db, current);
  }
}

function persistDatabase(db, targetPath) {
  const directory = path.dirname(targetPath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  const data = db.export();
  fs.writeFileSync(targetPath, Buffer.from(data));
}

async function ensureTempCompaniesDatabase({ userDataDir } = {}) {
  if (context) return context;
  if (!contextPromise) {
    contextPromise = (async () => {
      if (!userDataDir) throw new Error('userDataDir is required to initialize temp companies database.');
      const SQL = await initSqlJs({ locateFile: () => wasmPath });
      const databasePath = path.join(userDataDir, 'temp-companies.sqlite');
      let db;
      if (fs.existsSync(databasePath)) {
        const data = fs.readFileSync(databasePath);
        db = new SQL.Database(data);
      } else {
        db = new SQL.Database();
      }
      runMigrations(db);
      persistDatabase(db, databasePath);
      context = { SQL, db, path: databasePath, userDataDir };
      return context;
    })();
  }
  return contextPromise;
}

function getTempCompaniesDatabase() {
  if (!context) throw new Error('Temp companies database is not initialized.');
  return context.db;
}

function getTempCompaniesDatabasePath() {
  return context?.path || '';
}

function persistTempCompaniesDatabase() {
  if (!context || !context.db || !context.path) return;
  persistDatabase(context.db, context.path);
}

module.exports = {
  ensureTempCompaniesDatabase,
  getTempCompaniesDatabase,
  getTempCompaniesDatabasePath,
  persistTempCompaniesDatabase,
};
