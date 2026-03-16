const fs = require('fs');

const {
  getTempCompaniesDatabase,
  getTempCompaniesDatabasePath,
  persistTempCompaniesDatabase,
} = require('./database.js');

const FIELD_KEYS = [
  'name',
  'industry',
  'managerName',
  'representative',
  'bizNo',
  'region',
  'sipyung',
  'performance3y',
  'performance5y',
  'debtRatio',
  'currentRatio',
  'bizYears',
  'creditGrade',
  'womenOwned',
  'smallBusiness',
  'jobCreation',
  'qualityEval',
  'notes',
];

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeBizNo = (value) => normalizeText(value).replace(/[^0-9]/g, '');

const toRow = (item = {}) => ({
  id: item.id ? Number(item.id) : null,
  name: normalizeText(item.name || item['업체명']),
  industry: normalizeText(item.industry || item.fileType || item['공종']),
  managerName: normalizeText(item.managerName || item.manager || item['담당자']),
  representative: normalizeText(item.representative || item['대표자']),
  bizNo: normalizeBizNo(item.bizNo || item['사업자번호']),
  region: normalizeText(item.region || item['지역']),
  sipyung: normalizeText(item.sipyung || item['시평']),
  performance3y: normalizeText(item.performance3y || item['3년 실적']),
  performance5y: normalizeText(item.performance5y || item['5년 실적']),
  debtRatio: normalizeText(item.debtRatio || item['부채비율']),
  currentRatio: normalizeText(item.currentRatio || item['유동비율']),
  bizYears: normalizeText(item.bizYears || item['영업기간']),
  creditGrade: normalizeText(item.creditGrade || item['신용평가']),
  womenOwned: normalizeText(item.womenOwned || item['여성기업']),
  smallBusiness: normalizeText(item.smallBusiness || item['중소기업']),
  jobCreation: normalizeText(item.jobCreation || item['일자리창출']),
  qualityEval: normalizeText(item.qualityEval || item['품질평가']),
  notes: normalizeText(item.notes || item['비고']),
});

const rowToEntity = (row = {}) => ({
  id: Number(row.id),
  name: normalizeText(row.name),
  industry: normalizeText(row.industry),
  managerName: normalizeText(row.manager_name),
  representative: normalizeText(row.representative),
  bizNo: normalizeBizNo(row.biz_no),
  region: normalizeText(row.region),
  sipyung: normalizeText(row.sipyung),
  performance3y: normalizeText(row.performance3y),
  performance5y: normalizeText(row.performance5y),
  debtRatio: normalizeText(row.debt_ratio),
  currentRatio: normalizeText(row.current_ratio),
  bizYears: normalizeText(row.biz_years),
  creditGrade: normalizeText(row.credit_grade),
  womenOwned: normalizeText(row.women_owned),
  smallBusiness: normalizeText(row.small_business),
  jobCreation: normalizeText(row.job_creation),
  qualityEval: normalizeText(row.quality_eval),
  notes: normalizeText(row.notes),
  createdAt: row.created_at || '',
  updatedAt: row.updated_at || '',
});

const entityToSearchItem = (entity = {}) => ({
  id: `temp:${entity.id}`,
  name: entity.name,
  bizNo: entity.bizNo,
  _is_temp_company: true,
  _temp_company_id: entity.id,
  _file_type: entity.industry || '',
  '검색된 회사': entity.name,
  '업체명': entity.name,
  '공종': entity.industry,
  '담당자명': entity.managerName,
  '담당자': entity.managerName,
  managerName: entity.managerName,
  manager: entity.managerName,
  '대표자': entity.representative,
  '사업자번호': entity.bizNo,
  '지역': entity.region,
  '대표지역': entity.region,
  '시평': entity.sipyung,
  '3년 실적': entity.performance3y,
  '5년 실적': entity.performance5y,
  '부채비율': entity.debtRatio,
  '유동비율': entity.currentRatio,
  '영업기간': entity.bizYears,
  '신용평가': entity.creditGrade,
  '여성기업': entity.womenOwned,
  '중소기업': entity.smallBusiness,
  '일자리창출': entity.jobCreation,
  '품질평가': entity.qualityEval,
  '비고': entity.notes,
});

class TempCompaniesService {
  constructor({ userDataDir } = {}) {
    if (!userDataDir) throw new Error('userDataDir is required');
    this.userDataDir = userDataDir;
  }

  getDatabasePath() {
    return getTempCompaniesDatabasePath();
  }

  listCompanies({ query = '' } = {}) {
    const db = getTempCompaniesDatabase();
    const trimmed = normalizeText(query);
      const stmt = trimmed
      ? db.prepare(`SELECT * FROM temp_companies
        WHERE name LIKE ? OR representative LIKE ? OR biz_no LIKE ? OR region LIKE ?
        ORDER BY updated_at DESC, id DESC`)
      : db.prepare('SELECT * FROM temp_companies ORDER BY updated_at DESC, id DESC');
    if (trimmed) {
      const like = `%${trimmed}%`;
      stmt.bind([like, like, like, like]);
    }
    const items = [];
    while (stmt.step()) items.push(rowToEntity(stmt.getAsObject()));
    stmt.free();
    return items;
  }

  getCompany(id) {
    const db = getTempCompaniesDatabase();
    const stmt = db.prepare('SELECT * FROM temp_companies WHERE id = ? LIMIT 1');
    stmt.bind([Number(id)]);
    const entity = stmt.step() ? rowToEntity(stmt.getAsObject()) : null;
    stmt.free();
    return entity;
  }

  saveCompany(payload = {}) {
    const db = getTempCompaniesDatabase();
    const row = toRow(payload);
    if (!row.name) throw new Error('업체명은 필수입니다.');
    const now = new Date().toISOString();
    if (row.id) {
      const stmt = db.prepare(`UPDATE temp_companies SET
        name = ?, industry = ?, manager_name = ?, representative = ?, biz_no = ?, region = ?, sipyung = ?,
        performance3y = ?, performance5y = ?, debt_ratio = ?, current_ratio = ?,
        biz_years = ?, credit_grade = ?, women_owned = ?, small_business = ?,
        job_creation = ?, quality_eval = ?, notes = ?, updated_at = ?
        WHERE id = ?`);
      stmt.run([
        row.name, row.industry, row.managerName, row.representative, row.bizNo, row.region, row.sipyung,
        row.performance3y, row.performance5y, row.debtRatio, row.currentRatio,
        row.bizYears, row.creditGrade, row.womenOwned, row.smallBusiness,
        row.jobCreation, row.qualityEval, row.notes, now, row.id,
      ]);
      stmt.free();
    } else {
      const stmt = db.prepare(`INSERT INTO temp_companies (
        name, industry, manager_name, representative, biz_no, region, sipyung, performance3y, performance5y,
        debt_ratio, current_ratio, biz_years, credit_grade, women_owned, small_business,
        job_creation, quality_eval, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      stmt.run([
        row.name, row.industry, row.managerName, row.representative, row.bizNo, row.region, row.sipyung,
        row.performance3y, row.performance5y, row.debtRatio, row.currentRatio,
        row.bizYears, row.creditGrade, row.womenOwned, row.smallBusiness,
        row.jobCreation, row.qualityEval, row.notes, now, now,
      ]);
      stmt.free();
      row.id = this._getLastInsertId();
    }
    persistTempCompaniesDatabase();
    return this.getCompany(row.id);
  }

  deleteCompany(id) {
    const db = getTempCompaniesDatabase();
    const stmt = db.prepare('DELETE FROM temp_companies WHERE id = ?');
    stmt.run([Number(id)]);
    stmt.free();
    persistTempCompaniesDatabase();
    return true;
  }

  searchCompanies(criteria = {}, fileType = '') {
    const query = normalizeText(criteria.name || criteria.query || '');
    const normalizedType = normalizeText(fileType).toLowerCase();
    return this.listCompanies({ query })
      .filter((entity) => {
        if (!normalizedType || normalizedType === 'all') return true;
        return normalizeText(entity.industry).toLowerCase() === normalizedType;
      })
      .map(entityToSearchItem);
  }

  exportCompanies(targetPath) {
    if (!targetPath) throw new Error('targetPath is required');
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: this.listCompanies({ query: '' }).map((item) => {
        const clone = {};
        FIELD_KEYS.forEach((key) => { clone[key] = item[key] || ''; });
        return clone;
      }),
    };
    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
    return { exportedPath: targetPath, count: payload.items.length };
  }

  importCompanies(importPath) {
    if (!importPath || !fs.existsSync(importPath)) {
      throw new Error('가져올 파일을 찾을 수 없습니다.');
    }
    const raw = JSON.parse(fs.readFileSync(importPath, 'utf8'));
    const items = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
    if (!items.length) return { importedPath: importPath, importedCount: 0, replacedCount: 0 };
    const db = getTempCompaniesDatabase();
    const findStmt = db.prepare('SELECT id FROM temp_companies WHERE name = ? AND ifnull(biz_no, \'\') = ? LIMIT 1');
    const insertStmt = db.prepare(`INSERT INTO temp_companies (
      name, representative, biz_no, region, sipyung, performance3y, performance5y,
      debt_ratio, current_ratio, biz_years, credit_grade, women_owned, small_business,
      job_creation, quality_eval, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const updateStmt = db.prepare(`UPDATE temp_companies SET
      industry = ?, manager_name = ?, representative = ?, region = ?, sipyung = ?, performance3y = ?, performance5y = ?,
      debt_ratio = ?, current_ratio = ?, biz_years = ?, credit_grade = ?, women_owned = ?,
      small_business = ?, job_creation = ?, quality_eval = ?, notes = ?, updated_at = ?
      WHERE id = ?`);
    let importedCount = 0;
    let replacedCount = 0;
    const now = new Date().toISOString();
    items.forEach((item) => {
      const row = toRow(item);
      if (!row.name) return;
      findStmt.bind([row.name, row.bizNo]);
      const existing = findStmt.step() ? findStmt.getAsObject() : null;
      findStmt.reset();
      if (existing?.id) {
        updateStmt.run([
          row.industry, row.managerName, row.representative, row.region, row.sipyung, row.performance3y, row.performance5y,
          row.debtRatio, row.currentRatio, row.bizYears, row.creditGrade, row.womenOwned,
          row.smallBusiness, row.jobCreation, row.qualityEval, row.notes, now, existing.id,
        ]);
        replacedCount += 1;
      } else {
        insertStmt.run([
          row.name, row.industry, row.managerName, row.representative, row.bizNo, row.region, row.sipyung,
          row.performance3y, row.performance5y, row.debtRatio, row.currentRatio,
          row.bizYears, row.creditGrade, row.womenOwned, row.smallBusiness,
          row.jobCreation, row.qualityEval, row.notes, now, now,
        ]);
      }
      importedCount += 1;
    });
    findStmt.free();
    insertStmt.free();
    updateStmt.free();
    persistTempCompaniesDatabase();
    return { importedPath: importPath, importedCount, replacedCount };
  }

  _getLastInsertId() {
    const db = getTempCompaniesDatabase();
    const result = db.exec('SELECT last_insert_rowid() AS id');
    return Number(result?.[0]?.values?.[0]?.[0] || 0);
  }
}

module.exports = {
  TempCompaniesService,
  entityToSearchItem,
};
