# WealthOS Coding Standards

## TypeScript Rules
- Use TypeScript for all core application code.
- Prefer explicit types for shared models and service interfaces.
- Avoid `any` unless there is no practical alternative.
- Keep type definitions close to the domain they describe.

## React Rules
- Prefer functional components and hooks.
- Keep components small and focused on one responsibility.
- Favor composition over large, monolithic components.
- Preserve server/client boundaries and avoid unnecessary client-only complexity.

## Component Structure
- Start with imports and types.
- Keep props interfaces clear and minimal.
- Separate UI structure from data and side effects.
- Reuse existing layout and card primitives where possible.

## Naming Conventions
- Components: PascalCase
- Functions and variables: camelCase
- Constants: UPPER_SNAKE_CASE when appropriate
- Files: descriptive, lowercase, and hyphenated where needed

## Testing Philosophy
- Favor real behavior validation over brittle mocks.
- Validate critical flows with integration-style checks where feasible.
- Keep tests focused on user-visible behavior and contracts.
