"""Pipeline step modules for the analysis engine.

scanner    — Opengrep scanning + fast-scan file detection + Gitleaks secret scanning
enricher   — GitNexus AST enrichment
resolver   — Complexity metrics, naming audit, AI resolution
reporter   — Report assembly + JSON/Markdown output
thresholds — Quality gate evaluation (configurable PASS/FAIL)
"""