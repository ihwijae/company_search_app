const { getRecordsDatabase } = require('./recordsDatabase');

function mapProjectRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    corporationName: row.corporation_name,
    projectName: row.project_name,
    clientName: row.client_name,
    startDate: row.start_date,
    endDate: row.end_date,
    contractAmount: row.contract_amount,
    scopeNotes: row.scope_notes,
    primaryCompanyId: row.primary_company_id,
    attachment: row.attachment_path ? {
      displayName: row.attachment_display_name,
      filePath: row.attachment_path,
      mimeType: row.attachment_mime_type,
      fileSize: row.attachment_size,
      uploadedAt: row.attachment_uploaded_at,
    } : null,
    categories: Array.isArray(row.categories) ? row.categories : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class RecordsRepository {
  constructor() {
    this.db = getRecordsDatabase();
    this.statements = {
      companies: {
        listActive: this.db.prepare('SELECT * FROM companies WHERE active = 1 ORDER BY sort_order, name'),
        listAll: this.db.prepare('SELECT * FROM companies ORDER BY sort_order, name'),
        byId: this.db.prepare('SELECT * FROM companies WHERE id = ?'),
        insert: this.db.prepare(`INSERT INTO companies (name, alias, is_primary, active, sort_order)
          VALUES (:name, :alias, :is_primary, :active, :sort_order)`),
        update: this.db.prepare(`UPDATE companies SET
          name=:name,
          alias=:alias,
          is_primary=:is_primary,
          active=:active,
          sort_order=:sort_order,
          updated_at=datetime('now')
        WHERE id = :id`),
        delete: this.db.prepare('DELETE FROM companies WHERE id = ?'),
      },
      categories: {
        listActive: this.db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, name'),
        listAll: this.db.prepare('SELECT * FROM categories ORDER BY sort_order, name'),
        byId: this.db.prepare('SELECT * FROM categories WHERE id = ?'),
        insert: this.db.prepare(`INSERT INTO categories (name, parent_id, active, sort_order)
          VALUES (:name, :parent_id, :active, :sort_order)`),
        update: this.db.prepare(`UPDATE categories SET
          name=:name,
          parent_id=:parent_id,
          active=:active,
          sort_order=:sort_order,
          updated_at=datetime('now')
        WHERE id = :id`),
        delete: this.db.prepare('DELETE FROM categories WHERE id = ?'),
      },
    };

    this.helpers = {
      nextCompanySortOrder: this.db.prepare('SELECT IFNULL(MAX(sort_order), -1) + 1 AS next_order FROM companies'),
      nextRootCategorySortOrder: this.db.prepare('SELECT IFNULL(MAX(sort_order), -1) + 1 AS next_order FROM categories WHERE parent_id IS NULL'),
      nextChildCategorySortOrder: this.db.prepare('SELECT IFNULL(MAX(sort_order), -1) + 1 AS next_order FROM categories WHERE parent_id = ?'),
    };

    this.projectStatements = {
      insertProject: this.db.prepare(`INSERT INTO projects (
        corporation_name, project_name, client_name, start_date, end_date, contract_amount,
        scope_notes, primary_company_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
      updateProject: this.db.prepare(`UPDATE projects SET
        corporation_name=?,
        project_name=?,
        client_name=?,
        start_date=?,
        end_date=?,
        contract_amount=?,
        scope_notes=?,
        primary_company_id=?,
        updated_at=datetime('now')
      WHERE id = ?`),
      deleteProject: this.db.prepare('DELETE FROM projects WHERE id = ?'),
      insertProjectCategory: this.db.prepare('INSERT INTO project_categories (project_id, category_id) VALUES (?, ?) ON CONFLICT DO NOTHING'),
      deleteProjectCategories: this.db.prepare('DELETE FROM project_categories WHERE project_id = ?'),
      upsertAttachment: this.db.prepare(`INSERT INTO attachments (
        project_id, display_name, file_path, mime_type, file_size, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(project_id) DO UPDATE SET
        display_name=excluded.display_name,
        file_path=excluded.file_path,
        mime_type=excluded.mime_type,
        file_size=excluded.file_size,
        uploaded_at=datetime('now')`),
      deleteAttachment: this.db.prepare('DELETE FROM attachments WHERE project_id = ?'),
      getAttachmentPath: this.db.prepare('SELECT file_path FROM attachments WHERE project_id = ?'),
    };

    this.projectQueries = {
      getById: this.db.prepare(`SELECT p.*, a.display_name AS attachment_display_name, a.file_path AS attachment_path,
        a.mime_type AS attachment_mime_type, a.file_size AS attachment_size, a.uploaded_at AS attachment_uploaded_at,
        (SELECT json_group_array(category_id) FROM project_categories WHERE project_id = p.id) AS categories
      FROM projects p
      LEFT JOIN attachments a ON a.project_id = p.id
      WHERE p.id = ?`),
      listBase: `SELECT p.*, c.name AS primary_company_name,
        coalesce((SELECT json_group_array(json_object('id', cat.id, 'name', cat.name))
          FROM project_categories pc
          JOIN categories cat ON cat.id = pc.category_id
          WHERE pc.project_id = p.id
        ), '[]') AS categories_json,
        a.display_name AS attachment_display_name,
        a.file_path AS attachment_path,
        a.mime_type AS attachment_mime_type,
        a.file_size AS attachment_size,
        a.uploaded_at AS attachment_uploaded_at
      FROM projects p
      LEFT JOIN companies c ON c.id = p.primary_company_id
      LEFT JOIN attachments a ON a.project_id = p.id`,
    };
  }

  listCompanies({ includeInactive = false } = {}) {
    const stmt = includeInactive ? this.statements.companies.listAll : this.statements.companies.listActive;
    return stmt.all().map((row) => ({
      id: row.id,
      name: row.name,
      alias: row.alias,
      isPrimary: !!row.is_primary,
      active: !!row.active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getCompanyById(id) {
    const row = this.statements.companies.byId.get(id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      alias: row.alias,
      isPrimary: !!row.is_primary,
      active: !!row.active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  upsertCompany(payload) {
    let sortOrder = Number.isFinite(payload.sortOrder) ? payload.sortOrder : null;
    if (payload.id) {
      if (sortOrder === null) {
        const existing = this.statements.companies.byId.get(payload.id);
        sortOrder = existing ? existing.sort_order : this.helpers.nextCompanySortOrder.get().next_order;
      }
      const result = this.statements.companies.update.run({
        id: payload.id,
        name: payload.name,
        alias: payload.alias || null,
        is_primary: payload.isPrimary ? 1 : 0,
        active: payload.active === false ? 0 : 1,
        sort_order: sortOrder,
      });
      return result.changes > 0 ? payload.id : null;
    }
    if (sortOrder === null) {
      sortOrder = this.helpers.nextCompanySortOrder.get().next_order;
    }
    const result = this.statements.companies.insert.run({
      name: payload.name,
      alias: payload.alias || null,
      is_primary: payload.isPrimary ? 1 : 0,
      active: payload.active === false ? 0 : 1,
      sort_order: sortOrder,
    });
    return result.lastInsertRowid;
  }

  deleteCompany(id) {
    return this.statements.companies.delete.run(id).changes > 0;
  }

  listCategories({ includeInactive = false } = {}) {
    const stmt = includeInactive ? this.statements.categories.listAll : this.statements.categories.listActive;
    return stmt.all().map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      active: !!row.active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getCategoryById(id) {
    const row = this.statements.categories.byId.get(id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      active: !!row.active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  upsertCategory(payload) {
    const parentId = Number.isInteger(payload.parentId) ? payload.parentId : null;
    let sortOrder = Number.isFinite(payload.sortOrder) ? payload.sortOrder : null;
    if (payload.id) {
      if (sortOrder === null) {
        const existing = this.statements.categories.byId.get(payload.id);
        if (existing) {
          sortOrder = existing.sort_order;
        } else if (parentId === null) {
          sortOrder = this.helpers.nextRootCategorySortOrder.get().next_order;
        } else {
          sortOrder = this.helpers.nextChildCategorySortOrder.get(parentId).next_order;
        }
      }
      const result = this.statements.categories.update.run({
        id: payload.id,
        name: payload.name,
        parent_id: parentId,
        active: payload.active === false ? 0 : 1,
        sort_order: sortOrder,
      });
      return result.changes > 0 ? payload.id : null;
    }
    if (sortOrder === null) {
      sortOrder = parentId === null
        ? this.helpers.nextRootCategorySortOrder.get().next_order
        : this.helpers.nextChildCategorySortOrder.get(parentId).next_order;
    }
    const result = this.statements.categories.insert.run({
      name: payload.name,
      parent_id: parentId,
      active: payload.active === false ? 0 : 1,
      sort_order: sortOrder,
    });
    return result.lastInsertRowid;
  }

  deleteCategory(id) {
    return this.statements.categories.delete.run(id).changes > 0;
  }

  insertProject(project, categoryIds = []) {
    const run = this.db.transaction((proj, cats) => {
      const normalizedAmount = project.contractAmount !== undefined && project.contractAmount !== null
        ? Number(project.contractAmount)
        : null;
      const info = this.projectStatements.insertProject.run(
        proj.corporationName,
        proj.projectName,
        proj.clientName || null,
        proj.startDate || null,
        proj.endDate || null,
        Number.isFinite(normalizedAmount) ? normalizedAmount : null,
        proj.scopeNotes || null,
        proj.primaryCompanyId || null
      );
      const projectId = info.lastInsertRowid;
      if (Array.isArray(cats)) {
        cats.forEach((cid) => {
          this.projectStatements.insertProjectCategory.run(projectId, cid);
        });
      }
      return projectId;
    });
    return run(project, categoryIds);
  }

  updateProject(projectId, project, categoryIds = []) {
    const run = this.db.transaction((pid, proj, cats) => {
      const normalizedAmount = project.contractAmount !== undefined && project.contractAmount !== null
        ? Number(project.contractAmount)
        : null;
      const result = this.projectStatements.updateProject.run(
        proj.corporationName,
        proj.projectName,
        proj.clientName || null,
        proj.startDate || null,
        proj.endDate || null,
        Number.isFinite(normalizedAmount) ? normalizedAmount : null,
        proj.scopeNotes || null,
        proj.primaryCompanyId || null,
        pid
      );
      this.projectStatements.deleteProjectCategories.run(pid);
      if (Array.isArray(cats)) {
        cats.forEach((cid) => {
          this.projectStatements.insertProjectCategory.run(pid, cid);
        });
      }
      return result.changes > 0;
    });
    return run(projectId, project, categoryIds);
  }

  deleteProject(projectId) {
    return this.projectStatements.deleteProject.run(projectId).changes > 0;
  }

  upsertAttachment(projectId, attachment) {
    if (!attachment) return false;
    const result = this.projectStatements.upsertAttachment.run(
      projectId,
      attachment.displayName,
      attachment.filePath,
      attachment.mimeType || null,
      Number.isFinite(attachment.fileSize) ? attachment.fileSize : null,
    );
    return result.changes >= 1;
  }

  deleteAttachment(projectId) {
    return this.projectStatements.deleteAttachment.run(projectId).changes > 0;
  }

  getAttachmentPath(projectId) {
    const row = this.projectStatements.getAttachmentPath.get(projectId);
    return row ? row.file_path : null;
  }

  getProjectById(projectId) {
    const row = this.projectQueries.getById.get(projectId);
    if (!row) return null;
    const categoriesList = row.categories ? JSON.parse(row.categories) : [];
    return {
      id: row.id,
      corporationName: row.corporation_name,
      projectName: row.project_name,
      clientName: row.client_name,
      startDate: row.start_date,
      endDate: row.end_date,
      contractAmount: row.contract_amount,
      scopeNotes: row.scope_notes,
      primaryCompanyId: row.primary_company_id,
      categories: categoriesList,
      attachment: row.attachment_path ? {
        displayName: row.attachment_display_name,
        filePath: row.attachment_path,
        mimeType: row.attachment_mime_type,
        fileSize: row.attachment_size,
        uploadedAt: row.attachment_uploaded_at,
      } : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listProjects(filters = {}) {
    const conditions = [];
    const params = {};

    if (Array.isArray(filters.categoryIds) && filters.categoryIds.length > 0) {
      conditions.push(`p.id IN (
        SELECT project_id FROM project_categories WHERE category_id IN (${filters.categoryIds.map((_, idx) => `@cat${idx}`).join(', ')})
      )`);
      filters.categoryIds.forEach((cid, idx) => { params[`cat${idx}`] = cid; });
    }

    if (Array.isArray(filters.companyIds) && filters.companyIds.length > 0) {
      conditions.push(`p.primary_company_id IN (${filters.companyIds.map((_, idx) => `@comp${idx}`).join(', ')})`);
      filters.companyIds.forEach((cid, idx) => { params[`comp${idx}`] = cid; });
    }

    if (filters.startDateFrom) {
      conditions.push('p.start_date >= @startDateFrom');
      params.startDateFrom = filters.startDateFrom;
    }

    if (filters.startDateTo) {
      conditions.push('p.start_date <= @startDateTo');
      params.startDateTo = filters.startDateTo;
    }

    if (filters.keyword) {
      conditions.push('(p.project_name LIKE @keyword OR p.client_name LIKE @keyword OR p.corporation_name LIKE @keyword)');
      params.keyword = `%${filters.keyword}%`;
    }

    let query = this.projectQueries.listBase;
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY (p.start_date IS NULL), p.start_date DESC, p.created_at DESC';
    const stmt = this.db.prepare(query);
    return stmt.all(params).map((row) => ({
      id: row.id,
      corporationName: row.corporation_name,
      projectName: row.project_name,
      clientName: row.client_name,
      startDate: row.start_date,
      endDate: row.end_date,
      contractAmount: row.contract_amount,
      scopeNotes: row.scope_notes,
      primaryCompanyId: row.primary_company_id,
      primaryCompanyName: row.primary_company_name,
      categories: JSON.parse(row.categories_json || '[]'),
      attachment: row.attachment_path ? {
        displayName: row.attachment_display_name,
        filePath: row.attachment_path,
        mimeType: row.attachment_mime_type,
        fileSize: row.attachment_size,
        uploadedAt: row.attachment_uploaded_at,
      } : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}

module.exports = {
  RecordsRepository,
};
