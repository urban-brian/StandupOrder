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
```
## 2. Systems Flow — Integration Architecture

```mermaid
flowchart LR
    subgraph SSP["SSP — Sales Support Portal"]
        direction TB
        UI["UI Layer\n(Dealer-facing screens)"]
        SVC["Service / Integration Layer"]
        DB["SSP Database\n(Proposal state)"]
    end

    subgraph MDM["MDM — Master Data Management"]
        direction TB
        MDM_READ["Read API\nGET /vehicles/{vin}/customers\nGET /customers/{id}\nGET /customers/{customerId}/contacts"]
        MDM_WRITE["Write API\nPOST /contacts (create)\nPUT/PATCH /contacts/{id} (update)\nPUT/PATCH /customers/{id} (update)"]
    end

    subgraph VIPS["VIPS"]
        SP["Stored Procedure\n(VIN–Customer correction\nrequest routing)"]
        WAT["Warranty Audit Team\n(manual verification)"]
    end

    UI -->|"VIN entered"| SVC
    SVC -->|"GET /vehicles/{vin}/customers\n[637885]"| MDM_READ
    MDM_READ -->|"Customer list + relation types"| SVC

    SVC -->|"GET /customers/{id}\n[637886]"| MDM_READ
    MDM_READ -->|"Customer record\n(name, address, email, phone)"| SVC

    SVC -->|"GET /customers/{customerId}/contacts\n[637887]"| MDM_READ
    MDM_READ -->|"Contact list"| SVC

    SVC -->|"Customer identity + contacts"| UI
    SVC <-->|"Session state\n(customer ID, contacts, assignments)"| DB

    SVC -->|"Update customer meta details\non dealer confirm\n[638275]"| MDM_WRITE
    SVC -->|"Create new contact\nat submission\n[638272]"| MDM_WRITE
    SVC -->|"Update existing contact\nat submission\n[638273]"| MDM_WRITE
    MDM_WRITE -->|"Success / Error response"| SVC

    SVC -->|"Invoke stored procedure\nwith VINs + proposed customer\n[638267]"| SP
    SP -->|"Routes correction request"| WAT
    WAT -.->|"Verifies and updates\nVIN–customer relationship\n(out of SSP scope)"| VIPS
```
## 3. Contact Write Decision Flow — Submission

```mermaid
flowchart TD
    A([Contract submitted]) --> B[638751: Orchestrate\ncontact writes]

    B --> C{For each assigned contact:\nhas MDM contact ID?}

    C -->|No — entered manually\nvia 634705| D[638272: Call MDM\nCreate Contact endpoint]
    C -->|Yes — retrieved from MDM\nvia 638749| E{Were any fields\nmodified by dealer?}

    E -->|No changes| F([Skip — no API call made\n638273 AC5])
    E -->|Yes| G[638273: Call MDM\nUpdate Contact endpoint]

    G --> H{Partial update\nsupported?\nper spike 638271}
    H -->|Yes| I[Submit changed\nfields only]
    H -->|No| J[Submit full\ncontact record]

    D --> K{Same contact assigned\nto both Billing + Service?}
    I --> K
    J --> K

    K -->|Yes| L[Single MDM call\nsatisfies both roles\n638751 AC4]
    K -->|No| M[Separate MDM call\nper contact\n638751 AC5]

    L --> N{MDM response}
    M --> N

    N -->|Success| O[Log MDM contact ID\nagainst contract\n638751 AC8]
    N -->|Error| P[Surface error to dealer\nidentify contact + role\n638751 AC6]

    O --> Q([Write complete])
    P --> R{Dealer action}
    R -->|Retry| B
    R -->|Proceed with\nexisting data| Q
```
## 4. VIN Correction Request Flow — Systems

```mermaid
sequenceDiagram
    participant Dealer as Dealer (SSP UI)
    participant SSP as SSP Service Layer
    participant DB as SSP Database
    participant SP as VIPS Stored Procedure
    participant WAT as Warranty Audit Team

    Dealer->>SSP: VIN lookup returns no/wrong customer
    SSP->>Dealer: Present remediation options (638744)
    Dealer->>SSP: Submit VIN correction request (638267)

    SSP->>SP: Invoke stored procedure with:\n· VIN(s)\n· Proposed customer identity\n· Dealer ID\n· Proposal number
    Note over SSP,SP: Stored procedure confirmed via spike 638621

    alt Stored procedure succeeds
        SP-->>SSP: Success response
        SSP->>DB: Log submission (timestamp, VINs,\ncustomer, dealer, proposal, response)
        SSP->>Dealer: Confirm request submitted;\ninform registration remains blocked
        SP->>WAT: Routes correction request
        WAT-->>WAT: Verifies VIN–customer\nrelationship in VIPS\n(out of SSP scope)
    else Stored procedure fails
        SP-->>SSP: Error response
        SSP->>Dealer: Inform submission failed;\noffer retry or direct WAT contact
    end

    Note over Dealer,WAT: Registration stays blocked (634720)\nuntil valid MDM customer is confirmed.\nSSP does not poll for VIPS confirmation.
```

