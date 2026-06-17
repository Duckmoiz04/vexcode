# Tiến Độ Công Việc — VexCode Web UI

## Tổng Quan

Dự án **AI Code Review (VexCode)** — Hybrid Node.js/Python static code scanner & AI code reviewer.  
Frontend React + Vite, backend Python 3.12 + Express.

---

## Các Phiên Làm Việc Gần Nhất

### Phiên 1 — UI Refactoring & Security Fix

- **Refactor UI layout**: chuyển sang single-page scroll model cho trang chi tiết lỗi (CodeInspector)
- **Fix bảo mật đường dẫn file**: thêm validation `baseDir` khi truy cập file, chống path traversal
- **DiffViewer header**: thêm header với vị trí chunk, nút Prev/Next/Bulk Accept/Decline
- **Reset navigation state**: khi chuyển project/scan, reset toàn bộ filter và view state

### Phiên 2 — Cross-Scan Finding Status Tracking (Hoàn Thành)

**Tính năng chính**: Phân loại lỗi giữa 2 lần scan liên tiếp:

| Status | Ý nghĩa |
|--------|---------|
| **NEW** | Lỗi mới xuất hiện trong scan hiện tại |
| **PERSISTING** | Lỗi vẫn tồn tại từ scan trước |
| **RESOLVED** | Lỗi đã được sửa (không còn trong scan hiện tại) |
| **REGRESSED** | Lỗi đã từng sửa nhưng xuất hiện lại |

**Các file đã sửa/tạo:**

- `packages/engine/` — Engine Python phân loại finding khi so sánh 2 report
- `packages/web/src/types.ts` — Thêm `ScanStatus` type
- `packages/web/src/components/code-inspector/CodeInspectorHeader.tsx` — Badge hiển thị status
- `packages/web/src/components/FilterPanel.tsx` — Filter section cho 4 status
- `packages/web/src/App.tsx` — State `filterScanStatuses`, logic đếm và lọc
- `packages/web/src/components/sidebar/Sidebar.tsx` — Filter scan status trong sidebar
- `packages/web/src/pages/IssuesPage.tsx` — Truyền props filter xuống FilterPanel
- `packages/web/src/components/dashboard/CrossScanSummary.tsx` — Component mới cho dashboard
- `packages/web/src/components/dashboard/DashboardPage.tsx` — Thêm CrossScanSummary
- **Tests**: 13 engine tests + 18 web tests (CrossScanSummary, CodeInspectorHeader, FilterPanel)

### Phiên 3 — Fix DiffViewer Scroll & Auto-Scroll (Hoàn Thành)

**3 vấn đề đã sửa:**

#### 1. Auto-scroll bị mất
- **Nguyên nhân**: `useAutoScroll` dùng `activeLineRef.scrollIntoView()` nhưng `activeLineRef` chưa bao giờ được gắn vào DOM element. DiffViewer không có prop `goToLine`.
- **Fix**: Thêm `goToLine` prop vào DiffViewer, tạo Effect 2b riêng để scroll tới dòng lỗi bằng CodeMirror `EditorView.scrollIntoView()` mà không recreate editor.

#### 2. Không có thanh cuộn dọc trong DiffViewer
- **Nguyên nhân**: Fix trước dùng `max-h-full` nhưng CSS `max-height: 100%` không propagate từ flex parent (chỉ có `max-height`, không phải `height` explicit).
- **Fix**: 
  - FileViewer container: `flex-1 min-h-0 overflow-hidden` khi hiển thị DiffViewer (cho height xác định)
  - DiffViewer root: `flex-1 min-h-0 overflow-y-auto scrollbar-thin`
  - CSS: `.cm-editor` flex column, `.cm-scroller` flex:1 + overflow-y:auto

#### 3. File chỉ hiển thị 1 lỗi dù scan ra nhiều hơn
- **Nguyên nhân**: CodeInspector là detail view cho 1 finding duy nhất (thiết kế hiện tại).
- **Fix**: Thêm thanh điều hướng "Finding N of M in this file" với nút Prev/Next để chuyển giữa các lỗi cùng file. Wrap-around tại 2 đầu.

**Các file đã sửa:**

| File | Thay đổi |
|------|----------|
| `code-inspector/DiffViewer.tsx` | +`goToLine` prop, Effect 2b scroll, `flex-1 min-h-0 overflow-y-auto` |
| `code-inspector/FileViewer.tsx` | Conditional container class (flex vs max-h), truyền `goToLine` |
| `CodeInspector.tsx` | Sibling finding navigation bar (Prev/Next), `useMemo` same-file findings |
| `index.css` | `.cm-editor` flex column, `.cm-scroller` flex:1 scroll |

---

## Trạng Thái Hiện Tại

| Hạng mục | Trạng thái |
|----------|-----------|
| Cross-scan finding status tracking | Hoàn thành |
| DiffViewer auto-scroll | Hoàn thành |
| DiffViewer vertical scrollbar | Hoàn thành |
| Sibling finding navigation | Hoàn thành |
| TypeScript build (`tsc -b`) | Pass |
| Web tests (209) | Pass |
| Engine tests (230) | Pass |
| Production build | Pass |

## Commits Gần Nhất

```
da7f921  fix(ui): restore auto-scroll, fix DiffViewer scrollbar, add sibling finding navigation
e000276  fix(ui): restore DiffViewer vertical scroll for multi-error files
e0952e3  feat: cross-scan finding status tracking (NEW/PERSISTING/RESOLVED/REGRESSED)
```

## Công Việc Còn Lại (Nếu Có)

- Chưa có CI/CD pipeline
- Chưa có linter/formatter configured
- Bundle JS > 500kB (cảnh báo Vite) — có thể code-split bằng dynamic import
- Chunk size optimization (optional)
