/**
 * ERPVietResearch — Auth: đăng nhập thành viên + quản lý user (Admin)
 * Cùng CMS_SCRIPT_URL với cms.js. GET cho action đọc, POST text/plain cho
 * action ghi (né CORS preflight — Apps Script không trả lời OPTIONS).
 * Yêu cầu: load sau cms.js (không bắt buộc, nhưng giữ thứ tự cho nhất quán).
 */
(function () {
  const CMS_SCRIPT_URL =
    window.CMS_SCRIPT_URL ||
    'https://script.google.com/macros/s/AKfycbztUFzen4DXhwbau6JIAnNbgPEf2MapMlz_nB30dxqSV6P4cBb9h66eEhrfNgPuhRGq/exec';

  const SESSION_KEY = 'erp_session_token';

  /**
   * Đăng nhập bằng username/password. Lưu token vào localStorage khi thành công.
   * @returns {Promise<{status:'ok', token, user:{id,name,role,package,email}}|{error:string}>}
   */
  window.login = async function login(username, password) {
    // Mật khẩu đi qua query string GET (giống pattern booking form hiện tại) —
    // chấp nhận theo mức bảo mật MVP đã thống nhất (không dùng cho hệ thống thanh toán thật).
    const url = `${CMS_SCRIPT_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&cb=${Date.now()}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'ok' && data.token) localStorage.setItem(SESSION_KEY, data.token);
    return data;
  };

  /** Đăng xuất: xóa token cục bộ + báo server xóa token phía Sheet. */
  window.logout = async function logout() {
    const token = localStorage.getItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    if (!token) return { status: 'ok' };
    const res = await fetch(`${CMS_SCRIPT_URL}?action=logout&token=${encodeURIComponent(token)}&cb=${Date.now()}`);
    return res.json();
  };

  /**
   * Kiểm tra phiên đăng nhập hiện tại.
   * @returns {Promise<{valid:true, user:{...}}|{valid:false}>}
   */
  window.getSession = async function getSession() {
    const token = localStorage.getItem(SESSION_KEY);
    if (!token) return { valid: false };
    try {
      const res = await fetch(`${CMS_SCRIPT_URL}?action=verifySession&token=${encodeURIComponent(token)}&cb=${Date.now()}`);
      return await res.json();
    } catch (_) {
      return { valid: false };
    }
  };

  // ── Admin: quản lý Users (cần Admin Secret, cấu hình trong Apps Script Script Properties) ──
  const ADMIN_SECRET_KEY = 'erp_admin_secret';
  function getAdminSecret() { return sessionStorage.getItem(ADMIN_SECRET_KEY) || ''; }
  window.setAdminSecret = function setAdminSecret(secret) { sessionStorage.setItem(ADMIN_SECRET_KEY, secret); };

  window.adminListUsers = async function adminListUsers() {
    const res = await fetch(`${CMS_SCRIPT_URL}?action=adminListUsers&secret=${encodeURIComponent(getAdminSecret())}&cb=${Date.now()}`);
    return res.json();
  };

  window.adminSaveUser = async function adminSaveUser(user) {
    const res = await fetch(CMS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'adminSaveUser', secret: getAdminSecret(), user }),
    });
    return res.json();
  };

  window.adminDeleteUser = async function adminDeleteUser(id) {
    const res = await fetch(CMS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'adminDeleteUser', secret: getAdminSecret(), id }),
    });
    return res.json();
  };
})();
