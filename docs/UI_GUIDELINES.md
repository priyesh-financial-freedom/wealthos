# WealthOS UI Guidelines

## Design Language
WealthOS should feel calm, executive, trustworthy, and premium. The experience should feel more like a family office command center than a consumer finance app.

## Typography
- Favor clear, modern sans-serif type.
- Use strong hierarchy for headings, summaries, and details.
- Keep content scannable and highly readable.

## Spacing
- Use generous spacing to create calmness and reduce visual noise.
- Maintain consistency across cards, tables, forms, and navigation.

## Cards
- Cards should communicate structure, status, and insight quickly.
- Use clear headings, concise summaries, and subtle visual polish.

## Tables
- Tables should be easy to scan and support focus on key metrics.
- Keep actions simple and predictable.

## Forms
- Forms should be clear, concise, and forgiving.
- Use labels, helper text, and validation cues consistently.

## Icons
- Use simple, consistent icons that reinforce clarity and trust.
- Avoid cluttering the interface with unnecessary visual decoration.

## Charts
- Charts should support fast understanding of trends and composition.
- Use careful color choices and avoid overloading single views.

## Responsive Rules
- Support desktop-first planning and mobile-friendly access.
- Ensure important actions and information remain reachable across layouts.

## Accessibility
- Maintain sufficient color contrast.
- Use semantic structure and keyboard-friendly interactions.
- Ensure forms and controls are properly labeled.

## WealthOS Module Design System (v1)

### Frozen Layout Sequence
- Page Header
- Summary KPI Cards
- Charts and Visual Insights
- Category Cards
- Empty State (when no data)
- Detailed Pages

Do not introduce additional landing page variations without explicit approval.

### Header Standard
- Module name
- Short business-friendly description
- Dynamic portfolio summary when data exists

Avoid implementation details and technical terminology in user-facing copy.

### KPI Card Standard
- Uniform height, spacing, typography, icon placement, corner radius, shadow, and hover behavior
- Prioritize values over descriptions
- Keep descriptions short and business-focused

### Empty State Standard
- Do not show multiple zero values when no data exists
- Prefer onboarding guidance such as:
	- No Holdings Yet
	- Add your first Mutual Fund
- Show numeric values only after data exists

### Category Card Standard
- One consistent icon per category
- Category name
- Current value only when data exists
- Number of holdings only when data exists
- Monthly change only when data exists
- Friendly empty-state line
- Right-arrow navigation hint
- Full-card click target

### Business Language Standard
- Use finance-professional language
- Avoid terms like record, entity, architecture, generic component
- Prefer terms like Mutual Fund, Stock, Bond, Value History, Investment, Portfolio

### Color System
- Positive values: green
- Negative values: red
- Neutral values: slate
- Primary actions: brand blue
- Informational text: gray

### Typography and Spacing
- Keep title, section heading, KPI value, label, table, and empty-state hierarchy consistent
- Keep card padding, section spacing, grid spacing, margins, and table spacing consistent

### Navigation Flow
- Main Menu -> Module Summary -> Category -> Detail -> Edit
- Do not add extra layers without explicit approval

### Reference Module
- Investments is the reference implementation for module UX and layout standards.
- Retirement, Borrowings, Property, Goals, Reports, and Settings should inherit this template.
