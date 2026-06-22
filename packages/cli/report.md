# VexCode Scan Report

- **Target**: `D:\DATN2\packages\engine`
- **Scanner**: opengrep-mock
- **Timestamp**: 2026-06-22T09:53:27.302575Z
- **Commit**: `baf1d864`
- **Dirty**: Yes

## Summary

**Total findings**: 5

### By Severity

- **error**: 2
- **warning**: 1

### By Category

- **security**: 3
- **unknown**: 2

### Quality Gate: ✗ FAILED

- ❌ Exceeded max critical findings: 2 > 0
- ❌ Exceeded max high-severity findings: 3 > 1
- ❌ Exceeded max total findings: 5 > 2

## Finding Details

### db.py

| Line | Severity | Rule | Message | Category | Status |
|------|----------|------|---------|----------|--------|
| 45 | warning | `python.lang.security.audit.hardcoded-password` | Hardcoded password variable found in connection string. | security | open |

### example.py

| Line | Severity | Rule | Message | Category | Status |
|------|----------|------|---------|----------|--------|
| 12 | error | `python.lang.security.audit.dangerous-exec` | Found use of exec() with user input, which presents a remote code execution vuln | security | open |
| 10 | error | `gitleaks/mock-secret` | [Mock] Hardcoded credential detected | security | open |
| 8 | WARNING | `maintainability.naming.obscure` | Tên hàm 'do_it' và tham số 'x' quá chung chung và tối nghĩa. Đề xuất đổi tên để  |  | open |
| 8 | WARNING | `maintainability.naming.obscure` | Tên hàm 'do_it' và tham số 'x' quá chung chung và tối nghĩa. Đề xuất đổi tên để  |  | open |

## AI Resolutions

- **python.lang.security.audit.dangerous-exec**: Avoid using exec(). Use structured functions or parse inputs securely.
- **python.lang.security.audit.hardcoded-password**: Load password from environment variables instead of hardcoding it in the connection string.
- **gitleaks/mock-secret**: Avoid this pattern for rule gitleaks/mock-secret. Ensure input validation and standard security practices.
- **maintainability.naming.obscure**: Đổi tên hàm 'do_it' thành 'process_user_data' và tham số 'x' thành 'user_input' để tăng tính rõ nghĩa và dễ bảo trì.
