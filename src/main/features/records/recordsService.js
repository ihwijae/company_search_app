const fs = require('fs');
const path = require('path');
const os = require('os');
const { shell } = require('electron');
const AdmZip = require('adm-zip');
const { RecordsRepository } = require('./recordsRepository');
const { persistRecordsDatabase, getRecordsDatabasePath, resetRecordsDatabase } = require('./recordsDatabase.js');

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
    this.userDataDir = userDataDir;
    this.attachmentsRoot = path.join(userDataDir, 'attachments');
    this.migrateLegacyAttachmentPaths();
  }

  resolveAttachmentPath(storedPath) {
    if (!storedPath) return null;
    if (path.isAbsolute(storedPath)) return storedPath;
    return path.join(this.attachmentsRoot, storedPath);
  }

  toAttachmentRelative(absolutePath) {
    if (!absolutePath) return null;
    const normalizedRoot = path.normalize(`${this.attachmentsRoot}${path.sep}`);
    const normalizedPath = path.normalize(absolutePath);
    if (normalizedPath.startsWith(normalizedRoot)) {
      return path.relative(this.attachmentsRoot, normalizedPath);
    }
    return normalizedPath;
  }

  hydrateAttachment(attachment) {
    if (!attachment) return null;
    const resolvedPath = this.resolveAttachmentPath(attachment.filePath);
    return {
      ...attachment,
      filePath: resolvedPath,
      relativePath: this.toAttachmentRelative(resolvedPath),
    };
  }

  hydrateProject(project) {
    if (!project) return project;
    return {
      ...project,
      attachment: this.hydrateAttachment(project.attachment),
    };
  }

  migrateLegacyAttachmentPaths() {
    try {
      if (!fs.existsSync(this.attachmentsRoot)) return;
      const records = this.repository.listAttachmentRecords();
      if (!Array.isArray(records) || records.length === 0) return;
      const rootPrefix = path.normalize(`${this.attachmentsRoot}${path.sep}`);
      let mutated = false;
      records.forEach(({ projectId, filePath }) => {
        if (!projectId || !filePath || typeof filePath !== 'string') return;
        if (!path.isAbsolute(filePath)) return;
        const normalizedPath = path.normalize(filePath);
        if (!normalizedPath.startsWith(rootPrefix)) return;
        const relativePath = path.relative(this.attachmentsRoot, normalizedPath);
        if (!relativePath || relativePath === filePath) return;
        const updated = this.repository.updateAttachmentPath(projectId, relativePath);
        if (updated) mutated = true;
      });
      if (mutated) {
        persistRecordsDatabase();
      }
    } catch (error) {
      console.error('[MAIN][records] Failed to normalize attachment paths:', error);
    }
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
    return this.repository.listProjects(normalizedFilters)
      .map((project) => this.hydrateProject(project));
  }

  getProject(projectId) {
    if (!projectId) throw new Error('Project id is required');
    const project = this.repository.getProjectById(projectId);
    return this.hydrateProject(project);
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

    return this.hydrateProject(this.repository.getProjectById(projectId));
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

    return this.hydrateProject(this.repository.getProjectById(projectId));
  }

  deleteProject(projectId) {
    if (!projectId) throw new Error('Project id is required');
    const previousStoredPath = this.repository.getAttachmentPath(projectId);
    const existingPath = this.resolveAttachmentPath(previousStoredPath);
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

    const zip = new AdmZip();
    const dbName = 'records.sqlite';
    zip.addFile(dbName, fs.readFileSync(dbPath));

    if (fs.existsSync(this.attachmentsRoot)) {
      zip.addLocalFolder(this.attachmentsRoot, 'attachments');
    }

    const metaPath = path.join(this.userDataDir, 'meta.json');
    if (fs.existsSync(metaPath)) {
      zip.addLocalFile(metaPath, '', 'meta.json');
    }

    zip.writeZip(targetPath);

    return {
      sourcePath: dbPath,
      exportedPath: targetPath,
      includedAttachments: fs.existsSync(this.attachmentsRoot),
    };
  }

  async importDatabase(importPath) {
    if (!importPath) throw new Error('importPath is required');
    if (!fs.existsSync(importPath)) {
      throw new Error('선택한 파일을 찾을 수 없습니다.');
    }

    const stat = fs.statSync(importPath);
    let workingDir = importPath;
    let cleanupDir = null;

    const findFileRecursive = (baseDir, fileName) => {
      const queue = [baseDir];
      while (queue.length) {
        const current = queue.shift();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(current, entry.name);
          if (entry.isFile() && entry.name === fileName) {
            return fullPath;
          }
          if (entry.isDirectory()) {
            queue.push(fullPath);
          }
        }
      }
      return null;
    };

    const copyDirectory = (source, destination) => {
      fs.mkdirSync(destination, { recursive: true });
      const entries = fs.readdirSync(source, { withFileTypes: true });
      entries.forEach((entry) => {
        const srcPath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        if (entry.isDirectory()) {
          copyDirectory(srcPath, destPath);
        } else if (entry.isFile()) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(srcPath, destPath);
        }
      });
    };

    try {
      if (stat.isFile()) {
        const zip = new AdmZip(importPath);
        cleanupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'records-import-'));
        zip.extractAllTo(cleanupDir, true);
        workingDir = cleanupDir;
      } else if (!stat.isDirectory()) {
        throw new Error('지원하지 않는 가져오기 형식입니다.');
      }

      const sourceDbPath = findFileRecursive(workingDir, 'records.sqlite');
      if (!sourceDbPath) {
        throw new Error('가져오기 데이터에서 records.sqlite를 찾을 수 없습니다.');
      }

      const sourceRoot = path.dirname(sourceDbPath);
      const sourceAttachmentsPath = path.join(sourceRoot, 'attachments');
      const sourceMetaPath = path.join(sourceRoot, 'meta.json');

      persistRecordsDatabase();

      const targetDbPath = path.join(this.userDataDir, 'records.sqlite');
      fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });
      fs.copyFileSync(sourceDbPath, targetDbPath);

      if (fs.existsSync(this.attachmentsRoot)) {
        fs.rmSync(this.attachmentsRoot, { recursive: true, force: true });
      }
      if (fs.existsSync(sourceAttachmentsPath)) {
        copyDirectory(sourceAttachmentsPath, this.attachmentsRoot);
      } else {
        fs.mkdirSync(this.attachmentsRoot, { recursive: true });
      }

      const targetMetaPath = path.join(this.userDataDir, 'meta.json');
      if (fs.existsSync(sourceMetaPath)) {
        fs.copyFileSync(sourceMetaPath, targetMetaPath);
      } else if (fs.existsSync(targetMetaPath)) {
        fs.rmSync(targetMetaPath, { force: true });
      }

      await resetRecordsDatabase({ userDataDir: this.userDataDir });
      this.migrateLegacyAttachmentPaths();

      let attachmentsImported = false;
      if (fs.existsSync(this.attachmentsRoot)) {
        try {
          attachmentsImported = fs.readdirSync(this.attachmentsRoot).length > 0;
        } catch (error) {
          console.warn('[MAIN][records] Failed to inspect attachments after import:', error);
        }
      }

      return {
        importedPath: importPath,
        attachmentsImported,
      };
    } finally {
      if (cleanupDir && fs.existsSync(cleanupDir)) {
        try { fs.rmSync(cleanupDir, { recursive: true, force: true }); } catch {}
      }
    }
  }

  replaceAttachment(projectId, attachmentPayload) {
    if (!projectId) throw new Error('Project id is required');
    if (!attachmentPayload || (!attachmentPayload.sourcePath && !attachmentPayload.buffer)) {
      throw new Error('Attachment payload must include sourcePath or buffer');
    }

    const previousStoredPath = this.repository.getAttachmentPath(projectId);
    const previousPath = this.resolveAttachmentPath(previousStoredPath);

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
      filePath: this.toAttachmentRelative(filePath),
      mimeType,
      fileSize,
    });

    persistRecordsDatabase();

    if (previousPath && previousPath !== filePath && fs.existsSync(previousPath)) {
      try { fs.unlinkSync(previousPath); } catch {}
    }

    const attachment = this.repository.getProjectById(projectId)?.attachment;
    return this.hydrateAttachment(attachment);
  }

  removeAttachment(projectId) {
    if (!projectId) throw new Error('Project id is required');
    const storedPath = this.repository.getAttachmentPath(projectId);
    const existingPath = this.resolveAttachmentPath(storedPath);
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
    const attachment = this.hydrateAttachment(project?.attachment);
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
