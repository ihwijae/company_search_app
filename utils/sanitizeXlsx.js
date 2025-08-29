// utils/sanitizeXlsx.js
// 업로드된 xlsx에서 댓글/메모 파트를 제거해 ExcelJS 파싱 오류를 회피합니다.
// 주의: 단순한 문자열 기반 정리이며 모든 경우를 보장하진 않지만, 일반적인 댓글/스레드댓글 이슈엔 효과적입니다.

const os = require('os');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

function makeTempPath(originalPath) {
  const base = path.basename(originalPath, path.extname(originalPath));
  const tempName = `${base}.sanitized.${Date.now()}.xlsx`;
  return path.join(os.tmpdir(), tempName);
}

function removeRelationships(xml) {
  if (!xml) return xml;
  // Worksheet rels: remove comments/threaded/vmlDrawing relationships
  return xml
    .replace(/<Relationship[^>]+Type="[^"]*\/comments"[^>]*\/>/gi, '')
    .replace(/<Relationship[^>]+Type="[^"]*\/threadedcomments"[^>]*\/>/gi, '')
    .replace(/<Relationship[^>]+Type="[^"]*\/vmlDrawing"[^>]*\/>/gi, '');
}

function removeLegacyRefs(xml) {
  if (!xml) return xml;
  // Remove legacyDrawing tags in worksheet xml that reference VML drawings
  return xml
    .replace(/<legacyDrawing[^>]*\/>/gi, '')
    .replace(/<legacyDrawingExt[^>]*\/>/gi, '')
    // conservative removal of extLst items that explicitly mention threaded comments
    .replace(/<extLst>.*?threadedcomments.*?<\/extLst>/gis, (m) => {
      // remove only the ext that mentions threadedcomments
      return m
        .replace(/<ext[^>]*>.*?threadedcomments.*?<\/ext>/gis, '')
        .replace(/<extLst>\s*<\/extLst>/gis, '');
    });
}

function cleanContentTypes(xml) {
  if (!xml) return xml;
  return xml
    // Remove Overrides for comments/threadedcomments
    .replace(/<Override[^>]+ContentType="[^"]*comments\+xml"[^>]*\/>/gi, '')
    .replace(/<Override[^>]+ContentType="[^"]*threadedcomments\+xml"[^>]*\/>/gi, '')
    // Remove Default for VML drawings if present
    .replace(/<Default\s+Extension="vml"[^>]*\/>/gi, '');
}

function sanitizeXlsx(inputPath) {
  try {
    const zip = new AdmZip(inputPath);

    // 1) 댓글/메모 관련 엔트리 제거
    const shouldDelete = (name) => {
      const n = name.toLowerCase();
      return (
        n.startsWith('xl/comments') ||
        n.startsWith('xl/threadedcomments') ||
        n.includes('/comments') ||
        n.includes('/threadedcomments') ||
        // 레거시 VML 기반 주석(일부 문서)
        (n.startsWith('xl/drawings/') && n.includes('vmldrawing'))
      );
    };

    zip.getEntries().forEach((entry) => {
      if (shouldDelete(entry.entryName)) {
        zip.deleteFile(entry.entryName);
      }
    });

    // 2) [Content_Types].xml 정리
    const ctEntry = zip.getEntry('[Content_Types].xml');
    if (ctEntry) {
      const xml = ctEntry.getData().toString('utf8');
      const cleaned = cleanContentTypes(xml);
      zip.deleteFile('[Content_Types].xml');
      zip.addFile('[Content_Types].xml', Buffer.from(cleaned, 'utf8'));
    }

    // 3) worksheets 관계(.rels) 파일에서 댓글/스레드/VML 참조 제거
    zip.getEntries()
      .filter((e) => /xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/i.test(e.entryName))
      .forEach((rels) => {
        try {
          const xml = rels.getData().toString('utf8');
          const cleaned = removeRelationships(xml);
          zip.deleteFile(rels.entryName);
          zip.addFile(rels.entryName, Buffer.from(cleaned, 'utf8'));
        } catch {}
      });

    // 4) worksheets 본문에서 legacyDrawing, threadedcomments 관련 잔여 참조 제거
    zip.getEntries()
      .filter((e) => /xl\/worksheets\/sheet\d+\.xml$/i.test(e.entryName))
      .forEach((ws) => {
        try {
          const xml = ws.getData().toString('utf8');
          const cleaned = removeLegacyRefs(xml);
          zip.deleteFile(ws.entryName);
          zip.addFile(ws.entryName, Buffer.from(cleaned, 'utf8'));
        } catch {}
      });

    const tempPath = makeTempPath(inputPath);
    zip.writeZip(tempPath);
    return { sanitizedPath: tempPath, sanitized: true, createdAt: Date.now(), source: inputPath };
  } catch (e) {
    // 정화 실패 시 원본을 그대로 사용하도록 합니다.
    return { sanitizedPath: inputPath, sanitized: false, error: e, createdAt: Date.now(), source: inputPath };
  }
}

module.exports = { sanitizeXlsx };
