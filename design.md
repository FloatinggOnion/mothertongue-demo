# Mother Tongue · Design System
_Brand Artboard v1.0 — AI-Powered Language Tutor_

## Provenance
Extracted from Mother Tongue brand identity artboard (Brand Artboard v1.0).

## Overview
Heritage-warm, serif-led language learning system. Parchment surfaces, terracotta accent, literary tone. Asymmetric left-margin layout. Calm, focused, culturally grounded rhythm. Motif-driven — subtle cultural patterns used sparingly as background texture.

---

## Macrostructure
**Editorial Split** — left-aligned colour palette rail + generous prose-forward content area. Hero leads with a large serif statement, not a product pitch. Sections breathe with generous vertical spacing. CTA rows are left-aligned, never centred.

---

## Typography

### Display
- **Font family:** Lora (serif, Google Fonts)
- **Weight:** Regular (400)
- **Usage:** Hero heading, section heads, callouts, proverbs
- **Scale:** 3rem (hero), 2rem (section heads), 1.5rem (callouts)
- **Style:** Sentence case. Never all-caps for display.

### Body
- **Font family:** Lora (serif) for prose; Inter (sans-serif) for UI labels and captions
- **Weight:** Lora 400 for prose, Inter 500 for labels
- **Usage:** Body prose uses Lora. Buttons, badges, tags, input labels use Inter.
- **Scale:** 1.125rem (body prose), 1rem (UI body), 0.875rem (captions/labels)
- **Line height:** 1.7 for prose, 1.4 for UI

### Quote / Proverb
- **Font family:** Lora Italic
- **Usage:** Pull quotes, cultural proverbs, testimonials
- **Style:** Italic, slightly larger than body (1.2rem), terracotta left border

### Pairing Rule
Lora (display + prose) paired with Inter (labels + UI). Never swap — Lora owns the cultural, literary layer; Inter owns the functional UI layer.

### Google Fonts Import
```css
@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap');
```

---

## Colour Palette

### Named Colours
| Name | Hex | OKLCH approx | Usage |
|------|-----|--------------|-------|
| Deep Bark | #2C1810 | oklch(18% 0.08 30) | Primary text, headers, nav background |
| Terracotta | #C4622D | oklch(55% 0.16 38) | Accent, CTAs, highlights, active states |
| Sahara | #E8955A | oklch(70% 0.14 45) | Warm mid tone, icons, secondary highlights |
| Parchment | #F5F0E8 | oklch(95% 0.02 80) | Background, surfaces, cards |
| Forest Ink | #2D5A4E | oklch(38% 0.08 162) | Success states, cultural alt accent |
| Night Script | #1A2744 | oklch(22% 0.06 250) | Dark alt, dark mode base |
| Warm Ash | #A89B8C | oklch(65% 0.03 60) | Muted text, labels, dividers |

### Semantic Roles
```css
:root {
  /* Surfaces */
  --color-paper: #F5F0E8;           /* Parchment — page background */
  --color-surface: #EDE8DF;         /* Slightly darker parchment — cards */

  /* Text */
  --color-text: #2C1810;            /* Deep Bark — primary text */
  --color-text-secondary: #A89B8C;  /* Warm Ash — secondary/muted text */
  --color-text-inverse: #F5F0E8;    /* Parchment — text on dark surfaces */

  /* Accent */
  --color-accent: #C4622D;          /* Terracotta — primary CTA, links, active */
  --color-accent-warm: #E8955A;     /* Sahara — secondary highlights, icons */
  --color-accent-cool: #2D5A4E;     /* Forest Ink — success, alt accent */

  /* Dark */
  --color-dark: #2C1810;            /* Deep Bark — nav, footer */
  --color-dark-alt: #1A2744;        /* Night Script — dark mode base */

  /* Divider */
  --color-divider: #D9D2C7;         /* Warm light grey — borders, rules */

  /* Typography */
  --font-display: 'Lora', serif;
  --font-body: 'Lora', serif;
  --font-ui: 'Inter', sans-serif;

  /* Scale */
  --text-hero: 3rem;
  --text-display: 2rem;
  --text-callout: 1.5rem;
  --text-body-lg: 1.125rem;
  --text-body: 1rem;
  --text-caption: 0.875rem;
  --text-label: 0.75rem;

  /* Spacing (4-point scale) */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 48px;
  --space-2xl: 80px;
  --space-3xl: 120px;

  /* Motion */
  --dur-fast: 150ms;
  --dur-base: 250ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Constraints
- All neutrals are warm-biased. Never use cool grey.
- Accent is locked to Terracotta (#C4622D) unless explicitly overridden.
- Parchment (#F5F0E8) is the default page background — never white, never cool.
- No purple. No blue gradients. No neon.

---

## Layout & Spacing

### Grid
- Max content width: 1200px, centred
- Left margin rail (colour swatches / decorative): 100–140px fixed
- Main content column: generous, 45–75ch prose measure
- 4-point spatial scale throughout

### Asymmetry Rule
- Left rail is narrow and decorative (colour swatches, motifs, step numbers)
- Right/centre body is primary and generous
- Button rows and feature rows are **left-aligned**, never centred
- Section headings are left-aligned

### Section Rhythm
- Hero → Language/Scenario selector → Features → Proverb/Quote → CTA → Footer
- Each section separated by `--space-2xl` (80px) minimum
- No dense stacking — breathing room is part of the brand voice

---

## Components

### Buttons
```css
/* Primary CTA */
background: var(--color-accent);       /* Terracotta */
color: var(--color-text-inverse);      /* Parchment */
font-family: var(--font-ui);           /* Inter */
font-weight: 500;
font-size: var(--text-caption);        /* 0.875rem */
letter-spacing: 0.02em;
padding: 12px 24px;
border-radius: 6px;
border: none;

/* Hover */
background: #A84E22;                   /* Darker terracotta */
transition: background var(--dur-fast) var(--ease-out);

/* Secondary / Outline */
background: transparent;
border: 1.5px solid var(--color-accent);
color: var(--color-accent);
```

### Badges & Tags
```css
/* Language tag (e.g. "Yoruba", "Intermediate") */
font-family: var(--font-ui);
font-size: var(--text-label);
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.08em;
padding: 4px 10px;
border-radius: 4px;
background: var(--color-surface);
color: var(--color-text);
border: 1px solid var(--color-divider);

/* Active/highlighted tag */
background: var(--color-accent);
color: var(--color-text-inverse);
border-color: var(--color-accent);
```

### Input Fields
```css
background: white;
border: 1.5px solid var(--color-divider);
border-radius: 6px;
padding: 12px 16px;
font-family: var(--font-ui);
font-size: var(--text-body);
color: var(--color-text);

/* Focus */
border-color: var(--color-accent);
outline: none;
box-shadow: 0 0 0 3px rgba(196, 98, 45, 0.15);
```

### Lesson / Scenario Cards
```css
background: var(--color-paper);
border: 1px solid var(--color-divider);
border-radius: 8px;
padding: var(--space-lg) var(--space-xl);

/* Left accent bar */
border-left: 4px solid var(--color-accent);

/* Title: Lora, deep bark */
/* Meta: Inter 500, warm ash, uppercase, small */
```

### Proverb / Quote Block
```css
border-left: 4px solid var(--color-accent);
padding-left: var(--space-lg);
font-family: var(--font-display);
font-style: italic;
font-size: 1.2rem;
color: var(--color-text);
line-height: 1.6;
```

### Nav
- Dark Deep Bark background (#2C1810)
- Wordmark in Lora, Parchment colour
- Links in Inter 500, Warm Ash, uppercase small caps
- Single Terracotta CTA button right-aligned
- No hairline border — the dark background separates it

### Footer
- Deep Bark or Terracotta background
- Parchment text
- Lora for the brand statement, Inter for links/meta
- Single horizontal rule in Warm Ash at top

---

## Motif & Texture
- Cultural spiral/rosette patterns used as **background texture only** — very low opacity (3–8%), never as foreground decoration
- Patterns are monochrome (Deep Bark or Terracotta tinted), blurred slightly
- Never use emoji as decorative elements — use the cultural motifs instead
- Motifs appear on: hero background, footer, lesson card accents

---

## Microinteractions

### Motion Stance
Motion-restrained. No animation libraries. CSS transitions only.

### Allowed
- Opacity crossfade: 150–250ms ease-out
- Transform on hover: translateY(-2px), 150ms ease-out
- Button active: translateY(1px), instant
- Card hover: subtle box-shadow lift

### Reduced Motion
Collapse all motion to instant opacity shift or remove entirely.

### Milestone Celebrations
- **Never use confetti** — it's generic and culturally weightless
- Milestone animations should feel **ceremonial** — like ink spreading on paper, or a brushstroke unfurling
- Implementation: a dark ink-coloured radial wash that expands from the centre of the screen, fades to transparent, then dissolves — all in ~800ms
- CSS only: `radial-gradient` expanding via `transform: scale()` + `opacity` fade
- Reduced motion: skip the spread, show a simple opacity flash instead

---

## Personalisation
- **The user's name appears on the home screen in their target language's native script** — e.g. Yoruba romanisation, Arabic script, Mandarin characters
- This is the first thing the user sees after onboarding — a personal, cultural greeting
- Render the native script in Lora (or a system fallback that supports the script) at display size
- Below it, a warm subtitle in English: "Welcome back, [Name]" in Lora regular
- This is not a widget or a card — it sits directly in the hero, replacing the generic headline on returning visits

---

## Voice & Copy
- **Heritage warmth** — speak to cultural identity, not just language learning
- **Literary feel** — prose reads like a book, not a SaaS product
- **Cultural pride** — celebrate identity, not just the lesson
- **Calm & focused** — measured, deliberate pacing
- **Motif-driven** — reference cultural context naturally

### Tone Examples
- ✓ "Your language is your inheritance."
- ✓ "Fluency is built lesson by lesson, memory by memory, story by story."
- ✗ "Start learning today!" (too generic SaaS)
- ✗ "10× faster fluency" (fabricated stats)
- ✗ "No judgment, just progress." (too casual)

---

## Anti-Patterns (do NOT use)
- ❌ Dark backgrounds with neon/emerald gradients
- ❌ Emoji as hero icons (🗣️, 🎯, 📊)
- ❌ Centred everything — bias the layout left
- ❌ Purple or blue gradient heroes
- ❌ Inter or Roboto as display font
- ❌ Generic 3-column icon-tile feature cards
- ❌ Fabricated stats ("5 scenarios", "∞ Practice", "0 Judgment")
- ❌ Cool grey neutrals — always warm-biased
- ❌ Sans-serif for prose — Lora owns the literary layer
- ❌ Confetti animations — use ceremonial, ink-spreading motion instead

---

## Hallmark Stamp
- Macrostructure: Editorial Split Hero
- Hero archetype: H3 Quote-Led / H1 Marquee hybrid
- Display role: Lora serif, warm elegance
- Body role: Lora prose + Inter UI
- Paper band: Parchment warm (#F5F0E8)
- Accent hue: Terracotta (38° warm)
- Rhythm: Left rail · generous prose · left-aligned CTAs · proverb pull-quotes
- Slop-tested: ✓ No gradients · ✓ No emoji icons · ✓ No centred everything · ✓ No fabricated stats
