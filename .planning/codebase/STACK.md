# Technology Stack

**Analysis Date:** 2026-03-20

## Languages

**Primary:**
- TypeScript 5.x - Used throughout frontend and backend code
- JavaScript (JSX/TSX) - React components and Next.js pages

**Secondary:**
- Python 3.x - Found in `modal_tts.py` (local development/reference code)

## Runtime

**Environment:**
- Node.js (version not explicitly specified in package.json, development target appears to be recent LTS)

**Package Manager:**
- Yarn - Lockfile present at `yarn.lock`
- Lockfile status: Present and tracked

## Frameworks

**Core:**
- Next.js 16.1.1 - Full-stack React framework for API routes and pages
- React 19.2.3 - UI component library
- React DOM 19.2.3 - DOM rendering

**Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework
- @tailwindcss/postcss 4.x - Tailwind PostCSS plugin

**Build/Dev:**
- TypeScript 5.x - Static type checking
- PostCSS 4.x - CSS processing pipeline
- ESLint 9.x - Code linting with Next.js defaults

## Key Dependencies

**Critical:**
- @google-cloud/text-to-speech 6.4.0 - Google Cloud Text-to-Speech client for audio generation
- @google/genai 1.34.0 - Google Generative AI (Gemini) client for LLM interactions

**Infrastructure:**
- @types/node 20.x - TypeScript definitions for Node.js
- @types/react 19.x - TypeScript definitions for React
- @types/react-dom 19.x - TypeScript definitions for React DOM
- eslint-config-next 16.1.1 - ESLint configuration for Next.js projects

## Configuration

**Environment:**
- `.env.local` file present - Contains environment variables (file not committed; see forbidden_files policy)
- Required environment variables:
  - `GEMINI_API_KEY` - Google Generative AI API key (used in `src/services/gemini.ts`)
  - `GEMINI_MODEL` - Optional; defaults to `gemini-2.5-flash` for chat, `gemini-2.0-flash` for transcription
  - `GOOGLE_CLIENT_EMAIL` - Service account email for Google Cloud TTS
  - `GOOGLE_PRIVATE_KEY` - Service account private key for Google Cloud TTS (note: newlines escaped as `\\n` in transport)

**Build:**
- `tsconfig.json` - TypeScript compiler configuration
  - Target: ES2017
  - Module: esnext
  - JSX: react-jsx
  - Path alias: `@/*` → `./src/*`
  - Strict mode enabled
- `next.config.ts` - Next.js configuration (minimal, no custom overrides)
- `eslint.config.mjs` - ESLint configuration using new flat config format
  - Extends: eslint-config-next core-web-vitals and typescript
  - Ignores: .next/, out/, build/, next-env.d.ts
- `postcss.config.mjs` - PostCSS configuration for Tailwind

## Platform Requirements

**Development:**
- Node.js (unspecified version, assume recent LTS)
- Yarn package manager
- Google Cloud credentials (service account JSON file)
- Google Generative AI API key

**Production:**
- Node.js runtime (vercel deployment target implicit from Next.js choice)
- Same environment variables as development
- `.vercel` directory present (indicates Vercel deployment configuration)

---

*Stack analysis: 2026-03-20*
