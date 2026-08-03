# Bell Optimizer UI Design System

## Visual direction

The interface uses a Hole / Cavern 5-inspired palette without copying game artwork. Deep purple-black surfaces suggest cavern depth; warm gold and copper identify Bell actions; teal is reserved for supporting actions and positive information.

## Color tokens

- `--cave-void`, `--cave-deep`: page and inset backgrounds
- `--cave-surface`, `--cave-surface-raised`, `--cave-surface-soft`: primary and secondary surfaces
- `--cave-border`, `--cave-border-soft`: structural separators
- `--rock-purple`, `--rock-lilac`: cavern accents and disclosure depth
- `--bell-gold`, `--bell-gold-light`, `--bell-copper`, `--bell-shadow`: Bell identity and primary actions
- `--text-primary`, `--text-secondary`, `--text-muted`: readable hierarchy
- `--action-teal`, `--positive`, `--negative`, `--warning`: action and status semantics

## Typography

Georgia is used only for the application title and major player-result headings. System sans-serif fonts handle controls, tables, labels, data, and long-form explanations. Headings remain compact so the workflow—not decoration—controls page height.

## Spacing and shape

The spacing scale runs from `--space-1` through `--space-6`. Surfaces use small, medium, and large radius tokens. Inset detail panels use stronger indentation and a colored left rule instead of another large card.

## Components

- Panels are restrained cavern surfaces with purple borders.
- Tabs use a gold underline and high-contrast text.
- Segmented selectors use a shared inset track.
- Primary actions are Bell gold; secondary actions use raised cavern surfaces; destructive actions use a red outline and explicit text.
- Rate disclosures expose `+` and `−` states and place child values in an inset panel.
- Tables use contained horizontal overflow only where needed.
- Empty states use a dashed border and muted copy.
- Success, warning, and error states combine text with color rather than relying on color alone.

## Responsive principles

The shell is capped at 1240px with responsive side padding. Headers wrap rather than clip. Grids use `minmax(0, 1fr)`. Reward controls move from four columns to three, two, and one. Step 3 and metric layouts stack deliberately. Wide tables remain inside their own scroll container and never widen the page.

Breakpoints target approximately 1180px, 900px, 768px, 480px, and 360px.

## Prohibited patterns

Do not add glassmorphism, bright cyberpunk purple, glow on every element, giant empty cards, excessive pills, random floating shapes, copied Idleon assets, fake cave art, oversized headings, or one-number-per-card dashboard repetition.
