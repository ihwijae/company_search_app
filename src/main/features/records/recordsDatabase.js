const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const defaults = require('./defaults.json');

let recordsInstance = null;

const MIGRATIONS = [
  (db) => {
    db.exec(`BEGIN;
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        alias TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        corporation_name TEXT NOT NULL,
        project_name TEXT NOT NULL,
        client_name TEXT,
        start_date TEXT,
        end_date TEXT,
        contract_amount INTEGER,
        scope_notes TEXT,
        primary_company_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (primary_company_id) REFERENCES companies(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS project_categories (
        project_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        PRIMARY KEY (project_id, category_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER,
        uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
      CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
      CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(primary_company_id);
      CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, end_date);
    COMMIT;`);
  }
];

function runMigrations(db) {
  let userVersion = db.pragma('user_version', { simple: true }) || 0;
  const targetVersion = MIGRATIONS.length;
  while (userVersion < targetVersion) {
    const migration = MIGRATIONS[userVersion];
    if (typeof migration === 'function') {
      migration(db);
    }
    userVersion += 1;
    db.pragma(`user_version = ${userVersion}`);
  }
}

function seedDefaults(db, seedConfig = defaults) {
  if (!seedConfig) return;
  const nowIso = new Date().toISOString();

  const getCategory = db.prepare('SELECT id, parent_id FROM categories WHERE name = ?');
  const insertCategory = db.prepare(`INSERT INTO categories (name, parent_id, active, sort_order, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)`);
  const updateCategoryParent = db.prepare('UPDATE categories SET parent_id = ?, updated_at = ? WHERE id = ?');

  const ensureCategory = (category, parentId = null, order = 0) => {
    if (!category || !category.name) return null;
    const existing = getCategory.get(category.name);
    if (existing) {
      if ((existing.parent_id || null) !== (parentId || null)) {
        updateCategoryParent.run(parentId, nowIso, existing.id);
      }
      return existing.id;
    }
    const info = insertCategory.run(category.name, parentId, order, nowIso, nowIso);
    return info.lastInsertRowid;
  };

  const walkCategories = (items, parentId = null) => {
    if (!Array.isArray(items)) return;
    items.forEach((cat, idx) => {
      const categoryId = ensureCategory(cat, parentId, idx);
      if (cat && Array.isArray(cat.children) && categoryId) {
        walkCategories(cat.children, categoryId);
      }
    });
  };

  walkCategories(seedConfig.categories);

  const getCompany = db.prepare('SELECT id FROM companies WHERE name = ?');
  const insertCompany = db.prepare(`INSERT INTO companies (name, alias, is_primary, active, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?, ?)`);

  if (Array.isArray(seedConfig.companies)) {
    seedConfig.companies.forEach((company, idx) => {
      if (!company || !company.name) return;
      const exists = getCompany.get(company.name);
      if (exists) return;
      insertCompany.run(
        company.name,
        company.alias || null,
        company.isPrimary ? 1 : 0,
        idx,
        nowIso,
        nowIso
      );
    });
  }
}

function ensureRecordsDatabase({ userDataDir } = {}) {
  if (recordsInstance) return recordsInstance;
  if (!userDataDir) throw new Error('userDataDir is required to initialize records database.');

  const databasePath = path.join(userDataDir, 'records.db');
  const directory = path.dirname(databasePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  seedDefaults(db);

  recordsInstance = { db, path: databasePath };
  return recordsInstance;
}

function getRecordsDatabase() {
  if (!recordsInstance) {
    throw new Error('Records database has not been initialized yet. Call ensureRecordsDatabase first.');
  }
  return recordsInstance.db;
}

function getRecordsDatabasePath() {
  if (!recordsInstance) return null;
  return recordsInstance.path;
}

module.exports = {
  ensureRecordsDatabase,
  getRecordsDatabase,
  getRecordsDatabasePath,
};
