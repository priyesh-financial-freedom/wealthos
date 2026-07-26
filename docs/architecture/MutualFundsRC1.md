# Mutual Funds Module RC1

## Purpose

The Mutual Funds module is the RC1 reference implementation for investment modules in WealthOS.

Design constraints:
- No redesign of the frozen WealthOS Design System
- No overlap between static holding data and dynamic month-end valuation data
- Deterministic identity for duplicate prevention and import upsert behavior

## Architecture

Primary UI route:
- `src/app/investments/mutual-funds/page.tsx`

Primary components:
- `src/components/investments/mutualFunds/MutualFundForm.tsx`
- `src/components/investments/mutualFunds/MutualFundHoldingsTable.tsx`
- `src/components/investments/mutualFunds/MutualFundDetailsDialog.tsx`

Core services:
- `src/services/investments.ts`
- `src/services/imports/plugins/investmentsImport.ts`
- `src/services/investments/mutualFundSchemeMaster.ts`

This module follows a split model:
- Static holding details are stored once in `investment_holdings`
- Dynamic valuations are appended by month in `investment_monthly_history`

## Data Model

### Static Holding Data (`investment_holdings`)

For Mutual Funds, static records include:
- scheme name
- owner
- AMC
- AMFI scheme code
- folio number
- investment mode
- option type
- platform
- SIP metadata
- notes and document placeholder

Business identity key:
- Owner + Folio Number + AMFI Scheme Code (case-insensitive)

Enforced by index:
- `investment_holdings_mf_business_key_idx`

### Dynamic Value History (`investment_monthly_history`)

Each row stores:
- investment reference
- month_end_date
- closing_value
- notes

Integrity guarantees:
- one row per user + investment + month_end_date
- no orphan history due to FK to `investment_holdings(id)` with delete cascade

## Import Process

Import plugin:
- `src/services/imports/plugins/investmentsImport.ts`

Validation behavior for Mutual Funds:
- required fields: investment name, owner, folio number, AMFI scheme code, units, NAV, cost basis
- AMFI scheme code format: 6 to 12 digits
- numeric validation: units, NAV, cost basis, SIP values
- date validation: purchase_date and optional month_end_date

Duplicate handling:
- existing duplicate detection by Owner + Folio + AMFI updates existing holding
- in-file duplicate detection by Owner + Folio + AMFI skips later duplicate rows with warning

Month-end import behavior:
- optional month_end_date/month_end_value are accepted
- history writes normalize to end-of-month date
- duplicate month-end entries are absorbed by unique-key semantics

## Scheme Master

Reference table:
- `mutual_fund_scheme_master`

Usage:
- autocomplete source in Mutual Fund form
- autofill of AMC, AMFI code, investment mode, and option type from selected scheme
- updated during import upsert paths for Mutual Fund rows

## Month-End History

Write paths:
- manual month-end update dialog on Mutual Funds page
- import path for month-end value data

Consistency behavior:
- month_end_date normalized to month-end boundary
- latest month-end value syncs current holding value
- gain/loss and gain percentage derive from current value vs cost value

## Known Limitations

- Lint baseline failures exist outside the Mutual Funds scope and are not introduced by this module.
- Import AMFI validation enforces numeric code format and may reject non-standard code formats from custom sheets.
- Document handling is metadata-first (`documents_placeholder`) and does not yet include binary file storage.
- End-to-end UI workflow verification still requires user-level click-through in the runtime environment.
