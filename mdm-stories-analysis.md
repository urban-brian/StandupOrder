Here are both files:

---

**File 1: `mdm-stories-analysis.md`**

```markdown
# MDM Integration — User Story Analysis

**Epic:** MDM Integration (634718)
**Date:** 2026-04-10

---

## 1. Story Inventory

### Hierarchy

```
Epic: MDM Integration (634718)
│
├── Feature: Retrieve and Display Customer and Contact (634657)
│   ├── 638742  VIN Lookup: Single Match — Auto-Associate Customer
│   ├── 638743  VIN Lookup: Multiple Match — Route to Customer Selection
│   ├── 638744  VIN Lookup: No Match, Wrong Customer, Multi-VIN Conflict
│   ├── 638745  VIN Entry Page: Remove Free-Text Field / Display MDM Identity
│   ├── 638746  VIN Entry Page: Confirm or Change Customer Identity Gate
│   ├── 634689  Customer Selection Modal: UI Behavior (Multiple Match)
│   ├── 634696  Customer Selection: Multiple Match Resolution
│   ├── 638747  Change Customer: Search and Replace
│   ├── 638748  Change Customer: Contact Clearing, VIN Reconfirmation
│   ├── 543301  Display Contact Information on Contract Review
│   ├── 638620  Display and Edit Customer Details on Contract Review
│   ├── 638749  Contact Assignment: Select and Associate
│   ├── 638750  Contact Assignment: Persistence / Customer Change Clearing
│   ├── 634705  Enter a New Billing or Service Contact
│   ├── 634720  Registration Enforcement: MDM Customer and Contacts Required
│   ├── 638267  Submit Customer-to-VIN Correction Request
│   └── 638240  Search By Proposal Number
│
├── Feature: MDM Search API (637882)
│   ├── 637885  MDM API: Retrieve Customers for a VIN
│   ├── 637886  MDM API: Retrieve Customer Record by ID
│   ├── 637887  MDM API: Retrieve Contacts for a Customer
│   └── 637888  Spike: MDM Customer API Integration Readiness
│
├── Feature: Update and Create Customer and Contacts (638237)
│   ├── 638267  Submit Customer-to-VIN Correction Request (also under 634657)
│   ├── 638621  Spike: VIPS Stored Procedure — VIN Correction
│   └── 638271  Spike: MDM Write API — Endpoints, Validation, Auth (also under 638269)
│
└── Feature: MDM API Write Operations (638269)
    ├── 638751  Write Contact to MDM: Trigger, Create/Update Path, Error Handling
    ├── 638272  MDM API: Create Contact Record
    ├── 638273  MDM API: Update Contact Record
    ├── 638275  MDM API: Update Customer Meta Details
    └── 638271  Spike: MDM Write API (gating story for this feature)
```

> Note: 638240 (Search By Proposal Number) has no explicit feature parent in the provided data. Recommend placing it under Feature 634657.

---

### Superseded Stories (Closed — Do Not Plan)

| Closed ID | Title | Replaced By |
|-----------|-------|-------------|
| 633800 | VIN Search: Customer Lookup and Match Outcomes | 638742, 638743, 638744 |
| 634686 | VIN Entry Page: Display and Update Customer Identity | 638745, 638746 |
| 638286 | Change Customer on Proposal | 638747, 638748 |
| 634703 | Select and Associate Contact to Type | 638749, 638750 |
| 638256 | Write Billing and Service Contact to MDM at Submission | 638751 |

All superseded stories have been correctly split and their acceptance criteria redistributed. AC coverage appears complete across replacements.

---

## 2. Dependency Map

### Read Path (Proposal → Customer Identity)

```
[VIN entered]
     │
     ▼
637885 MDM API: Retrieve Customers for VIN
     │
     ├─ Single match ──► 638742 → 638745 (display) → 638746 (confirm/change gate)
     │                                                      │
     │                                                      └─ change ──► 638747 → 638748
     │
     ├─ Multiple match ► 638743 → 634696 (logic) + 634689 (modal UI)
     │                                │
     │                                └─ correct not found ──► 638747 / 638267
     │
     └─ No match / conflict ► 638744 → temp name OR 638267 (VIN correction)
```

### Contract Review Path

```
637886 MDM API: Retrieve Customer by ID
     │
     ▼
543301 Display Contact Info on Contract Review
     │
     ├─ 638620 Display/Edit Customer Details → 638275 MDM API: Update Customer
     │
     ├─ 638749 Contact Assignment (checkbox UI)
     │     └─ 638750 Persistence / change-clearing
     │
     └─ 634705 Enter New Contact
```

### Contact Write Path (at submission)

```
638749 (existing MDM contact) ─┐
634705 (new manually entered) ─┤
                                ▼
                           638751 Write Contact to MDM (orchestrator)
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             638272 Create Contact   638273 Update Contact
             (no MDM ID)             (has MDM ID)
```

### VIN Correction Path

```
638744 (no match / wrong customer)
     │
     ▼
638267 Submit VIN Correction Request
     │
     └── depends on ──► 638621 Spike: VIPS Stored Procedure
```

### Registration Enforcement (Hub)

**634720** is the single source of truth for registration blocking rules. It is referenced by:
638742, 638743, 638744, 638745, 638746, 638747, 638748, 638749, 638750, 638751, 634705

---

## 3. Spike Dependency Gating

Three spikes gate independent tracks. They should be highest priority to prevent sprint blockage.

| Spike | ID | Blocks |
|-------|----|--------|
| MDM Customer API Integration Readiness | 637888 | 637885, 637886, 637887 — entire read integration layer |
| MDM Write API Endpoints / Validation / Auth | 638271 | 638272, 638273, 638275, 638751 — entire write layer; also gates Feature 638269 AC4 and Feature 638237 AC5 |
| VIPS Stored Procedure — VIN Correction | 638621 | 638267 — VIN correction submission; stored procedure name, params, and connection details unconfirmed |

**No story in the integration layer (637885, 637886, 637887, 638272, 638273, 638275) should enter a sprint until its respective spike is closed.**

---

## 4. Sprint Readiness Assessment

### Ready for Sprint (no spike dependency; UX confirmed or UX not required)

| ID | Story | Notes |
|----|-------|-------|
| 634720 | Registration Enforcement | Hub story; pure logic, no external deps. High priority to align early. |
| 638742 | VIN Lookup: Single Match | UI/routing logic; integration layer gated by 637888 but routing rules can be built independently |
| 638743 | VIN Lookup: Multiple Match | Same as above |
| 638744 | VIN Lookup: No Match / Conflict / Remediation | Same as above |
| 634696 | Customer Selection: Multiple Match Resolution | Logic story; no UX dependency |
| 638747 | Change Customer: Search and Replace | UX pattern clear from existing flows |
| 638748 | Change Customer: Contact Clearing / VIN Reconfirmation | Logic story |
| 638749 | Contact Assignment: Select and Associate | UX wireframe confirmed |
| 638750 | Contact Assignment: Persistence / Clearing | Logic story |
| 543301 | Display Contact Info on Contract Review | UX wireframe confirmed |

### Blocked by Pending UX Design

| ID | Story | Blocker |
|----|-------|---------|
| 634689 | Customer Selection Modal | Display fields not defined; UX artifact pending |
| 638620 | Display/Edit Customer Details (Contract Review) | UX design artifact required before sprint |
| 634705 | Enter New Contact | UX design pending; required fields TBD |

### Blocked by Open Spike

| ID | Story | Spike |
|----|-------|-------|
| 637885 | MDM API: Retrieve Customers for VIN | 637888 |
| 637886 | MDM API: Retrieve Customer by ID | 637888 |
| 637887 | MDM API: Retrieve Contacts for Customer | 637888 |
| 638267 | Submit VIN Correction Request | 638621 |
| 638751 | Write Contact to MDM | 638271 |
| 638272 | MDM API: Create Contact | 638271 |
| 638273 | MDM API: Update Contact | 638271 |
| 638275 | MDM API: Update Customer Meta Details | 638271 |

---

## 5. Issues and Risks

### Issue 1 — Contradictory Service Portal Reference in 634696

**Severity: High — must resolve before story enters sprint**

The AC3/Notes body of story 634696 states:
> *"The Service Portal remediation process is retired — correction requests are now handled within SSP via story 638267."*

The UX/Notes field of the same story states:
> *"The Service Portal remediation process remains the source of truth for correcting customer ↔ VIN relationships (no redesign included)."*

These are directly contradictory. Stories 638267 and 638744 both treat the Service Portal path as retired. The UX/Notes field appears to be a stale remnant from an earlier version. **The body text should be treated as authoritative, and the UX/Notes field should be updated to remove the old statement.**

---

### Issue 2 — Bidirectional Dependency: 638620 ↔ 638746

**Severity: Medium — sprint planning risk**

- Story 638620 (Display/Edit Customer Details) lists 638746 as a dependency
- Story 638746 (Confirm or Change Customer Identity Gate) lists 638620 as a dependency

This is a co-implementation relationship, not a true blocking dependency. Both stories share an edit form pattern. **They must be planned into the same sprint.** ADO should link them as "related" rather than "blocked by" to avoid a circular dependency flag.

---

### Issue 3 — 638240 Has No Feature Parent

**Severity: Low — ADO hygiene**

Story 638240 (Search By Proposal Number) is not explicitly placed under any feature in the provided data. It logically belongs under Feature 634657 (Retrieve and Display Customer and Contact). Recommend verifying and updating the ADO parent link.

---

### Issue 4 — 638272 / 638273 Partial Update Behavior Is Spike-Dependent

**Severity: Medium — implementation approach TBD**

Stories 638272 and 638273 both contain conditional acceptance criteria:
- "If partial update is supported → submit only changed fields"
- "If partial update is NOT supported → submit full replacement"

The correct implementation path cannot be determined until spike 638271 documents the MDM endpoint behavior. **ACs should not be estimated until spike 638271 closes.**

---

### Issue 5 — Feature 638269 Entirely Gated on Spike 638271

**Severity: High — feature-level blocker**

Feature 638269 (MDM API Write Operations) includes AC4: *"Feature is complete only when write spike findings are incorporated."* All four user stories under this feature (638751, 638272, 638273, 638275) depend on 638271. If spike 638271 is delayed, the entire write feature is blocked. **Spike 638271 should be scheduled as early as possible — ideally Sprint 1.**

---

### Issue 6 — 634720 Is Referenced but Not Always Linked in ADO

**Severity: Medium — dependency tracking gap**

Story 634720 (Registration Enforcement) is the single source of truth for registration blocking rules and is prose-referenced by 12+ stories. Its Notes field references a smaller set (633800, 634696, 634689, 634703, 634705) that does not include the newer split stories (638742–638751). **634720's ADO links should be updated to include all replacement stories.**

---

## 6. Recommended Delivery Sequence

### Sprint 0 (Before any feature development)
- 637888 — Spike: MDM Customer API Readiness
- 638271 — Spike: MDM Write API
- 638621 — Spike: VIPS Stored Procedure
- 634720 — Registration Enforcement *(hub story; align all teams on rules before building)*

### Sprint 1 — UI Logic (no integration layer required)
- 638742, 638743, 638744 — VIN Lookup routing outcomes
- 638745, 638746 — VIN Entry Page display and gate *(co-plan with 638620)*
- 638747, 638748 — Change Customer flows
- 634696 — Multiple Match Resolution logic
- 543301 — Display Contact Info on Contract Review *(UX confirmed)*
- 638749, 638750 — Contact Assignment and Persistence

### Sprint 2 — Integration Layer (after spikes close)
- 637885, 637886, 637887 — MDM Read API integration
- 638272, 638273, 638275 — MDM Write API integration
- 638751 — Contact Write orchestration

### Sprint 2 / Parallel — UX-Gated (after design artifacts delivered)
- 634689 — Customer Selection Modal
- 638620 — Customer Detail Edit on Contract Review *(co-plan with 638746)*
- 634705 — Enter New Contact

### Sprint 3 — VIN Correction (after spike 638621 closes)
- 638267 — Submit VIN Correction Request
- 638240 — Search By Proposal Number *(no spike dependency; can move earlier if needed)*

---

## 7. Summary Counts

| Category | Count |
|----------|-------|
| Active User Stories | 27 |
| Active Features | 4 |
| Closed / Superseded Stories | 5 |
| Open Spikes | 3 |
| Stories blocked by spike | 8 |
| Stories blocked by pending UX | 3 |
| Stories sprint-ready | 10 |
| Issues identified | 6 |
```

