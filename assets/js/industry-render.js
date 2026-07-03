/**
 * ERPVietResearch — Industry page dynamic renderer
 * Reads <meta name="industry-id" content="san-xuat"> from the page,
 * fetches the matching row from the CMS, then fills in all dynamic sections.
 * Requires cms.js to be loaded first.
 */
(async function () {
  // id lấy từ meta (5 trang ngành tĩnh) hoặc từ URL của trang template chi-tiet.html
  // Hỗ trợ cả ?id=xay-dung lẫn #xay-dung (một số server local bỏ mất query string)
  const meta = document.querySelector('meta[name="industry-id"]');
  const queryId = new URLSearchParams(location.search).get('id');
  const hashId = decodeURIComponent(location.hash.replace(/^#(id=)?/, '')) || null;
  const urlId = queryId || hashId;
  const industryId = (meta && meta.content) || urlId;
  if (!industryId) return;
  const isTemplate = !meta && !!urlId;

  let ind, all = [];
  try {
    all = await fetchCMS('Nganh');
    ind = all.find(r => r.id === industryId);
  } catch (_) {}

  // Cache có thể trả dữ liệu tức thì TRƯỚC khi DOM parse xong → phải chờ DOM
  if (document.readyState === 'loading') {
    await new Promise(res => document.addEventListener('DOMContentLoaded', res));
  }
  if (!ind) {
    // Template mà không tìm thấy ngành → báo rõ thay vì trang trắng
    if (isTemplate) {
      const h = document.getElementById('ind-hero-h1');
      if (h) h.textContent = 'Không tìm thấy ngành "' + industryId + '"';
      const l = document.getElementById('ind-hero-lede');
      if (l) l.textContent = 'Kiểm tra cột id trong Google Sheet tab Nganh, hoặc chờ vài phút nếu vừa tạo.';
    }
    return;
  }

  // ── Helper ───────────────────────────────────────────────────────────────────
  function set(id, html, useInner = true) {
    const el = document.getElementById(id);
    if (!el) return;
    if (useInner) el.innerHTML = html;
    else el.textContent = html;
  }

  // ── Trang template: điền title, eyebrow, diagram, related chips ─────────────
  if (isTemplate) {
    document.title = 'Business Central cho Ngành ' + (ind.label || '') + ' | ERPVietResearch';
    const eyebrow = document.getElementById('ind-eyebrow');
    if (eyebrow) eyebrow.textContent = 'Microsoft Dynamics 365 — Ngành ' + (ind.label || '');

    // Diagram: node từ tên module
    const diagramNodes = document.getElementById('ind-diagram-nodes');
    if (diagramNodes) {
      diagramNodes.innerHTML = [1, 2, 3, 4]
        .map(n => ind['mod' + n + '_ten'])
        .filter(Boolean)
        .map((ten, i) => `<div class="factory-node${i % 2 === 1 ? ' lvl2' : ''}"><span class="tag">MODULE 0${i + 1}</span>${ten}</div>`)
        .join('');
    }

    // Related chips: các ngành khác
    const related = document.getElementById('ind-related');
    if (related) {
      related.innerHTML = all.filter(r => r.id !== industryId).map(r => {
        const href = /chi-tiet\.html/.test(r.slug || '')
          ? 'chi-tiet.html?id=' + encodeURIComponent(r.id) + '#' + encodeURIComponent(r.id)
          : (r.slug || '').replace('pages/nganh/', '');
        return `<a href="${href}" class="related-chip"><span class="dot" style="background:${r.color || '#4A7C7C'}"></span>${r.label}</a>`;
      }).join('');
    }
  }

  // ── Hero ─────────────────────────────────────────────────────────────────────
  const heroH1 = document.getElementById('ind-hero-h1');
  if (heroH1 && ind.heroH1) heroH1.innerHTML = ind.heroH1;

  const heroLede = document.getElementById('ind-hero-lede');
  if (heroLede && ind.description) heroLede.textContent = ind.description;

  // ── Stat bar ─────────────────────────────────────────────────────────────────
  set('ind-stat-bar', `
    <div class="wrap">
      <div class="ind-stat-item"><b>${ind.stat1_so || ''}</b><span>${ind.stat1_mo || ''}</span></div>
      <div class="ind-stat-item"><b>${ind.stat2_so || ''}</b><span>${ind.stat2_mo || ''}</span></div>
      <div class="ind-stat-item"><b>${ind.stat3_so || ''}</b><span>${ind.stat3_mo || ''}</span></div>
    </div>
  `);

  // ── Pain cards ───────────────────────────────────────────────────────────────
  const painItems = [1, 2, 3].map(n => ({
    tieu_de: ind[`pain${n}_tieu_de`] || '',
    noi_dung: ind[`pain${n}_noi_dung`] || '',
    giai_phap: ind[`pain${n}_giai_phap`] || '',
  }));

  set('ind-pain-grid', painItems.map((p, i) => `
    <div class="pain-card">
      <span class="num">0${i + 1}</span>
      <h3>${p.tieu_de}</h3>
      <p>${p.noi_dung}</p>
      <div class="fix">→ Giải pháp: ${p.giai_phap}</div>
    </div>
  `).join(''));

  // ── Module table ─────────────────────────────────────────────────────────────
  const modRows = [1, 2, 3, 4].map(n => ({
    ten: ind[`mod${n}_ten`] || '',
    al: ind[`mod${n}_al`] || '',
    chuc_nang: ind[`mod${n}_chuc_nang`] || '',
    phu_hop: ind[`mod${n}_phu_hop`] || '',
  })).filter(r => r.ten);

  const modTable = document.getElementById('ind-module-table');
  if (modTable) {
    modTable.innerHTML = `
      <thead><tr><th>Module</th><th>Chức năng chính</th><th>Phù hợp với</th></tr></thead>
      <tbody>
        ${modRows.map(r => `
          <tr>
            <td class="mod-name">${r.ten}<span class="al">${r.al}</span></td>
            <td>${r.chuc_nang}</td>
            <td>${r.phu_hop}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
  }

  // ── Inline case study (phần tử #ind-case đã có class="case") ────────────────
  const caseEl = document.getElementById('ind-case');
  if (caseEl) {
    caseEl.classList.add('case');
    caseEl.innerHTML = `
      <div>
        <div class="eyebrow eyebrow--light">Case Study</div>
        <h3>${ind.case_ten_cong_ty || ''}</h3>
        <p>${ind.case_noi_dung || ''}</p>
        <a class="btn btn-outline-light" href="../case-studies/index.html">Xem tất cả case study →</a>
      </div>
      <div class="stat-row">
        <div class="stat"><b>${ind.stat1_so || ''}</b><span>${ind.stat1_mo || ''}</span></div>
        <div class="stat"><b>${ind.caseStat || ''}</b><span>${ind.caseStatLabel || ''}</span></div>
        <div class="stat"><b>${ind.case_tg_trien_khai || ''}</b><span>Thời gian triển khai</span></div>
      </div>
    `;
  }

  // ── CSS accent color ─────────────────────────────────────────────────────────
  if (ind.color) {
    document.documentElement.style.setProperty('--ind-color', ind.color);
  }
})();
