# Tài Liệu Yêu Cầu Chức Năng

## AI Code Review (Vexcode)

| Mục | Thông tin |
|---|---|
| **Dự án** | AI Code Review (Vexcode) |
| **Phiên bản tài liệu** | 1.0 |
| **Ngày** | 20/06/2026 |
| **Tác giả** | Sisyphus (AI Orchestrator) |
| **Phạm vi** | Toàn bộ hệ thống gồm CLI, Python Engine, Web Dashboard |
| **Cơ sở** | ISO/IEC/IEEE 29148:2018 — Systems and software engineering — Requirements engineering |
| **Ngôn ngữ** | Tiếng Việt (thuật ngữ kỹ thuật giữ nguyên tiếng Anh) |

---

## Lịch Sử Thay Đổi

| Phiên bản | Ngày | Mô tả thay đổi |
|---|---|---|
| 1.0 | 20/06/2026 | Tạo tài liệu lần đầu — phân tích mã nguồn toàn bộ 3 packages |

---

## Mục Lục

1. [Giới Thiệu](#1-giới-thiệu)
2. [Thuật Ngữ và Từ Viết Tắt](#2-thuật-ngữ-và-từ-viết-tắt)
3. [Tổng Quan Hệ Thống](#3-tổng-quan-hệ-thống)
4. [Nhóm Yêu Cầu CLI & Máy Chủ (FR-001 → FR-004)](#4-nhóm-yêu-cầu-cli--máy-chủ)
5. [Nhóm Yêu Cầu Công Cụ Phân Tích (FR-005 → FR-007)](#5-nhóm-yêu-cầu-công-cụ-phân-tích)
6. [Nhóm Yêu Cầu Tích Hợp AI (FR-008 → FR-011)](#6-nhóm-yêu-cầu-tích-hợp-ai)
7. [Nhóm Yêu Cầu Quản Lý Báo Cáo & Sửa Lỗi (FR-012 → FR-014)](#7-nhóm-yêu-cầu-quản-lý-báo-cáo--sửa-lỗi)
8. [Nhóm Yêu Cầu Giao Diện Người Dùng (FR-015 → FR-020)](#8-nhóm-yêu-cầu-giao-diện-người-dùng)

---

## 1. Giới Thiệu

### 1.1 Mục Đích

Tài liệu này đặc tả các yêu cầu chức năng (Functional Requirements) của hệ thống **AI Code Review (Vexcode)** — một công cụ phân tích mã nguồn tĩnh kết hợp với trí tuệ nhân tạo để phát hiện lỗ hổng bảo mật, vấn đề chất lượng mã nguồn, và đề xuất bản sửa lỗi tự động.

### 1.2 Phạm Vi

Tài liệu bao gồm tất cả các chức năng của 3 thành phần chính trong hệ thống:

- **CLI (packages/cli/)**: Giao diện dòng lệnh Node.js ESM, Express REST API server
- **Engine (packages/engine/)**: Pipeline phân tích Python 3.12 (Semgrep → GitNexus → Lizard → AI)
- **Web Dashboard (packages/web/)**: Ứng dụng React 19 + TypeScript SPA

### 1.3 Đối Tượng Sử Dụng

- Nhà phát triển phần mềm sử dụng CLI hoặc Web Dashboard để quét mã nguồn
- Kỹ sư DevOps tích hợp vào pipeline CI/CD
- Kỹ sư bảo mật đánh giá lỗ hổng và đề xuất sửa lỗi
- Quản lý dự án theo dõi chất lượng mã nguồn qua Dashboard

### 1.4 Quy Ước Ký Hiệu

- **FR-NNN**: Functional Requirement — Yêu cầu chức năng (FR = Functional Requirement)
- **Actor**: Tác nhân tương tác với hệ thống
- **Priority**: Cao / Trung bình / Thấp
- **Acceptance Criteria**: Tiêu chí chấp nhận có thể kiểm chứng

---

## 2. Thuật Ngữ và Từ Viết Tắt

| Thuật ngữ | Giải thích |
|---|---|
| **CLI** | Command-Line Interface — giao diện dòng lệnh |
| **SSE** | Server-Sent Events — cơ chế đẩy dữ liệu thời gian thực từ server đến client |
| **Semgrep** | Công cụ phân tích mã nguồn tĩnh mã nguồn mở (static analysis) |
| **GitNexus** | Công cụ phân tích AST (Abstract Syntax Tree) và đồ thị cuộc gọi của dự án này |
| **Lizard** | Công cụ đo độ phức tạp mã nguồn (Cyclomatic Complexity Number) |
| **SARIF** | Static Analysis Results Interchange Format — định dạng trao đổi kết quả phân tích tĩnh |
| **AST** | Abstract Syntax Tree — cây cú pháp trừu tượng của mã nguồn |
| **CCN** | Cyclomatic Complexity Number — độ phức tạp vòng lặp |
| **SSE** | Server-Sent Events — sự kiện đẩy từ máy chủ |
| **REST API** | Representational State Transfer API |
| **SPA** | Single Page Application — ứng dụng trang đơn |
| **Actor** | Người dùng hoặc hệ thống tương tác với chức năng |
| **Suggestion** | Đề xuất sửa lỗi do AI tạo ra |
| **Remediation Code** | Mã nguồn sửa lỗi cụ thể do AI đề xuất |

---

## 3. Tổng Quan Hệ Thống

### 3.1 Kiến Trúc Tổng Thể

Hệ thống AI Code Review bao gồm 3 tầng:

```
┌──────────────────────────────────────────────────────┐
│                  Web Dashboard (React SPA)            │
│  DashboardPage / IssuesPage / OnboardingPage          │
│  Components: Header, Sidebar, ScanModal, CodeInspector│
│  Hooks: useScan, useConfig, useReports, useChat       │
└─────────────────────┬────────────────────────────────┘
                      │ HTTP REST + SSE (port 3000)
┌─────────────────────▼────────────────────────────────┐
│             Express REST API (CLI Package)             │
│  Routes (7 groups, 18 endpoints)                      │
│  Auth: API key (X-API-Key header/Bearer token)        │
│  Rate Limiting: 100 req/15 min global, 10/15 min scan │
│  Services: reportService, fileService, backupService  │
└─────────────────────┬────────────────────────────────┘
                      │ JSON stdin/stdout (subprocess)
┌─────────────────────▼────────────────────────────────┐
│              Python Analysis Engine                    │
│  Pipeline 11 phases:                                   │
│  Scan → Enrich → Complexity → Dedup → Classify →      │
│  NamingAudit → AI Resolve → Report                    │
│  Semgrep → GitNexus → Lizard → AI (multi-provider)    │
└──────────────────────────────────────────────────────┘
```

### 3.2 Pipeline Phân Tích (11 phases)

1. **Scan**: Quét mã nguồn với Semgrep (full / incremental)
2. **Enrich (blocking)**: Phân tích AST với GitNexus
3. **Complexity (blocking)**: Đo độ phức tạp với Lizard
4. **Deduplication**: Loại bỏ kết quả trùng lặp
5. **Cross-scan Classification**: Phân loại kết quả qua nhiều lần quét
6. **Naming Audit**: Kiểm tra đặt tên bằng AI (tùy chọn, phụ thuộc vào AI)
7. **AI Resolve**: Đề xuất sửa lỗi bằng AI (song song với ThreadPoolExecutor)
8. **Report Assembly**: Tổng hợp báo cáo JSON
9. **Atomic Write**: Ghi báo cáo an toàn (tmp + rename)
10. **SARIF Sidecar**: Tạo tệp SARIF kèm theo
11. **Return**: Trả kết quả về CLI bridge

### 3.3 Actors Chính

| Actor | Mô tả |
|---|---|
| **Developer** | Nhà phát triển sử dụng CLI hoặc Web Dashboard để quét và xem kết quả |
| **Security Engineer** | Kỹ sư bảo mật đánh giá findings, áp dụng bản sửa lỗi |
| **Guest / Unauthenticated User** | Người dùng chưa xác thực (bị giới hạn quyền truy cập) |
| **System** | Hệ thống tự động thực thi các tác vụ nền (pipeline) |

---

## 4. Nhóm Yêu Cầu CLI & Máy Chủ

---

### FR-001: Giao Diện Dòng Lệnh (CLI)

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-001 |
| **Tên yêu cầu** | Giao Diện Dòng Lệnh (CLI) |
| **Phân loại** | Chức năng |
| **Actor** | Developer, System |
| **Mô tả** | Hệ thống cung cấp giao diện dòng lệnh (CLI) với các lệnh `analyze`, `serve`, và `help` để người dùng tương tác với công cụ phân tích mã nguồn. |
| **Trigger** | Người dùng nhập lệnh `vexcode` trong terminal |
| **Preconditions** | Node.js >= 18.3 đã được cài đặt; gói `vexcode` đã được cài đặt (npm link hoặc global install) |

**User Story**
> As a **Developer**, I want to **chạy công cụ phân tích mã nguồn từ terminal** so that **tôi có thể quét mã nguồn và xem kết quả mà không cần mở trình duyệt**.

**Basic Flow**

1. Người dùng mở terminal và nhập `vexcode analyze --target <đường_dẫn>` hoặc `vexcode scan --target <đường_dẫn>`
2. CLI xác thực tham số đầu vào (`--target` là bắt buộc, kiểm tra đường dẫn tồn tại)
3. CLI spawn tiến trình Python Engine với các tham số tương ứng
4. Engine thực thi pipeline phân tích (11 phases)
5. Engine ghi báo cáo JSON vào `~/.vexcode/reports/<project>/<timestamp>.json`
6. CLI in kết quả tóm tắt ra terminal và thoát với mã 0

**Exception Flow**

- **Thiếu tham số `--target`**: CLI in thông báo lỗi và hướng dẫn sử dụng, thoát với mã 1
- **Đường dẫn không tồn tại**: CLI in lỗi "Target directory does not exist", thoát với mã 1
- **Python Engine không khả dụng**: CLI in lỗi "Python engine not found at <path>", thoát với mã 1
- **Engine trả về lỗi**: CLI in thông báo lỗi từ stderr của Engine, thoát với mã 1

**Inputs / Outputs**

- **Input**: `argv` — tham số dòng lệnh (`--target`, `--mock-scan`, `--mock-ai`, `--fast`)
- **Output**: stdout (tóm tắt kết quả), exit code (0 = thành công, 1 = lỗi)

**Constraints**

- Hỗ trợ `--mock-scan` và `--mock-ai` flags để chạy ở chế độ mô phỏng (không gọi Semgrep/AI thật)
- Lệnh `vexcode` phải khả dụng thông qua npm link (`npm link` trong `packages/cli/`)
- Lệnh `serve` / `ui` khởi động Express server cho Web Dashboard trên cổng 3000

**Priority**: Cao

**Acceptance Criteria**

- [ ] `vexcode analyze --target .` chạy pipeline và in tóm tắt kết quả
- [ ] `vexcode analyze --target . --mock-scan --mock-ai` chạy ở chế độ mô phỏng
- [ ] `vexcode serve --port 3000` khởi động server và hiển thị "Server running on http://localhost:3000"
- [ ] `vexcode` (không tham số) in hướng dẫn sử dụng
- [ ] `vexcode help` in danh sách lệnh khả dụng
- [ ] Thiếu `--target` in lỗi và thoát mã 1
- [ ] Đường dẫn không tồn tại in lỗi và thoát mã 1

---

### FR-002: Khởi Tạo Máy Chủ HTTP và Dashboard

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-002 |
| **Tên yêu cầu** | Khởi Tạo Máy Chủ HTTP và Dashboard |
| **Phân loại** | Chức năng |
| **Actor** | Developer, Security Engineer |
| **Mô tả** | Hệ thống khởi động máy chủ Express phục vụ REST API và tĩnh phục vụ ứng dụng Web Dashboard SPA đã được build. |
| **Trigger** | Người dùng chạy lệnh `vexcode serve` hoặc `vexcode ui` |
| **Preconditions** | CLI package đã được cài đặt; Dashboard SPA đã được build sẵn trong thư mục `src/public/` |

**User Story**
> As a **Security Engineer**, I want to **mở giao diện web dashboard** so that **tôi có thể xem trực quan kết quả phân tích, biểu đồ và quản lý findings**.

**Basic Flow**

1. CLI gọi hàm `startServer()` trong `server.js`
2. Express server được khởi tạo với các middleware:
   - `express.json()` — parse JSON body
   - `cors()` — cho phép cross-origin requests
   - `rateLimit` — giới hạn tần suất (100 request / 15 phút global)
   - API key authentication middleware (nếu API key được cấu hình)
3. Các REST route handlers được đăng ký:
   - Config, AI Settings, Auth, Scan, Reports, Apply, Chat, Files, Findings
4. Express phục vụ tệp tĩnh từ `src/public/` (React SPA đã build)
5. Fallback SPA: tất cả các route không phải API đều trả về `index.html`
6. Server lắng nghe trên cổng 3000 (mặc định, có thể cấu hình qua `--port`)

**Exception Flow**

- **Cổng đã được sử dụng**: Server in lỗi và thoát, khuyến nghị dùng cổng khác
- **Thư mục public không tồn tại**: Server khởi động nhưng không phục vụ SPA, in cảnh báo
- **API key không được cấu hình**: Server khởi động ở chế độ không xác thực (cho phép tất cả requests)

**Inputs / Outputs**

- **Input**: Cấu hình từ `~/.vexcode/.env` (PORT, API_KEY), CLI flags (`--port`)
- **Output**: HTTP server lắng nghe tại `http://localhost:3000`

**Constraints**

- Mặc định cổng 3000
- Phục vụ SPA từ thư mục tĩnh, tất cả route không phải `/api/*` fallback về `index.html`
- Tích hợp middleware auth và rate limiting cho tất cả API routes
- Có thể chạy song song với CLI scan (non-blocking)

**Priority**: Cao

**Acceptance Criteria**

- [ ] `vexcode serve` khởi động Express server tại `http://localhost:3000`
- [ ] `vexcode serve --port 5000` khởi động server tại cổng 5000
- [ ] GET `http://localhost:3000` trả về HTML của React SPA
- [ ] GET `http://localhost:3000/api/config` trả về JSON (nếu không có auth) hoặc 401 (nếu có auth)
- [ ] Middleware rate limit trả về 429 khi vượt quá 100 requests trong 15 phút

---

### FR-003: Xác Thực API và Giới Hạn Tần Suất

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-003 |
| **Tên yêu cầu** | Xác Thực API và Giới Hạn Tần Suất |
| **Phân loại** | Chức năng (Bảo mật) |
| **Actor** | Developer, System, Unauthenticated User |
| **Mô tả** | Hệ thống bảo vệ API bằng cơ chế xác thực dựa trên API key (Bearer token hoặc X-API-Key header) và giới hạn tần suất yêu cầu để ngăn chặn lạm dụng. Các endpoint scan có giới hạn riêng thấp hơn. |
| **Trigger** | Yêu cầu HTTP đến API endpoint |
| **Preconditions** | API key đã được cấu hình trong `~/.vexcode/.env` (không bắt buộc — nếu không có, server chạy ở chế độ không xác thực) |

**User Story**
> As a **System**, I want to **xác thực mọi yêu cầu đến API** so that **chỉ người dùng có API key hợp lệ mới truy cập được dữ liệu phân tích**.

**Basic Flow**

1. Client gửi yêu cầu HTTP đến API endpoint
2. Middleware auth kiểm tra header `X-API-Key` hoặc `Authorization: Bearer <key>` hoặc query parameter `apiKey`
3. Nếu API key trùng khớp với giá trị trong cấu hình (hoặc auth không được cấu hình), cho phép request đi tiếp
4. Middleware rate limit kiểm tra số lượng requests trong cửa sổ 15 phút
5. Nếu dưới giới hạn (100 requests / 15 phút), cho phép request đi tiếp

**Exception Flow**

- **Không có API key** (khi auth được cấu hình): Trả về HTTP 401 "Missing authorization header"
- **API key không hợp lệ**: Trả về HTTP 401 "Invalid API key"
- **Vượt quá rate limit**: Trả về HTTP 429 "Too many requests" với header `Retry-After`
- **Scan endpoint vượt quá rate limit**: Trả về HTTP 429 (giới hạn 10 requests / 15 phút cho scan)
- **Auth không được cấu hình**: Tất cả request được phép đi qua (không kiểm tra API key)

**Inputs / Outputs**

- **Input**: HTTP request headers (`X-API-Key`, `Authorization`), query parameter (`apiKey`)
- **Output**: HTTP response với status code 200 (thành công), 401 (không xác thực), 429 (quá tần suất)

**Constraints**

- Hỗ trợ 3 phương thức truyền API key: header `X-API-Key`, `Authorization: Bearer`, query `?apiKey=`
- Rate limit global: 100 requests / 15 phút
- Rate limit scan: 10 requests / 15 phút
- Có thể chạy ở chế độ không xác thực (khi không có API key trong .env)
- API key được đọc từ `~/.vexcode/.env` (biến `API_KEY`)

**Priority**: Cao

**Acceptance Criteria**

- [ ] Request có `X-API-Key: <key-đúng>` được xác thực thành công
- [ ] Request có `Authorization: Bearer <key-đúng>` được xác thực thành công
- [ ] Request có `?apiKey=<key-đúng>` được xác thực thành công
- [ ] Request không có API key trả về 401 (khi auth được cấu hình)
- [ ] Request có API key sai trả về 401
- [ ] Request vượt quá 100 lần / 15 phút trả về 429
- [ ] Request scan vượt quá 10 lần / 15 phút trả về 429
- [ ] Server không có API key trong .env cho phép tất cả request (không auth)

---

### FR-004: Quản Lý Cấu Hình Hệ Thống Qua API

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-004 |
| **Tên yêu cầu** | Quản Lý Cấu Hình Hệ Thống Qua API |
| **Phân loại** | Chức năng |
| **Actor** | Developer, Security Engineer |
| **Mô tả** | Hệ thống cung cấp API để đọc và ghi cấu hình hệ thống (`.env` + AI settings) thông qua các endpoint `GET/PUT /api/config` và `GET/PUT /api/settings/ai`. |
| **Trigger** | Người dùng thay đổi cài đặt từ Web Dashboard hoặc gọi API trực tiếp |
| **Preconditions** | Server đang chạy; file `.env` và `settings.toml` tồn tại và có thể ghi |

**User Story**
> As a **Developer**, I want to **thay đổi cấu hình AI provider từ Web Dashboard** so that **tôi có thể chuyển đổi giữa OpenAI, Anthropic và các provider khác mà không cần sửa file thủ công**.

**Basic Flow — Config (`.env`)**

1. Client gửi `GET /api/config` đến server
2. Server đọc `~/.vexcode/.env` qua `fileService.readEnvConfig()`
3. Server trả về JSON chứa các biến môi trường (API keys bị che dấu — `••••••`)
4. Client gửi `POST /api/config` với body JSON chứa các biến cần cập nhật
5. Server ghi các biến vào `~/.vexcode/.env` qua `fileService.writeEnvConfig()`
6. Server trả về 200 OK

**Basic Flow — AI Settings (`settings.toml`)**

1. Client gửi `GET /api/settings/ai` đến server
2. Server gọi Python `config_cli.py dump` để đọc cấu hình AI từ `settings.toml`
3. Server trả về JSON gồm: providers (6 provider), agents (agent-to-provider routing), enabled flag
4. Client gửi `PUT /api/settings/ai` với body JSON chứa cấu hình mới
5. Server gọi Python `config_cli.py update` để ghi cấu hình mới
6. Server trả về 200 OK

**Exception Flow**

- **File `.env` không tồn tại**: Trả về cấu hình mặc định (các biến rỗng)
- **Lỗi ghi file `.env`**: Trả về HTTP 500 "Failed to write config"
- **Python config_cli không trả về kết quả**: Trả về HTTP 503 "AI settings unavailable"
- **Cập nhật AI settings với provider không hợp lệ**: Trả về HTTP 400 với thông báo lỗi

**Inputs / Outputs**

- **GET /api/config**: Output — JSON object các biến môi trường (API key bị che dấu)
- **POST /api/config**: Input — JSON object các biến cần cập nhật; Output — 200 OK
- **GET /api/settings/ai**: Output — JSON `{ enabled, providers: {...}, agents: {...} }`
- **PUT /api/settings/ai**: Input — JSON cấu hình mới; Output — 200 OK

**Constraints**

- API keys luôn bị che dấu khi trả về từ API (hiển thị `••••••`)
- .env config được lưu tại `~/.vexcode/.env`
- AI settings được lưu tại `packages/engine/conf/settings.toml` trong project (không phải home directory)
- Mọi thay đổi cấu hình có hiệu lực ngay lập tức (không cần restart server)

**Priority**: Trung bình

**Acceptance Criteria**

- [ ] `GET /api/config` trả về các biến môi trường hiện tại (API key bị che)
- [ ] `POST /api/config` với body `{ "API_KEY": "new-key" }` ghi thành công vào `.env`
- [ ] `GET /api/settings/ai` trả về danh sách providers và agents
- [ ] `PUT /api/settings/ai` với provider mới cập nhật thành công
- [ ] File `.env` không tồn tại — API trả về cấu hình mặc định (không lỗi)

---

> Tiếp theo: [Nhóm Yêu Cầu Công Cụ Phân Tích — FR-005 → FR-007](#5-nhóm-yêu-cầu-công-cụ-phân-tích)

---

## 5. Nhóm Yêu Cầu Công Cụ Phân Tích

---

### FR-005: Quét Mã Nguồn Tĩnh với Semgrep

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-005 |
| **Tên yêu cầu** | Quét Mã Nguồn Tĩnh với Semgrep |
| **Phân loại** | Chức năng |
| **Actor** | Developer, System |
| **Mô tả** | Hệ thống sử dụng Semgrep để quét mã nguồn tĩnh, phát hiện các lỗ hổng bảo mật, vi phạm chất lượng mã nguồn và các mẫu mã nguy hiểm. Hỗ trợ chế độ quét toàn bộ (full scan) và quét nhanh (fast scan dựa trên git diff). |
| **Trigger** | Người dùng chạy lệnh `vexcode analyze --target <dir>` hoặc bấm "Scan" từ Web Dashboard |
| **Preconditions** | Python 3.12 environment đã được kích hoạt; Semgrep đã được cài đặt trong virtual environment; thư mục target tồn tại |

**User Story**
> As a **Developer**, I want to **quét mã nguồn tự động** so that **tôi có thể phát hiện lỗ hổng bảo mật và vấn đề chất lượng trước khi đưa lên production**.

**Basic Flow**

1. Engine nhận lệnh scan từ CLI bridge qua stdin JSON
2. Scanner kiểm tra chế độ:
   - **Full scan**: Quét tất cả các tệp trong thư mục target
   - **Fast scan**: Chỉ quét các tệp đã thay đổi (git diff) từ commit gần nhất
3. Scanner đọc rules từ `conf/semgrep-rules.yml` (hoặc path custom từ settings)
4. Scanner chạy lệnh `semgrep --json` với các rules đã cấu hình
5. Semgrep trả về kết quả JSON gồm các finding (matches) với thông tin:
   - File path, line number, column
   - Rule ID, severity (ERROR / WARNING / INFO), message
   - Code snippet của finding
6. Scanner parse kết quả JSON, chuẩn hóa thành định dạng Finding
7. Findings được gắn metadata: scan timestamp, scanner version
8. Scanner trả về danh sách findings cho pipeline

**Exception Flow**

- **Semgrep không được cài đặt**: Engine in lỗi "Semgrep not found. Install with: pip install semgrep" và dừng pipeline
- **Semgrep không tìm thấy rules phù hợp**: Scanner trả về danh sách findings rỗng (không phải lỗi)
- **Target directory không chứa tệp mã nguồn**: Scanner trả về danh sách findings rỗng
- **Git không khả dụng (fast scan)**: Scanner tự động fallback sang full scan với cảnh báo
- **Lỗi Semgrep timeout**: Scanner bắt lỗi, ghi log, retry 1 lần; nếu vẫn lỗi, trả về kết quả rỗng
- **Chế độ `--mock-scan`**: Scanner sinh dữ liệu mẫu (mock data) thay vì gọi Semgrep thật
- **Scan bị hủy (cancel)**: Scanner kiểm tra cờ cancel sau mỗi phase, dừng và cleanup nếu được yêu cầu

**Inputs / Outputs**

- **Input**: `{ target_dir: string, mode: "full" | "fast", rules_path?: string, mock?: boolean }`
- **Output**: `Finding[]` — mảng các kết quả phát hiện với đầy đủ metadata

**Constraints**

- Hỗ trợ song song full scan và fast scan (git-aware)
- Rules được cấu hình trong `packages/engine/conf/semgrep-rules.yml`
- Kết quả được mapping thành Finding objects với các trường chuẩn: file_path, line, column, severity, rule_id, message, code_text
- Có thể chạy ở chế độ mock để phát triển và testing
- Scan có thể bị hủy bỏ thông qua cơ chế cancel event

**Priority**: Cao

**Acceptance Criteria**

- [ ] Quét toàn bộ thư mục target và trả về danh sách findings từ Semgrep
- [ ] Fast scan chỉ quét các tệp đã thay đổi từ git diff
- [ ] Findings có đầy đủ: file_path, line, column, severity, rule_id, message, code_text
- [ ] Chạy với `--mock-scan` sinh findings mẫu (không gọi Semgrep)
- [ ] Hủy scan trong khi đang quét dừng pipeline và cleanup
- [ ] Semgrep không được cài đặt — in lỗi và dừng pipeline
- [ ] Target rỗng — trả về danh sách findings rỗng

---

### FR-006: Phân Tích AST và Đồ Thị Cuộc Gọi (GitNexus)

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-006 |
| **Tên yêu cầu** | Phân Tích AST và Đồ Thị Cuộc Gọi (GitNexus) |
| **Phân loại** | Chức năng |
| **Actor** | System |
| **Mô tả** | Hệ thống phân tích cây cú pháp trừu tượng (AST) của mã nguồn bằng GitNexus để trích xuất danh sách symbol (tên hàm, class, biến), xây dựng đồ thị cuộc gọi (call graph) và đánh giá phạm vi ảnh hưởng (blast radius) cho mỗi finding. |
| **Trigger** | Phase "enrich" trong pipeline sau khi scan hoàn tất |
| **Preconditions** | Semgrep scan đã hoàn tất và trả về findings; GitNexus index đã được khởi tạo cho thư mục target |

**User Story**
> As a **Security Engineer**, I want to **xem đồ thị cuộc gọi và phạm vi ảnh hưởng của một lỗ hổng** so that **tôi có thể đánh giá mức độ nghiêm trọng và tác động của lỗ hổng trước khi sửa**.

**Basic Flow**

1. Engine nhận findings từ phase scan
2. Enricher gọi GitNexus để phân tích AST của từng tệp trong findings
3. GitNexus trả về cho mỗi symbol trong tệp:
   - Symbol name và kind (function, class, method, variable)
   - Danh sách callers (hàm gọi đến symbol này)
   - Blast radius (phạm vi ảnh hưởng nếu symbol bị thay đổi)
4. Enricher mapping findings với symbols tương ứng
5. Mỗi finding được enrich với thông tin:
   - `symbol_name`: tên symbol bị phát hiện lỗi
   - `symbol_kind`: loại symbol (function, class, method, variable)
   - `callers`: danh sách các caller của symbol
   - `blast_radius`: phạm vi ảnh hưởng
6. Enriched findings được trả về cho pipeline

**Exception Flow**

- **GitNexus không khả dụng**: Enricher ghi log cảnh báo và trả về findings không có enrichment (không block pipeline)
- **Tệp không có AST hợp lệ**: Enricher bỏ qua tệp, ghi log debug
- **Tệp không phải ngôn ngữ được hỗ trợ**: Enricher bỏ qua, không enrich
- **GitNexus timeout**: Enricher ghi log và trả về findings hiện tại

**Inputs / Outputs**

- **Input**: `Finding[]` — danh sách findings từ phase scan
- **Output**: `EnrichedFinding[]` — findings với trường `ast_context` bổ sung

**Constraints**

- Enrichment là non-blocking — findings vẫn được trả về nếu GitNexus không khả dụng
- Chỉ enrich các tệp thuộc ngôn ngữ được GitNexus hỗ trợ
- Callers và blast radius chỉ mang tính tham khảo (không quyết định severity)

**Priority**: Trung bình

**Acceptance Criteria**

- [ ] Findings được enrich với symbol_name, symbol_kind, callers, blast_radius
- [ ] GitNexus không khả dụng — findings trả về không có lỗi (thiếu enrichment)
- [ ] Callers hiển thị danh sách các hàm gọi đến symbol bị lỗi
- [ ] Blast radius đánh giá phạm vi ảnh hưởng nếu sửa lỗi

---

### FR-007: Đo Độ Phức Tạp Mã Nguồn (Lizard)

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-007 |
| **Tên yêu cầu** | Đo Độ Phức Tạp Mã Nguồn (Lizard) |
| **Phân loại** | Chức năng |
| **Actor** | System |
| **Mô tả** | Hệ thống sử dụng Lizard để đo độ phức tạp mã nguồn của từng hàm và tệp trong findings, bao gồm Cyclomatic Complexity Number (CCN), số dòng mã (LOC) và độ phức tạp nhận thức (cognitive complexity). |
| **Trigger** | Phase "complexity" trong pipeline sau khi enrich hoàn tất |
| **Preconditions** | Findings đã được enrich; Lizard đã được cài đặt trong Python environment |

**User Story**
> As a **Developer**, I want to **xem độ phức tạp của mã nguồn bị lỗi** so that **tôi có thể ưu tiên sửa các lỗi trong các hàm phức tạp hơn trước**.

**Basic Flow**

1. Engine thu thập danh sách tệp duy nhất từ findings (không trùng lặp)
2. Resolver chạy `lizard` command trên từng tệp (hoặc tất cả cùng lúc nếu hiệu suất cho phép)
3. Lizard trả về metrics cho từng hàm:
   - CCN (Cyclomatic Complexity Number)
   - LOC (Lines of Code)
   - Token count
   - Tên hàm và số tham số
4. Resolver mapping metrics với findings dựa trên file_path và line number
5. Mỗi finding được gắn thêm:
   - `metrics.complexity`: CCN của hàm chứa finding
   - `metrics.loc`: Số dòng của hàm
   - `metrics.cognitive_complexity`: Độ phức tạp nhận thức (nếu có)
6. Metrics findings được trả về cho pipeline

**Exception Flow**

- **Lizard không được cài đặt**: Resolver ghi log cảnh báo và trả về findings không có metrics
- **Tệp không được Lizard hỗ trợ**: Resolver bỏ qua tệp
- **Lizard timeout hoặc lỗi**: Resolver bắt lỗi, ghi log, tiếp tục với tệp khác

**Inputs / Outputs**

- **Input**: `EnrichedFinding[]` — findings từ phase enrich
- **Output**: `FindingWithMetrics[]` — findings với `metrics` bổ sung

**Constraints**

- Metrics chỉ mang tính tham khảo (không ảnh hưởng đến pipeline)
- Chỉ đo cho các tệp thuộc ngôn ngữ Lizard hỗ trợ
- Non-blocking — lỗi Lizard không dừng pipeline

**Priority**: Thấp

**Acceptance Criteria**

- [ ] Findings được gắn CCN, LOC của hàm chứa finding
- [ ] Lizard không khả dụng — findings trả về không có lỗi (thiếu metrics)
- [ ] Metrics hiển thị trên Web Dashboard trong CodeInspector

---

> Tiếp theo: [Nhóm Yêu Cầu Tích Hợp AI — FR-008 → FR-011](#6-nhóm-yêu-cầu-tích-hợp-ai)

---

## 6. Nhóm Yêu Cầu Tích Hợp AI

---

### FR-008: Cấu Hình và Quản Lý Nhà Cung Cấp AI

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-008 |
| **Tên yêu cầu** | Cấu Hình và Quản Lý Nhà Cung Cấp AI |
| **Phân loại** | Chức năng |
| **Actor** | Developer, Security Engineer, System |
| **Mô tả** | Hệ thống hỗ trợ nhiều nhà cung cấp AI (OpenAI, Anthropic, Google Gemini, 9router, NVIDIA NIM, proxy-compatible) và cơ chế routing agent → provider. Cấu hình được load từ `settings.toml` (non-secret) và `.env` (API keys). |
| **Trigger** | Engine khởi tạo pipeline; Người dùng thay đổi cấu hình từ Web Dashboard |
| **Preconditions** | File `settings.toml` tồn tại trong `packages/engine/conf/`; File `.env` tồn tại trong `~/.vexcode/` (nếu có API keys) |

**User Story**
> As a **Developer**, I want to **cấu hình nhiều AI provider khác nhau và gán từng agent vào provider cụ thể** so that **tôi có thể tối ưu chi phí bằng cách dùng provider rẻ cho naming audit và provider mạnh cho fix suggestion**.

**Basic Flow**

1. Truy cập đầu tiên: `get_ai_config()` → `_load_all()` được gọi
2. Hàm load `settings.toml` → đọc section `[ai]` với các sub-section:
   - `[ai.providers]`: danh sách providers (openai, anthropic, google, 9router, nvidia, proxy)
   - `[ai.agents]`: danh sách agents (suggest, naming_audit) với mapping đến provider
3. Hàm load `.env` → đọc API keys, model names, base URLs từ biến môi trường
4. Merge settings.toml + .env (ưu tiên .env)
5. Kết quả được cache trong biến global `_PROVIDERS`, `_AGENTS`, `_AI_ENABLED`
6. Agent khi được gọi sẽ resolve provider qua `get_resolved_provider_for_agent(agent_name)`
7. Provider config bao gồm: api_key, base_url, model, enabled, requires_key

**Exception Flow**

- **settings.toml không có section [ai]**: Hệ thống trả về cấu hình mặc định (AI disabled)
- **Agent mapping đến provider không tồn tại**: Logger cảnh báo, trả về None
- **API key không được cấu hình cho provider bắt buộc**: Provider marked as disabled, agent fallback
- **File .env không tồn tại**: Hệ thống chỉ dùng defaults từ settings.toml

**Inputs / Outputs**

- **Input**: File `settings.toml` + File `.env` (biến `*_API_KEY`, `*_MODEL`, `*_BASE_URL`)
- **Output**: `dict[str, ProviderConfig]` — cấu hình providers đã merge; `dict[str, AgentConfig]` — cấu hình agents

**Constraints**

- Hỗ trợ 6 provider: OpenAI, Anthropic, Google Gemini, 9router, NVIDIA NIM, proxy-compatible
- Agent-to-provider routing: mỗi agent (suggest, naming_audit) được gán vào một provider
- Master toggle `ai.enabled`: nếu `false`, không AI agent nào chạy
- API keys được đọc từ `.env` với prefix tương ứng (OPENAI_, ANTHROPIC_, GOOGLE_, NINEROUTER_, NVIDIA_)
- Secret key không bao giờ được expose qua API (luôn bị che dấu)
- Config được cache và có thể reset bằng `reset_config()` cho testing

**Priority**: Cao

**Acceptance Criteria**

- [ ] Load cấu hình từ `settings.toml` thành công với tất cả providers
- [ ] API key từ `.env` được merge đúng với provider tương ứng
- [ ] `get_resolved_provider_for_agent("suggest")` trả về provider config hợp lệ
- [ ] `is_ai_enabled()` trả về `false` khi `ai.enabled = false` trong settings.toml
- [ ] `dump_ai_config()` trả về JSON với API keys được che dấu (`••••••`)
- [ ] Agent-to-provider mapping sai — logger cảnh báo, trả về None
- [ ] Reset config và load lại sau khi thay đổi .env

---

### FR-009: Đề Xuất Sửa Lỗi Tự Động Bằng AI

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-009 |
| **Tên yêu cầu** | Đề Xuất Sửa Lỗi Tự Động Bằng AI |
| **Phân loại** | Chức năng |
| **Actor** | System |
| **Mô tả** | Hệ thống sử dụng AI để phân từng finding, xác định false positive, và tạo đề xuất sửa lỗi (suggestion + remediation_code) cho các finding thực sự là lỗ hổng. Các request AI được thực thi song song với cơ chế retry và rate limiting. |
| **Trigger** | Phase "ai_resolve" trong pipeline sau khi naming audit hoàn tất |
| **Preconditions** | AI được bật (ai.enabled = true); Provider cho agent "suggest" được cấu hình hợp lệ; Findings đã được enrich và có metrics |

**User Story**
> As a **Security Engineer**, I want to **AI tự động đề xuất bản sửa lỗi cho từng finding** so that **tôi có thể áp dụng bản sửa nhanh chóng mà không cần tự tìm cách khắc phục**.

**Basic Flow**

1. Resolver lấy danh sách findings cần AI xử lý (có enriched context)
2. Resolver xác định provider cho agent "suggest" qua `get_resolved_provider_for_agent("suggest")`
3. Resolver xây dựng prompt cho từng finding với context:
   - Code snippet của finding
   - Rule description và severity
   - AST context (symbol_name, callers, blast_radius)
   - Complexity metrics
   - Surrouding code (lines trước và sau finding)
4. Resolver gửi request AI song song qua ThreadPoolExecutor (tối đa 5 threads)
5. Mỗi request AI có retry tối đa 3 lần với exponential backoff nếu gặp lỗi rate limit
6. AI response được parse thành JSON với format: `{ "<rule_alias>": { "suggestion": "...", "rem_code": "..." } }`
7. Mỗi finding được gắn kết quả AI: `suggestion`, `remediation_code`
8. Findings không phải false positive: `suggestion` mô tả cách sửa; false positive: `suggestion` bắt đầu bằng "False positive:"

**Exception Flow**

- **AI provider không khả dụng**: Resolver retry 3 lần; nếu vẫn lỗi, finding được đánh dấu "AI unavailable"
- **AI trả về JSON không hợp lệ**: Resolver log lỗi, finding được đánh dấu "AI parse error"
- **Rate limit bị vượt**: Resolver đợi với exponential backoff (1s → 2s → 4s) trước khi retry
- **Tất cả provider đều disabled**: Log cảnh báo, tất cả findings đánh dấu "AI unavailable"
- **Chế độ `--mock-ai`**: Resolver sinh dữ liệu mẫu thay vì gọi AI thật

**Inputs / Outputs**

- **Input**: `FindingWithMetrics[]` — findings với enriched context và metrics
- **Output**: `ResolvedFinding[]` — findings với `ai_resolution` (suggestion, remediation_code, ai_status)

**Constraints**

- Song song hóa với ThreadPoolExecutor (tối đa 5 workers đồng thời)
- Retry tối đa 3 lần với exponential backoff (1s, 2s, 4s)
- Mỗi finding được xử lý riêng biệt (không gộp findings vào một request)
- Hỗ trợ mock fallback khi AI không khả dụng hoặc `--mock-ai` flag
- Suggestion phải bằng tiếng Anh (theo system prompt)

**Priority**: Cao

**Acceptance Criteria**

- [ ] AI trả về suggestion và remediation_code cho mỗi finding hợp lệ
- [ ] False positive được phát hiện và đánh dấu "False positive: <reason>"
- [ ] Song song xử lý 5 findings đồng thời (ThreadPoolExecutor)
- [ ] Retry khi rate limit với exponential backoff (tối đa 3 lần)
- [ ] AI không khả dụng — findings được đánh dấu "AI unavailable"
- [ ] `--mock-ai` sinh dữ liệu mẫu
- [ ] Remediation code là mã nguồn sạch (không comment, không markdown fences)

---

### FR-010: Kiểm Tra Đặt Tên Mã Nguồn Bằng AI

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-010 |
| **Tên yêu cầu** | Kiểm Tra Đặt Tên Mã Nguồn Bằng AI |
| **Phân loại** | Chức năng |
| **Actor** | System |
| **Mô tả** | Hệ thống sử dụng AI để kiểm tra chất lượng đặt tên (naming convention) của các class, function và biến trong mã nguồn. Phát hiện các tên mơ hồ, quá chung chung (temp, data, obj, process), hoặc gây hiểu nhầm. |
| **Trigger** | Phase "naming_audit" trong pipeline; Agent "naming_audit" được bật |
| **Preconditions** | AI được bật; Provider cho agent "naming_audit" được cấu hình; Scanner đã hoàn tất |

**User Story**
> As a **Developer**, I want to **AI kiểm tra chất lượng đặt tên trong mã nguồn** so that **tôi có thể cải thiện readability và maintainability của codebase**.

**Basic Flow**

1. Resolver thu thập danh sách tệp mã nguồn từ findings
2. Resolver xác định provider cho agent "naming_audit" (mặc định: NVIDIA NIM)
3. Resolver xây dựng prompt với system prompt `SYSTEM_PROMPT_NAMING_AUDIT`:
   > "Analyze the provided source code and review the naming quality of classes, functions, and key variables."
4. Resolver gửi từng tệp đến AI để audit naming
5. AI trả về JSON array các naming issues:
   ```json
   [{ "line": 12, "code_text": "const temp = req.body;",
      "message": "Variable 'temp' is too generic.",
      "suggestion": "Rename 'temp' to 'requestPayload'",
      "remediation_code": "const requestPayload = req.body;" }]
   ```
6. Resolver mapping naming issues với findings dựa trên file_path và line number
7. Naming issues được thêm vào findings dưới dạng `naming_audit` field

**Exception Flow**

- **AI không khả dụng**: Resolver bỏ qua naming audit (không block pipeline)
- **Tệp quá lớn cho AI context**: Resolver chia nhỏ tệp hoặc bỏ qua nếu vượt quá giới hạn
- **AI trả về JSON không hợp lệ**: Resolver log lỗi, bỏ qua tệp hiện tại
- **Agent "naming_audit" bị tắt**: Bỏ qua toàn bộ phase naming

**Inputs / Outputs**

- **Input**: `SourceFile[]` — danh sách tệp mã nguồn cần audit
- **Output**: `NamingIssue[]` — danh sách các vấn đề đặt tên (line, code_text, message, suggestion, remediation_code)

**Constraints**

- Non-blocking — lỗi naming audit không dừng pipeline
- Mặc định dùng NVIDIA NIM cho naming audit (chi phí thấp)
- Kết quả là tham khảo (không ảnh hưởng đến severity của finding)
- Chỉ audit các tệp mã nguồn (không audit file cấu hình, JSON, markdown)

**Priority**: Thấp

**Acceptance Criteria**

- [ ] AI trả về naming issues với line, code_text, message, suggestion, remediation_code
- [ ] Naming audit phát hiện tên biến chung chung (temp, data, obj, process, x, a)
- [ ] AI không khả dụng — pipeline tiếp tục mà không có naming audit
- [ ] Agent "naming_audit" bị tắt — bỏ qua phase naming
- [ ] Kết quả naming audit hiển thị trên Web Dashboard

---

### FR-011: Trò Chuyện với AI về Mã Nguồn

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-011 |
| **Tên yêu cầu** | Trò Chuyện với AI về Mã Nguồn |
| **Phân loại** | Chức năng |
| **Actor** | Developer, Security Engineer |
| **Mô tả** | Hệ thống cung cấp giao diện chat với AI (multi-provider) trong Web Dashboard, cho phép người dùng đặt câu hỏi về mã nguồn, yêu cầu giải thích lỗ hổng, hoặc đề xuất cách sửa lỗi thông qua giao diện hội thoại. |
| **Trigger** | Người dùng bấm "Chat" trong CodeInspector và gửi tin nhắn |
| **Preconditions** | AI provider được cấu hình; Report và finding đang được xem |

**User Story**
> As a **Developer**, I want to **chat với AI về một finding cụ thể** so that **tôi có thể hiểu rõ hơn về nguyên nhân lỗ hổng và cách khắc phục trước khi áp dụng bản sửa**.

**Basic Flow**

1. Client gửi `GET /api/models` để lấy danh sách model khả dụng từ provider
2. Client gửi `POST /api/chat` với body JSON:
   - `provider`: tên provider (openai, anthropic, google, 9router)
   - `model`: tên model
   - `message`: tin nhắn của người dùng
   - `context`: mã nguồn và finding context (tùy chọn)
3. Server nhận request, gọi đến provider tương ứng với API call
4. AI response được stream về client qua response (không SSE)
5. Client hiển thị response trong ChatPanel component

**Exception Flow**

- **Provider không khả dụng**: Server trả về lỗi với gợi ý thử provider khác
- **API key không hợp lệ**: Server trả về lỗi 401
- **Model không tồn tại**: Server trả về lỗi với danh sách model khả dụng
- **Chat timeout**: Server trả về lỗi timeout sau 60 giây

**Inputs / Outputs**

- **Input**: `POST /api/chat` body `{ provider, model?, message, context? }`
- **Output**: `GET /api/models` — JSON array các model khả dụng; `POST /api/chat` — streaming text response

**Constraints**

- Hỗ trợ 4 provider cho chat: OpenAI, Anthropic, Google Gemini, 9router
- Chat độc lập với pipeline (không ảnh hưởng đến scan)
- Context mã nguồn được gửi kèm để AI hiểu bối cảnh
- Không lưu trữ lịch sử chat trên server (phiên chat chỉ ở client)

**Priority**: Trung bình

**Acceptance Criteria**

- [ ] `GET /api/models` trả về danh sách model từ provider đã cấu hình
- [ ] `POST /api/chat` với provider OpenAI trả về response hợp lệ
- [ ] `POST /api/chat` với provider Anthropic trả về response hợp lệ
- [ ] Chat panel hiển thị hội thoại trong CodeInspector
- [ ] Provider không khả dụng — hiển thị thông báo lỗi cho người dùng

---

> Tiếp theo: [Nhóm Yêu Cầu Quản Lý Báo Cáo & Sửa Lỗi — FR-012 → FR-014](#7-nhóm-yêu-cầu-quản-lý-báo-cáo--sửa-lỗi)

---

## 7. Nhóm Yêu Cầu Quản Lý Báo Cáo & Sửa Lỗi

---

### FR-012: Tổng Hợp và Lưu Trữ Báo Cáo

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-012 |
| **Tên yêu cầu** | Tổng Hợp và Lưu Trữ Báo Cáo |
| **Phân loại** | Chức năng |
| **Actor** | System, Developer, Security Engineer |
| **Mô tả** | Hệ thống tổng hợp kết quả từ tất cả các phase trong pipeline thành báo cáo JSON, lưu trữ tại `~/.vexcode/reports/<project>/<timestamp>.json` với cơ chế ghi atomic (tmp + rename). Đồng thời tạo file SARIF sidecar và cập nhật liên kết "latest report". |
| **Trigger** | Phase "report" trong pipeline sau khi AI resolve hoàn tất |
| **Preconditions** | Tất cả findings đã được enrich, có metrics và AI resolution; Thư mục `~/.vexcode/reports/` tồn tại (tự động tạo nếu chưa có) |

**User Story**
> As a **Developer**, I want to **lưu trữ kết quả quét thành báo cáo có cấu trúc** so that **tôi có thể xem lại lịch sử quét, so sánh giữa các lần quét và chia sẻ kết quả với đồng nghiệp**.

**Basic Flow**

1. Reporter thu thập dữ liệu từ tất cả các phase pipeline:
   - Scan findings → findings array
   - Enriched context → ast_context trên mỗi finding
   - Complexity metrics → metrics trên mỗi finding
   - AI resolutions → ai_resolution trên mỗi finding
   - Naming audit → naming_audit array
2. Reporter tổng hợp thành report object với cấu trúc:
   ```json
   {
     "metadata": { "target": "...", "timestamp": "...", "version": "...", "duration_ms": ... },
     "summary": { "total": N, "by_severity": {...}, "by_category": {...}, "new": N, "fixed": N, "regression": N },
     "findings": [ { "id", "file_path", "line", "severity", "category", "message", "code_text", "ast_context", "metrics", "ai_resolution", "status" } ],
     "files": [ { "path": "...", "symbols": [...], "metrics": {...} } ],
     "naming_audit": [ ... ]
   }
   ```
3. Reporter ghi JSON vào file tạm `report.json.tmp`
4. Atomic rename: `report.json.tmp` → `<timestamp>.json`
5. Reporter cập nhật "latest report" symlink/pointer: ghi đường dẫn mới vào `latest.txt`
6. Reporter tạo file SARIF sidecar (xem FR-014)
7. Reporter trả về đường dẫn báo cáo cho CLI bridge

**Exception Flow**

- **Lỗi ghi file**: Reporter retry 1 lần; nếu vẫn lỗi, báo lỗi lên pipeline
- **File tmp tồn tại từ lần trước**: Reporter xóa file tmp cũ trước khi ghi
- **Atomic rename thất bại**: Reporter ghi log lỗi và trả về lỗi
- **Thư mục reports không tồn tại**: Reporter tự động tạo thư mục

**Inputs / Outputs**

- **Input**: `Findings[] + metadata + metrics + ai_resolutions + naming_audit`
- **Output**: File `~/.vexcode/reports/<project>/<timestamp>.json` — báo cáo JSON đầy đủ

**Constraints**

- Atomic write: ghi vào file `.tmp` trước, sau đó rename để tránh corrupted file
- Báo cáo được tổ chức theo project: `~/.vexcode/reports/<project_name>/`
- File "latest" pointer: `~/.vexcode/reports/<project>/latest.txt` chứa đường dẫn đến report mới nhất
- Báo cáo cũ không bị xóa tự động (lưu trữ lịch sử đầy đủ)
- Hỗ trợ phân trang khi đọc report lớn (50 findings/page)

**Priority**: Cao

**Acceptance Criteria**

- [ ] Báo cáo JSON được tạo tại `~/.vexcode/reports/<project>/<timestamp>.json`
- [ ] Báo cáo chứa metadata, summary, findings, files, naming_audit
- [ ] Mỗi finding trong báo cáo có đầy đủ: id, file_path, line, severity, category, message, code_text
- [ ] Atomic write không tạo file corrupted nếu quá trình ghi bị gián đoạn
- [ ] File `latest.txt` được cập nhật với đường dẫn report mới nhất
- [ ] `GET /api/reports` trả về danh sách project có báo cáo
- [ ] `GET /api/reports/:project` trả về danh sách báo cáo theo thời gian (có phân trang)
- [ ] `GET /api/report/:project/:id` trả về nội dung báo cáo (phân trang 50 findings/lần)

---

### FR-013: Áp Dụng Bản Sửa Lỗi và Sao Lưu / Khôi Phục

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-013 |
| **Tên yêu cầu** | Áp Dụng Bản Sửa Lỗi và Sao Lưu / Khôi Phục |
| **Phân loại** | Chức năng |
| **Actor** | Developer, Security Engineer |
| **Mô tả** | Hệ thống cho phép người dùng áp dụng bản sửa lỗi (remediation_code) do AI đề xuất vào tệp mã nguồn gốc, tự động sao lưu tệp trước khi sửa, và hỗ trợ khôi phục (rollback) về trạng thái ban đầu. |
| **Trigger** | Người dùng bấm "Apply Fix" trong CodeInspector trên Web Dashboard |
| **Preconditions** | Finding có AI resolution với remediation_code không rỗng; Tệp mã nguồn tồn tại và có thể ghi |

**User Story**
> As a **Security Engineer**, I want to **áp dụng bản sửa lỗi do AI đề xuất vào mã nguồn** so that **tôi có thể nhanh chóng khắc phục lỗ hổng mà không cần tự sửa thủ công, và có thể rollback nếu cần**.

**Basic Flow**

1. Client gửi `POST /api/apply` với body: `{ filePath, findingId, reportPath, remediationCode }`
2. Server nhận request, parse finding ID và report path để lấy remediation_code
3. **Backup**: `backupService.backupFile(filePath)`:
   - Đọc nội dung hiện tại của tệp
   - Lưu vào `~/.vexcode/backups/<project>/<filename>.<timestamp>.bak`
4. **Apply fix**: `backupService.applyFixToFile(filePath, remediationCode)`:
   - Đọc tệp gốc
   - Tìm vị trí finding (file_path, line) trong tệp
   - Thay thế dòng code bị lỗi bằng remediation_code
   - Ghi tệp đã sửa
5. **Update status**: Server gọi `updateFindingStatus(reportPath, findingId, "applied")`
6. Server trả về 200 OK với thông tin: `{ backupPath, newChecksum }`

**Exception Flow**

- **File không tồn tại**: Server trả về HTTP 404 "File not found"
- **File không thể ghi**: Server trả về HTTP 403 "File is not writable"
- **Remediation code rỗng**: Server trả về HTTP 400 "No remediation code available"
- **Finding đã được applied trước đó**: Server trả về HTTP 409 "Finding already applied"
- **Không tìm thấy dòng code gốc trong tệp**: Server trả về HTTP 409 "Cannot match original code in file" (có thể file đã thay đổi)

**Rollback Flow** (FR-013b)

1. Client gửi `POST /api/rollback` với body: `{ filePath, backupId }` hoặc `{ filePath }` (rollback mới nhất)
2. Server tìm file backup trong `~/.vexcode/backups/`
3. `backupService.rollbackFile(filePath, backupId)`:
   - Đọc nội dung từ file backup
   - Ghi đè lên tệp gốc
4. Server cập nhật finding status về "open"
5. Server trả về 200 OK

**Inputs / Outputs**

- **Apply**: Input — `POST /api/apply` với `{ filePath, findingId, reportPath, remediationCode }`; Output — `{ backupPath, newChecksum }`
- **Rollback**: Input — `POST /api/rollback` với `{ filePath, backupId? }`; Output — 200 OK

**Constraints**

- Tự động sao lưu trước khi sửa (backup tại `~/.vexcode/backups/`)
- Mỗi lần apply tạo một backup riêng (không ghi đè)
- Finding status được cập nhật: "open" → "applied"
- Không cho phép apply lại finding đã applied
- Có thể rollback bằng backup ID hoặc rollback bản mới nhất

**Priority**: Cao

**Acceptance Criteria**

- [ ] Apply fix: remediation_code được áp dụng vào tệp gốc thành công
- [ ] Backup được tạo trước khi sửa tại `~/.vexcode/backups/`
- [ ] Finding status chuyển từ "open" sang "applied"
- [ ] Rollback khôi phục tệp về trạng thái ban đầu
- [ ] Finding status chuyển từ "applied" về "open" sau rollback
- [ ] File không tồn tại — trả về 404
- [ ] Remediation code rỗng — trả về 400
- [ ] Finding đã applied — trả về 409

---

### FR-014: Xuất Báo Cáo SARIF

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-014 |
| **Tên yêu cầu** | Xuất Báo Cáo SARIF |
| **Phân loại** | Chức năng |
| **Actor** | System, Developer |
| **Mô tả** | Hệ thống tạo file SARIF (Static Analysis Results Interchange Format) sidecar cho mỗi báo cáo, cho phép người dùng tải xuống và tích hợp với các công cụ CI/CD hỗ trợ SARIF (GitHub Code Scanning, VS Code SARIF extension, etc.). |
| **Trigger** | Phase "report" trong pipeline; Người dùng bấm "Download SARIF" từ Web Dashboard |
| **Preconditions** | Báo cáo JSON đã được tạo thành công |

**User Story**
> As a **Developer**, I want to **tải xuống báo cáo SARIF** so that **tôi có thể tích hợp kết quả quét với GitHub Code Scanning hoặc các công cụ CI/CD khác hỗ trợ SARIF**.

**Basic Flow**

1. Sau khi báo cáo JSON được tạo, Reporter chuyển đổi findings sang định dạng SARIF 2.1
2. Cấu trúc SARIF bao gồm:
   - `sarifLevel`: mapping severity (ERROR → "error", WARNING → "warning", INFO → "note")
   - `toolComponent`: name = "Vexcode", version, rules list
   - `results`: mỗi finding là một SARIF result với:
     - ruleId, message, level
     - locations (uri, startLine, startColumn, endLine, endColumn)
     - codeFlows (nếu có AST context với callers chain)
     - fixes (nếu có remediation_code)
3. File SARIF được lưu cùng thư mục với báo cáo JSON: `<timestamp>.sarif`
4. API endpoint `GET /api/report/:project/:id/sarif` cho phép tải xuống file SARIF

**Exception Flow**

- **SARIF sidecar không tồn tại**: Server tự động sinh lại từ báo cáo JSON
- **Findings không có location đầy đủ**: SARIF result bỏ qua location (warning level)

**Inputs / Outputs**

- **Input**: Báo cáo JSON
- **Output**: File `<timestamp>.sarif` (SARIF 2.1.0 format)

**Constraints**

- Tuân thủ SARIF v2.1.0 OASIS Standard
- Lưu cùng thư mục với báo cáo JSON gốc
- Có thể tải xuống qua API endpoint riêng
- Hỗ trợ codeFlows nếu finding có AST callers chain

**Priority**: Thấp

**Acceptance Criteria**

- [ ] File SARIF được tạo cùng thư mục với báo cáo JSON
- [ ] SARIF valid theo schema v2.1.0
- [ ] Mỗi finding được mapping thành SARIF result với ruleId, message, level, location
- [ ] `GET /api/report/:project/:id/sarif` trả về file SARIF
- [ ] SARIF không có findings — file SARIF hợp lệ với results array rỗng

---

> Tiếp theo: [Nhóm Yêu Cầu Giao Diện Người Dùng — FR-015 → FR-020](#8-nhóm-yêu-cầu-giao-diện-người-dùng)

---

## 8. Nhóm Yêu Cầu Giao Diện Người Dùng

---

### FR-015: Trang Tổng Quan Dự Án (Dashboard)

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-015 |
| **Tên yêu cầu** | Trang Tổng Quan Dự Án (Dashboard) |
| **Phân loại** | Chức năng |
| **Actor** | Developer, Security Engineer |
| **Mô tả** | Hệ thống cung cấp trang Dashboard hiển thị tổng quan về chất lượng mã nguồn của dự án, bao gồm các chỉ số metrics, biểu đồ health score, phân bố lỗi theo category, và so sánh giữa các lần quét. |
| **Trigger** | Người dùng truy cập trang chủ Web Dashboard |
| **Preconditions** | Có ít nhất một báo cáo quét đã được tạo; Server API đang chạy |

**User Story**
> As a **Security Engineer**, I want to **xem tổng quan chất lượng mã nguồn trên Dashboard** so that **tôi có thể nhanh chóng đánh giá tình trạng bảo mật và chất lượng của dự án**.

**Basic Flow**

1. Người dùng truy cập Web Dashboard → component `App.tsx` render route `/` → `DashboardPage`
2. DashboardPage gọi `useDashboardStats()` hook để fetch dữ liệu từ API
3. Hook gọi đồng thời nhiều API endpoints:
   - `GET /api/reports` — danh sách projects
   - `GET /api/report/:project/:id` — nội dung báo cáo mới nhất
4. DashboardPage hiển thị các thành phần con:
   - **MetricsCards**: Thẻ hiển thị tổng số findings, số lỗi nghiêm trọng (Critical/High), số cảnh báo (Medium/Low)
   - **HealthScoreChart**: Biểu đồ donut hiển thị health score (phần trăm findings đã được xử lý)
   - **CategoryBreakdown**: Biểu đồ phân bố findings theo category (Security, Quality, Maintainability, Architecture)
   - **CrossScanSummary**: Bảng so sánh giữa lần quét hiện tại và lần trước (new, persisting, resolved, regressed)
   - **Leaderboards**: Danh sách top files có nhiều findings nhất, top files phức tạp nhất

**Exception Flow**

- **Chưa có báo cáo nào**: Dashboard hiển thị empty state với hướng dẫn chạy scan đầu tiên
- **API lỗi**: DashboardPage hiển thị ErrorBoundary với thông báo lỗi và nút retry
- **Dashboard đang loading**: Hiển thị skeleton loading cho mỗi component con

**Inputs / Outputs**

- **Input**: API responses từ report endpoints
- **Output**: Trang Dashboard với metrics cards, charts, leaderboards

**Constraints**

- Tất cả dữ liệu được fetch từ REST API (không có state management phức tạp)
- Biểu đồ sử dụng thư viện đồ họa nhẹ (lucide-react + CSS custom)
- Hỗ trợ cả 2 theme: dark và light
- Cross-scan summary chỉ hoạt động khi có từ 2 báo cáo trở lên

**Priority**: Cao

**Acceptance Criteria**

- [ ] Dashboard hiển thị MetricsCards với tổng findings và severity breakdown
- [ ] HealthScoreChart hiển thị biểu đồ donut với tỷ lệ findings đã xử lý
- [ ] CategoryBreakdown hiển thị biểu đồ phân bố category
- [ ] CrossScanSummary hiển thị so sánh giữa các lần quét
- [ ] Leaderboards hiển thị top files theo findings và complexity
- [ ] Chưa có báo cáo — hiển thị empty state
- [ ] API lỗi — hiển thị ErrorBoundary với nút retry

---

### FR-016: Duyệt và Quản Lý Lỗi (Issues Page)

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-016 |
| **Tên yêu cầu** | Duyệt và Quản Lý Lỗi (Issues Page) |
| **Phân loại** | Chức năng |
| **Actor** | Developer, Security Engineer |
| **Mô tả** | Hệ thống cung cấp trang Issues với giao diện chia đôi (split pane): bên trái là danh sách findings có bộ lọc đa chiều, bên phải là CodeInspector hiển thị mã nguồn, AI suggestion, AST context, complexity metrics và chat panel. |
| **Trigger** | Người dùng chọn một project/report từ Header hoặc Dashboard và chuyển đến Issues page |
| **Preconditions** | Báo cáo đã được load thành công; Findings list không rỗng |

**User Story**
> As a **Developer**, I want to **duyệt danh sách lỗi với bộ lọc đa chiều và xem mã nguồn bị lỗi cùng AI suggestion** so that **tôi có thể đánh giá, phân loại và sửa lỗi một cách hiệu quả**.

**Basic Flow**

1. Người dùng chọn project/report từ Header
2. IssuesPage render với:
   - **Left panel**: Sidebar component với 2 tab:
     - Explorer tab: cây thư mục (file tree)
     - Findings tab: FilterPanel + FindingsList
   - **Right panel**: CodeInspector với:
     - FileViewer (CodeMirror 6): hiển thị mã nguồn, highlight finding line
     - Finding details: severity badge, message, category, AST context, metrics
     - AI Suggestion: suggestion text + remediation code (diff highlight)
     - Action buttons: Apply Fix, Open in IDE, Rollback
     - ChatPanel: chat với AI về finding hiện tại
3. FilterPanel hỗ trợ lọc findings theo:
   - Severity: Critical, High, Medium, Low
   - Category: Security, Quality, Maintainability, Architecture
   - Status: Open, Applied, False Positive, Ignored
   - Language: ngôn ngữ lập trình
   - Scan status: new, persisting, resolved, regressed
   - Search: tìm kiếm theo message hoặc file path
4. FindingsList hiển thị findings đã lọc với phân trang (50 findings/page)
5. Khi người dùng click vào một finding:
   - CodeInspector load file content từ `GET /api/file-content`
   - Highlight dòng code bị lỗi
   - Hiển thị AI suggestion và các action buttons

**Exception Flow**

- **File không tìm thấy**: CodeInspector hiển thị thông báo "File not found"
- **Finding không có AI resolution**: Hiển thị "No AI suggestion available"
- **Bộ lọc không có kết quả**: FindingsList hiển thị empty state "No findings match your filters"
- **API lỗi khi load file**: Hiển thị ErrorBoundary

**Inputs / Outputs**

- **Input**: Report ID, Filter state (severity, category, status, language, search query)
- **Output**: Giao diện split pane với findings list và CodeInspector

**Constraints**

- Findings được phân trang 50 items/lần
- Tất cả bộ lọc có thể kết hợp đồng thời
- CodeInspector support line highlighting và diff view
- File content được load động (lazy load) khi user click finding

**Priority**: Cao

**Acceptance Criteria**

- [ ] Issues page hiển thị split pane với findings + CodeInspector
- [ ] FilterPanel lọc findings theo severity (Critical/High/Medium/Low)
- [ ] FilterPanel lọc findings theo status (Open/Applied/False Positive/Ignored)
- [ ] FilterPanel search theo message hoặc file path
- [ ] FindingsList phân trang 50 findings/lần
- [ ] CodeInspector hiển thị file content với line highlight
- [ ] CodeInspector hiển thị AI suggestion và remediation code
- [ ] Apply Fix và Rollback hoạt động từ CodeInspector
- [ ] ChatPanel cho phép chat với AI về finding hiện tại

---

### FR-017: Hiển Thị Tiến Trình Quét Thời Gian Thực (Scan Modal)

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-017 |
| **Tên yêu cầu** | Hiển Thị Tiến Trình Quét Thời Gian Thực (Scan Modal) |
| **Phân loại** | Chức năng |
| **Actor** | Developer, Security Engineer |
| **Mô tả** | Hệ thống hiển thị modal tiến trình quét thời gian thực với checklist các phase pipeline, terminal log, elapsed timer, và nút hủy scan. Dữ liệu được đẩy từ server qua SSE (Server-Sent Events). |
| **Trigger** | Người dùng bấm nút "Scan" từ Header |
| **Preconditions** | Server đang chạy; AI provider được cấu hình (nếu không dùng mock); Thư mục target hợp lệ |

**User Story**
> As a **Developer**, I want to **xem tiến trình quét theo thời gian thực** so that **tôi có thể biết pipeline đang ở phase nào và có thể hủy nếu cần**.

**Basic Flow**

1. Người dùng bấm "Scan" trên Header → ScanModal mở ra
2. Client mở kết nối SSE đến `GET /api/scan/stream` hoặc `GET /api/scan/start?target=<dir>`
3. Server push events qua SSE:
   - `event: phase` — phase hiện tại (scan, enrich, complexity, dedup, classify, naming, ai_resolve, report)
   - `event: log` — log message từ pipeline (terminal output)
   - `event: progress` — phần trăm hoàn thành (0-100)
   - `event: complete` — scan hoàn tất với đường dẫn báo cáo
   - `event: error` — lỗi xảy ra trong pipeline
4. ScanModal hiển thị:
   - Checklist các phase pipeline (đánh dấu completed/current/pending)
   - Terminal log (scrollable, auto-scroll xuống cuối)
   - Elapsed timer (tính từ lúc bắt đầu)
   - Progress bar (phần trăm)
   - Nút "Cancel" để hủy scan
5. Khi scan hoàn tất: modal tự động đóng hoặc hiển thị nút "View Results"
6. Khi scan bị hủy: modal hiển thị thông báo "Scan cancelled" và đóng

**Exception Flow**

- **Scan thất bại**: Modal hiển thì thông báo lỗi với log chi tiết và nút "Retry"
- **SSE connection mất kết nối**: Client tự động reconnect với exponential backoff
- **Server không phản hồi**: Modal hiển thị timeout error sau 60 giây

**Inputs / Outputs**

- **Input**: SSE events từ server (`phase`, `log`, `progress`, `complete`, `error`)
- **Output**: Scan modal với checklist, log, timer, progress bar, cancel button

**Constraints**

- SSE kết nối duy trì trong suốt quá trình scan
- Checklist phase: scan, enrich, complexity, dedup, classify, naming, ai_resolve, report
- Auto-scroll log xuống cuối
- Timer tính từ lúc bắt đầu scan
- Nút Cancel gọi `POST /api/scan/cancel`

**Priority**: Cao

**Acceptance Criteria**

- [ ] Scan modal mở khi bấm nút "Scan"
- [ ] Checklist hiển thị các phase pipeline với trạng thái completed/current/pending
- [ ] Terminal log hiển thị real-time và auto-scroll
- [ ] Progress bar cập nhật theo phần trăm
- [ ] Elapsed timer hiển thị thời gian đã chạy
- [ ] Nút Cancel hủy scan thành công
- [ ] Scan hoàn tất — modal hiển thị "View Results"
- [ ] Scan lỗi — modal hiển thị thông báo lỗi và log

---

### FR-018: Quản Lý Cài Đặt AI từ Giao Diện

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-018 |
| **Tên yêu cầu** | Quản Lý Cài Đặt AI từ Giao Diện |
| **Phân loại** | Chức năng |
| **Actor** | Developer |
| **Mô tả** | Hệ thống cung cấp Settings Drawer cho phép người dùng cấu hình AI providers (API keys, models, base URLs), gán agent-to-provider routing, và tùy chỉnh các tham số nâng cao từ Web Dashboard. |
| **Trigger** | Người dùng bấm nút "Settings" (bánh răng) trên Header |
| **Preconditions** | Server API đang chạy |

**User Story**
> As a **Developer**, I want to **cấu hình AI providers trực tiếp từ Web Dashboard** so that **tôi có thể nhập API key, chọn model và gán agent vào provider phù hợp mà không cần chỉnh sửa file thủ công**.

**Basic Flow**

1. Người dùng bấm nút Settings trên Header → SettingsDrawer mở ra từ bên phải
2. SettingsDrawer fetch cấu hình hiện tại từ `GET /api/settings/ai`
3. Drawer hiển thị các tab:
   - **Providers tab**: Danh sách 6 provider với các trường:
     - API Key (input password, masked)
     - Base URL (input text)
     - Model name (input text hoặc dropdown)
     - Enabled toggle
   - **Agents tab**: Danh sách agents (suggest, naming_audit) với:
     - Provider selector (dropdown từ danh sách providers)
     - Model override (tùy chọn)
     - Enabled toggle
   - **Advanced tab**: Các tham số nâng cao:
     - Semgrep rules path
     - Excluded directories
     - Max findings per scan
4. Người dùng thay đổi giá trị và bấm "Save"
5. Client gọi `PUT /api/settings/ai` hoặc `POST /api/config` để lưu
6. Drawer hiển thị thông báo "Settings saved" và đóng
7. (Appearance settings được lưu riêng trong localStorage: theme dark/light)

**Exception Flow**

- **API key không hợp lệ**: Drawer hiển thị cảnh báo nhưng vẫn lưu (không validate phía server)
- **Save thất bại**: Drawer hiển thị error toast với thông báo lỗi
- **Provider không khả dụng**: Hiển thị warning icon bên cạnh provider

**Inputs / Outputs**

- **Input**: Form data (API keys, model names, base URLs, agent mapping)
- **Output**: `PUT /api/settings/ai` request + `POST /api/config` request

**Constraints**

- API keys được ẩn trong input password (hiển thị `••••••`)
- Provider list được load động từ server (không hardcode)
- Settings được persist giữa các phiên làm việc
- Theme (dark/light) được lưu trong localStorage riêng (không qua API)

**Priority**: Trung bình

**Acceptance Criteria**

- [ ] SettingsDrawer mở từ bên phải khi bấm nút Settings
- [ ] Providers tab hiển thị 6 provider với API key (masked), base URL, model, enabled toggle
- [ ] Agents tab hiển thị suggest và naming_audit agent với provider selector
- [ ] Advanced tab hiển thị semgrep rules path và exclusions
- [ ] Save gửi request thành công và hiển thị "Settings saved"
- [ ] Theme dark/light toggle hoạt động và persist qua localStorage

---

### FR-019: Hướng Dẫn Bắt Đầu và Chọn Dự Án (Onboarding)

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-019 |
| **Tên yêu cầu** | Hướng Dẫn Bắt Đầu và Chọn Dự Án (Onboarding) |
| **Phân loại** | Chức năng |
| **Actor** | Developer |
| **Mô tả** | Hệ thống cung cấp trang Onboarding giúp người dùng mới bắt đầu với công cụ: chọn dự án, chọn thư mục target, cấu hình scan (mock mode), và chạy scan đầu tiên. |
| **Trigger** | Người dùng truy cập Web Dashboard lần đầu hoặc bấm "Getting Started" |
| **Preconditions** | Server API đang chạy |

**User Story**
> As a **Developer**, I want to **được hướng dẫn chạy scan đầu tiên** so that **tôi có thể nhanh chóng bắt đầu sử dụng công cụ mà không cần đọc tài liệu dài**.

**Basic Flow**

1. Người dùng truy cập Web Dashboard → nếu chưa có project/report nào, chuyển hướng đến `/onboarding`
2. OnboardingPage hiển thị 2 section:
   - **Getting Started Guide**: Hướng dẫn từng bước:
     1. Cài đặt CLI (`npm link`)
     2. Cấu hình AI provider (API key)
     3. Chạy scan đầu tiên
     4. Xem kết quả trên Dashboard
   - **Project Analytics**: Danh sách projects đã scan với thông tin:
     - Project name
     - Last scan time
     - Total findings
     - Health score
3. Người dùng có thể chọn project từ danh sách hoặc nhập thư mục target mới
4. Có toggle "Mock Scan" và "Mock AI" cho phép chạy scan mô phỏng
5. Khi user bấm "Start Scan", gọi API scan với các tham số đã chọn
6. Sau khi scan hoàn tất, chuyển hướng đến Issues page

**Exception Flow**

- **Không có project nào**: Project analytics hiển thị empty state với hướng dẫn chạy scan
- **Thư mục target không tồn tại**: Hiển thị lỗi và yêu cầu nhập lại
- **Scan thất bại**: Hiển thị lỗi và nút retry

**Inputs / Outputs**

- **Input**: Target directory path, mock scan/AI flags
- **Output**: API scan request + chuyển hướng đến Issues page

**Constraints**

- Tự động phát hiện projects từ `~/.vexcode/reports/`
- Mock scan toggle cho phép chạy scan mô phỏng (không cần AI key)
- Target directory có thể nhập thủ công hoặc dùng browser folder picker

**Priority**: Trung bình

**Acceptance Criteria**

- [ ] OnboardingPage hiển thị Getting Started Guide với 4 bước
- [ ] Project analytics hiển thị danh sách projects đã scan
- [ ] Mock Scan và Mock AI toggle hoạt động
- [ ] Nhập target directory và bấm "Start Scan" chạy scan thành công
- [ ] Chưa có project — empty state với hướng dẫn
- [ ] Sau scan, tự động chuyển hướng đến Issues page

---

### FR-020: Điều Hướng và Quản Lý Giao Diện

| Thuộc tính | Giá trị |
|---|---|
| **Mã số** | FR-020 |
| **Tên yêu cầu** | Điều Hướng và Quản Lý Giao Diện |
| **Phân loại** | Chức năng |
| **Actor** | Developer, Security Engineer |
| **Mô tả** | Hệ thống cung cấp các component điều hướng và quản lý giao diện: Header (project/report selector, scan button, settings, theme toggle), Sidebar (explorer/findings tabs), và cơ chế routing giữa các trang. |
| **Trigger** | Người dùng tương tác với giao diện Web Dashboard |
| **Preconditions** | Web Dashboard đã được load trong trình duyệt |

**User Story**
> As a **Developer**, I want to **dễ dàng điều hướng giữa các trang và chọn project/report** so that **tôi có thể làm việc hiệu quả mà không bị lạc trong giao diện**.

**Basic Flow — Header**

1. **Header** hiển thị ở đầu trang với:
   - Logo + tên ứng dụng
   - **Project Selector**: dropdown chọn project từ danh sách
   - **Report Selector**: dropdown chọn báo cáo trong project
   - **Scan Button**: nút "Run Scan" mở ScanModal
   - **Findings Count**: badge hiển thị tổng findings
   - **Settings Button**: bánh răng mở SettingsDrawer
   - **Theme Toggle**: icon mặt trời / mặt trăng chuyển dark/light

**Basic Flow — Sidebar**

2. **Sidebar** hiển thị bên trái với 2 tab:
   - **Explorer tab**: cây thư mục của project (toggle expand/collapse)
   - **Findings tab**: FilterPanel (FR-016) + FindingsList (FR-016)
   - Sidebar có thể thu gọn (collapse) để mở rộng không gian cho CodeInspector

**Basic Flow — Routing**

3. **App.tsx** quản lý routing:
   - `/` → DashboardPage
   - `/issues` → IssuesPage (với project/report context từ Header)
   - `/onboarding` → OnboardingPage
   - `*` → Redirect đến DashboardPage

**Exception Flow**

- **Project không có báo cáo**: Report selector disabled, hiển thị "No reports"
- **Không có project nào**: Project selector empty, chỉ hiển thị "Getting Started"
- **Sidebar ở chế độ collapsed**: Click tab icon để expand

**Inputs / Outputs**

- **Input**: User interactions (click, select, toggle)
- **Output**: Route changes, component visibility toggles, API calls

**Constraints**

- Tất cả selectors (project, report) là controlled components từ `useReports()` hook
- Theme được persist trong localStorage (không gọi API)
- Sidebar có thể collapse/expand
- Scan button chỉ khả dụng khi có target directory hợp lệ
- Header sticky ở đầu trang

**Priority**: Trung bình

**Acceptance Criteria**

- [ ] Header hiển thị project selector, report selector, scan button, settings, theme toggle
- [ ] Project selector load danh sách projects từ API
- [ ] Report selector load danh sách reports khi chọn project
- [ ] Theme toggle chuyển giữa dark và light, persist qua localStorage
- [ ] Sidebar có 2 tab: Explorer và Findings
- [ ] Sidebar có thể collapse/expand
- [ ] Routing: `/` → Dashboard, `/issues` → Issues, `/onboarding` → Onboarding
- [ ] Scan button mở ScanModal
- [ ] Settings button mở SettingsDrawer

---

> Hết tài liệu — 20 yêu cầu chức năng (FR-001 → FR-020)

