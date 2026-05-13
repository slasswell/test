# AI Agent Opportunity Report

**Tier 1 Deliverable — Confidential**

---

| Field | Value |
|-------|-------|
| **Client** | [Client Name] |
| **Industry** | [Industry] |
| **Business Size** | [X employees] |
| **Date** | [Delivery Date] |
| **Prepared by** | [Founder Name], [Business Name] |
| **Engagement Scope** | [Focused / Standard / Comprehensive] |
| **Workflows Assessed** | [Number] |
| **Report Version** | 1.0 |

*This document is prepared exclusively for [Client Name]. It contains proprietary
analysis of internal operations and should not be distributed outside the organization
without prior written consent.*

---

## 1. Executive Summary

### What This Engagement Found

[2–3 sentences describing the overall picture: how the business operates, what the
discovery sessions surfaced, and the general level of AI readiness observed.]

**Example:** After three discovery sessions with the [Client Name] operations and client
services teams, we mapped seven core workflows and identified five candidate AI agent
opportunities. The business has strong data infrastructure and a team open to change —
conditions that make implementation faster and more reliable than average. Three
opportunities are recommended for prioritized investment, with one clear first move.

### Key Findings

- **Finding 1:** [Description — e.g., "Manual data re-entry between [System A] and [System B] consumes an estimated 12 hours/week across the ops team"]
- **Finding 2:** [Description]
- **Finding 3:** [Description]
- **Finding 4:** [Description]

### Top Recommended Opportunities

| Priority | Opportunity | Complexity | Est. Annual Value |
|----------|-------------|------------|-------------------|
| 1 | [Opportunity Name A] | Low–Medium | $[X]K–$[Y]K |
| 2 | [Opportunity Name B] | Medium | $[X]K–$[Y]K |
| 3 | [Opportunity Name C] | Medium–High | $[X]K–$[Y]K |

### Recommended Immediate Next Step

[One specific action. Example: "Begin a Tier 2 Agent Blueprint for Opportunity #1.
Target build start: Q3 2026. Prerequisite: confirm API access to [System A]."]

---

## 2. Current State Snapshot

*A brief picture of where the business stands today, based on what was shared in
the discovery sessions. Not exhaustive — focused on what's relevant to AI agent adoption.*

### Operations Overview

| Area | Current State |
|------|--------------|
| Team size | [X] employees |
| Primary workflows | [Brief list] |
| Primary tools | [List] |
| Data infrastructure | [Structured / Partially structured / Scattered] |
| Tool integration | [Mostly automated / Mixed / Mostly manual] |
| Prior AI/automation | [None / Informal / Some tools in use] |
| Internal technical capacity | [Self-managed / Vendor-dependent / None] |

### Workflow Summary

Brief description of the 3–8 workflows covered in the assessment:

| Workflow | Owner | Volume/Frequency | Current Pain Level |
|----------|-------|-----------------|-------------------|
| [Workflow A] | [Dept/Role] | [X/week] | High / Medium / Low |
| [Workflow B] | [Dept/Role] | [X/week] | High / Medium / Low |
| [Workflow C] | [Dept/Role] | [X/week] | High / Medium / Low |
| [Workflow D] | [Dept/Role] | [X/week] | High / Medium / Low |
| [Workflow E] | [Dept/Role] | [X/week] | High / Medium / Low |

### Identified Pain Points (Summary)

- **[Pain Point 1]:** [Description and operational impact]
- **[Pain Point 2]:** [Description and operational impact]
- **[Pain Point 3]:** [Description and operational impact]
- **[Pain Point 4]:** [Description and operational impact]

---

## 3. Opportunity Scoring Methodology

Each candidate opportunity is evaluated on four dimensions, scored 1–5:

| Dimension | Score 1 | Score 3 | Score 5 |
|-----------|---------|---------|---------|
| **ROI Potential** | Minimal time or cost saved | Moderate savings | Significant labor or revenue impact |
| **Implementation Feasibility** | Technically complex, many unknowns | Moderate complexity | Well-understood problem, clear solution |
| **Data Readiness** | Data scattered / missing / unstructured | Partially accessible | Data clean, accessible, structured |
| **Strategic Fit** | Nice-to-have, peripheral | Supports a key goal | Directly tied to a core business priority |

**Composite Score** = Average of all four dimensions.

| Score | Recommendation |
|-------|---------------|
| 4.0–5.0 | **Prioritize** — high confidence, clear ROI |
| 3.0–3.9 | **Consider** — solid case, address dependencies first |
| 2.0–2.9 | **Defer** — revisit after higher-priority items are complete |
| < 2.0   | **Decline** — not appropriate for AI agent approach |

---

## 4. Opportunity Scorecard

| # | Opportunity | ROI Potential | Feasibility | Data Readiness | Strategic Fit | **Composite** | Recommendation |
|---|-------------|:---:|:---:|:---:|:---:|:---:|---|
| 1 | [Name A] | 5 | 4 | 4 | 5 | **4.5** | Prioritize |
| 2 | [Name B] | 4 | 4 | 4 | 4 | **4.0** | Prioritize |
| 3 | [Name C] | 4 | 3 | 4 | 4 | **3.75** | Prioritize |
| 4 | [Name D] | 4 | 3 | 2 | 3 | **3.0** | Consider |
| 5 | [Name E] | 3 | 2 | 2 | 3 | **2.5** | Defer |

---

## 5. Prioritized Opportunity Profiles

---

### Opportunity #1: [Opportunity Name A]

**Composite Score:** [X.X] / 5.0  
**Complexity Rating:** Low / Medium / High  
**Recommended Platform / Tooling:** [e.g., Claude API + n8n / Make / Zapier / Copilot Studio / Custom Python]

#### The Problem

[2–3 sentences describing the specific pain this addresses. What is happening now? Who is doing it? How often? What goes wrong?]

**Example:** The sales team manually transfers qualified lead data from the web inquiry
form into HubSpot CRM — a 15-step process that takes 8–12 minutes per lead, runs 40+
times a week, and results in an ~18% data entry error rate that must be manually corrected.

#### What the Agent Would Do

Describe the agent's behavior in plain, non-technical language:

- **Trigger:** [What event starts the agent — e.g., new form submission received, email arrives with specific subject, daily schedule at 8am]
- **Step 1:** [What it does — e.g., reads the form data and normalizes fields]
- **Step 2:** [e.g., checks HubSpot for a duplicate contact]
- **Step 3:** [e.g., creates or updates the CRM record with enriched data]
- **Step 4:** [e.g., sends a Slack notification to the assigned sales rep]
- **Human handoff:** [Where a human reviews, approves, or acts — e.g., "Rep reviews the enriched contact before sending first outreach"]

#### Systems and Integrations Required

| System | What the Agent Does With It | Access Status |
|--------|----------------------------|--------------|
| [System A] | [Reads / Writes / Triggers] | Available / Needs setup |
| [System B] | [Reads / Writes / Triggers] | Available / Needs setup |

#### Estimated Value

| Metric | Current | With Agent | Annual Impact |
|--------|---------|-----------|---------------|
| Time per task | [X min] | [Y min] | [Z hrs/year saved] |
| Volume | [N tasks/week] | — | — |
| Error rate | [X%] | ~0% | [Cost of rework avoided/year] |
| Staff capacity freed | — | [X hrs/week] | [$X in labor redirected] |
| **Total estimated annual value** | | | **$[X]K–$[Y]K** |

*Note: Estimates use [Client Name]'s own figures from discovery sessions — not industry
benchmarks. They should be treated as directional, not audited.*

#### Recommended Platform and Tooling

**Primary recommendation:** [e.g., n8n (self-hosted) + Claude API]  
**Rationale:** [1–2 sentences on why this stack fits — cost, integration capability, maintainability, client's existing tools]

**Alternative considered:** [e.g., Zapier]  
**Why not chosen:** [e.g., Zapier's per-task pricing would exceed $X/month at this volume; n8n's one-time setup cost is more economical at scale]

#### Implementation Estimate

| Item | Estimate |
|------|---------|
| Build effort | [Low: 2–4 wks / Medium: 4–8 wks / High: 8–16 wks] |
| Estimated cost | [$X,000–$Y,000] |
| Key dependencies | [e.g., API credentials for [System A], data cleanup in [System B]] |
| Key risks | [e.g., [System A] API rate limits may require a queuing layer] |
| Mitigation | [e.g., Test at low volume first; monitor API usage in week 1] |

#### Success Metrics (KPIs)

- [KPI 1 — e.g., Data entry time per lead reduced from 10 min to <1 min]
- [KPI 2 — e.g., CRM data error rate reduced from 18% to <2%]
- [KPI 3 — e.g., X hours/week of sales team time redeployed to calls]

---

### Opportunity #2: [Opportunity Name B]

*(Repeat the structure above for each of the top 3–5 opportunities.)*

**Composite Score:** [X.X] / 5.0  
**Complexity Rating:** Low / Medium / High  
**Recommended Platform / Tooling:** [Platform]

#### The Problem
[Description]

#### What the Agent Would Do
- **Trigger:** [Description]
- **Step 1:** [Description]
- **Step 2:** [Description]
- **Human handoff:** [Description]

#### Systems and Integrations Required
| System | Role | Access Status |
|--------|------|--------------|
| [System] | [Role] | [Status] |

#### Estimated Value
| Metric | Current | With Agent | Annual Impact |
|--------|---------|-----------|---------------|
| Time per task | — | — | — |
| Error rate | — | — | — |
| **Est. annual value** | | | **$[X]K–$[Y]K** |

#### Recommended Platform and Tooling
**Primary:** [Platform] — [1-sentence rationale]

#### Implementation Estimate
| Build effort | Estimated cost | Key dependency |
|---|---|---|
| [Timeline] | $[X]K–$[Y]K | [Dependency] |

#### Success Metrics
- [KPI 1]
- [KPI 2]

---

### Opportunity #3: [Opportunity Name C]

*(Repeat structure above)*

---

## 6. Deferred Opportunities

These opportunities were identified but are not recommended for current investment.

| Opportunity | Composite Score | Reason Deferred | Revisit Condition |
|-------------|:---:|----------------|-------------------|
| [Name D] | 3.0 | Low data readiness — source data in inconsistent formats | After CRM data cleanup project completes |
| [Name E] | 2.5 | Low feasibility — workflow depends on a legacy system with no API | After system replacement (planned Q4) |

---

## 7. Recommended Next Steps

### Implementation Sequence

```
Phase 1 (Recommended Start): [Opportunity #1 Name]
  Timeline: [Start date] → [Target launch date]
  └── Prerequisites: [List 1–2 prerequisites]
  └── Milestones: Blueprint → Build → UAT → Launch

Phase 2: [Opportunity #2 Name]
  Timeline: Begin after Phase 1 launch (or in parallel if capacity allows)
  └── Prerequisites: [Dependencies]

Phase 3: [Opportunity #3 Name]
  Timeline: After Phase 2
  └── Note: [Any conditional factors]
```

### Immediate Actions (Client)

| Action | Owner | By When |
|--------|-------|---------|
| Review this report with leadership team | [Client] | [Date] |
| Confirm Opportunity #1 as priority | [Client] | [Date] |
| Confirm API access to [System A] | [Client IT / vendor] | [Date] |
| Schedule Blueprint kickoff | [Client + Consultant] | [Date] |

### Suggested Next Engagement

A **Tier 2 Agent Blueprint** for Opportunity #1 would take approximately 2–3 weeks and produce a complete implementation plan, tool selection, integration map, and ROI model — ready for a build decision.

**Estimated Blueprint cost:** $[X]K–$[Y]K  
**Assessment fee credit:** The $[X] paid for this Assessment is credited toward the Blueprint if started within 90 days.

---

## 8. AI Readiness Summary

| Factor | Rating | Notes |
|--------|--------|-------|
| Leadership buy-in | Strong / Moderate / Weak | [Brief note] |
| Staff openness to change | Strong / Moderate / Resistant | [Brief note] |
| Data infrastructure | Strong / Moderate / Weak | [Brief note] |
| Tool integration maturity | Strong / Moderate / Weak | [Brief note] |
| Internal technical support | Self-sufficient / Vendor-dependent / None | [Brief note] |
| **Overall readiness** | **High / Medium / Early-stage** | [Summary sentence] |

### Change Management Considerations

- [Consideration 1 — e.g., "The ops team expressed concern about job security; a brief communication from leadership framing agents as capacity extenders — not replacements — would ease adoption"]
- [Consideration 2]
- [Consideration 3]

---

## Appendix: Discovery Session Notes

Brief summaries from each session for reference.

### Session 1 — [Date] — [Participants]
**Topics covered:** [Overview]  
**Key takeaways:**
- [Note]
- [Note]

### Session 2 — [Date] — [Participants]
**Topics covered:** [Overview]  
**Key takeaways:**
- [Note]
- [Note]

### Session 3 — [Date] — [Participants]
**Topics covered:** [Overview]  
**Key takeaways:**
- [Note]
- [Note]

---

## Glossary

| Term | Plain-Language Definition |
|------|--------------------------|
| AI Agent | Software that perceives inputs, reasons about them, and takes actions — often using a large language model as its reasoning engine. Unlike a simple automation, an agent can handle variability and make decisions. |
| Integration | Connecting the agent to an existing system (CRM, email, database, etc.) via API so they can exchange data automatically. |
| API | A connection point that lets two software systems talk to each other. Most modern SaaS tools have one. |
| Orchestration | Coordinating multiple agents or automated steps to complete a multi-step workflow. |
| UAT | User Acceptance Testing — structured testing by the client's team before the agent goes live. |
| Hypercare | A post-launch period (30 days in our engagements) where we respond quickly to issues and make minor fixes at no additional charge. |
| n8n / Make / Zapier | Workflow automation platforms that connect tools and can host agent logic. n8n is open-source; Make and Zapier are subscription-based. |

---

*Prepared by [Founder Name] | [Business Name] | [Email] | [Website]*  
*Version 1.0 — [Date]*
