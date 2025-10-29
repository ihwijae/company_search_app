const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const { RecordsRepository } = require('./recordsRepository');
const { persistRecordsDatabase, getRecordsDatabasePath } = require('./recordsDatabase.js');

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

  getDatabasePath() {
    return getRecordsDatabasePath();
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

  exportDatabase(targetPath) {
    if (!targetPath) throw new Error('targetPath is required');
    persistRecordsDatabase();
    const dbPath = getRecordsDatabasePath();
    if (!dbPath || !fs.existsSync(dbPath)) {
      throw new Error('Database file not found');
    }
    const directory = path.dirname(targetPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.copyFileSync(dbPath, targetPath);
    return { sourcePath: dbPath, exportedPath: targetPath };
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
      let buffer = attachmentPayload.buffer;
      if (buffer instanceof ArrayBuffer) {
        buffer = Buffer.from(new Uint8Array(buffer));
      } else if (ArrayBuffer.isView(buffer)) {
        buffer = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      } else if (Array.isArray(buffer)) {
        buffer = Buffer.from(buffer);
      } else if (buffer && buffer.type === 'Buffer' && Array.isArray(buffer.data)) {
        buffer = Buffer.from(buffer.data);
      }
      if (!(buffer instanceof Buffer)) {
        buffer = Buffer.from(buffer);
      }
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

  async openAttachment(projectId) {
    if (!projectId) throw new Error('Project id is required');
    const project = this.repository.getProjectById(projectId);
    const attachment = project?.attachment;
    if (!attachment || !attachment.filePath) {
      throw new Error('첨부 파일이 없습니다.');
    }
    const resolved = path.resolve(attachment.filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error('첨부 파일을 찾을 수 없습니다.');
    }
    const result = await shell.openPath(resolved);
    if (result) {
      throw new Error(result);
    }
    return true;
  }
}

module.exports = {
  RecordsService,
};
