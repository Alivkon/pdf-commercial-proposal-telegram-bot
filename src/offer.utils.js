// Utilities to parse and enrich offer data extracted from LLM replies

// Parse offer data from free-form text (supports fenced JSON, inline JSON, arrays, and markdown tables)
function parseOfferData(text) {
  const tryParse = (candidate) => { try { return JSON.parse(candidate); } catch { return null; } };
  const normalizeNumber = (v) => {
    if (typeof v === 'number') return v;
    if (v === 0) return 0;
    if (!v) return null;
    const s = String(v)
      .replace(/\s+/g, '')
      .replace(/[^\d,.-]+/g, '')
      .replace(/,/, '.');
    const num = parseFloat(s);
    return Number.isFinite(num) ? num : null;
  };
  const mapFields = (p) => {
    if (!p || typeof p !== 'object') return null;
    const out = {};
    out.name = p.name || p.title || p.product || p.model || p['наименовани��'] || p['модель'] || p['товар'] || '';
    out.connector = p.connector || p.socket || p['разъем'] || p['разъём'] || p['коннектор'] || p['порт'] || '-';
    if (p.socket) out.socket = p.socket;
    if (p.specifications_file) out.specifications_file = p.specifications_file;
    const price_one = normalizeNumber(p.price_one ?? p.price ?? p['цена'] ?? p['цена_за_шт'] ?? p['цена за шт'] ?? p['стоимость_ед'] ?? p['стоимость за ед']);
    const nds = normalizeNumber(p.nds ?? p.vat ?? p['ндс'] ?? p['НДС']);
    const quantity = normalizeNumber(p.quantity ?? p.qty ?? p['количество'] ?? p['кол-во']);
    const total = normalizeNumber(p.price_with_nds ?? p['цена_с_ндс'] ?? p['цена с ндс'] ?? p['стоимость'] ?? p['итого'] ?? p['сумма']);
    if (price_one != null) out.price_one = price_one;
    if (nds != null) out.nds = nds;
    out.quantity = Number.isFinite(quantity) ? Math.round(quantity) : 1;
    if (total != null) out.price_with_nds = total;
    return out;
  };
  const normalize = (data) => {
    if (!data || typeof data !== 'object') return null;
    let products = data.products || data.items || data.positions || data['товары'] || data['позиции'] || data['предложения'] || [];
    if (!Array.isArray(products) || products.length === 0) return null;
    const mapped = products.map(mapFields).filter(Boolean);
    if (mapped.length === 0) return null;
    const result = { ...data, products: mapped };
    return result;
  };
  const parseMarkdownTable = (txt) => {
    if (!txt || !txt.includes('|')) return null;
    const lines = txt.split(/\r?\n/).filter(l => l.includes('|'));
    if (lines.length < 2) return null;
    let headerIdx = -1;
    for (let i = 0; i < lines.length - 1; i++) {
      if (/\|/.test(lines[i]) && /---/.test(lines[i+1])) { headerIdx = i; break; }
    }
    if (headerIdx === -1) headerIdx = 0;
    const header = lines[headerIdx].split('|').map(s => s.trim().toLowerCase());
    const body = lines.slice(headerIdx + 1).filter(l => !/^\s*\|?\s*[-: ]+\|/.test(l));
    const idxOf = (re) => header.findIndex(h => re.test(h));
    const iName = idxOf(/наимен|модель|товар|product|name/);
    const iConn = idxOf(/разъ|разем|разъем|коннектор|socket|connector/);
    const iPrice = idxOf(/цена(\s*за\s*шт)?|price/);
    const iVAT = idxOf(/ндс|vat/);
    const iQty = idxOf(/кол-?во|количество|qty|quantity/);
    const iTotal = idxOf(/итого|сумма|стоим|total/);
    const products = [];
    for (const row of body) {
      const cells = row.split('|').map(s => s.trim());
      if (cells.filter(c => c).length < 2) continue;
      const p = {};
      p.name = cells[iName] || '';
      p.connector = iConn >= 0 ? cells[iConn] : '-';
      const price_one = iPrice >= 0 ? normalizeNumber(cells[iPrice]) : null;
      const nds = iVAT >= 0 ? normalizeNumber(cells[iVAT]) : null;
      const quantity = iQty >= 0 ? normalizeNumber(cells[iQty]) : 1;
      const total = iTotal >= 0 ? normalizeNumber(cells[iTotal]) : null;
      if (price_one != null) p.price_one = price_one;
      if (nds != null) p.nds = nds;
      p.quantity = Number.isFinite(quantity) ? Math.round(quantity) : 1;
      if (total != null) p.price_with_nds = total;
      products.push(p);
    }
    return products.length ? { products } : null;
  };
  try {
    if (!text || typeof text !== 'string') return null;
    const block = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
    if (block?.[1]) {
      const parsed = tryParse(block[1]);
      const norm = normalize(parsed);
      if (norm) return norm;
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = tryParse(jsonMatch[0]);
      const norm = normalize(parsed);
      if (norm) return norm;
    }
    const arrMatch = text.match(/\"(products|items|positions|товары|позиции|предложения)\"\s*:\s*(\[[\s\S]*?\])/i);
    if (arrMatch?.[2]) {
      const arr = tryParse(arrMatch[2]);
      if (Array.isArray(arr) && arr.length > 0) {
        const mapped = arr.map(mapFields).filter(Boolean);
        if (mapped.length) return { products: mapped };
      }
    }
    const tableExtract = parseMarkdownTable(text);
    if (tableExtract) return tableExtract;
    return null;
  } catch (error) {
    console.warn('Could not parse offer data:', error.message);
    return null;
  }
}

// Enrich offer data: compute derived values and totals
function enrichOfferData(offer) {
  if (!offer || !Array.isArray(offer.products)) return offer;
  const enriched = { ...offer };
  enriched.products = offer.products.map(p => {
    const price_one = Number(p.price_one) || 0;
    const nds = Number(p.nds) || 0;
    const quantity = Number.isFinite(Number(p.quantity)) ? Math.round(Number(p.quantity)) : 1;
    const price_with_nds = Number(p.price_with_nds);
    const computed_price_with_nds = price_one * quantity; // price_one * quantity
    return {
      ...p,
      price_one,
      nds,
      quantity,
      price_with_nds: Number.isFinite(price_with_nds) ? price_with_nds : computed_price_with_nds,
    };
  });
  enriched.items_count = enriched.products.length;
  enriched.total_price_with_nds = enriched.products.reduce((sum, p) => sum + (Number(p.price_with_nds) || 0), 0);
  enriched.total_nds = enriched.products.reduce((sum, p) => sum + (Number(p.nds) || 0), 0);
  if (!enriched.specifications_file) {
    const specFiles = new Set(
      enriched.products
        .map(p => p.specifications_file)
        .filter(Boolean)
    );
    if (specFiles.size === 1) {
      enriched.specifications_file = Array.from(specFiles)[0];
    }
  }
  return enriched;
}

module.exports = {
  parseOfferData,
  enrichOfferData,
};
