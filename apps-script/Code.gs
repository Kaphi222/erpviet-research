/**
 * ERPVietResearch — Google Apps Script (BẢN ĐẦY ĐỦ)
 * ==================================================
 * Chức năng:
 *   1. Nhận booking form (GET ?name=...)            → ghi vào tab "Responses"
 *   2. CMS đọc dữ liệu (GET ?sheet=Nganh)           → trả JSON cho website
 *   3. CMS restore (POST {sheet, data})             → ghi đè tab từ file JSON
 *   4. Backup (GET ?action=backup)                  → sao chép tab CMS thành tab Backup_<ngày giờ>
 *   5. setupSheets() — chạy tay 1 lần               → tự tạo tab Nganh + CaseStudies với headers
 *   6. Users: đăng nhập/phiên (GET ?action=login|verifySession|logout)
 *      + quản lý user cho Admin (cần ?secret=... khớp ADMIN_SECRET):
 *      GET ?action=adminListUsers, POST {action:'adminSaveUser'|'adminDeleteUser', secret, ...}
 *   7. setupUsersSheet() — chạy tay 1 lần            → tự tạo tab Users với headers
 *
 * CÁCH DÙNG:
 *   - Thay SHEET_ID bên dưới bằng ID Google Sheet của bạn
 *   - Chạy hàm setupSheets() và setupUsersSheet() 1 lần (chọn hàm → Run) để tạo tab
 *   - Set ADMIN_SECRET: Project Settings → Script Properties → thêm key ADMIN_SECRET,
 *     giá trị là 1 chuỗi ngẫu nhiên dài (dùng làm mật khẩu bảo vệ API quản lý Users)
 *   - Deploy: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone
 *   - Copy URL /exec mới → dán vào assets/js/cms.js, assets/js/auth.js và pages/dat-lich-tu-van.html
 */

const SHEET_ID = '1tVbEjOf9MwvsaEauMPRklf-vt4s-K7JaR9VL-JVKYgA'; // ← ID Sheet của bạn

// Các tab CMS được phép đọc/ghi/backup qua ?sheet=... (public, không xác thực)
// ⚠️ KHÔNG BAO GIỜ thêm 'Users' vào đây — tab Users chứa password hash,
// chỉ được truy cập qua các action adminXxx có kiểm tra secret riêng bên dưới.
const CMS_SHEETS = ['Nganh', 'CaseStudies'];

// ─────────────────────────────────────────────────────────────────────────────
// Users — quản lý tài khoản (admin/content/member/vip/partner) + đăng nhập
// ─────────────────────────────────────────────────────────────────────────────
const USERS_SHEET = 'Users';
const USER_HEADERS = ['id', 'username', 'passwordHash', 'passwordSalt', 'name', 'email', 'phone', 'role', 'package', 'status', 'sessionToken', 'sessionExpires', 'createdAt', 'updatedAt'];
const SECRET_FIELDS = ['passwordHash', 'passwordSalt', 'sessionToken'];

// ─────────────────────────────────────────────────────────────────────────────
// doGet — xử lý 3 loại request: CMS read / backup / booking form
// ─────────────────────────────────────────────────────────────────────────────
function doGet(e) {
  const p = (e && e.parameter) || {};
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // ── 1. Backup: ?action=backup ──────────────────────────────────────────────
  if (p.action === 'backup') {
    return json(runBackup(ss));
  }

  // ── 1b. Auth (public): đăng nhập / kiểm tra phiên / đăng xuất ──────────────
  if (p.action === 'login') return json(handleLogin(ss, p.username, p.password));
  if (p.action === 'verifySession') return json(handleVerifySession(ss, p.token));
  if (p.action === 'logout') return json(handleLogout(ss, p.token));

  // ── 1c. Admin Users (cần secret): chỉ đọc danh sách qua GET ────────────────
  if (p.action === 'adminListUsers') {
    if (!checkAdminSecret(p)) return json({ error: 'unauthorized' });
    const sheet = getUsersSheet(ss);
    const rows = sheet ? readUsersRows(sheet).map(stripSecrets) : [];
    return json({ status: 'ok', users: rows });
  }

  // ── 2. CMS read: ?sheet=Nganh hoặc ?sheet=CaseStudies ─────────────────────
  if (p.sheet) {
    if (CMS_SHEETS.indexOf(p.sheet) === -1) {
      return json({ error: 'Sheet not allowed: ' + p.sheet });
    }
    const sheet = ss.getSheetByName(p.sheet);
    if (!sheet) return json({ error: 'Sheet not found: ' + p.sheet });

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return json([]);

    const headers = rows[0];
    const data = rows.slice(1)
      .filter(function (r) { return r[0] !== '' && r[0] !== null; })
      .map(function (r) {
        const obj = {};
        headers.forEach(function (h, i) {
          if (h) obj[h] = r[i];
        });
        return obj;
      });
    return json(data);
  }

  // ── 3. Booking form: ?name=... ─────────────────────────────────────────────
  if (p.name) {
    const bookingSheet = ss.getSheetByName('Responses') || ss.getSheets()[0];
    bookingSheet.appendRow([
      new Date(),
      p.name || '', p.company || '', p.email || '', p.phone || '',
      p.role || '', p.industry || '', p.topics || '',
      p.date || '', p.time || '',
      p.current || '', p.size || '', p.note || ''
    ]);
    return json({ status: 'ok', type: 'booking' });
  }

  return json({ status: 'ok', message: 'ERPVietResearch API. Params: ?sheet=Nganh | ?action=backup | ?name=... (booking)' });
}

// ─────────────────────────────────────────────────────────────────────────────
// doPost — CMS restore: ghi đè tab từ JSON (gửi từ Admin Panel)
// Body: { "sheet": "Nganh", "data": [ {...}, {...} ] }
// ─────────────────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);

    // ── Admin Users (cần secret): tạo/sửa/xóa user ───────────────────────────
    if (p.action === 'adminSaveUser') {
      if (!checkAdminSecret(p)) return json({ error: 'unauthorized' });
      return json(handleSaveUser(SpreadsheetApp.openById(SHEET_ID), p.user));
    }
    if (p.action === 'adminDeleteUser') {
      if (!checkAdminSecret(p)) return json({ error: 'unauthorized' });
      return json(handleDeleteUser(SpreadsheetApp.openById(SHEET_ID), p.id));
    }

    if (CMS_SHEETS.indexOf(p.sheet) === -1) {
      return json({ error: 'Sheet not allowed: ' + p.sheet });
    }
    if (!p.data || !p.data.length) {
      return json({ error: 'No data provided' });
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);

    // Tự động backup trước khi ghi đè — an toàn khi restore nhầm file
    runBackup(ss, [p.sheet]);

    let sheet = ss.getSheetByName(p.sheet);
    if (!sheet) sheet = ss.insertSheet(p.sheet);

    // Gom tất cả key từ mọi hàng (phòng khi hàng đầu thiếu field)
    const headerSet = {};
    p.data.forEach(function (row) {
      Object.keys(row).forEach(function (k) { headerSet[k] = true; });
    });
    const headers = Object.keys(headerSet);

    // Ghi 1 lần bằng setValues (nhanh hơn appendRow từng dòng)
    const values = [headers];
    p.data.forEach(function (row) {
      values.push(headers.map(function (h) {
        return row[h] !== undefined && row[h] !== null ? row[h] : '';
      }));
    });

    sheet.clearContents();
    sheet.getRange(1, 1, values.length, headers.length).setValues(values);

    return json({ status: 'ok', rows: p.data.length, sheet: p.sheet });
  } catch (err) {
    return json({ error: String(err) });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Backup — sao chép các tab CMS thành tab "Backup_Nganh_20260702_1430"
// Giữ tối đa 10 bản backup gần nhất cho mỗi tab, tự xóa bản cũ hơn
// ─────────────────────────────────────────────────────────────────────────────
function runBackup(ss, sheetNames) {
  const targets = sheetNames || CMS_SHEETS;
  const stamp = Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmm');
  const created = [];

  targets.forEach(function (name) {
    const src = ss.getSheetByName(name);
    if (!src) return;

    const backupName = 'Backup_' + name + '_' + stamp;
    // Nếu backup cùng phút đã tồn tại thì bỏ qua
    if (ss.getSheetByName(backupName)) return;

    const copy = src.copyTo(ss);
    copy.setName(backupName);
    copy.hideSheet(); // ẩn đi cho gọn, vẫn xem được qua menu View
    created.push(backupName);

    // Dọn dẹp: giữ 10 bản gần nhất cho mỗi tab
    const prefix = 'Backup_' + name + '_';
    const backups = ss.getSheets()
      .map(function (s) { return s.getName(); })
      .filter(function (n) { return n.indexOf(prefix) === 0; })
      .sort(); // tên chứa timestamp nên sort = theo thời gian
    while (backups.length > 10) {
      const oldest = backups.shift();
      ss.deleteSheet(ss.getSheetByName(oldest));
    }
  });

  return { status: 'ok', backups: created };
}

// Chạy tay để backup ngay (chọn hàm này → Run)
function backupNow() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const result = runBackup(ss);
  Logger.log(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// setupSheets — CHẠY TAY 1 LẦN: tạo tab Nganh + CaseStudies với đầy đủ headers
// Không xóa dữ liệu nếu tab đã tồn tại và có nội dung
// ─────────────────────────────────────────────────────────────────────────────
function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const NGANH_HEADERS = [
    'id', 'slug', 'label', 'labelEn', 'color', 'tagline', 'description', 'heroH1',
    'stat1_so', 'stat1_mo', 'stat2_so', 'stat2_mo', 'stat3_so', 'stat3_mo',
    'pain1_tieu_de', 'pain1_noi_dung', 'pain1_giai_phap',
    'pain2_tieu_de', 'pain2_noi_dung', 'pain2_giai_phap',
    'pain3_tieu_de', 'pain3_noi_dung', 'pain3_giai_phap',
    'mod1_ten', 'mod1_al', 'mod1_chuc_nang', 'mod1_phu_hop',
    'mod2_ten', 'mod2_al', 'mod2_chuc_nang', 'mod2_phu_hop',
    'mod3_ten', 'mod3_al', 'mod3_chuc_nang', 'mod3_phu_hop',
    'mod4_ten', 'mod4_al', 'mod4_chuc_nang', 'mod4_phu_hop',
    'case_ten_cong_ty', 'case_noi_dung', 'case_tg_trien_khai',
    'caseStatLabel', 'caseStat'
  ];

  const CASE_HEADERS = [
    'id', 'company', 'location', 'industry', 'industryLabel',
    'title', 'summary',
    'result1', 'result2', 'result3',
    'solution1', 'solution2', 'solution3',
    'date', 'featured', 'detailUrl', 'sourceUrl'
  ];

  createSheetWithHeaders(ss, 'Nganh', NGANH_HEADERS);
  createSheetWithHeaders(ss, 'CaseStudies', CASE_HEADERS);

  Logger.log('✓ Đã tạo xong tab Nganh và CaseStudies. Tiếp theo: dùng Admin Panel → Restore từ JSON để nạp dữ liệu.');
}

function createSheetWithHeaders(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (sheet && sheet.getLastRow() > 1) {
    Logger.log('Tab "' + name + '" đã có dữ liệu — bỏ qua, không ghi đè.');
    return;
  }
  if (!sheet) sheet = ss.insertSheet(name);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Định dạng hàng header: đậm, nền xám, đóng băng
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#E8E6E1');
  sheet.setFrozenRows(1);

  Logger.log('✓ Tạo tab "' + name + '" với ' + headers.length + ' cột.');
}

// ─────────────────────────────────────────────────────────────────────────────
// setupUsersSheet — CHẠY TAY 1 LẦN: tạo tab Users với đầy đủ headers
// ─────────────────────────────────────────────────────────────────────────────
function setupUsersSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  createSheetWithHeaders(ss, USERS_SHEET, USER_HEADERS);
  Logger.log('✓ Đã tạo xong tab Users. Nhớ set ADMIN_SECRET trong Project Settings → Script Properties.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Users — hàm trợ giúp
// ─────────────────────────────────────────────────────────────────────────────
function hashPassword(password, salt) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + ':' + salt);
  return Utilities.base64Encode(raw);
}
function makeSalt() {
  return Utilities.base64Encode(Utilities.getUuid() + Utilities.getUuid());
}
function makeToken() {
  return Utilities.base64EncodeWebSafe(Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid());
}
function stripSecrets(userObj) {
  const out = Object.assign({}, userObj);
  SECRET_FIELDS.forEach(function (f) { delete out[f]; });
  return out;
}
function getUsersSheet(ss) {
  return ss.getSheetByName(USERS_SHEET);
}
function readUsersRows(sheet) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1)
    .filter(function (r) { return r[0] !== '' && r[0] !== null; })
    .map(function (r, idx) {
      const obj = { _row: idx + 2 };
      headers.forEach(function (h, i) { if (h) obj[h] = r[i]; });
      return obj;
    });
}
function checkAdminSecret(p) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_SECRET');
  return !!(expected && p.secret && p.secret === expected);
}

// ─────────────────────────────────────────────────────────────────────────────
// Users — đăng nhập / phiên đăng nhập / đăng xuất (public)
// ─────────────────────────────────────────────────────────────────────────────
function handleLogin(ss, username, password) {
  if (!username || !password) return { error: 'Thieu username hoac mat khau' };
  const sheet = getUsersSheet(ss);
  if (!sheet) return { error: 'Chua khoi tao Users sheet' };
  const rows = readUsersRows(sheet);
  const user = rows.find(function (u) { return String(u.username).toLowerCase() === String(username).toLowerCase(); });
  if (!user) return { error: 'Sai tai khoan hoac mat khau' };
  if (user.status !== 'active') return { error: 'Tai khoan da bi khoa' };
  const hash = hashPassword(password, user.passwordSalt);
  if (hash !== user.passwordHash) return { error: 'Sai tai khoan hoac mat khau' };

  const token = makeToken();
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000); // phiên 7 ngày
  sheet.getRange(user._row, USER_HEADERS.indexOf('sessionToken') + 1).setValue(token);
  sheet.getRange(user._row, USER_HEADERS.indexOf('sessionExpires') + 1).setValue(expires.toISOString());

  return {
    status: 'ok',
    token: token,
    user: { id: user.id, name: user.name, role: user.role, package: user.package, email: user.email }
  };
}

function handleVerifySession(ss, token) {
  if (!token) return { valid: false };
  const sheet = getUsersSheet(ss);
  if (!sheet) return { valid: false };
  const rows = readUsersRows(sheet);
  const user = rows.find(function (u) { return u.sessionToken && u.sessionToken === token; });
  if (!user) return { valid: false };
  if (user.status !== 'active') return { valid: false };
  if (!user.sessionExpires || new Date(user.sessionExpires) < new Date()) return { valid: false };
  return { valid: true, user: { id: user.id, name: user.name, role: user.role, package: user.package, email: user.email } };
}

function handleLogout(ss, token) {
  if (!token) return { status: 'ok' };
  const sheet = getUsersSheet(ss);
  if (!sheet) return { status: 'ok' };
  const rows = readUsersRows(sheet);
  const user = rows.find(function (u) { return u.sessionToken === token; });
  if (user) {
    sheet.getRange(user._row, USER_HEADERS.indexOf('sessionToken') + 1).setValue('');
    sheet.getRange(user._row, USER_HEADERS.indexOf('sessionExpires') + 1).setValue('');
  }
  return { status: 'ok' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Users — CRUD (cần Admin Secret)
// ─────────────────────────────────────────────────────────────────────────────
function handleSaveUser(ss, u) {
  if (!u || !u.username || !u.name || !u.role) return { error: 'Thieu username/name/role' };
  const sheet = getUsersSheet(ss);
  if (!sheet) return { error: 'Chua khoi tao Users sheet' };
  const rows = readUsersRows(sheet);
  const now = new Date().toISOString();

  if (u.id) {
    // UPDATE
    const existing = rows.find(function (r) { return r.id === u.id; });
    if (!existing) return { error: 'Khong tim thay user id=' + u.id };
    const dupe = rows.find(function (r) { return r.id !== u.id && String(r.username).toLowerCase() === String(u.username).toLowerCase(); });
    if (dupe) return { error: 'Username da ton tai' };

    const set = function (col, val) { sheet.getRange(existing._row, USER_HEADERS.indexOf(col) + 1).setValue(val); };
    set('username', u.username);
    set('name', u.name);
    set('email', u.email || '');
    set('phone', u.phone || '');
    set('role', u.role);
    set('package', u.package || '');
    set('status', u.status || 'active');
    set('updatedAt', now);
    if (u.password) {
      const salt = makeSalt();
      set('passwordSalt', salt);
      set('passwordHash', hashPassword(u.password, salt));
    }
    return { status: 'ok', id: u.id };
  } else {
    // CREATE
    const dupe = rows.find(function (r) { return String(r.username).toLowerCase() === String(u.username).toLowerCase(); });
    if (dupe) return { error: 'Username da ton tai' };
    if (!u.password) return { error: 'Thieu mat khau cho user moi' };
    const id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const salt = makeSalt();
    const values = {
      id: id, username: u.username, passwordHash: hashPassword(u.password, salt), passwordSalt: salt,
      name: u.name, email: u.email || '', phone: u.phone || '', role: u.role, package: u.package || '',
      status: u.status || 'active', sessionToken: '', sessionExpires: '', createdAt: now, updatedAt: now
    };
    const row = USER_HEADERS.map(function (h) { return values[h] !== undefined ? values[h] : ''; });
    sheet.appendRow(row);
    return { status: 'ok', id: id };
  }
}

function handleDeleteUser(ss, id) {
  if (!id) return { error: 'Thieu id' };
  const sheet = getUsersSheet(ss);
  if (!sheet) return { error: 'Chua khoi tao Users sheet' };
  const rows = readUsersRows(sheet);
  const existing = rows.find(function (r) { return r.id === id; });
  if (!existing) return { error: 'Khong tim thay user' };
  sheet.deleteRow(existing._row);
  return { status: 'ok' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
