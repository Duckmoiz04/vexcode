# Plan: Bổ sung OWASP Top 10 & CWE Top 25 Coverage cho OpenGrep

**Date:** 23-06-2026  
**Status:** ACTIVE  
**Priority:** HIGH  
**Goal:** Tăng coverage OWASP từ 30% → 90% và CWE Top 25 từ 4% → 60%

---

## Tổng quan Hiện tại

### Coverage hiện tại
- **OWASP Top 10:** 3/10 (30%) - A02, A03, A07
- **CWE Top 25:** 1/25 (4%) - Chỉ CWE-78
- **Custom rules:** 10 rules (8 Python, 2 JS/TS Express)
- **Taint rules:** 0 rules (lãng phí lớn nhất của OpenGrep)

### Yếu điểm chính
1. **Không có taint rules** - OpenGrep hỗ trợ `--taint-intrafile` nhưng không dùng
2. **Thiếu React/Frontend security** - 0 rules cho React
3. **Thiếu OWASP critical categories** - A01, A04, A05, A08, A09, A10
4. **Thiếu CWE Top 25** - XSS, SQL injection, CSRF, Path traversal, SSRF

---

## Phase 1: Taint Rules (Ưu tiên CAO NHẤT)

**Mục tiêu:** Unlock khả năng `--taint-intrafile` của OpenGrep

### 1.1 SQL Injection Taint Rules
**File:** `semgrep-rules/custom/taint-sql-injection.yaml`

```yaml
rules:
  - id: taint-sql-injection-python
    mode: taint
    pattern-sources:
      - pattern: request.args.get(...)
      - pattern: request.form.get(...)
      - pattern: request.json.get(...)
      - pattern: request.data
    pattern-sinks:
      - pattern: execute(...)
      - pattern: executemany(...)
      - pattern: cursor.execute(...)
      - pattern: $DB.execute(...)
    message: "SQL injection: user input flows into SQL query without parameterization"
    severity: ERROR
    languages: [python]
    metadata:
      cwe: "CWE-89"
      owasp: "A03:2021 - Injection"
      category: security
```

### 1.2 Command Injection Taint Rules
**File:** `semgrep-rules/custom/taint-command-injection.yaml`

```yaml
rules:
  - id: taint-command-injection-python
    mode: taint
    pattern-sources:
      - pattern: request.args.get(...)
      - pattern: request.form.get(...)
      - pattern: request.json.get(...)
    pattern-sinks:
      - pattern: subprocess.call(...)
      - pattern: subprocess.run(...)
      - pattern: os.system(...)
      - pattern: os.popen(...)
    message: "Command injection: user input flows into system command"
    severity: ERROR
    languages: [python]
    metadata:
      cwe: "CWE-78"
      owasp: "A03:2021 - Injection"
      category: security
```

### 1.3 Path Traversal Taint Rules
**File:** `semgrep-rules/custom/taint-path-traversal.yaml`

```yaml
rules:
  - id: taint-path-traversal-python
    mode: taint
    pattern-sources:
      - pattern: request.args.get(...)
      - pattern: request.form.get(...)
    pattern-sinks:
      - pattern: open(...)
      - pattern: Path(...).read_text()
      - pattern: pathlib.Path(...)
    message: "Path traversal: user input flows into file path without sanitization"
    severity: ERROR
    languages: [python]
    metadata:
      cwe: "CWE-22"
      owasp: "A01:2021 - Broken Access Control"
      category: security
```

### 1.4 XSS Taint Rules (JavaScript/TypeScript)
**File:** `semgrep-rules/custom/taint-xss-js.yaml`

```yaml
rules:
  - id: taint-xss-javascript
    mode: taint
    pattern-sources:
      - pattern: req.query.$PROP
      - pattern: req.params.$PROP
      - pattern: req.body.$PROP
    pattern-sinks:
      - pattern: res.send(...)
      - pattern: res.json(...)
      - pattern: $ELEMENT.innerHTML = ...
      - pattern: document.write(...)
    message: "XSS: user input flows into response without sanitization"
    severity: ERROR
    languages: [javascript, typescript]
    metadata:
      cwe: "CWE-79"
      owasp: "A03:2021 - Injection"
      category: security
```

---

## Phase 2: OWASP Missing Categories

### 2.1 A01: Broken Access Control
**File:** `semgrep-rules/custom/no-idor-patterns.yaml`

```yaml
rules:
  - id: no-idor-patterns
    patterns:
      - pattern-either:
          - pattern: $APP.get('/api/$RESOURCE/:id', ...)
          - pattern: $APP.get('/api/$RESOURCE/:$ID', ...)
      - pattern-not-inside: |
          $APP.get('/api/$RESOURCE/:id', ($REQ, $RES) => {
            ...
            if (...) { ... }
            ...
          })
    message: "Potential IDOR: route handler may lack authorization check"
    severity: WARNING
    languages: [javascript, typescript]
    metadata:
      cwe: "CWE-639"
      owasp: "A01:2021 - Broken Access Control"
      category: security
```

### 2.2 A05: Security Misconfiguration
**File:** `semgrep-rules/custom/no-debug-in-production.yaml`

```yaml
rules:
  - id: no-debug-in-production
    pattern-either:
      - pattern: app.set('debug', true)
      - pattern: DEBUG=True
      - pattern: FLASK_DEBUG=1
    message: "Debug mode enabled in production configuration"
    severity: ERROR
    languages: [python, javascript, typescript]
    metadata:
      cwe: "CWE-489"
      owasp: "A05:2021 - Security Misconfiguration"
      category: security
```

### 2.3 A08: Software & Data Integrity Failures
**File:** `semgrep-rules/custom/no-eval-in-handler.yaml`

```yaml
rules:
  - id: no-eval-in-handler
    patterns:
      - pattern-either:
          - pattern: eval(...)
          - pattern: new Function(...)
          - pattern: setTimeout('...', ...)
          - pattern: setInterval('...', ...)
      - pattern-inside: |
          $APP.$METHOD($PATH, ($REQ, $RES) => {
            ...
          })
    message: "eval() in route handler: code injection risk"
    severity: ERROR
    languages: [javascript, typescript]
    metadata:
      cwe: "CWE-94"
      owasp: "A08:2021 - Software and Data Integrity Failures"
      category: security
```

### 2.4 A10: Server-Side Request Forgery (SSRF)
**File:** `semgrep-rules/custom/taint-ssrf.yaml`

```yaml
rules:
  - id: taint-ssrf-python
    mode: taint
    pattern-sources:
      - pattern: request.args.get(...)
      - pattern: request.json.get(...)
    pattern-sinks:
      - pattern: requests.get(...)
      - pattern: requests.post(...)
      - pattern: urllib.request.urlopen(...)
      - pattern: httpx.get(...)
    message: "SSRF: user input flows into outbound HTTP request"
    severity: ERROR
    languages: [python]
    metadata:
      cwe: "CWE-918"
      owasp: "A10:2021 - SSRF"
      category: security
```

---

## Phase 3: CWE Top 25 Missing Rules

### 3.1 CSRF Protection Detection
**File:** `semgrep-rules/custom/missing-csrf-protection.yaml`

```yaml
rules:
  - id: missing-csrf-protection
    patterns:
      - pattern: $APP.post(...)
      - pattern-not-inside: |
          $APP.post(..., csrfProtection, ...)
      - pattern-not-inside: |
          $APP.post(..., [csrfProtection, ...], ...)
    message: "POST route may lack CSRF protection"
    severity: WARNING
    languages: [javascript, typescript]
    metadata:
      cwe: "CWE-352"
      owasp: "A01:2021 - Broken Access Control"
      category: security
```

### 3.2 Unrestricted File Upload
**File:** `semgrep-rules/custom/no-unrestricted-upload.yaml`

```yaml
rules:
  - id: no-unrestricted-upload
    pattern-either:
      - pattern: multer(...)
      - pattern: $REQ.files
    message: "File upload detected: ensure file type and size validation"
    severity: WARNING
    languages: [javascript, typescript]
    metadata:
      cwe: "CWE-434"
      owasp: "A04:2021 - Insecure Design"
      category: security
```

### 3.3 Missing Input Validation
**File:** `semgrep-rules/custom/missing-input-validation.yaml`

```yaml
rules:
  - id: missing-input-validation-python
    patterns:
      - pattern: $APP.route(...)
      - pattern-not-inside: |
          @app.route(...)
          def $FUNC(...):
              ...
              validate(...)
              ...
    message: "Route handler may lack input validation"
    severity: WARNING
    languages: [python]
    metadata:
      cwe: "CWE-20"
      owasp: "A04:2021 - Insecure Design"
      category: security
```

---

## Phase 4: React/Frontend Security

### 4.1 dangerouslySetInnerHTML
**File:** `semgrep-rules/custom/no-dangerouslysetinnerhtml.yaml`

```yaml
rules:
  - id: no-dangerouslysetinnerhtml
    pattern: dangerouslySetInnerHTML={{ __html: $PROP }}
    message: "dangerouslySetInnerHTML with dynamic content: XSS risk"
    severity: ERROR
    languages: [javascript, typescript, jsx, tsx]
    metadata:
      cwe: "CWE-79"
      owasp: "A03:2021 - Injection"
      category: security
```

### 4.2 innerHTML Usage
**File:** `semgrep-rules/custom/no-innerhtml.yaml`

```yaml
rules:
  - id: no-innerhtml
    pattern-either:
      - pattern: $ELEMENT.innerHTML = $VALUE
      - pattern: $ELEMENT.outerHTML = $VALUE
    message: "innerHTML/outerHTML assignment: use textContent or dangerouslySetInnerHTML with sanitization"
    severity: ERROR
    languages: [javascript, typescript]
    metadata:
      cwe: "CWE-79"
      owasp: "A03:2021 - Injection"
      category: security
```

### 4.3 React eval Usage
**File:** `semgrep-rules/custom/no-eval-in-react.yaml`

```yaml
rules:
  - id: no-eval-in-react
    pattern-either:
      - pattern: eval(...)
      - pattern: new Function(...)
    message: "eval() in React component: code injection risk"
    severity: ERROR
    languages: [javascript, typescript, jsx, tsx]
    metadata:
      cwe: "CWE-94"
      owasp: "A03:2021 - Injection"
      category: security
```

---

## Phase 5: Node.js/Express Expansion

### 5.1 Prototype Pollution
**File:** `semgrep-rules/custom/no-prototype-pollution.yaml`

```yaml
rules:
  - id: no-prototype-pollution
    pattern-either:
      - pattern: Object.assign($TARGET, $SOURCE)
      - pattern: {...$SOURCE, ...$USER_INPUT}
    message: "Potential prototype pollution: validate and sanitize merge sources"
    severity: WARNING
    languages: [javascript, typescript]
    metadata:
      cwe: "CWE-1321"
      owasp: "A08:2021 - Software and Data Integrity Failures"
      category: security
```

### 5.2 Open Redirect
**File:** `semgrep-rules/custom/no-open-redirect.yaml`

```yaml
rules:
  - id: no-open-redirect
    pattern-either:
      - pattern: res.redirect($USER_INPUT)
      - pattern: redirect($USER_INPUT)
    message: "Open redirect: validate redirect URL against whitelist"
    severity: ERROR
    languages: [javascript, typescript]
    metadata:
      cwe: "CWE-601"
      owasp: "A01:2021 - Broken Access Control"
      category: security
```

### 5.3 JSON.parse without try-catch
**File:** `semgrep-rules/custom/unsafe-json-parse.yaml`

```yaml
rules:
  - id: unsafe-json-parse
    pattern: JSON.parse($INPUT)
    message: "JSON.parse without try-catch: DoS risk from malformed JSON"
    severity: WARNING
    languages: [javascript, typescript]
    metadata:
      cwe: "CWE-20"
      owasp: "A04:2021 - Insecure Design"
      category: reliability
```

---

## Phase 6: Python Deserialization

### 6.1 pickle Usage
**File:** `semgrep-rules/custom/no-pickleloads.yaml`

```yaml
rules:
  - id: no-pickleloads
    pattern-either:
      - pattern: pickle.loads(...)
      - pattern: pickle.load(...)
      - pattern: cPickle.loads(...)
    message: "Insecure deserialization: pickle can execute arbitrary code"
    severity: ERROR
    languages: [python]
    metadata:
      cwe: "CWE-502"
      owasp: "A08:2021 - Software and Data Integrity Failures"
      category: security
```

### 6.2 yaml.load without SafeLoader
**File:** `semgrep-rules/custom/unsafe-yaml-load.yaml`

```yaml
rules:
  - id: unsafe-yaml-load
    pattern: yaml.load($DATA)
    message: "yaml.load without Loader=SafeLoader: code execution risk"
    severity: ERROR
    languages: [python]
    metadata:
      cwe: "CWE-502"
      owasp: "A08:2021 - Software and Data Integrity Failures"
      category: security
```

---

## Implementation Checklist

### Phase 1: Taint Rules (Ưu tiên cao nhất)
- [ ] 1.1 Tạo `taint-sql-injection.yaml`
- [ ] 1.2 Tạo `taint-command-injection.yaml`
- [ ] 1.3 Tạo `taint-path-traversal.yaml`
- [ ] 1.4 Tạo `taint-xss-js.yaml`
- [ ] Test taint rules với sample vulnerable code
- [ ] Verify `--taint-intrafile` hoạt động đúng

### Phase 2: OWASP Missing Categories
- [ ] 2.1 Tạo `no-idor-patterns.yaml` (A01)
- [ ] 2.2 Tạo `no-debug-in-production.yaml` (A05)
- [ ] 2.3 Tạo `no-eval-in-handler.yaml` (A08)
- [ ] 2.4 Tạo `taint-ssrf.yaml` (A10)

### Phase 3: CWE Top 25
- [ ] 3.1 Tạo `missing-csrf-protection.yaml` (CWE-352)
- [ ] 3.2 Tạo `no-unrestricted-upload.yaml` (CWE-434)
- [ ] 3.3 Tạo `missing-input-validation.yaml` (CWE-20)

### Phase 4: React/Frontend
- [ ] 4.1 Tạo `no-dangerouslysetinnerhtml.yaml` (CWE-79)
- [ ] 4.2 Tạo `no-innerhtml.yaml` (CWE-79)
- [ ] 4.3 Tạo `no-eval-in-react.yaml` (CWE-94)

### Phase 5: Node.js/Express
- [ ] 5.1 Tạo `no-prototype-pollution.yaml` (CWE-1321)
- [ ] 5.2 Tạo `no-open-redirect.yaml` (CWE-601)
- [ ] 5.3 Tạo `unsafe-json-parse.yaml` (CWE-20)

### Phase 6: Python Deserialization
- [ ] 6.1 Tạo `no-pickleloads.yaml` (CWE-502)
- [ ] 6.2 Tạo `unsafe-yaml-load.yaml` (CWE-502)

---

## Expected Coverage After Implementation

### OWASP Top 10 Coverage
| Category | Status | Rules |
|----------|--------|-------|
| A01: Broken Access Control | ✅ | `no-idor-patterns`, `no-open-redirect`, `taint-path-traversal` |
| A02: Cryptographic Failures | ✅ | `no-insecure-http` |
| A03: Injection | ✅ | `taint-sql-injection`, `taint-command-injection`, `taint-xss-js`, `no-eval-in-handler`, `no-eval-in-react` |
| A04: Insecure Design | ✅ | `missing-input-validation`, `no-unrestricted-upload`, `unsafe-json-parse` |
| A05: Security Misconfiguration | ✅ | `no-debug-in-production` |
| A06: Vulnerable Components | ⚠️ | Cần SAST tool khác (npm audit, pip-audit) |
| A07: Auth Failures | ✅ | `no-hardcoded-creds` |
| A08: Data Integrity Failures | ✅ | `no-eval-in-handler`, `no-prototype-pollution`, `no-pickleloads`, `unsafe-yaml-load` |
| A09: Logging Failures | ⚠️ | Cần custom rule logging detection |
| A10: SSRF | ✅ | `taint-ssrf` |

**Coverage: 8/10 (80%) → 9/10 (90%)** nếu thêm logging rule

### CWE Top 25 Coverage
| CWE | Name | Status |
|-----|------|--------|
| CWE-79 | XSS | ✅ `taint-xss-js`, `no-dangerouslysetinnerhtml`, `no-innerhtml` |
| CWE-89 | SQL Injection | ✅ `taint-sql-injection` |
| CWE-352 | CSRF | ✅ `missing-csrf-protection` |
| CWE-78 | OS Command Injection | ✅ `no-child-process-in-handler`, `taint-command-injection` |
| CWE-22 | Path Traversal | ✅ `taint-path-traversal` |
| CWE-918 | SSRF | ✅ `taint-ssrf` |
| CWE-94 | Code Injection | ✅ `no-eval-in-handler`, `no-eval-in-react` |
| CWE-434 | Unrestricted Upload | ✅ `no-unrestricted-upload` |
| CWE-20 | Input Validation | ✅ `missing-input-validation`, `unsafe-json-parse` |
| CWE-862 | Missing Authorization | ⚠️ Cần rule thêm |
| CWE-306 | Missing Auth | ⚠️ Cần rule thêm |
| CWE-476 | NULL Pointer | ❌ Không áp dụng cho JS/Python |
| CWE-770 | Resource Limits | ⚠️ Cần rate limiting rule |

**Coverage: 10/25 (40%) → 12/25 (48%)** với rules hiện có

---

##风险与缓解措施

### Risks
1. **False Positives từ taint rules** - Taint analysis có thể quá broad
2. **Performance impact** - Taint analysis chậm hơn pattern matching
3. **Maintenance burden** - Nhiều rules cần maintain

### Mitigations
1. **Start with strict taint rules** - Chỉ detect direct user input → sink
2. **Use `--dynamic-timeout`** - Đã enable để tránh timeout
3. **Group rules theo language** - Dễ maintain và test

---

## Success Criteria

1. **OWASP Coverage:** ≥ 80% (8/10 categories)
2. **CWE Top 25 Coverage:** ≥ 40% (10/25 weaknesses)
3. **Taint Rules:** Ít nhất 4 rules hoạt động với `--taint-intrafile`
4. **False Positive Rate:** < 10%
5. **All tests pass:** 312+ tests

---

## Next Steps

1. Bắt đầu với Phase 1 (Taint Rules) - impact cao nhất
2. Test từng rule với sample vulnerable code
3. Update `iso25010_taxonomy.py` nếu cần thêm CWE mappings
4. Document rules trong `semgrep-rules/custom/README.md`

---

**Last Updated:** 23-06-2026  
**Owner:** Sisyphus  
**Status:** Ready for Implementation