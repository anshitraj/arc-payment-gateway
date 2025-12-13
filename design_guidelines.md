# ArcPayKit Design Guidelines

## Design Approach
**System**: Inspired by Stripe, Circle Payments, and modern fintech platforms with Arc-native branding
**Philosophy**: Enterprise-grade, premium, NOT generic AI-generated - clean, fast, professional

## Core Design Principles

### Color System
- **Primary Background**: Dark navy gradient (deep navy → slightly lighter navy)
- **Accent Color**: Icy blue (#3B82F6 to #60A5FA range) - use sparingly for CTAs, highlights, and active states
- **Text**: White/off-white for primary, gray-400 for secondary
- **Borders**: Subtle 1px borders in gray-800/gray-700
- **No rainbow colors** - maintain sophisticated, monochromatic palette with blue accent

### Typography
- **Font Family**: Inter (via next/font)
- **Hierarchy**:
  - Hero Headlines: text-6xl to text-7xl, font-bold, tracking-tight
  - Section Headers: text-4xl to text-5xl, font-semibold
  - Body: text-base to text-lg, leading-relaxed
  - Code: font-mono for technical content

### Layout System
- **Spacing**: Use Tailwind units of 4, 8, 12, 16, 24, 32 (p-4, gap-8, space-y-12, etc.)
- **Border Radius**: rounded-2xl everywhere (components, cards, buttons, inputs)
- **Max Width**: max-w-7xl for main containers, max-w-6xl for content sections

## Component Library

### Navigation
- **Navbar**: Sticky top with glassmorphism (backdrop-blur-xl, bg-navy-900/80)
- Mega menu dropdowns for "Product" and "Developers" sections
- Logo + nav links + CTA button (icy blue)
- Scroll shrink effect (reduce padding on scroll)
- Mobile: Full-screen overlay menu with smooth transitions

### Hero Section
- Massive headline with gradient text effect (navy to icy blue)
- Thin curved SVG geometric shapes as decorative elements
- Subtle grid/noise texture overlay on background
- Primary CTA + Secondary CTA buttons
- Code snippet preview showing Arc integration
- No hero image - focus on typography and geometry

### Cards & Containers
- **Background**: bg-gray-900/50 with border border-gray-800
- **Glass Effect**: backdrop-blur-sm for layered cards
- **Padding**: p-6 to p-8
- **Shadow**: Subtle glow effect on hover using icy blue (shadow-lg shadow-blue-500/10)

### Buttons
- **Primary**: bg-blue-500 with rounded-2xl, px-8 py-3, font-semibold
- **Secondary**: border border-gray-700 with hover:bg-gray-800
- **On Images/Hero**: Add backdrop-blur-md bg-white/10 background

### Dashboard Components
- **KPI Cards**: Grid layout with metric value (text-4xl), label (text-sm), and trend indicator
- **Tables**: Clean rows with hover:bg-gray-800/50, alternating subtle backgrounds
- **Status Badges**: pill-shaped with rounded-full, bg colors: green-500/20 (final), yellow-500/20 (pending), red-500/20 (refunded)
- **Sidebar**: Fixed left navigation with icons + labels

### Forms & Inputs
- **Input Fields**: bg-gray-900 border border-gray-700 rounded-xl px-4 py-3
- **Focus State**: ring-2 ring-blue-500 border-blue-500
- **Dialogs**: Centered modal with max-w-md, same glass card treatment

### Code Blocks
- Dark background (bg-gray-950) with syntax highlighting
- Copy button in top-right corner
- Line numbers optional
- rounded-2xl with p-6

## Page Layouts

### Landing Page (6-8 sections)
1. Hero with massive headline + code preview
2. Feature grid (3-4 columns) showcasing Arc advantages
3. Developer quickstart with code examples
4. Dashboard preview screenshot/mockup
5. "Why Arc" benefits section
6. Testimonials (if applicable) or stats showcase
7. Final CTA section
8. Footer with links, social, docs

### Dashboard Layout
- Fixed sidebar (left, w-64)
- Top bar with user menu
- Main content area with KPI grid + tables
- Right panel for quick actions (create payment, etc.)

### Checkout Page
- Centered card (max-w-lg) on dark background
- Merchant branding at top
- Amount display (large, prominent)
- Currency selector dropdown
- Pay button with loading → success animation
- "<1s finality on Arc" badge below button

## Animations
- Use sparingly and subtly (framer-motion)
- Page transitions: fade-in with slight scale
- Button hover: gentle scale (scale-105) and shadow
- Success animations: checkmark with smooth draw-in
- Loading states: simple spinner or pulse effect
- **No distracting animations** - keep professional

## Visual Enhancements
- Subtle noise/grain texture overlay on backgrounds
- Thin curved SVG shapes as decorative elements (hero, section dividers)
- Soft gradient overlays (navy to transparent)
- Glow effects on interactive elements (very subtle)

## Accessibility
- Maintain WCAG AA contrast ratios (white on navy backgrounds)
- Focus states clearly visible (ring-2 ring-blue-500)
- Semantic HTML throughout
- Keyboard navigation support

## Images
**No large hero image** - this is a developer/fintech product focused on typography and code
- Optional: Small dashboard preview screenshot in "Features" section
- Optional: Small logos for "Trusted by" or integration partners
- Keep visual focus on clean interface and code examples