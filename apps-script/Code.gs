/**
 * ERPVietResearch — Google Apps Script (BẢN ĐẦY ĐỦ)
 * ==================================================
 * Chức năng:
 *   1. Nhận booking form (GET ?name=...)            → ghi vào tab "Responses"
 *   2. CMS đọc dữ liệu (GET ?sheet=Nganh)           → trả JSON cho website
 *   3. CMS restore (POST {sheet, data})             → ghi đè tab từ file JSON
 *   4. Backup (GET ?action=backup)                  → sao chép tab CMS thành tab Backup_<ngày giờ>
 *   5. setupSheets() — chạy tay 1 lần               → tự tạo tab Nganh + CaseStudies với headers
 *
 * CÁCH DÙNG:
 *   - Thay SHEET_ID bên dưới bằng ID Google Sheet của bạn
 *   - Chạy hàm setupSheets() 1 lần (chọn hàm → Run) để tạo tab
 *   - Deploy: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone
 *   - Copy URL /exec mới → dán vào assets/js/cms.js và pages/dat-lich-tu-van.html
 */

const SHEET_ID = '1tVbEjOf9MwvsaEauMPRklf-vt4s-K7JaR9VL-JVKYgA'; // ← ID Sheet của bạn

// Các tab CMS được phép đọc/ghi/backup
const CMS_SHEETS = ['Nganh', 'CaseStudies'];

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
// Helper
// ─────────────────────────────────────────────────────────────────────────────
function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
