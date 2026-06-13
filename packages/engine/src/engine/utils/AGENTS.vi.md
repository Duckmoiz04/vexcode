# `utils/` — Tiện Ích Dùng Chung

**Helper nhẹ, được dùng bởi mọi module khác.** Không có external dependencies ngoài thư viện chuẩn Python.

## Cấu trúc

| File | Export | Trách nhiệm |
|------|--------|-------------|
| `logger.py` | `get_logger(name)` | Tạo/trả về `logging.Logger` với một `StreamHandler(sys.stderr)`, formatter đơn giản (`%(message)s`), và `propagate=False` |

## Chi tiết

### `logger.py`
- `get_logger(name)`: Wrapper chuẩn `logging.getLogger(name)`.
- Lần đầu gọi với `name` cụ thể: tạo `logging.StreamHandler` ghi ra `sys.stderr`, formatter `"%(message)s"` (không timestamp, không level prefix), thêm handler, tắt propagate lên root logger.
- Các lần gọi sau với cùng `name`: trả về logger đã cache (handler check ngăn trùng lặp).
- Được dùng đồng nhất toàn bộ engine — mọi module gọi `get_logger(__name__)` ở module level.
- `sys.stderr` cho output người dùng (tiến trình scan, cảnh báo, lỗi) giúp `sys.stdout` sạch cho JSON report.

## Tra cứu nhanh

| Task | File |
|------|------|
| Đổi format log (thêm timestamp, level) | `logger.py` |
| Đổi output stream (stdout thay vì stderr) | `logger.py` |
| Thêm structured logging (JSON lines) | `logger.py` |
| Im lặng module cụ thể trong test | `logger.py` (mock `get_logger` hoặc `logging.Logger`) |

## Quy ước

- **Mọi output → stderr**: qua `get_logger()`. stdout chỉ dùng cho JSON output (nội dung file report).
- **Module-level instantiation**: mọi module gọi `get_logger(__name__)` ở đầu file — biến `logger` có sẵn trong toàn module.
- **Không log levels**: formatter bỏ level prefix — mọi message in như cũ. Module dùng `logger.info()` / `logger.error()` để phân loại ngữ nghĩa.
- **Không log file rotation**: đây là CLI tool, không phải service dài hạn. Output chỉ qua stderr.
