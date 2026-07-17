# WealthOS Architecture

## Core
WealthOS is structured as a modular, modern web application. The core platform centers on a secure user experience, strong data modeling, and a clean product shell that can expand into a rich family office system.

## Finance
The finance layer manages the core wealth data model, including assets, liabilities, income, expenses, and future planning. Each domain is represented through dedicated modules and typed services.

## Family Office
The family office layer supports household coordination, documents, goals, governance, and reporting. It expands the system beyond transactions into strategic stewardship and long-term planning.

## Health
Health and protection capabilities are intended to support insurance, wellness, and family risk management. These functions complement financial planning with broader life stewardship.

## AI
AI capabilities are designed to assist with insights, forecasting, summarization, recommendations, and planning support. AI is treated as a decision aid rather than a replacement for human judgment.

## Folder Structure
- app/: pages and route-level experience
- components/: UI and feature building blocks
- services/: domain operations and data access
- types/: shared data contracts
- lib/: helpers and utilities
- supabase/: migrations and database policies
- docs/: system and product documentation

## Feature Architecture
Each domain module should follow a consistent structure:
1. Type definitions
2. Service layer
3. UI components
4. Route/page integration

## Reusable Components
- Layout shell and navigation
- Page container and header patterns
- Card-based summary modules
- Tables and forms for CRUD workflows
- Charts and analytics surfaces
