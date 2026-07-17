# WealthOS Master Specification

## Architecture
WealthOS is built as a modern, secure SaaS application with a Next.js front end, TypeScript services, and Supabase-backed data and authentication. The architecture prioritizes modularity, simplicity, and long-term maintainability.

## Folder Structure
- app/: route-level pages and layouts
- components/: reusable UI and feature components
- services/: API and data-access logic
- types/: shared TypeScript models
- lib/: utilities and helpers
- supabase/: database migrations and SQL policies
- docs/: product and engineering documentation

## Naming Standards
- Use descriptive PascalCase for components and interfaces.
- Use camelCase for functions, variables, and props.
- Use kebab-case for file names where appropriate.
- Use domain-specific names that reflect financial concepts.

## Coding Rules
- Prefer TypeScript for all application logic.
- Keep components focused and composable.
- Avoid business logic inside UI components.
- Keep functions small, readable, and reusable.
- Preserve existing architecture and routing patterns.
- Avoid introducing breaking changes without explicit planning.

## Database Rules
- Treat the database as a governed platform layer.
- Keep row-level security and access rules explicit.
- Use typed service layers instead of direct ad hoc queries in UI code.
- Ensure data models are documented before implementation.

## UI Rules
- Build around a calm, executive, and premium experience.
- Favor clarity, consistency, and strong information hierarchy.
- Keep interactions predictable and low-friction.
- Use accessible, responsive patterns by default.

## AI Rules
- AI features must be assistive, not authoritative.
- AI output should be clearly labeled and explainable.
- Do not use AI to bypass user consent or security expectations.

## Release Process
1. Define and document the scope.
2. Implement against the existing architecture.
3. Validate with linting and build checks.
4. Document the release in the changelog.
