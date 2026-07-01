(function () {
  'use strict';

  /* ── Resolve root-relative paths based on current page depth ── */
  function rootPath(rel) {
    // Count how many directories deep we are from root
    const depth = window.location.pathname.split('/').filter(Boolean).length - 1;
    if (depth <= 0) return rel;
    return '../'.repeat(depth) + rel;
  }

  const base = rootPath('');

  /* ── Active nav detection ── */
  function isActive(href) {
    const path = window.location.pathname;
    if (href === base + 'index.html' || href === base) {
      return path === '/' || path.endsWith('index.html');
    }
    return path.includes(href.replace(base, ''));
  }

  function navLink(href, label) {
    const active = isActive(href) ? ' class="active"' : '';
    return `<a href="${href}"${active}>${label}</a>`;
  }

  /* ── Header HTML ── */
  const header = `
<div class="wrap">
  <div class="topbar">
    <a href="${base}index.html" class="logo">ERP<span>Việt</span>Research</a>
    <nav class="site-nav">
      ${navLink(base + 'index.html', 'Trang chủ')}
      <div class="nav-dropdown">
        <a href="#">Ngành nghề</a>
        <div class="dropdown-menu">
          <a href="${base}pages/nganh/san-xuat.html">Sản xuất</a>
          <a href="${base}pages/nganh/ban-le.html">Bán lẻ</a>
          <a href="${base}pages/nganh/phan-phoi.html">Phân phối</a>
          <a href="${base}pages/nganh/fb.html">F&amp;B</a>
          <a href="${base}pages/nganh/dich-vu-du-an.html">Dịch vụ / Dự án</a>
        </div>
      </div>
      ${navLink(base + 'pages/case-studies/index.html', 'Case Study')}
      <a href="${base}pages/dat-lich-tu-van.html" class="nav-cta">Đặt lịch tư vấn</a>
    </nav>
  </div>
</div>`;

  /* ── Footer HTML ── */
  const footer = `
<div class="wrap">
  <div class="footer-inner">
    <div class="footer-brand">
      <a href="${base}index.html" class="logo">ERP<span>Việt</span>Research</a>
      <p style="margin-top:10px;">Thư viện thông tin ERP độc lập cho doanh nghiệp Việt Nam. Tập trung vào Microsoft Dynamics 365 Business Central.</p>
    </div>
    <div class="footer-col">
      <h4>Ngành nghề</h4>
      <a href="${base}pages/nganh/san-xuat.html">Sản xuất</a>
      <a href="${base}pages/nganh/ban-le.html">Bán lẻ</a>
      <a href="${base}pages/nganh/phan-phoi.html">Phân phối</a>
      <a href="${base}pages/nganh/fb.html">F&amp;B</a>
      <a href="${base}pages/nganh/dich-vu-du-an.html">Dịch vụ / Dự án</a>
    </div>
    <div class="footer-col">
      <h4>Case Study</h4>
      <a href="${base}pages/case-studies/index.html">Tất cả case study</a>
      <a href="${base}pages/case-studies/horizon-stone.html">Horizon Stone</a>
    </div>
    <div class="footer-col">
      <h4>Liên hệ</h4>
      <a href="${base}pages/dat-lich-tu-van.html">Đặt lịch tư vấn</a>
      <a href="mailto:hello@erpvietresearch.com">hello@erpvietresearch.com</a>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 ERPVietResearch — Thư viện độc lập về Microsoft ERP</span>
    <span style="font-size:10px;">Nội dung tham khảo từ dmsiworks.com / Insight Works — phân tích lại cho bối cảnh Việt Nam</span>
  </div>
</div>`;

  /* ── Inject into DOM ── */
  document.addEventListener('DOMContentLoaded', function () {
    const headerEl = document.getElementById('site-header');
    if (headerEl) headerEl.innerHTML = header;

    const footerEl = document.getElementById('site-footer');
    if (footerEl) footerEl.innerHTML = footer;
  });
})();
