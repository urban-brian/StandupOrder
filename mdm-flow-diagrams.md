# MDM Integration — Process and Systems Flow Diagrams

**Epic:** MDM Integration (634718)
**Date:** 2026-04-10

---

## 1. Process Flow — Dealer Journey

```mermaid
flowchart TD
    A([Dealer starts Contract Proposal]) --> B[Enter VIN\n638745]
    B --> C{MDM VIN Lookup\n637885}
    C -->|Single match| D[Auto-associate customer\n638742]
    C -->|Multiple matches| E[Route to Customer\nSelection step\n638743]
    C -->|No match| F[Inform dealer:\nno customer found\n638744]
    C -->|Conflicting VINs| G[Inform dealer:\nVIN conflict\n638744]
    D --> H[Display MDM customer\nidentity — read-only\n638745]
    E --> I[Customer Selection Modal\n634689 / 634696]
    I -->|Customer selected| H
    I -->|Correct customer\nnot shown| J{Remediation options\n634696 / 638744}
    F --> J
    G --> J
    J -->|Search MDM| K[Change Customer flow\n638747]
    J -->|Enter temp name| L[Proposal proceeds\nwith temp name\n638744 / 634696]
    J -->|Submit correction| M[VIN Correction Request\n638267]
    K -->|Customer found| H
    K -->|Not found| J
    M --> L
    H --> N{Dealer action\n638746}
    N -->|Confirm customer| O[Proceed to\nContract Review]
    N -->|Change customer| K
    N -->|Edit customer details| P[Edit inline\n638746]
    P --> O
    O --> Q[Contract Review Screen\nloads\n543301]
    Q --> R[Display MDM customer\nidentity panel\n543301 / 638620]
    Q --> S[Retrieve contacts\nfor customer\n637887 / 543301]
    R --> T{Dealer edits\ncustomer details?\n638620}
    T -->|Yes| U[Edit customer meta details\ninline\n638620]
    U --> V[Submit to MDM\n638275]
    V -->|Success| R
    V -->|Error| W[Show error +\nrecovery option\n638620]
    T -->|No| X[Assign Billing /\nService contacts\n638749]
    S -->|Contacts returned| X
    S -->|No contacts returned| Y[Prompt: search or\nadd new contact\n634705 / 543301]
    Y --> X
    X --> Z{All contact\nroles filled?\n638749 / 638750}
    Z -->|Missing role| AA[Enter new contact\n634705]
    AA --> X
    Z -->|Both roles filled| AB[Navigate to\nRegistration\n634720]
    AB --> AC{Registration\nenforcement checks\n634720}
    AC -->|Valid MDM customer +\nboth contacts present| AD([Registration proceeds])
    AC -->|Temp name only| AE[Block: valid MDM\ncustomer required\n634720]
    AC -->|Missing Billing contact| AF[Block: Billing\ncontact required\n634720]
    AC -->|Missing Service contact| AG[Block: Service\ncontact required\n634720]
    AE --> AH[Navigate back\nto resolve\n634720]
    AF --> AH
    AG --> AH
    AH --> AB
    AD --> AI[Write contacts\nto MDM\n638751]
    AI --> AJ([Contract registered])

