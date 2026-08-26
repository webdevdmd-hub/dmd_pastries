# Supplier Module Redesign Plan

Date: 2026-08-24 · Basis: the 2026-08-24 QA audit (16 findings), live measurements at 1030px, DESIGN.md v3, the shipped token layer, and the inventory redesign — the two modules share one design language.
Hard constraint: **every existing API connection is kept.** Mapping table below.

## Why it feels overwhelming (measured)

1. **The detail page is one endless scroll** — KPI row, profile, contacts, notes, purchased items, recent documents, vendor statement — with the same figure repeated: AED 4,500.00 renders **five times** in one viewport (KPI, ledger trio, statement totals, statement row, statement footer).
2. **The KPI row mixes bases**: "Purchase Amount" is bill-derived (AED 4,500) while it sits next to "Purchase Orders: 3" whose POs total AED 4,703 — a wrong-exposure reading, not just clutter (audit SUP-003).
3. **The list spends four KPI cards on counts that don't reconcile** (no Inactive card) and a whole card on "Supplier Countries: 0".
4. **Eight list columns at 694px** wrap the supplier code and dates mid-value; four "Not set" cells per row render at full emphasis (SUP-011, SUP-013).
5. **No pagination exists** — the list silently caps at 20 (SUP-001).
6. **The data a buyer actually needs is missing**: payment terms, lead time, preferred flag are not in the schema (SUP-002) — the page is long yet doesn't answer "when will it arrive, when do I pay".
7. **Status is hidden and unexplained**: Deactivate/Block/Delete live in a row dropdown with no consequence copy; status can't be changed from Edit (SUP-007/008).

## The redesign in one sentence

The list becomes a lean directory with an attention strip (same pattern as inventory); the detail page stops being a scroll and becomes **a header plus four tabs — Overview · Documents · Statement · Contacts & notes** — with every money figure appearing exactly once, on its own basis.

## Information architecture

```
/suppliers
├─ Directory (list)            ← getSuppliers (+ page/limit), lookupSuppliers (pickers elsewhere)
│   attention strip            ← derived from getSuppliers counts
│   └─ row menu                ← updateSupplierStatus, deleteSupplier
├─ /suppliers/{id}
│   header + stat row          ← getSupplierById, getSupplierStats (split into Ordered vs Billed)
│   ├─ Overview                ← profile fields + terms/lead/preferred + top items
│   ├─ Documents               ← getPurchaseOrders / getPurchaseInvoices / getPurchaseReturns /
│   │                            getSupplierPayments (all ?supplier_id=, now paginated)
│   ├─ Statement               ← getSupplierStatement
│   └─ Contacts & notes        ← getSupplierContacts (+CRUD), getSupplierNotes (+create/delete)
└─ Add / Edit dialog           ← createSupplier, updateSupplier (status control included in Edit)
```

**Nothing is removed.** Every section of today's detail page maps to a tab; deep links to `#statement` etc. select the tab.

## The seven design moves

### 1. Attention strip replaces the four KPI cards
`12 suppliers · 8 active` as text; chips only when actionable: `2 blocked` (danger tint → filters the list), `3 missing terms` (warning tint → filters to suppliers whose terms are unset — the PO-blocking gap made visible). "Supplier Countries" is deleted; Inactive reconciliation is implicit in the strip text + filter.

### 2. List diet: 6 columns, none wrapping at 1030px
Supplier (name + mono code, preferred star) · Contact (name + phone stacked) · Terms (or the warning "Not set" chip) · Status badge (dotted; **Active rows show no badge** — one-badge rule, exceptions only) · Location (right) · row menu. Pagination bar always present (`Showing 1–10 of 12`, backed by the envelope the API already returns).

### 3. Detail page: header + tabs, not a scroll
Header: name, dotted status badge (only when not Active), mono code, Edit button.
Stat row, one basis each, stated: **Ordered** `AED 4,703.00 · 3 POs` · **Billed** `AED 4,500.00 · 1 bill` · **Outstanding** `AED 4,500.00` · **Last order** `20 Aug 2026`. Paid drops out of the header (it lives in the Statement tab where payments actually are). No figure repeats anywhere else on the same screen.

### 4. Overview answers the buyer's three questions
Payment terms, lead time, preferred — first row of the profile, with warning "Needed for POs" chips while the schema fields don't exist yet (they are additive migrations; the audit's SUP-002 decision). Then contact/tax/address. Absent optional values are muted em-dashes, never full-black "Not set".

### 5. Documents tab = the supplier's purchasing history, paginated
One list, type-filtered by chips (All · Orders · Bills · Returns · Payments — each chip is one of the four existing endpoints), every row an anchor to its document (already works today; kept). Status badges dotted. `page`/`limit` finally sent.

### 6. Statement tab = the only place money is itemised
Opening/debit/credit/closing as one compact strip, then the entry table (4 columns — Entry, Debit, Credit, Balance — so nothing clips at 1030px, per the remediation reflow). Payments made to the supplier appear here, next to the bills they settle.

### 7. Form, status, and states — adopted from the remediation prototype
Everything labelled, required marked, phone `inputMode=tel` with submit-gated validation, status control in Edit with consequence copy, the Deactivate-vs-Block confirm dialogs, and the §8 empty/filtered/failed treatments. (Those artboards already exist in the Supplier Module Remediation canvas and carry over unchanged.)

## API mapping — proof nothing is dropped

| Existing function | Endpoint | Lives in redesign at |
|---|---|---|
| getSuppliers | GET /suppliers | Directory (now sending page/limit) |
| lookupSuppliers | GET /suppliers/lookup | Unchanged — supplier pickers in purchasing |
| createSupplier | POST /suppliers | Add dialog |
| getSupplierById | GET /suppliers/{id} | Detail header + Overview |
| updateSupplier | PATCH /suppliers/{id} | Edit dialog |
| updateSupplierStatus | PATCH /suppliers/{id}/status | Row menu + Edit status control (with confirms) |
| deleteSupplier | DELETE /suppliers/{id} | Row menu (guarded) |
| getSupplierStats | GET /suppliers/{id}/stats | Stat row (Ordered/Billed split — needs the backend to add `total_po_amount`; until then the PO sum is computed client-side from the orders it already fetches) |
| getSupplierContacts / create / update / delete | /suppliers/{id}/contacts* | Contacts & notes tab |
| getSupplierNotes / create / delete | /suppliers/{id}/notes* | Contacts & notes tab |
| getSupplierStatement | GET /suppliers/{id}/statement | Statement tab |
| getPurchaseOrders?supplier_id | GET /purchasing/orders | Documents tab · Orders chip |
| getPurchaseInvoices?supplier_id | GET /purchasing/invoices | Documents tab · Bills chip |
| getPurchaseReturns?supplier_id | GET /purchasing/returns | Documents tab · Returns chip |
| getSupplierPayments?supplier_id | GET /purchasing/supplier-payments | Documents tab · Payments chip + Statement |
| supplier-payables report | GET /reports/financial/supplier-payables | Unchanged — Reports module |

## Build phases

1. **P1 — List diet + pagination.** 6 columns, attention strip, pagination bar, em-dash absents. Fixes SUP-001/009/011/013/014 in one pass. No API change beyond finally sending `page`/`limit`.
2. **P2 — Detail tabs.** Restructure the scroll into header + 4 tabs; split Ordered/Billed (SUP-003); de-duplicate every repeated figure; statement reflow (SUP-010/012).
3. **P3 — Form + status.** Labels, required, validation, status-in-Edit, confirm dialogs (SUP-004/005/006/007/008). Badge component moves to the dotted semantic variants (the 17th finding).
4. **P4 — Schema additions.** `payment_terms`, `lead_time_days`, `preferred` columns + form fields + Overview row (SUP-002). Additive migration; PO/bill flows read them from here on.
5. **P5 — States.** §8 empty/filtered/failed for directory and every tab.

Each phase ships independently; none touches a request path (P4 adds columns, removes nothing).
