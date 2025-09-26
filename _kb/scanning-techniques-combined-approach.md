---
layout: single
title: "Scanning Techniques: Host, Network, SBOM, Static — and How to Combine Them"
order: 40
---
---

**Intro**  
Scanning finds weak spots. Different scan types catch different problems. The smart approach combines multiple scans so you get better coverage with fewer false alarms.

<!--more-->

## 1) Major scan types — what they do

- **Network scanning** — probes IP ranges and ports to see what is exposed. Good for fast discovery and surface mapping.
- **Host-based scanning** — inspects the machine itself (installed packages, config, processes). Can be **agent-based** or **agentless**.
- **SBOM / SCA (Software Composition Analysis)** — lists application components and checks those packages for known CVEs. Great for supply‑chain visibility.
- **SAST (Static Application Security Testing)** — checks source code for issues before release.
- **DAST (Dynamic Application Security Testing)** — tests a running app from the outside to find runtime issues.

---

## 2) Agent vs Agentless (simple view)

**Agent-based scanning**
- A small program runs on the host.
- Pros: deep runtime visibility (running processes, live libraries), accurate list of installed packages, continuous telemetry.
- Cons: needs rollout and maintenance; small resource use on host.

**Agentless scanning**
- Uses remote access (SSH/WinRM) to log in and check.
- Pros: no software to install on hosts; easy for quick checks.
- Cons: less runtime detail; may fail in segmented or restricted networks.

**What to choose?**  
Use **agents** where you need continuous, deep visibility (servers, critical hosts). Use **agentless** for quick audits or where agents aren’t possible. Many teams use **both**.

---

## 3) SBOM — why it matters (with a tiny example)

An **SBOM** (**Software Bill of Materials**) is a list of all packages and versions in an application. It helps you answer: “Do we use the vulnerable version?” When a new CVE appears, you can search your SBOMs and respond fast.

**Example — make an SBOM and scan it (shell):**

```bash
# generate SBOM in CycloneDX format for a docker image
trivy image --format cyclonedx --output sbom.json nginx:latest

# scan the image directly for vulnerabilities
trivy image nginx:latest

# scan an existing SBOM file
trivy sbom sbom.json
```

*(These commands mirror the approach used in your book to connect SBOM and scanning.)*

---

## 4) Static vs Runtime — strengths and limits

- **Static (SAST)**: finds code issues before release. Good early, but can raise false positives and needs source code.
- **Runtime / Host-based**: sees what actually runs in production. Catches dynamic or environment‑specific problems. Needs access to deployed systems.

**Key idea:** combine both. Static finds issues early; runtime confirms which ones matter in real use.

---

## 5) Combine scan types — practical benefit

**SBOM + SAST + image scanning + host runtime scanning** gives broad and useful coverage. When you **correlate** results, you cut noise and focus on risks that are both present and reachable.

**Simple workflow:**

```text
1. Build: generate SBOM (Syft/Trivy)
2. CI: run SAST (e.g., Semgrep) on code
3. Image: run image scan (e.g., Trivy/Grype)
4. Deploy: run host runtime scan (agent or agentless)
5. Correlate: package+version → CVE → runtime evidence
6. Prioritize and patch
```

---

## 6) Quick checklist

- Keep scanners and feeds up to date (new CVEs appear daily).
- Use SBOMs to locate affected components fast.
- Combine **agent-based** for depth and **agentless** for breadth.
- Add context (asset criticality, exposure, EPSS, exploit info) to reduce false positives.

---

## 7) Summary

No single scan type is enough. A combined approach — SBOM + SAST + image scanning + host runtime scanning (mix of agent + agentless) — gives the widest and most useful view of risk. Use automation for scale and human review for tricky cases.
