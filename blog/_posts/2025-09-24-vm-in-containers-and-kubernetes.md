
Vulnerability Management for Containers and Kubernetes: From Image Layers to CI/CD
---


Traditional VM (vulnerability management) assumed long-lived servers. Containers and Kubernetes changed that: software ships as **layers**, runs as **short-lived pods**, and is promoted through **registries** and **GitOps pipelines**.  
This guide explains how VM fits into Docker images, the container runtime, and Kubernetes — and how to wire it into CI/CD with today’s best practices.

---

## 1) Containers 101 for VM

### Image layers and why they matter
- A container image is built in **layers** (base → packages → app). Vulnerabilities live in those layers.  
- The same base layer may be reused by hundreds of images — **patch once, fix many**.  
- Your scanner should report **which layer** introduced a CVE and the **fixed version**.

### Build contexts that affect risk
- **Base images:** Prefer minimal (e.g., distroless, alpine with caution) to shrink attack surface.  
- **Package managers:** `apt`, `apk`, `yum`, `pip`, `npm` add OS and app libs. Lock versions; update regularly.  
- **User & filesystem:** `USER 10001`, `readOnlyRootFilesystem`, drop Linux capabilities by default.

### Example: safer Dockerfile
```dockerfile
FROM gcr.io/distroless/python3
# Avoid root
USER 65532:65532
# App code
COPY app/ /app
WORKDIR /app
# No package managers at runtime image; build deps in a separate builder stage
ENTRYPOINT ["/usr/bin/python3","main.py"]
```
Tip: use multi-stage builds so compilers and build tools don’t end up in the final image.

## 2) Where to scan: build, registry, and runtime
A robust program scans at three checkpoints:

Build-time (CI) — Scan SBOM + image before pushing to registry; fail the build on critical issues.

Registry-time — Continuously rescan stored images when new CVEs are published (daily).

Runtime — Confirm whether vulnerable packages are actually loaded in running pods (reachability). Combine with workload context: internet-facing? privileged? sensitive data?

Inline vs. sidecar/daemonset
Inline scanners run in CI pipelines.

Registry scanners integrate with your image registry (GHCR, ECR, GCR, ACR).

Runtime insights often come from a DaemonSet on each node (agent) or agentless telemetry (e.g., eBPF-based).

## 3) SBOM + VEX + Signing = less noise, more trust
SBOM (Software Bill of Materials) attached to images lets scanners map packages precisely.

VEX documents mark whether a CVE is exploitable for your product (reduces false positives).

Signing / provenance (Cosign, SLSA) ensures the image and attestations are genuine.

Example: verify signatures at admission
Use policy engines to block unsigned images:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-cosign
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-signed-images
      match:
        any:
          - resources:
              kinds: ["Pod", "Deployment", "StatefulSet", "Job", "CronJob"]
      verifyImages:
        - imageReferences: ["registry.example.com/*"]
          attestors:
            - entries:
                - keys:
                    publicKeys: |
                      -----BEGIN PUBLIC KEY-----
                      ...
                      -----END PUBLIC KEY-----
   ```

## 4) Kubernetes architecture: where VM data meets cluster reality
### Key pieces
API Server & etcd — cluster brain. Harden access; audit logging on.

Scheduler & Controller Manager — place pods; enforce desired state.

Kubelet (nodes) — runs pods via containerd/cri-o.

Admission control — gatekeeper to enforce policies (Kyverno, OPA/Gatekeeper, Pod Security Admission).

### Security knobs that change risk
Pod Security (baseline/restricted): runAsNonRoot, allowPrivilegeEscalation=false, readOnlyRootFilesystem=true, drop all capabilities and add back only what’s needed.

NetworkPolicy: default-deny, allow only required egress/ingress.

Secrets: use external KMS/CSI provider; avoid env-var secrets.

Service accounts / workload identity: IRSA (AWS), GCP Workload Identity — least privilege for pods.

Ingress exposure: internet-facing services get higher priority for patching.

Example: secure pod spec
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  template:
    spec:
      automountServiceAccountToken: false
      securityContext:
        seccompProfile: {type: RuntimeDefault}
      containers:
      - name: app
        image: registry.example.com/web@sha256:... # pin by digest
        securityContext:
          runAsNonRoot: true
          allowPrivilegeEscalation: false
          capabilities:
            drop: ["ALL"]
          readOnlyRootFilesystem: true
        volumeMounts:
          - name: tmp
            mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {medium: Memory}
```

## 5) Prioritization that fits K8s reality

Not every CVE is equal. Prioritize with context:

Exposure: internet-facing Ingress, NodePort, or public LoadBalancer.

Blast radius: namespace with sensitive data, access to secrets, cluster-wide roles.

Runtime evidence: vulnerable library actually loaded in process memory.

Exploit signals: EPSS percentile, KEV list, available exploits.

Base image reuse: one fix may close hundreds of findings across deployments.

## 6) CI/CD: shift-left and guard the gates
Pipeline pattern (build → sign → attest → scan → release)

Build: create image + SBOM (e.g., syft).

Sign: cosign the image and attestations (SBOM, SLSA provenance).

Scan: SCA scanner on image + SBOM; fail on criticals that have fixes.

Policy: enforce via OPA/Kyverno in CI (prevent pushing non-compliant images).

Promote: use GitOps (Argo CD/Flux) to promote only signed, compliant digests across environments.

Re-scan on disclosure: new CVEs trigger registry rescans and PRs to bump base images.

## 7) Registry strategy and image hygiene
Mutable tags are dangerous: deploy by digest not tag. Keep a promotion flow (dev → staging → prod) with digests.

Base image program: maintain golden bases; patch monthly or when KEV/critical appears.

Deprecate old images: mark EOL; block new deployments referencing them.

Quarantine: hold images with severe findings or missing signatures.

## 8) Runtime controls that reduce exploitability
Read-only root FS, no privilege escalation, drop ALL caps.

Rootless containers when possible.

Seccomp/AppArmor profiles at least RuntimeDefault.

NetworkPolicy default deny + explicit egress.

Resource limits to avoid noisy-neighbor DoS.

mTLS (via service mesh) for pod-to-pod encryption.

## 9) K8s-aware remediation workflows
Patch at the source: bump the base image and rebuild dependents.

Automated PRs: bots raise PRs to update FROM digests across repos.

Gradual rollout: canary the new image; monitor error budgets; roll back fast if needed.

Exceptions with VEX: if a CVE is non-exploitable due to runtime policy, record a time-boxed exception with evidence.

## 10) What “good” looks like (reference checklist)
Build & Supply Chain

Multi-stage builds, minimal bases, reproducible builds.

SBOM generated and attached; image signed with Cosign.

SLSA/Sigstore attestations stored; provenance verified in CI and at admission.

Image scanned in CI; criticals with fixes block the pipeline.

Registry

Continuous rescans; alerts on KEV/High with fixes.

Only signed images promoted; digest-pinned deployments.

Base image patching cadence defined.

Kubernetes

Admission controls: Kyverno/Gatekeeper rules for signatures, Pod Security (restricted), and image sources.

Default-deny NetworkPolicies; tight egress.

Secrets via CSI/KMS; IRSA/Workload Identity for cloud access.

Runtime evidence used in prioritization.

Operations & Metrics

MTTR for critical image vulns < 7 days.

Coverage: % of workloads with SBOM + signature + policy pass.

False positives reduced via VEX + runtime reachability.

Regular “base image refresh” sprints.

## 11) Bringing it all together
VM in containers/K8s isn’t about chasing every CVE in every pod. It’s about controlling the sources (base images), guarding the gates (CI/CD and admission), and prioritizing with context (exposure + runtime evidence + exploit signals). Add SBOM/VEX/signing to cut noise, and GitOps to roll out fixes safely.

Do this well, and you’ll patch faster, break less, and spend your time fixing what actually matters.
