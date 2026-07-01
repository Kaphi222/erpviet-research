const DATA_FILES = {
  industries: '../data/industries.json',
  cases: '../data/case-studies.json',
  site: '../data/site.json'
};

const PANEL_TITLES = {
  industries: 'Quản lý Ngành nghề',
  cases: 'Quản lý Case Studies',
  site: 'Cấu hình Site',
  guide: 'Hướng dẫn Publish',
  preview: 'Links trang'
};

let data = { industries: [], cases: [], site: {} };
let currentPanel = 'industries';
let editingIndex = -1;
let modalType = '';

async function loadAll() {
  for (const [key, url] of Object.entries(DATA_FILES)) {
    const draft = localStorage.getItem('draft_' + key);
    if (draft) {
      try { data[key] = JSON.parse(draft); continue; } catch(e) {}
    }
    try {
      const res = await fetch(url);
      data[key] = await res.json();
      localStorage.setItem('draft_' + key, JSON.stringify(data[key]));
    } catch(e) {
      console.warn('Could not load', url, e);
    }
  }
  renderAll();
}

function renderAll() {
  renderIndustries();
  renderCases();
  renderSiteForm();
  updateBadges();
}

function renderIndustries() {
  const ind = data.industries || [];
  document.getElementById('s-ind-count').textContent = ind.length;
  document.getElementById('s-ind-pain').textContent = ind.reduce((s,i)=>s+(i.painPoints?.length||0),0);
  document.getElementById('s-ind-mod').textContent = ind.reduce((s,i)=>s+(i.keyModules?.length||0),0);
  const tbody = document.getElementById('ind-tbody');
  if (!ind.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><div class="icon">🏭</div><p>Chưa có dữ liệu. Nhấn + Thêm ngành.</p></div></td></tr>'; return; }
  tbody.innerHTML = ind.map((item, i) => `
    <tr>
      <td class="td-id">${item.id || '—'}</td>
      <td><strong>${item.label || ''}</strong><br><small style="color:#999;font-size:11px;">${item.labelEn || ''}</small></td>
      <td style="max-width:200px;font-size:12px;">${item.tagline || '—'}</td>
      <td><span class="td-tag">${item.painPoints?.length || 0} điểm</span></td>
      <td><span class="td-tag">${item.keyModules?.length || 0} module</span></td>
      <td><div class="td-actions">
        <button class="btn btn-secondary btn-sm" onclick="editIndustry(${i})">✏️ Sửa</button>
        <button class="btn btn-danger btn-sm" onclick="deleteItem('industries',${i})">🗑</button>
      </div></td>
    </tr>`).join('');
}

function renderCases() {
  const cases = data.cases || [];
  const industries = [...new Set(cases.map(c=>c.industry).filter(Boolean))];
  document.getElementById('s-case-count').textContent = cases.length;
  document.getElementById('s-case-featured').textContent = cases.filter(c=>c.featured).length;
  document.getElementById('s-case-ind').textContent = industries.length;
  const sorted = [...cases].sort((a,b)=>b.date?.localeCompare(a.date||'')||0);
  document.getElementById('s-case-recent').textContent = sorted[0]?.date || '—';
  const tbody = document.getElementById('case-tbody');
  if (!cases.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="icon">📋</div><p>Chưa có case study.</p></div></td></tr>'; return; }
  tbody.innerHTML = cases.map((item, i) => `
    <tr>
      <td class="td-id">${item.id || '—'}</td>
      <td><strong>${item.company || '—'}</strong><br><small style="color:#999;font-size:11px;">${item.location || ''}</small></td>
      <td><span class="td-tag">${item.industryLabel || item.industry || '—'}</span></td>
      <td style="max-width:220px;font-size:12px;">${item.title || '—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;">${item.date || '—'}</td>
      <td>${item.featured ? '<span class="td-featured">⭐ Featured</span>' : '<span style="color:#ccc;font-size:12px;">—</span>'}</td>
      <td><div class="td-actions">
        <button class="btn btn-secondary btn-sm" onclick="editCase(${i})">✏️ Sửa</button>
        <button class="btn btn-danger btn-sm" onclick="deleteItem('cases',${i})">🗑</button>
      </div></td>
    </tr>`).join('');
}

function renderSiteForm() {
  const s = data.site || {};
  document.getElementById('siteForm').innerHTML = `
    <div class="form-row"><div class="field"><label>Tên site</label><input id="sf-siteName" value="${s.siteName||''}" /></div><div class="field"><label>Tagline</label><input id="sf-tagline" value="${s.tagline||''}" /></div></div>
    <div class="form-row"><div class="field"><label>Email liên hệ</label><input id="sf-email" value="${s.contact?.email||''}" /></div><div class="field"><label>Điện thoại</label><input id="sf-phone" value="${s.contact?.phone||''}" /></div></div>
    <div class="form-row"><div class="field"><label>Stat 1 — Label</label><input id="sf-s1l" value="${s.stats?.[0]?.label||''}" /></div><div class="field"><label>Stat 1 — Value</label><input id="sf-s1v" value="${s.stats?.[0]?.value||''}" /></div></div>
    <div class="form-row"><div class="field"><label>Stat 2 — Label</label><input id="sf-s2l" value="${s.stats?.[1]?.label||''}" /></div><div class="field"><label>Stat 2 — Value</label><input id="sf-s2v" value="${s.stats?.[1]?.value||''}" /></div></div>
    <div class="form-row"><div class="field"><label>Stat 3 — Label</label><input id="sf-s3l" value="${s.stats?.[2]?.label||''}" /></div><div class="field"><label>Stat 3 — Value</label><input id="sf-s3v" value="${s.stats?.[2]?.value||''}" /></div></div>
    <div class="form-row"><div class="field"><label>Stat 4 — Label</label><input id="sf-s4l" value="${s.stats?.[3]?.label||''}" /></div><div class="field"><label>Stat 4 — Value</label><input id="sf-s4v" value="${s.stats?.[3]?.value||''}" /></div></div>`;
}

function saveSiteConfig() {
  data.site = {
    ...data.site,
    siteName: document.getElementById('sf-siteName').value,
    tagline: document.getElementById('sf-tagline').value,
    contact: { email: document.getElementById('sf-email').value, phone: document.getElementById('sf-phone').value },
    stats: [
      { label: document.getElementById('sf-s1l').value, value: document.getElementById('sf-s1v').value },
      { label: document.getElementById('sf-s2l').value, value: document.getElementById('sf-s2v').value },
      { label: document.getElementById('sf-s3l').value, value: document.getElementById('sf-s3v').value },
      { label: document.getElementById('sf-s4l').value, value: document.getElementById('sf-s4v').value },
    ]
  };
  localStorage.setItem('draft_site', JSON.stringify(data.site));
  showAlert('✅ Đã lưu cấu hình site vào localStorage. Nhấn Xuất JSON để tải về.', 'success');
}

function updateBadges() {
  document.getElementById('badge-industries').textContent = (data.industries||[]).length;
  document.getElementById('badge-cases').textContent = (data.cases||[]).length;
}

function showPanel(name) {
  currentPanel = name;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  event.currentTarget.classList.add('active');
  document.getElementById('panelTitle').textContent = PANEL_TITLES[name] || name;
}

// --- INDUSTRY MODAL ---
function openAddIndustry() { editingIndex = -1; modalType = 'industry'; showIndustryModal({}); }
function editIndustry(i) { editingIndex = i; modalType = 'industry'; showIndustryModal(data.industries[i]); }
function showIndustryModal(item) {
  document.getElementById('modalTitle').textContent = editingIndex >= 0 ? 'Sửa ngành' : 'Thêm ngành mới';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-row"><div class="field"><label>ID <span style="color:red">*</span></label><input id="mi-id" value="${item.id||''}" placeholder="manufacturing"/><div class="hint">Không dấu, không cách (slug)</div></div><div class="field"><label>Slug URL</label><input id="mi-slug" value="${item.slug||''}" placeholder="san-xuat"/></div></div>
    <div class="form-row"><div class="field"><label>Tên tiếng Việt <span style="color:red">*</span></label><input id="mi-label" value="${item.label||''}"/></div><div class="field"><label>Tên tiếng Anh</label><input id="mi-labelEn" value="${item.labelEn||''}"/></div></div>
    <div class="form-row full"><div class="field"><label>Tagline</label><input id="mi-tagline" value="${item.tagline||''}"/></div></div>
    <div class="form-row full"><div class="field"><label>Mô tả ngắn</label><textarea id="mi-desc">${item.description||''}</textarea></div></div>
    <div class="form-row full"><div class="field"><label>Pain Points (mỗi dòng 1 điểm)</label><textarea id="mi-pain">${(item.painPoints||[]).join('\n')}</textarea></div></div>
    <div class="form-row full"><div class="field"><label>Key Modules (mỗi dòng 1 module)</label><textarea id="mi-mods">${(item.keyModules||[]).join('\n')}</textarea></div></div>
    <div class="form-row"><div class="field"><label>Màu accent (hex)</label><input id="mi-color" value="${item.color||'#4A7C7C'}"/></div><div class="field"><label>Case Stat</label><input id="mi-stat" value="${item.caseStat||''}" placeholder="15 case study"/></div></div>`;
  openModal();
}

// --- CASE MODAL ---
function openAddCase() { editingIndex = -1; modalType = 'case'; showCaseModal({}); }
function editCase(i) { editingIndex = i; modalType = 'case'; showCaseModal(data.cases[i]); }
function showCaseModal(item) {
  document.getElementById('modalTitle').textContent = editingIndex >= 0 ? 'Sửa case study' : 'Thêm case study mới';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-row"><div class="field"><label>ID <span style="color:red">*</span></label><input id="mc-id" value="${item.id||''}"/></div><div class="field"><label>Slug</label><input id="mc-slug" value="${item.slug||''}" placeholder="horizon-stone"/></div></div>
    <div class="form-row"><div class="field"><label>Công ty <span style="color:red">*</span></label><input id="mc-company" value="${item.company||''}"/></div><div class="field"><label>Địa điểm</label><input id="mc-location" value="${item.location||''}" placeholder="Hà Nội, Việt Nam"/></div></div>
    <div class="form-row"><div class="field"><label>Ngành (ID)</label><input id="mc-industry" value="${item.industry||''}" placeholder="manufacturing"/></div><div class="field"><label>Nhãn ngành</label><input id="mc-industryLabel" value="${item.industryLabel||''}" placeholder="Sản xuất"/></div></div>
    <div class="form-row full"><div class="field"><label>Tiêu đề</label><input id="mc-title" value="${item.title||''}"/></div></div>
    <div class="form-row full"><div class="field"><label>Tóm tắt</label><textarea id="mc-summary">${item.summary||''}</textarea></div></div>
    <div class="form-row full"><div class="field"><label>Kết quả (mỗi dòng 1 kết quả)</label><textarea id="mc-results">${(item.results||[]).join('\n')}</textarea></div></div>
    <div class="form-row full"><div class="field"><label>Giải pháp module (mỗi dòng 1 module)</label><textarea id="mc-solutions">${(item.solutions||[]).join('\n')}</textarea></div></div>
    <div class="form-row"><div class="field"><label>Ngày (MMM YYYY)</label><input id="mc-date" value="${item.date||''}" placeholder="Jan 2026"/></div><div class="field"><label>Link trang chi tiết</label><input id="mc-detailUrl" value="${item.detailUrl||''}"/></div></div>
    <div class="form-row"><div class="field"><label>Link nguồn gốc</label><input id="mc-sourceUrl" value="${item.sourceUrl||''}"/></div><div class="field" style="padding-top:20px;"><div class="checkbox-row"><input type="checkbox" id="mc-featured" ${item.featured?'checked':''}/><label for="mc-featured">Hiển thị là Featured (spotlight)</label></div></div></div>`;
  openModal();
}

function modalSave() {
  if (modalType === 'industry') saveIndustry();
  else if (modalType === 'case') saveCase();
}

function saveIndustry() {
  const item = {
    id: document.getElementById('mi-id').value.trim(),
    slug: document.getElementById('mi-slug').value.trim(),
    label: document.getElementById('mi-label').value.trim(),
    labelEn: document.getElementById('mi-labelEn').value.trim(),
    tagline: document.getElementById('mi-tagline').value.trim(),
    description: document.getElementById('mi-desc').value.trim(),
    painPoints: document.getElementById('mi-pain').value.split('\n').map(s=>s.trim()).filter(Boolean),
    keyModules: document.getElementById('mi-mods').value.split('\n').map(s=>s.trim()).filter(Boolean),
    color: document.getElementById('mi-color').value.trim(),
    caseStat: document.getElementById('mi-stat').value.trim()
  };
  if (!item.id || !item.label) { alert('ID và Tên ngành là bắt buộc.'); return; }
  if (editingIndex >= 0) data.industries[editingIndex] = item;
  else data.industries.push(item);
  localStorage.setItem('draft_industries', JSON.stringify(data.industries));
  renderIndustries(); updateBadges(); closeModal();
  showAlert('✅ Đã lưu ngành "' + item.label + '". Nhấn Xuất JSON để tải về và commit.', 'success');
}

function saveCase() {
  const item = {
    id: document.getElementById('mc-id').value.trim(),
    slug: document.getElementById('mc-slug').value.trim(),
    company: document.getElementById('mc-company').value.trim(),
    location: document.getElementById('mc-location').value.trim(),
    industry: document.getElementById('mc-industry').value.trim(),
    industryLabel: document.getElementById('mc-industryLabel').value.trim(),
    title: document.getElementById('mc-title').value.trim(),
    summary: document.getElementById('mc-summary').value.trim(),
    results: document.getElementById('mc-results').value.split('\n').map(s=>s.trim()).filter(Boolean),
    solutions: document.getElementById('mc-solutions').value.split('\n').map(s=>s.trim()).filter(Boolean),
    date: document.getElementById('mc-date').value.trim(),
    detailUrl: document.getElementById('mc-detailUrl').value.trim(),
    sourceUrl: document.getElementById('mc-sourceUrl').value.trim(),
    featured: document.getElementById('mc-featured').checked
  };
  if (!item.id || !item.company) { alert('ID và Công ty là bắt buộc.'); return; }
  if (editingIndex >= 0) data.cases[editingIndex] = item;
  else data.cases.push(item);
  localStorage.setItem('draft_cases', JSON.stringify(data.cases));
  renderCases(); updateBadges(); closeModal();
  showAlert('✅ Đã lưu case "' + item.company + '". Nhấn Xuất JSON để tải về.', 'success');
}

function deleteItem(type, i) {
  const arr = type === 'industries' ? data.industries : data.cases;
  const name = arr[i]?.label || arr[i]?.company || 'mục này';
  if (!confirm('Xóa "' + name + '"?')) return;
  arr.splice(i, 1);
  localStorage.setItem('draft_' + (type === 'industries' ? 'industries' : 'cases'), JSON.stringify(arr));
  if (type === 'industries') renderIndustries(); else renderCases();
  updateBadges();
}

function exportCurrent() {
  let key, filename, content;
  if (currentPanel === 'industries') { key = 'industries'; filename = 'industries.json'; content = data.industries; }
  else if (currentPanel === 'cases') { key = 'cases'; filename = 'case-studies.json'; content = data.cases; }
  else if (currentPanel === 'site') { key = 'site'; filename = 'site.json'; content = data.site; }
  else { showAlert('⚠️ Chọn tab Industries, Cases, hoặc Site để xuất JSON.', 'info'); return; }
  downloadJSON(filename, content);
  showAlert('⬇️ Đã xuất <strong>' + filename + '</strong>. Thay file trong thư mục <code>/data/</code> rồi commit lên GitHub.', 'success');
}

function downloadJSON(filename, content) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function resetDraft() {
  if (!confirm('Xóa toàn bộ draft trong localStorage và load lại từ file JSON trên server?')) return;
  ['industries', 'cases', 'site'].forEach(k => localStorage.removeItem('draft_' + k));
  loadAll();
  showAlert('↺ Đã reset. Dữ liệu được load lại từ file JSON gốc.', 'info');
}

function openModal() { document.getElementById('modal').style.display = 'flex'; }
function closeModal() { document.getElementById('modal').style.display = 'none'; }

function showAlert(msg, type) {
  const box = document.getElementById('alertBox');
  box.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  box.style.display = 'block';
  setTimeout(() => { box.style.display = 'none'; }, 5000);
}

loadAll();
