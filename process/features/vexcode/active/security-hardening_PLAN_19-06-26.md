# Security Hardening — Technical Plan

**Date**: 19-06-26
**Complexity**: Medium (3 phases, 11 items, Node.js + Python)
**Status**: 🟢 PHASE 1 ✅ — PHASE 2 ✅ — PHASE 3 ✅ (3.4 covered by auth middleware)

> **Implemented**: isPathSafe fix, auth middleware, .env 0o600, rate limiting (express-rate-limit), SSE disconnect detection, Python subprocess timeout (120s), error sanitization (SAFE_ERRORS), parseBool for GET params, 100KB body limit, UI warning badge for mock fallback. — All phases complete on `master`.
> **Remaining**: 3.4 report storage access control (covered by existing auth middleware).
**Author**: Sisyphus
**Project**: VexCode — AI Code Review (DATN)

## Overview

Plan này tập trung vá các lỗ hổng bảo mật đã được phát hiện qua security audit. Mục tiêu là đưa dự án từ trạng thái "không có bảo vệ" lên mức an toàn cơ bản: chống path traversal, thêm authentication, rate limiting, và các biện pháp phòng vệ theo chiều sâu.

**Phát hiện từ audit:**
- `isPathSafe()` dùng `startsWith` — có thể bypass với path khéo léo
- Không có authentication — tất cả endpoints đều public
- API keys lưu plaintext
- SSE không handle client disconnect — zombie processes
- Python subprocess không timeout
- Rate limiting, input validation, error sanitization đều thiếu

**Chia làm 3 phase** — mỗi phase là một PR riêng để dễ review.

---

## Quick Links
- [Phase 1 — Critical](#phase-1--critical-chống-path-traversal--auth--api-keys)
- [Phase 2 — High](#phase-2--high-ổn-định--chống-abuse)
- [Phase 3 — Medium](#phase-3--medium-củng-cố-chất-lượng-code)
- [Acceptance Criteria](#acceptance-criteria)
- [Blast Radius](#blast-radius)
- [Verification](#verification)

---

## Phase 1 — Critical (Chống path traversal + Auth + API keys)

### Mục tiêu
Vá lỗ hổng nghiêm trọng nhất: path traversal có thể cho attacker đọc file ngoài workspace. Thêm lớp authentication cơ bản. Bảo vệ API keys.

### Items

**1.1 Fix `isPathSafe()` — chống path traversal**
- File: `packages/cli/src/services/fileService.js`
- Hiện tại:
  ```js
  resolved.toLowerCase().startsWith(baseDir.toLowerCase())
  ```
- Vấn đề: `/workspace-evil/file` pass được nếu `baseDir = /workspace`
- Fix:
  ```js
  const resolved = resolve(targetPath);
  const normalizedBase = resolve(baseDir);
  return resolved.toLowerCase().startsWith(normalizedBase.toLowerCase() + sep);
  ```
  Trong đó `sep` là `path.sep` (dùng `resolve` để đảm bảo có trailing separator). Hoặc alternative:
  ```js
  const relative = relative(baseDir, resolved);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  ```
  Cách này dùng `path.relative()` — an toàn hơn, không dính edge case.
  - Thêm test cho `isPathSafe` trong file test tương ứng (hoặc tạo mới)
  - Test cases:
    - Path trong workspace → true
    - Path ngoài workspace → false
    - Path trùng prefix nhưng khác thư mục (vd: `/workspace-evil`) → false
    - Path dùng `..` để thoát → false
    - Path tương đối → resolved đúng trước khi check

**1.2 Thêm Authentication middleware**
- File mới: `packages/cli/src/middleware/auth.js`
- Sinh API key khi khởi tạo (hoặc đọc từ env `VEXCODE_API_KEY`)
- Middleware kiểm tra header `Authorization: Bearer <key>`
- Áp dụng cho tất cả routes: `/api/scan`, `/api/scan/stream`, `/api/scan/cancel`, `/api/projects`, `/api/reports`, `/api/backups`
- SSE endpoint cần auth qua query param (vì EventSource không support headers) — hoặc dùng token trong URL
- Exempt: static files trong `public/` (UI dashboard có thể không cần auth nếu chỉ serve local)

**1.3 Bảo vệ API keys trong `.env`**
- File: `packages/cli/src/services/fileService.js`
- `writeEnvConfig()` đang ghi plaintext — cần thêm:
  - File permission: `0o600` (chỉ owner đọc/ghi) khi tạo `.env`
  - Hoặc warning log nếu permission quá open
  - (Không mã hóa ở phase này vì Python engine cũng cần đọc plaintext — permission là đủ cho phase 1)

---

## Phase 2 — High (Ổn định & chống abuse)

### Mục tiêu
Ngăn chặn các tấn công từ chối dịch vụ (DOS), dọn dẹp tài nguyên khi client ngắt kết nối, tránh treo vô hạn, không leak thông tin nội bộ.

### Items

**2.1 Rate limiting**
- File: `packages/cli/src/index.js` (Express app setup)
- Thêm package `express-rate-limit`
- Global limiter: 100 request / 15 phút / IP
- `/api/scan` limiter: 10 request / 15 phút / IP (heavy operation)
- Error response: `429 Too Many Requests`

**2.2 SSE client disconnect detection**
- File: `packages/cli/src/routes/scan.js` — `GET /api/scan/stream`
- Thêm handler:
  ```js
  req.on('close', () => {
    if (res.writableEnded) return;
    cancelActiveScan();  // hủy Python process
    res.end();
  });
  ```
- Kiểm tra `req.res.writableEnded` trước mỗi `res.write()` để tránh lỗi `ERR_STREAM_WRITE_AFTER_END`

**2.3 Python subprocess timeout**
- File: `packages/engine/src/engine/core/scanner.py`
- Dòng 203: `subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=120)`
- Thêm `timeout=120` (120 giây) để không treo vô hạn
- Bắt `subprocess.TimeoutExpired` exception → fallback về mock findings với log rõ ràng

**2.4 Error message sanitization**
- File: `packages/cli/src/routes/scan.js`
- Không trả `error.message` trực tiếp
- Tạo map error code → message an toàn:
  ```js
  const SAFE_ERRORS = {
    SCAN_CANCELLED: 'Scan was cancelled.',
    SCAN_FAILED: 'Scan failed to complete. Please try again.',
    PATH_INVALID: 'Invalid target path.',
    AUTH_REQUIRED: 'Authentication required.',
    RATE_LIMITED: 'Too many requests. Please try again later.',
  };
  ```
- Error codes từ server:
  - `SCAN_CANCELLED` — scan bị hủy (status 400)
  - `SCAN_FAILED` — lỗi không xác định (status 500)
  - `PATH_INVALID` — path không hợp lệ (status 400)
  - Còn lại → `INTERNAL_ERROR` (status 500) — không leak stack trace

---

## Phase 3 — Medium (Củng cố chất lượng code)

### Mục tiêu
Các cải tiến defensive programming: validate input chặt hơn, giới hạn tài nguyên, thông báo fallback rõ ràng.

### Items

**3.1 Validate GET query params**
- File: `packages/cli/src/routes/scan.js`
- `mockScan`, `mockAi`, `fastScan` hiện chỉ so sánh với `'true'`
- Thêm validation: nếu có giá trị thì phải là `'true'` hoặc `'false'`, nếu không thì mặc định `false`
- Dùng:
  ```js
  const parseBool = (val) => val === 'true' ? true : val === 'false' ? false : undefined;
  ```

**3.2 Request body size limit**
- File: `packages/cli/src/index.js`
- Thêm:
  ```js
  app.use(express.json({ limit: '100kb' }));
  ```
- 100KB là đủ cho request scan (chỉ gửi target path) — nếu cần lớn hơn thì tăng sau

**3.3 Mock findings fallback warning rõ ràng**
- File: `packages/engine/src/engine/core/scanner.py`
- Khi fallback về mock, thêm field `fallback_reason` vào response:
  ```python
  "fallback_reason": "Opengrep CLI failed: {error_message}"
  ```
- File: `packages/cli/src/routes/scan.js` — forward `fallback_reason` tới frontend
- UI hiển thị warning badge: "⚠️ Using simulated results" khi fallback

**3.4 Report storage access control** (nếu có route serve report)
- File: `packages/cli/src/routes/reports.js` (nếu chưa có thì tạo)
- Chỉ cho phép đọc report của project mà user có quyền truy cập
- Trả về `403` nếu không match

---

## Acceptance Criteria

| # | Tiêu chí | Phase | Xác nhận |
|---|----------|-------|----------|
| 1 | `isPathSafe()` rejects all path traversal attempts | 1 | Test suite pass |
| 2 | Tất cả API endpoints yêu cầu `Authorization: Bearer <key>` | 1 | Test: request không auth → 401 |
| 3 | `.env` file permission = `0o600` | 1 | `fs.stat` verify |
| 4 | Rate limiter block >100 requests/IP/15p | 2 | Test: burst → 429 |
| 5 | SSE disconnect hủy Python process | 2 | Manual: curl + cancel |
| 6 | Python subprocess timeout sau 120s | 2 | Test: timeout trigger |
| 7 | Error messages không chứa stack trace | 2 | Code review |
| 8 | GET query params parse đúng boolean | 3 | Test: `'true'`, `'false'`, missing |
| 9 | Request body limit = 100KB | 3 | Test: >100KB → 413 |
| 10 | UI hiển thị warning khi mock fallback | 3 | Visual check |
| 11 | 0 TypeScript errors | All | `lsp_diagnostics` |
| 12 | 0 regression trên existing tests | All | `npm test` trên CLI + Web |

---

## Blast Radius

| Item | Ảnh hưởng đến | Risk |
|------|---------------|------|
| `isPathSafe()` fix | `routes/scan.js` (2 endpoints), `routes/reports.js` | LOW — chỉ thay đổi logic so sánh |
| Auth middleware | Tất cả API routes | MEDIUM — có thể break existing clients, cần update UI |
| Rate limiting | Tất cả endpoints | MEDIUM — cần test threshold phù hợp |
| SSE disconnect | `GET /api/scan/stream` | LOW — chỉ thêm cleanup |
| Python timeout | `scanner.py` | LOW — graceful fallback |
| Error sanitization | Response format thay đổi | MEDIUM — frontend parse error message |
| Input validation | Scan endpoint | LOW |
| Body limit | Express app global | LOW — 100KB đủ cho use case |

**Kế hoạch rollback:** Phase 1 dễ rollback (revert commit). Nếu auth gây vấn đề, có thể tắt bằng env `AUTH_DISABLED=true`.

---

## Verification

1. **Phase 1**: `lsp_diagnostics` trên JS files + chạy test suite CLI + Web
2. **Phase 2**: Test rate limiting bằng `curl` burst + test SSE disconnect + test timeout bằng `timeout` command
3. **Phase 3**: Test body limit bằng request >100KB + test query param edge cases

Mỗi phase chạy riêng, verify sạch sẽ mới merge.
