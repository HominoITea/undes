# Commercial Strategy & Boundary Review

Status: discussion
Priority: medium

## Summary
This document captures the cross-functional review of the `COMMERCIAL_ADDON_BOUNDARY.md` policy. The review evaluates the proposed Open Core model from technical, financial, and legal perspectives.

## 💼 Financial Perspective

1. **Target Audience:** Prioritizing GitLab and Jira integrations is the right move for Enterprise (B2B) monetization. This is a high-margin market that values out-of-the-box workflows.
2. **Cannibalization Risk (The Paywall):** The OSS core must remain highly functional for individual developers, but we need strict "Enterprise boundaries". Features like SSO, RBAC (Role-Based Access Control), Audit Logs, and managed multi-tenant instances should be strictly reserved for the commercial layer.
3. **Maintenance Overhead:** Splitting OSS and Commercial logic into separate repositories increases CI/CD complexity. We must budget engineering time to ensure OSS updates do not silently break proprietary plugins.

## ⚖️ Legal Perspective

1. **OSS License Choice:** To safely build proprietary plugins on top of the OSS core, the core repository must use a permissive license (e.g., **Apache 2.0** or **MIT**). Copyleft licenses (like GPL) could force commercial plugins to be open-sourced if they link to the core.
2. **Contributor License Agreement (CLA):** If community contributions are accepted into the OSS core, a CLA process is mandatory. This protects our intellectual property and grants us the legal right to include community fixes in commercial bundles.
3. **IP Protection & Automation:** We must implement strict CI scanners (or pre-commit hooks) to ensure customer-specific workflows, billing logic, and proprietary adapter code never accidentally leak into the OSS repository.

## 🛠️ Architectural Implications

To support the separation outlined in `COMMERCIAL_ADDON_BOUNDARY.md`, the Hub must evolve a formal **Plugin / Hook Architecture**. 
Currently, scripts like `hub.js` and `generate-context.js` are tightly coupled. We need clear inversion-of-control (IoC) boundaries so that a commercial Jira or GitLab package can inject its logic (e.g., fetching a ticket, submitting a PR) without modifying the core OSS files.

## Roadmap Separation

To maintain focus, we should split our planning surfaces:
- **Technical Roadmap:** (`ai/ROADMAP.md`) — focuses purely on OSS pipeline hardening, memory models, and agent orchestration.
- **Commercial Roadmap:** ([`docs/commercialization/commercial-roadmap.md`](/home/kair/ai_agents_coding/ai-hub-coding/docs/commercialization/commercial-roadmap.md)) — tracks commercialization milestones, launch gates, pilot economics, and add-on sequencing separately from the engineering roadmap.

---
**Related References:**
- `COMMERCIAL_ADDON_BOUNDARY.md`
- `ai/ROADMAP.md`
