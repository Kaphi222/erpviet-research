/**
 * ERPVietResearch — Industry page dynamic renderer
 * Reads <meta name="industry-id" content="san-xuat"> from the page,
 * fetches the matching row from the CMS, then fills in all dynamic sections.
 * Requires cms.js to be loaded first.
 */
(async function () {
  const meta = document.querySelector('meta[name="industry-id"]');
  if (!meta) return;
  const industryId = meta.content;

  let ind;
  try {
    const all = await fetchCMS('Nganh');
    ind = all.find(r => r.id === industryId);
  } catch (_) {}
  if (!ind) return;

  // ── Helper ───────────────────────────────────────────────────────────────────
  function set(id, html, useInner = true) {
    const el = document.getElementById(id);
    if (!el) return;
    if (useInner) el.innerHTML = html;
    else el.textContent = html;
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

  // ── Inline case study ────────────────────────────────────────────────────────
  set('ind-case', `
    <div class="case">
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
    </div>
  `);

  // ── CSS accent color ─────────────────────────────────────────────────────────
  if (ind.color) {
    document.documentElement.style.setProperty('--ind-color', ind.color);
  }
})();
