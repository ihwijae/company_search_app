const { getRecordsDatabase } = require('./recordsDatabase.js');

function rowsFromStatement(stmt) {
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function getScalar(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const value = stmt.step() ? Object.values(stmt.getAsObject())[0] : undefined;
  stmt.free();
  return value;
}

function toBoolean(value) {
  return value ? true : false;
}

class RecordsRepository {
  constructor() {
    this.db = getRecordsDatabase();
  }

  refreshDb() {
    this.db = getRecordsDatabase();
  }

  listCompanies({ includeInactive = false } = {}) {
    this.refreshDb();
    const sql = includeInactive
      ? 'SELECT * FROM companies ORDER BY sort_order, name'
      : 'SELECT * FROM companies WHERE active = 1 ORDER BY sort_order, name';
    const stmt = this.db.prepare(sql);
    const rows = rowsFromStatement(stmt);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      alias: row.alias,
      isPrimary: toBoolean(row.is_primary),
      active: toBoolean(row.active),
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getCompanyById(id) {
    this.refreshDb();
    const stmt = this.db.prepare('SELECT * FROM companies WHERE id = ?');
    stmt.bind([id]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      alias: row.alias,
      isPrimary: toBoolean(row.is_primary),
      active: toBoolean(row.active),
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  upsertCompany(payload) {
    this.refreshDb();
    const db = this.db;
    if (payload.id) {
      const stmt = db.prepare(`UPDATE companies SET
        name = ?,
        alias = ?,
        is_primary = ?,
        active = ?,
        sort_order = ?,
        updated_at = datetime('now')
      WHERE id = ?`);
      const sortOrder = Number.isFinite(payload.sortOrder)
        ? payload.sortOrder
        : this.getCompanyById(payload.id)?.sortOrder ?? getScalar(db, 'SELECT IFNULL(MAX(sort_order), -1) + 1 FROM companies');
      stmt.bind([
        payload.name,
        payload.alias || null,
        payload.isPrimary ? 1 : 0,
        payload.active === false ? 0 : 1,
        sortOrder,
        payload.id,
      ]);
      stmt.step();
      stmt.free();
      const changes = getScalar(db, 'SELECT changes()');
      return changes > 0 ? payload.id : null;
    }

    const nextOrder = Number.isFinite(payload.sortOrder)
      ? payload.sortOrder
      : getScalar(db, 'SELECT IFNULL(MAX(sort_order), -1) + 1 FROM companies');
    const stmt = db.prepare(`INSERT INTO companies (name, alias, is_primary, active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`);
    stmt.bind([
      payload.name,
      payload.alias || null,
      payload.isPrimary ? 1 : 0,
      payload.active === false ? 0 : 1,
      nextOrder,
    ]);
    stmt.step();
    stmt.free();
    const rowId = Number(getScalar(db, 'SELECT last_insert_rowid()'));
    return Number.isFinite(rowId) ? rowId : null;
  }

  deleteCompany(id) {
    this.refreshDb();
    const stmt = this.db.prepare('DELETE FROM companies WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    stmt.free();
    return getScalar(this.db, 'SELECT changes()') > 0;
  }

  listCategories({ includeInactive = false } = {}) {
    this.refreshDb();
    const sql = includeInactive
      ? 'SELECT * FROM categories ORDER BY sort_order, name'
      : 'SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, name';
    const stmt = this.db.prepare(sql);
    const rows = rowsFromStatement(stmt);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      active: toBoolean(row.active),
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getCategoryById(id) {
    this.refreshDb();
    const stmt = this.db.prepare('SELECT * FROM categories WHERE id = ?');
    stmt.bind([id]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      active: toBoolean(row.active),
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  upsertCategory(payload) {
    this.refreshDb();
    const db = this.db;
    const parentId = Number.isInteger(payload.parentId) ? payload.parentId : null;
    const computeNextOrder = () => {
      if (Number.isFinite(payload.sortOrder)) return payload.sortOrder;
      const sql = parentId === null
        ? 'SELECT IFNULL(MAX(sort_order), -1) + 1 FROM categories WHERE parent_id IS NULL'
        : 'SELECT IFNULL(MAX(sort_order), -1) + 1 FROM categories WHERE parent_id = ?';
      return parentId === null ? getScalar(db, sql) : getScalar(db, sql, [parentId]);
    };

    if (payload.id) {
      const sortOrder = computeNextOrder();
      const stmt = db.prepare(`UPDATE categories SET
        name = ?,
        parent_id = ?,
        active = ?,
        sort_order = ?,
        updated_at = datetime('now')
      WHERE id = ?`);
      stmt.bind([
        payload.name,
        parentId,
        payload.active === false ? 0 : 1,
        sortOrder,
        payload.id,
      ]);
      stmt.step();
      stmt.free();
      const changes = getScalar(db, 'SELECT changes()');
      return changes > 0 ? payload.id : null;
    }

    const sortOrder = computeNextOrder();
    const stmt = db.prepare(`INSERT INTO categories (name, parent_id, active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`);
    stmt.bind([
      payload.name,
      parentId,
      payload.active === false ? 0 : 1,
      sortOrder,
    ]);
    stmt.step();
    stmt.free();
    const rowId = Number(getScalar(db, 'SELECT last_insert_rowid()'));
    return Number.isFinite(rowId) ? rowId : null;
  }

  deleteCategory(id) {
    this.refreshDb();
    const stmt = this.db.prepare('DELETE FROM categories WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    stmt.free();
    return getScalar(this.db, 'SELECT changes()') > 0;
  }

  insertProject(project, categoryIds = []) {
    this.refreshDb();
    const db = this.db;
    db.exec('BEGIN');
    try {
      const stmt = db.prepare(`INSERT INTO projects (
        corporation_name, project_name, client_name, start_date, end_date, contract_amount,
        scope_notes, primary_company_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`);
      stmt.bind([
        project.corporationName,
        project.projectName,
        project.clientName || null,
        project.startDate || null,
        project.endDate || null,
        project.contractAmount || null,
        project.scopeNotes || null,
        project.primaryCompanyId || null,
      ]);
      stmt.step();
      stmt.free();

      const projectId = Number(getScalar(db, 'SELECT last_insert_rowid()'));
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        const catStmt = db.prepare('INSERT OR IGNORE INTO project_categories (project_id, category_id) VALUES (?, ?)');
        categoryIds.forEach((cid) => {
          catStmt.bind([projectId, cid]);
          catStmt.step();
          catStmt.reset();
        });
        catStmt.free();
      }

      db.exec('COMMIT');
      return projectId;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  updateProject(projectId, project, categoryIds = []) {
    this.refreshDb();
    const db = this.db;
    db.exec('BEGIN');
    try {
      const stmt = db.prepare(`UPDATE projects SET
        corporation_name = ?,
        project_name = ?,
        client_name = ?,
        start_date = ?,
        end_date = ?,
        contract_amount = ?,
        scope_notes = ?,
        primary_company_id = ?,
        updated_at = datetime('now')
      WHERE id = ?`);
      stmt.bind([
        project.corporationName,
        project.projectName,
        project.clientName || null,
        project.startDate || null,
        project.endDate || null,
        project.contractAmount || null,
        project.scopeNotes || null,
        project.primaryCompanyId || null,
        projectId,
      ]);
      stmt.step();
      stmt.free();

      const deleteStmt = db.prepare('DELETE FROM project_categories WHERE project_id = ?');
      deleteStmt.bind([projectId]);
      deleteStmt.step();
      deleteStmt.free();

      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        const catStmt = db.prepare('INSERT OR IGNORE INTO project_categories (project_id, category_id) VALUES (?, ?)');
        categoryIds.forEach((cid) => {
          catStmt.bind([projectId, cid]);
          catStmt.step();
          catStmt.reset();
        });
        catStmt.free();
      }

      db.exec('COMMIT');
      return true;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  deleteProject(projectId) {
    this.refreshDb();
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.bind([projectId]);
    stmt.step();
    stmt.free();
    return getScalar(this.db, 'SELECT changes()') > 0;
  }

  upsertAttachment(projectId, attachment) {
    this.refreshDb();
    const stmt = this.db.prepare(`INSERT INTO attachments (project_id, display_name, file_path, mime_type, file_size, uploaded_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(project_id) DO UPDATE SET
        display_name = excluded.display_name,
        file_path = excluded.file_path,
        mime_type = excluded.mime_type,
        file_size = excluded.file_size,
        uploaded_at = datetime('now')`);
    stmt.bind([
      projectId,
      attachment.displayName,
      attachment.filePath,
      attachment.mimeType || null,
      attachment.fileSize || null,
    ]);
    stmt.step();
    stmt.free();
    return true;
  }

  deleteAttachment(projectId) {
    this.refreshDb();
    const stmt = this.db.prepare('DELETE FROM attachments WHERE project_id = ?');
    stmt.bind([projectId]);
    stmt.step();
    stmt.free();
    return getScalar(this.db, 'SELECT changes()') > 0;
  }

  getAttachmentPath(projectId) {
    this.refreshDb();
    const stmt = this.db.prepare('SELECT file_path FROM attachments WHERE project_id = ?');
    stmt.bind([projectId]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row ? row.file_path : null;
  }

  listAttachmentRecords() {
    this.refreshDb();
    const stmt = this.db.prepare('SELECT project_id, file_path FROM attachments');
    const rows = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push({ projectId: row.project_id, filePath: row.file_path });
    }
    stmt.free();
    return rows;
  }

  updateAttachmentPath(projectId, filePath) {
    this.refreshDb();
    const stmt = this.db.prepare('UPDATE attachments SET file_path = ?, uploaded_at = datetime(\'now\') WHERE project_id = ?');
    stmt.bind([filePath, projectId]);
    stmt.step();
    stmt.free();
    return getScalar(this.db, 'SELECT changes()') > 0;
  }

  getProjectById(projectId) {
    this.refreshDb();
    const db = this.db;
    const stmt = db.prepare(`SELECT p.*, c.name AS primary_company_name
      FROM projects p
      LEFT JOIN companies c ON c.id = p.primary_company_id
      WHERE p.id = ?`);
    stmt.bind([projectId]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    if (!row) return null;

    const categories = [];
    const catStmt = db.prepare(`SELECT pc.project_id, cat.id, cat.name
      FROM project_categories pc
      JOIN categories cat ON cat.id = pc.category_id
      WHERE pc.project_id = ?
      ORDER BY cat.sort_order, cat.name`);
    catStmt.bind([projectId]);
    while (catStmt.step()) {
      const cat = catStmt.getAsObject();
      categories.push({ id: cat.id, name: cat.name });
    }
    catStmt.free();

    const attachmentStmt = db.prepare(`SELECT display_name, file_path, mime_type, file_size, uploaded_at
      FROM attachments WHERE project_id = ?`);
    attachmentStmt.bind([projectId]);
    const attachmentRow = attachmentStmt.step() ? attachmentStmt.getAsObject() : null;
    attachmentStmt.free();

    return {
      id: row.id,
      corporationName: row.corporation_name,
      projectName: row.project_name,
      clientName: row.client_name,
      startDate: row.start_date,
      endDate: row.end_date,
      contractAmount: row.contract_amount === null || row.contract_amount === undefined
        ? null
        : Number(row.contract_amount),
      scopeNotes: row.scope_notes,
      primaryCompanyId: row.primary_company_id,
      primaryCompanyName: row.primary_company_name,
      categories,
      attachment: attachmentRow ? {
        displayName: attachmentRow.display_name,
        filePath: attachmentRow.file_path,
        mimeType: attachmentRow.mime_type,
        fileSize: attachmentRow.file_size,
        uploadedAt: attachmentRow.uploaded_at,
      } : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listProjects(filters = {}) {
    this.refreshDb();
    const db = this.db;
    const whereParts = [];
    const bindings = [];

    if (filters.keyword) {
      const keyword = `%${filters.keyword.trim()}%`;
      whereParts.push('(p.project_name LIKE ? OR p.client_name LIKE ? OR p.corporation_name LIKE ?)');
      bindings.push(keyword, keyword, keyword);
    }

    if (Array.isArray(filters.companyIds) && filters.companyIds.length > 0) {
      const placeholders = filters.companyIds.map(() => '?').join(', ');
      whereParts.push(`p.primary_company_id IN (${placeholders})`);
      bindings.push(...filters.companyIds);
    }

    if (Array.isArray(filters.categoryIds) && filters.categoryIds.length > 0) {
      const placeholders = filters.categoryIds.map(() => '?').join(', ');
      whereParts.push(`EXISTS (SELECT 1 FROM project_categories pc WHERE pc.project_id = p.id AND pc.category_id IN (${placeholders}))`);
      bindings.push(...filters.categoryIds);
    }

    if (filters.startDateFrom) {
      whereParts.push('p.start_date >= ?');
      bindings.push(filters.startDateFrom);
    }

    if (filters.startDateTo) {
      whereParts.push('p.start_date <= ?');
      bindings.push(filters.startDateTo);
    }

    let sql = `SELECT p.*, c.name AS primary_company_name
      FROM projects p
      LEFT JOIN companies c ON c.id = p.primary_company_id`;
    if (whereParts.length > 0) {
      sql += ` WHERE ${whereParts.join(' AND ')}`;
    }
    sql += ' ORDER BY (p.start_date IS NULL), p.start_date DESC, p.created_at DESC';

    const stmt = db.prepare(sql);
    stmt.bind(bindings);
    const rows = rowsFromStatement(stmt);

    const projects = rows.map((row) => ({
      id: row.id,
      corporationName: row.corporation_name,
      projectName: row.project_name,
      clientName: row.client_name,
      startDate: row.start_date,
      endDate: row.end_date,
      contractAmount: row.contract_amount === null || row.contract_amount === undefined
        ? null
        : Number(row.contract_amount),
      scopeNotes: row.scope_notes,
      primaryCompanyId: row.primary_company_id,
      primaryCompanyName: row.primary_company_name,
      categories: [],
      attachment: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    if (!projects.length) return projects;

    const projectMap = new Map(projects.map((item) => [item.id, item]));

    const catStmt = db.prepare(`SELECT pc.project_id, cat.id AS cat_id, cat.name AS cat_name, cat.sort_order
      FROM project_categories pc
      JOIN categories cat ON cat.id = pc.category_id
      ORDER BY cat.sort_order, cat.name`);
    while (catStmt.step()) {
      const row = catStmt.getAsObject();
      const project = projectMap.get(row.project_id);
      if (project) {
        project.categories.push({ id: row.cat_id, name: row.cat_name });
      }
    }
    catStmt.free();

    const attachmentStmt = db.prepare(`SELECT project_id, display_name, file_path, mime_type, file_size, uploaded_at FROM attachments`);
    while (attachmentStmt.step()) {
      const row = attachmentStmt.getAsObject();
      const project = projectMap.get(row.project_id);
      if (project) {
        project.attachment = {
          displayName: row.display_name,
          filePath: row.file_path,
          mimeType: row.mime_type,
          fileSize: row.file_size,
          uploadedAt: row.uploaded_at,
        };
      }
    }
    attachmentStmt.free();

    return projects;
  }
}

module.exports = {
  RecordsRepository,
};
