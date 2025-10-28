const fs = require('fs');
const path = require('path');
const { RecordsRepository } = require('./recordsRepository');
const { persistRecordsDatabase } = require('./recordsDatabase.js');

const sanitizeFileName = (name) => {
  if (!name) return 'attachment';
  return String(name).replace(/[\x00-\x1f<>:"/\\|?*]+/g, '').slice(0, 120) || 'attachment';
};

const normalizeIdArray = (input) => {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => {
      const num = Number(value);
      return Number.isInteger(num) && num > 0 ? num : null;
    })
    .filter((value) => value !== null);
};

class RecordsService {
  constructor({ userDataDir }) {
    if (!userDataDir) throw new Error('userDataDir is required for RecordsService');
    this.repository = new RecordsRepository();
    this.attachmentsRoot = path.join(userDataDir, 'attachments');
  }

  ensureAttachmentDirectory(projectId) {
    const projectDir = path.join(this.attachmentsRoot, String(projectId));
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    return projectDir;
  }

  listCompanies(options = {}) {
    return this.repository.listCompanies(options)
      .map((row) => ({
        ...row,
        isPrimary: !!row.isPrimary,
        active: row.active !== false,
      }));
  }

  saveCompany(payload) {
    if (!payload || !payload.name) {
      throw new Error('Company name is required');
    }
    const id = this.repository.upsertCompany(payload);
    if (!id) throw new Error('Failed to save company');
    persistRecordsDatabase();
    return this.repository.getCompanyById(id);
  }

  deleteCompany(id) {
    if (!id) throw new Error('Company id is required');
    const deleted = this.repository.deleteCompany(id);
    if (deleted) persistRecordsDatabase();
    return deleted;
  }

  listCategories(options = {}) {
    return this.repository.listCategories(options)
      .map((row) => ({
        ...row,
        active: row.active !== false,
      }));
  }

  saveCategory(payload) {
    if (!payload || !payload.name) {
      throw new Error('Category name is required');
    }
    const id = this.repository.upsertCategory(payload);
    if (!id) throw new Error('Failed to save category');
    persistRecordsDatabase();
    return this.repository.getCategoryById(id);
  }

  deleteCategory(id) {
    if (!id) throw new Error('Category id is required');
    const deleted = this.repository.deleteCategory(id);
    if (deleted) persistRecordsDatabase();
    return deleted;
  }

  listProjects(filters = {}) {
    const normalizedFilters = {
      keyword: filters.keyword ? String(filters.keyword).trim() : undefined,
      categoryIds: normalizeIdArray(filters.categoryIds),
      companyIds: normalizeIdArray(filters.companyIds),
      startDateFrom: filters.startDateFrom || undefined,
      startDateTo: filters.startDateTo || undefined,
    };
    return this.repository.listProjects(normalizedFilters);
  }

  getProject(projectId) {
    if (!projectId) throw new Error('Project id is required');
    return this.repository.getProjectById(projectId);
  }

  createProject(payload) {
    if (!payload) throw new Error('Project payload is required');
    const categoryIds = normalizeIdArray(payload.categoryIds);
    const projectData = {
      corporationName: payload.corporationName,
      projectName: payload.projectName,
      clientName: payload.clientName,
      startDate: payload.startDate,
      endDate: payload.endDate,
      contractAmount: payload.contractAmount,
      scopeNotes: payload.scopeNotes,
      primaryCompanyId: payload.primaryCompanyId ? Number(payload.primaryCompanyId) : null,
    };

    const projectId = this.repository.insertProject(projectData, categoryIds);
    if (!projectId) throw new Error('Failed to create project');

    if (payload.attachment) {
      this.replaceAttachment(projectId, payload.attachment);
    }

    persistRecordsDatabase();

    return this.repository.getProjectById(projectId);
  }

  updateProject(projectId, payload) {
    if (!projectId) throw new Error('Project id is required');
    if (!payload) throw new Error('Project payload is required');
    const categoryIds = normalizeIdArray(payload.categoryIds);
    const projectData = {
      corporationName: payload.corporationName,
      projectName: payload.projectName,
      clientName: payload.clientName,
      startDate: payload.startDate,
      endDate: payload.endDate,
      contractAmount: payload.contractAmount,
      scopeNotes: payload.scopeNotes,
      primaryCompanyId: payload.primaryCompanyId ? Number(payload.primaryCompanyId) : null,
    };

    const updated = this.repository.updateProject(projectId, projectData, categoryIds);
    if (!updated) throw new Error('Project update failed');

    if (payload.attachment) {
      this.replaceAttachment(projectId, payload.attachment);
    }

    persistRecordsDatabase();

    return this.repository.getProjectById(projectId);
  }

  deleteProject(projectId) {
    if (!projectId) throw new Error('Project id is required');
    const existingPath = this.repository.getAttachmentPath(projectId);
    const deleted = this.repository.deleteProject(projectId);
    if (deleted && existingPath && fs.existsSync(existingPath)) {
      try { fs.unlinkSync(existingPath); } catch {}
    }
    if (deleted) persistRecordsDatabase();
    return deleted;
  }

  replaceAttachment(projectId, attachmentPayload) {
    if (!projectId) throw new Error('Project id is required');
    if (!attachmentPayload || (!attachmentPayload.sourcePath && !attachmentPayload.buffer)) {
      throw new Error('Attachment payload must include sourcePath or buffer');
    }

    const previousPath = this.repository.getAttachmentPath(projectId);

    let filePath;
    let fileSize = null;
    const displayName = attachmentPayload.originalName || attachmentPayload.displayName || path.basename(attachmentPayload.sourcePath || '') || 'attachment';
    const mimeType = attachmentPayload.mimeType || null;

    if (attachmentPayload.buffer) {
      const buffer = attachmentPayload.buffer;
      const projectDir = this.ensureAttachmentDirectory(projectId);
      const targetName = `${Date.now()}_${sanitizeFileName(displayName)}`;
      filePath = path.join(projectDir, targetName);
      fs.writeFileSync(filePath, buffer);
      fileSize = buffer.length;
    } else if (attachmentPayload.sourcePath) {
      const sourcePath = attachmentPayload.sourcePath;
      if (!fs.existsSync(sourcePath)) {
        throw new Error('Attachment source file does not exist');
      }
      const projectDir = this.ensureAttachmentDirectory(projectId);
      const targetName = `${Date.now()}_${sanitizeFileName(displayName)}`;
      filePath = path.join(projectDir, targetName);
      fs.copyFileSync(sourcePath, filePath);
      const stats = fs.statSync(filePath);
      fileSize = stats.size;
    } else {
      throw new Error('Attachment payload was not valid');
    }

    this.repository.upsertAttachment(projectId, {
      displayName,
      filePath,
      mimeType,
      fileSize,
    });

    persistRecordsDatabase();

    if (previousPath && previousPath !== filePath && fs.existsSync(previousPath)) {
      try { fs.unlinkSync(previousPath); } catch {}
    }

    return this.repository.getProjectById(projectId)?.attachment;
  }

  removeAttachment(projectId) {
    if (!projectId) throw new Error('Project id is required');
    const existingPath = this.repository.getAttachmentPath(projectId);
    const removed = this.repository.deleteAttachment(projectId);
    if (removed && existingPath && fs.existsSync(existingPath)) {
      try { fs.unlinkSync(existingPath); } catch {}
    }
    if (removed) persistRecordsDatabase();
    return removed;
  }
}

module.exports = {
  RecordsService,
};
