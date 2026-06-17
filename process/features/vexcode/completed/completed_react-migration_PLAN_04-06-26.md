# Plan: React + Tailwind v4 Migration (Split Workspace)

Kế hoạch này đề xuất tách toàn bộ mã nguồn giao diện (Web UI) thành một gói độc lập nằm dưới thư mục `packages/web`, sử dụng **React 19** và **Tailwind CSS v4** với thiết kế tự dựng thủ công (giống phong cách GitNexus) thay vì cài đặt các thư viện ShadCN/Radix UI.

---

## User Review Required

> [!IMPORTANT]
> - **Cấu trúc Thư mục mới:** Dự án sẽ được chuyển sang dạng split-workspace, mã nguồn React nằm ở `packages/web/`, trong khi `packages/cli-global/` chỉ chứa server Express và mã nhị phân CLI.
> - **Quy trình Build & Serve:** Khi chạy build ở frontend (`packages/web`), Vite sẽ được cấu hình để xuất (build output) trực tiếp vào thư mục tĩnh `packages/cli-global/src/public/`. Nhờ vậy, server Express của CLI vẫn có thể phục vụ giao diện offline một cách nguyên bản mà không thay đổi logic backend.
> - **Không dùng UI Library:** Mọi thành phần tương tác (Dropdown dự án, Drawer cài đặt, file tree Explorer) sẽ được xây dựng thủ công bằng React State và Tailwind CSS v4, giảm tối đa sự phụ thuộc vào thư viện bên ngoài.

---

## Proposed Changes

### 1. Cấu hình Workspace & Scripts

#### [MODIFY] [package.json](file:///d:/DATN2/packages/cli-global/package.json)
- Cập nhật các scripts build và dev để trỏ sang thư mục `packages/web`:
  - `"build:ui": "npm run build --prefix ../web"`
  - `"dev:ui": "npm run dev --prefix ../web"`

---

### 2. Thiết lập Dự án Frontend mới (packages/web)

#### [NEW] [package.json](file:///d:/DATN2/packages/web/package.json)
- Khai báo các dependencies cho React 19, Lucide Icons, TypeScript và các công cụ phát triển:
  - `react`, `react-dom` (^19.0.0)
  - `lucide-react`
  - `vite`, `@vitejs/plugin-react`
  - `tailwindcss`, `@tailwindcss/vite` (^4.0.0)
  - `typescript`

#### [NEW] [vite.config.ts](file:///d:/DATN2/packages/web/vite.config.ts)
- Cấu hình plugin React và Tailwind v4.
- Thiết lập `build.outDir` trỏ về `../cli-global/src/public` để đóng gói trực tiếp vào thư mục public của CLI.
- Cấu hình `server.proxy` chuyển hướng các yêu cầu `/api` về `http://localhost:3000` phục vụ cho quá trình phát triển (HMR).

#### [NEW] [tsconfig.json](file:///d:/DATN2/packages/web/tsconfig.json) & [tsconfig.app.json](file:///d:/DATN2/packages/web/tsconfig.app.json)
- Cấu hình TypeScript cho môi trường ứng dụng React và Node.

#### [NEW] [index.html](file:///d:/DATN2/packages/web/index.html)
- Tệp HTML chính chứa phần tử gốc `<div id="root"></div>` trỏ đến tệp nhập liệu `/src/main.tsx`.

#### [NEW] [src/main.tsx](file:///d:/DATN2/packages/web/src/main.tsx)
- Điểm khởi chạy (Entrypoint) khởi tạo React DOM và render thành phần `<App />`.

#### [NEW] [src/index.css](file:///d:/DATN2/packages/web/src/index.css)
- Khai báo Tailwind CSS v4 `@import "tailwindcss";` và định nghĩa các biến theme màu tối (Dark theme tokens) tương thích hệ màu xanh neon của GitNexus.

---

### 3. Phát triển các React Components

#### [NEW] [src/App.tsx](file:///d:/DATN2/packages/web/src/App.tsx)
- Quản lý toàn bộ State chính: `currentProject`, `currentReportId`, `currentReport`, `selectedFindingIndex`, `selectedFilePath`, `chatHistory`, và các biến đóng/mở Drawer/Modal.
- Tự động gọi API tải danh sách dự án khi khởi chạy.

#### [NEW] [src/components/Header.tsx](file:///d:/DATN2/packages/web/src/components/Header.tsx)
- Logo và thanh tiêu đề của ứng dụng.
- **Project Selector (Custom Dropdown):** Click hiển thị danh sách các dự án, hỗ trợ tự tắt khi bấm ra ngoài (click-outside listener).

#### [NEW] [src/components/Sidebar.tsx](file:///d:/DATN2/packages/web/src/components/Sidebar.tsx)
- **Scan Version Dropdown:** Chọn phiên bản báo cáo quét.
- **Code Explorer (File Tree):** Cây thư mục được render đệ quy dựa trên danh sách tệp của findings, cho phép thu gọn/mở rộng các thư mục.
- **Findings List:** Danh sách các lỗi phát hiện được lọc theo tệp tin đã chọn trong Explorer.

#### [NEW] [src/components/OverviewDashboard.tsx](file:///d:/DATN2/packages/web/src/components/OverviewDashboard.tsx)
- Hiển thị các Metric Cards (Security, Quality, Architecture, Maintainability).
- **Health Score Meter:** SVG radial progress hiển thị chỉ số sức khỏe của mã nguồn.
- **Severity Distribution:** SVG donut chart phân phối mức độ nghiêm trọng (Error, Warning, Info).
- **Top Affected Files & Top Risky Symbols:** Bảng xếp hạng các tệp và ký tự có độ ảnh hưởng/rủi ro cao.

#### [NEW] [src/components/CodeInspector.tsx](file:///d:/DATN2/packages/web/src/components/CodeInspector.tsx)
- Hiển thị chi tiết lỗi, thông báo, AST Context (Symbol, Kind, Callers, Blast Radius).
- **Code Diff Viewer:** Hiển thị mã nguồn trước và sau khi sửa đổi từ đề xuất của AI.
- **AI Chat Copilot:** Khung chat trực tiếp để hỏi đáp thông tin về lỗi bảo mật tương ứng.
- **Apply Fix Button:** Kích hoạt API áp dụng code sửa đổi của AI vào tệp tin thật.

#### [NEW] [src/components/SettingsDrawer.tsx](file:///d:/DATN2/packages/web/src/components/SettingsDrawer.tsx)
- Cho phép cấu hình các API Provider (OpenAI, Anthropic, Google, 9router), cấu hình Model, Key và Test Connection.

#### [NEW] [src/components/Onboarding.tsx](file:///d:/DATN2/packages/web/src/components/Onboarding.tsx)
- Giao diện chọn dự án ban đầu hoặc nhập đường dẫn quét mã nguồn mới nếu chưa chọn dự án nào.

---

## Verification Plan

### Automated Tests
- Chạy lệnh build: `npm run build:ui` trong thư mục `packages/cli-global/` để xác nhận biên dịch thành công của `packages/web` và ghi đè dữ liệu tĩnh lên `packages/cli-global/src/public/`.
- Chạy lệnh test backend: `npm run test` trong `packages/cli-global/` để đảm bảo API hoạt động chính xác.

### Manual Verification
- Mở server bằng cách chạy Express hoặc chạy dev server ở `packages/web` (`npm run dev:ui`).
- Truy cập `http://localhost:5173` (Vite dev) và `http://localhost:3000` (Express production) để xác nhận các dropdown và biểu đồ hoạt động mượt mà.
