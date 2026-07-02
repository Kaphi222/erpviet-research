/**
 * ERPVietResearch CMS — Google Sheets integration
 * Set window.CMS_SCRIPT_URL before loading this file, or update CMS_SCRIPT_URL below.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────────
  // Paste your Apps Script Web App URL here after deploying
  const CMS_SCRIPT_URL =
    window.CMS_SCRIPT_URL ||
    'https://script.google.com/macros/s/AKfycbztUFzen4DXhwbau6JIAnNbgPEf2MapMlz_nB30dxqSV6P4cBb9h66eEhrfNgPuhRGq/exec';

  // Resolve base path from this script's src (works on any host / subdirectory)
  const _s = document.querySelector('script[src*="cms.js"]');
  const _cmsBase = _s ? _s.src.replace(/assets\/js\/cms\.js.*$/, '') : (window.SITE_BASE || '');

  const FALLBACKS = {
    Nganh: 'data/industries.json',
    CaseStudies: 'data/case-studies.json',
  };

  // Các cột dạng danh sách: lưu trong Sheet là chuỗi "a | b | c", web dùng mảng
  const LIST_FIELDS = ['results', 'solutions'];

  /** Chuẩn hóa 1 hàng từ Sheet về đúng shape web cần */
  function normalizeRow(row) {
    const r = { ...row };
    // "TRUE"/"FALSE" → boolean
    if ('featured' in r) r.featured = r.featured === true || String(r.featured).toUpperCase() === 'TRUE';
    // "a | b | c" → ['a','b','c']
    LIST_FIELDS.forEach(f => {
      if (typeof r[f] === 'string') {
        r[f] = r[f].split('|').map(s => s.trim()).filter(Boolean);
      } else if (f in r && !Array.isArray(r[f])) {
        r[f] = [];
      }
    });
    // Sheets đổi "06/2026" thành Date ISO → format lại MM/YYYY (Sheet ở GMT+7)
    if (typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(r.date)) {
      const d = new Date(new Date(r.date).getTime() + 7 * 3600 * 1000);
      if (!isNaN(d)) r.date = String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear();
    }
    // Ô trống trong Sheet trả về "" → null cho các field URL
    if (r.detailUrl === '') r.detailUrl = null;
    if (r.sourceUrl === '') r.sourceUrl = null;
    return r;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Fetch a sheet by name from the CMS (Google Sheets → Apps Script).
   * Falls back to the local JSON file if the API is unavailable.
   * @param {string} sheetName  e.g. 'Nganh' | 'CaseStudies'
   * @returns {Promise<Array>}
   */
  window.fetchCMS = async function fetchCMS(sheetName) {
    // 1. Try Google Sheets API
    if (CMS_SCRIPT_URL) {
      try {
        const url = `${CMS_SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}&cb=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            return data.map(normalizeRow);
          }
        }
      } catch (_) {
        // fall through to local fallback
      }
    }

    // 2. Local JSON fallback
    const localPath = FALLBACKS[sheetName];
    if (!localPath) return [];
    try {
      const res = await fetch(_cmsBase + localPath);
      return await res.json();
    } catch (_) {
      return [];
    }
  };

  /**
   * Push a data array back to Google Sheets (used by admin restore).
   * @param {string} sheetName
   * @param {Array}  data
   */
  window.pushCMS = async function pushCMS(sheetName, data) {
    if (!CMS_SCRIPT_URL) throw new Error('CMS_SCRIPT_URL not set');
    // Mảng → chuỗi "a | b | c" để ghi được vào ô Sheet (đọc lại sẽ tự split)
    const flat = data.map(row => {
      const r = { ...row };
      Object.keys(r).forEach(k => {
        if (Array.isArray(r[k])) r[k] = r[k].join(' | ');
      });
      return r;
    });
    // Content-Type text/plain để tránh CORS preflight — Apps Script không trả lời OPTIONS
    const res = await fetch(CMS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ sheet: sheetName, data: flat }),
    });
    return res.json();
  };

  /**
   * Trigger a server-side backup: Apps Script copies each CMS tab
   * into a hidden Backup_<name>_<timestamp> sheet (keeps last 10).
   */
  window.backupCMS = async function backupCMS() {
    if (!CMS_SCRIPT_URL) throw new Error('CMS_SCRIPT_URL not set');
    const res = await fetch(`${CMS_SCRIPT_URL}?action=backup&cb=${Date.now()}`);
    return res.json();
  };

  /**
   * Download data as a JSON file (backup).
   * @param {Array}  data
   * @param {string} filename  e.g. 'industries.json'
   */
  window.exportJSON = function exportJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };
})();
