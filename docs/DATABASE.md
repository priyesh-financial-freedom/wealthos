# WealthOS Database Guide

## Overview
WealthOS uses a relational data model centered on household and financial records. The database design should remain clear, typed, and governed by row-level security and documented ownership rules.

## Current Tables
- users: user identity and profile information, primarily managed through the authentication provider.
- assets: household assets such as cash, investments, real estate, and other holdings.

## Future Tables
- liabilities: loans, mortgages, and other obligations.
- investments: portfolio holdings and allocation data.
- goals: financial and life goals with milestones and target values.
- documents: files and records associated with household planning.
- insurance: coverage records and policy summaries.
- transactions: financial activity history and movement tracking.

## Data Principles
- Every table should have clear ownership and lifecycle semantics.
- Dates, monetary values, and status fields should follow consistent conventions.
- Sensitive household data must be protected by explicit access controls.
