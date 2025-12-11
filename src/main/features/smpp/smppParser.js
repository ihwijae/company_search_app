const cheerio = require('cheerio');

const emptyFeature = () => ({ exists: false, confirmDate: null, expireDate: null });

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

const hasNoData = (cells) => {
  return cells.some((cell) => {
    const text = normalizeText(cell);
    if (!text) return false;
    return text.includes('해당사항 없음') || text.includes('미발급');
  });
};

function parseCorpFeatures(html) {
  const doc = cheerio.load(html || '');
  const label = doc('span.labelType1').filter((_, el) => {
    const text = normalizeText(doc(el).text());
    return text.includes('기업특징');
  }).first();

  const result = {
    small: emptyFeature(),
    women: emptyFeature(),
  };

  if (!label.length) return result;
  const table = label.nextAll('table').first();
  if (!table.length) return result;
  const rows = table.find('tbody tr');
  rows.each((_, tr) => {
    const cells = doc(tr).find('td').toArray();
    if (!cells.length) return;
    const kind = normalizeText(doc(cells[0]).text());
    if (!kind) return;
    if (hasNoData(cells.slice(1).map((cell) => doc(cell).text()))) return;

    const confirmDate = cells[2] ? normalizeText(doc(cells[2]).text()) || null : null;
    const expireDate = cells[3] ? normalizeText(doc(cells[3]).text()) || null : null;

    if (/여성/.test(kind)) {
      result.women = {
        exists: true,
        confirmDate,
        expireDate,
      };
      return;
    }

    if (/소기업/.test(kind)) {
      result.small = {
        exists: true,
        confirmDate,
        expireDate,
      };
    }
  });

  return result;
}

module.exports = {
  parseCorpFeatures,
};
