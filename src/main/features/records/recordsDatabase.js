const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const defaults = require('./defaults.json');

let contextPromise = null;
let context = null;

const MIGRATIONS = [
  (db) => {
    db.exec(`BEGIN;
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        alias TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        is_misc INTEGER NOT NULL DEFAULT 0,
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
  },
  (db) => {
    try {
      const info = db.exec("PRAGMA table_info('companies')");
      const hasColumn = Array.isArray(info) && info.length > 0 && Array.isArray(info[0].values)
        && info[0].values.some((row) => row && row.length > 1 && row[1] === 'is_misc');
      if (!hasColumn) {
        db.exec("ALTER TABLE companies ADD COLUMN is_misc INTEGER NOT NULL DEFAULT 0;");
      }
    } catch (error) {
      console.error('[DB][records] Failed to ensure companies.is_misc column:', error);
      throw error;
    }
  },
  (db) => {
    try {
      const indexInfo = db.exec("PRAGMA index_list('attachments')");
      const hasUniqueProjectIndex = Array.isArray(indexInfo) && indexInfo.length > 0 && Array.isArray(indexInfo[0].values)
        && indexInfo[0].values.some((row) => row && row[1] === 'sqlite_autoindex_attachments_1');
      if (!hasUniqueProjectIndex) return;
      db.exec(`BEGIN;
        ALTER TABLE attachments RENAME TO attachments_legacy;
        CREATE TABLE attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          display_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          mime_type TEXT,
          file_size INTEGER,
          uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        INSERT INTO attachments (id, project_id, display_name, file_path, mime_type, file_size, uploaded_at)
        SELECT id, project_id, display_name, file_path, mime_type, file_size, uploaded_at
        FROM attachments_legacy;
        DROP TABLE attachments_legacy;
        CREATE INDEX IF NOT EXISTS idx_attachments_project ON attachments(project_id);
      COMMIT;`);
    } catch (error) {
      console.error('[DB][records] Failed to migrate attachments table to multi-file:', error);
      throw error;
    }
  },
  (db) => {
    try {
      db.exec(`BEGIN;
        UPDATE categories
        SET parent_id = NULL,
            updated_at = datetime('now')
        WHERE parent_id IS NOT NULL
          AND parent_id NOT IN (SELECT id FROM categories);
      COMMIT;`);
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      console.error('[DB][records] Failed to normalize invalid category parents:', error);
      throw error;
    }
  },
  (db) => {
    try {
      const groupResult = db.exec(`
        SELECT DISTINCT parent_id
        FROM categories
        ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, parent_id
      `);
      const parentValues = Array.isArray(groupResult) && groupResult[0] && Array.isArray(groupResult[0].values)
        ? groupResult[0].values
        : [];
      const updateStmt = db.prepare('UPDATE categories SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ?');

      db.exec('BEGIN');
      parentValues.forEach(([parentId]) => {
        const sql = parentId === null
          ? 'SELECT id FROM categories WHERE parent_id IS NULL ORDER BY sort_order, name, id'
          : 'SELECT id FROM categories WHERE parent_id = ? ORDER BY sort_order, name, id';
        const stmt = db.prepare(sql);
        if (parentId !== null) stmt.bind([parentId]);
        let nextOrder = 0;
        while (stmt.step()) {
          const row = stmt.getAsObject();
          updateStmt.bind([nextOrder, row.id]);
          updateStmt.step();
          updateStmt.reset();
          nextOrder += 1;
        }
        stmt.free();
      });
      db.exec('COMMIT');
      updateStmt.free();
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      console.error('[DB][records] Failed to normalize category sort order:', error);
      throw error;
    }
  }
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

function getMetaValue(db, key) {
  const stmt = db.prepare('SELECT value FROM meta WHERE key = ?');
  stmt.bind([key]);
  const value = stmt.step() ? stmt.getAsObject().value : null;
  stmt.free();
  return value;
}

function setMetaValue(db, key, value) {
  const stmt = db.prepare(`INSERT INTO meta (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`);
  stmt.bind([key, String(value)]);
  stmt.step();
  stmt.free();
}

function runMigrations(db) {
  let current = getUserVersion(db);
  const target = MIGRATIONS.length;
  while (current < target) {
    const migration = MIGRATIONS[current];
    if (typeof migration === 'function') {
      migration(db);
    }
    current += 1;
    setUserVersion(db, current);
  }
}

function prepare(db, sql) {
  const stmt = db.prepare(sql);
  return stmt;
}

function seedDefaults(db, seedConfig = defaults) {
  if (!seedConfig) return false;
  let mutated = false;
  const nowIso = new Date().toISOString();

  const getCategory = prepare(db, 'SELECT id, parent_id FROM categories WHERE name = ?');
  const insertCategory = prepare(db, `INSERT INTO categories (name, parent_id, active, sort_order, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?, ?)`);
  const updateCategoryParent = prepare(db, 'UPDATE categories SET parent_id = ?, updated_at = ? WHERE id = ?');

  const ensureCategory = (category, parentId = null, order = 0) => {
    if (!category || !category.name) return null;
    getCategory.bind([category.name]);
    const hasExisting = getCategory.step();
    if (hasExisting) {
      const existing = getCategory.getAsObject();
      if ((existing.parent_id || null) !== (parentId || null)) {
        updateCategoryParent.bind([parentId, nowIso, existing.id]);
        updateCategoryParent.step();
        updateCategoryParent.reset();
        mutated = true;
      }
      getCategory.reset();
      return existing.id;
    }
    getCategory.reset();
    insertCategory.bind([category.name, parentId, order, nowIso, nowIso]);
    insertCategory.step();
    insertCategory.reset();
    mutated = true;
    const row = db.exec('SELECT last_insert_rowid() AS id');
    if (row && row[0] && row[0].values.length) {
      return Number(row[0].values[0][0]) || null;
    }
    return null;
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

  db.exec('BEGIN');
  try {
    walkCategories(seedConfig.categories);

    if (Array.isArray(seedConfig.companies)) {
      const getCompany = prepare(db, 'SELECT id FROM companies WHERE name = ?');
      const insertCompany = prepare(db, `INSERT INTO companies (name, alias, is_primary, is_misc, active, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)`);
      seedConfig.companies.forEach((company, idx) => {
        if (!company || !company.name) return;
        getCompany.bind([company.name]);
        const exists = getCompany.step();
        getCompany.reset();
        if (exists) return;
        insertCompany.bind([
          company.name,
          company.alias || null,
          company.isPrimary ? 1 : 0,
          company.isMisc ? 1 : 0,
          idx,
          nowIso,
          nowIso,
        ]);
        insertCompany.step();
        insertCompany.reset();
        mutated = true;
      });
      insertCompany.free();
      getCompany.free();
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    getCategory.free();
    insertCategory.free();
    updateCategoryParent.free();
  }

  return mutated;
}

function persistDatabase(db, targetPath) {
  const directory = path.dirname(targetPath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  const data = db.export();
  fs.writeFileSync(targetPath, Buffer.from(data));
}

async function ensureRecordsDatabase({ userDataDir } = {}) {
  if (context) return context;
  if (!contextPromise) {
    contextPromise = (async () => {
      if (!userDataDir) throw new Error('userDataDir is required to initialize records database.');

      const SQL = await initSqlJs({
        locateFile: (file) => (file === 'sql-wasm.wasm' ? wasmPath : file),
      });

      const databasePath = path.join(userDataDir, 'records.sqlite');
      const hasExistingFile = fs.existsSync(databasePath);
      const fileBuffer = hasExistingFile ? fs.readFileSync(databasePath) : null;
      const db = fileBuffer && fileBuffer.length ? new SQL.Database(fileBuffer) : new SQL.Database();

      runMigrations(db);
      const hasSeedMarker = getMetaValue(db, 'defaults_seeded') === '1';
      let mutated = false;

      // Seed defaults only for a brand-new database. Existing/imported user DBs win as-is.
      if (!hasExistingFile && !hasSeedMarker) {
        mutated = seedDefaults(db) || mutated;
        setMetaValue(db, 'defaults_seeded', '1');
        mutated = true;
      } else if (!hasSeedMarker) {
        setMetaValue(db, 'defaults_seeded', '1');
        mutated = true;
      }

      if (!hasExistingFile || mutated) {
        persistDatabase(db, databasePath);
      }

      context = {
        db,
        path: databasePath,
        save: () => persistDatabase(db, databasePath),
      };
      return context;
    })();
  }
  return contextPromise;
}

function getRecordsDatabase() {
  if (!context) {
    throw new Error('Records database has not been initialized yet. Call ensureRecordsDatabase first.');
  }
  return context.db;
}

function getRecordsDatabasePath() {
  if (!context) return null;
  return context.path;
}

function persistRecordsDatabase() {
  if (!context) return;
  persistDatabase(context.db, context.path);
}

function disposeRecordsDatabase() {
  if (context && context.db) {
    try { context.db.close(); } catch (error) {
      console.error('[MAIN][records] Failed to close records database:', error);
    }
  }
  context = null;
  contextPromise = null;
}

async function resetRecordsDatabase({ userDataDir } = {}) {
  if (!userDataDir) {
    throw new Error('userDataDir is required to reset records database.');
  }
  disposeRecordsDatabase();
  return ensureRecordsDatabase({ userDataDir });
}

module.exports = {
  ensureRecordsDatabase,
  getRecordsDatabase,
  getRecordsDatabasePath,
  persistRecordsDatabase,
  resetRecordsDatabase,
};
