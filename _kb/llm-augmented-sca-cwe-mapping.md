---
layout: single
title: "LLM‑Augmented SCA: Map CVE→CWE, Cut False Positives, and Shift Left"
order: 90

---
---

## Why this matters

Most software vulnerabilities in code and dependencies can be described with **CWEs**, while **CVEs** are real-world cases tied to specific versions. Static tools (SCA/SAST) are good at **pattern matching** and **rules**; LLMs are good at **context**, **intent**, and **explanations**. We can combine both to reduce false positives, surface real risk, and help developers fix fast — **at commit time**.

---

## High-level design (best of both worlds)

<div class="mermaid">
flowchart LR
  Dev(Commit/Pull Request) -->|CI hook| SCA[SCA/Dependency Scan]
  Dev -->|CI hook| SAST[Static Code Scan]
  SCA --> Broker
  SAST --> Broker
  Broker[Findings Broker] --> LLM(LLM Analysis)
  KB[(CWE/CVE KB + EPSS + KEV + SBOM + Config)]
  LLM <---> KB
  LLM --> Verdict[Verdict + CWE Map + Fix Plan]
  Verdict --> PR[PR Comment / Check Run]
</div>

**Roles**  
- **SCA/SAST**: produce raw findings with rule IDs, locations, versions. Strong at syntax, taint, license rules.  
- **LLM**: adds context — is the code path reachable? does config make it exploitable? which **CWE** best fits? is there **fix** that won’t break build?  
- **KB**: retrieval store of CWE texts, secure coding examples, organization policies, and CVE/EPSS/KEV facts.

---

## What the LLM should do (and not do)

**Use LLM where strong:**  
1) **Normalize & group** duplicates across tools (semantic de-dup).  
2) **Map to CWE** with confidence and rationale.  
3) **Reachability heuristics**: reason about imports, call chains, feature flags, and env gates.  
4) **Policy explanation**: turn scanner jargon into plain steps.  
5) **Safe autofix drafts**: minimal diffs with tests.  
6) **Risk context**: link dependency CVEs to EPSS/KEV and to **runtime use** (if known).

**Rely on static tools where strong:**  
- Language parsing, ESLint/semgrep rules, type-aware taint analysis, SSA/CFG flows.  
- Exact version checks for SCA (package name + version + CVE).  
- License/attribution checks and reproducible SBOMs.

---

## Data contract: finding → LLM input

```json
{
  "artifact": "service/auth/user.py",
  "ecosystem": "pypi",
  "sca": {
    "package": "PyJWT",
    "version": "1.7.1",
    "cve": ["CVE-2022-xxxx"],
    "fixed_versions": ["2.4.0"]
  },
  "sast": {
    "rule_id": "jwt-none-alg",
    "line": 52,
    "code": "jwt.decode(token, verify=False)"
  },
  "context": {
    "calls": ["handle_login -> verify_token -> jwt.decode"],
    "feature_flags": ["legacy_auth=true"],
    "config": ["ALLOWED_ALG=none"],
    "exposure": "internet-facing"
  },
  "sbom_ref": "sha256:..."
}
```

LLM **output (strict JSON)**:

```json
{
  "cwe": ["CWE-287", "CWE-347"],
  "verdict": "exploitable",
  "confidence": 0.91,
  "exposure": "public",
  "explain": "JWT verified with 'none' algorithm; internet-facing route; legacy_auth enabled.",
  "fix": {
     "type": "change",
     "diff": "set verify=True and provide algorithm list; rotate tokens",
     "tests": ["add negative test for 'none' alg token"]
  }
}
```

---

## Prompt template
```
System: You are a secure code triage assistant. Output STRICT JSON for below schema.

User:
- Scanner Finding:
  <FINDING_JSON>
- CWE Knowledge: <RETRIEVED_CWE_SNIPPETS>

Tasks:
1) Map to CWE IDs with confidence.
2) Decide exploitability (exploitable|not_exploitable|needs_context) with reasoning.
3) Propose minimal safe fix.
```

---

## Cutting false positives (techniques that work)

- **Reachability gates**: require either (a) call-path from entrypoint or (b) package is runtime-loaded in prod.  
- **Config correlation**: some issues exist only when certain flags are enabled. Provide config snapshot to LLM.  
- **Environment scoping**: ignore dev/test-only code unless deploying.  
- **Exploit evidence**: boost priority if CVE is in **KEV** or EPSS≥70.  
- **LLM uncertainty routing**: if `confidence < 0.6`, send back to human or run deeper static analysis; do **not** auto-create tickets.

---

## Safe autofix (guardrails)

- Generate **small diffs** only.  
- Run **unit tests + SAST again** on patched branch.  
- Require reviewer approval for risky areas (crypto, auth, db migrations).  
- Keep a rollback plan; attach LLM rationale to the PR.  

---

## Evaluation (keep it honest)

Track: precision/recall, FP rate, time-to-fix, % auto-closed by tests, developer accept rate. Create a **golden set** of labeled findings mapped to CWE to regression-test the LLM prompt + static rules after each change.

---

## Example: SSRF in URL fetch

**Finding:** `requests.get(user_url)` flows from `?url=` parameter; ingress route is public.  
**LLM verdict:** CWE-918, exploitable; suggests allowlist + metadata URL block; adds unit test for `http://169.254.169.254`.  
**Static tool:** confirms taint flow and sink. **Together:** high confidence, one ticket, clear fix.

---

## Takeaways

- Let **static tools** find patterns and flows.  
- Let the **LLM** decide *context and priority*, map **CWE**, draft fixes, and translate to developer language.  
- Use strict schemas, validations, and confidence thresholds to avoid noise.  
- Result: fewer false positives, faster fixes, and a happier CI.
