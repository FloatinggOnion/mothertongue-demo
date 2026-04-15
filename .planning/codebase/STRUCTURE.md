# Codebase Structure

**Analysis Date:** 2026-03-20

## Directory Layout

```
mothertongue-demo/
├── src/                      # Source code root
│   ├── app/                  # Next.js App Router (pages and API routes)
│   │   ├── page.tsx          # Home page with scenario selection
│   │   ├── layout.tsx        # Root layout wrapper
│   │   ├── globals.css       # Global styles (Tailwind)
│   │   ├── drill/
│   │   │   └── [id]/
│   │   │       └── page.tsx  # Drill conversation page (dynamic route)
│   │   ├── api/              # API route handlers
│   │   │   ├── chat/
│   │   │   │   └── route.ts  # POST /api/chat - AI response generation
│   │   │   ├── evaluate/
│   │   │   │   └── route.ts  # POST /api/evaluate - Conversation evaluation
│   │   │   ├── transcribe/
│   │   │   │   └── route.ts  # POST /api/transcribe - Audio to text
│   │   │   ├── tts/
│   │   │   │   └── route.ts  # POST /api/tts - Text to speech
│   │   │   └── suggestions/
│   │   │       └── route.ts  # POST /api/suggestions - Reply hints
│   │   └── favicon.ico       # Favicon
│   ├── components/           # Reusable React components
│   │   ├── index.ts          # Barrel export file
│   │   ├── ConversationView.tsx  # Message display + loading state
│   │   ├── MessageBubble.tsx  # (exported from ConversationView)
│   │   ├── MicButton.tsx     # Microphone input button with states
│   │   ├── ReplySuggestions.tsx # Hint cards display
│   │   ├── FeedbackCard.tsx  # Evaluation results modal
│   │   └── ScenarioCard.tsx  # Scenario selection card (home page)
│   ├── hooks/                # Custom React hooks
│   │   └── useSpeech.ts      # useSpeechRecognition + useSpeechSynthesis
│   ├── services/             # Business logic and API clients
│   │   └── gemini.ts         # All Gemini API integration (marked 'use server')
│   ├── config/               # Static configuration
│   │   └── scenarios.ts      # 5 scenario definitions + getScenarioById()
│   ├── types/                # TypeScript type definitions
│   │   ├── index.ts          # Core domain types
│   │   └── speech.d.ts       # Web Speech API type stubs (if needed)
│   └── (generated config)    # Added by Next.js build
├── .planning/                # Documentation directory (created by GSD)
│   └── codebase/
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONVENTIONS.md    # (if generated)
│       └── TESTING.md        # (if generated)
├── public/                   # Static assets (if any)
├── .next/                    # Next.js build output (generated)
├── node_modules/             # Dependencies (gitignored)
├── package.json              # Project metadata and dependencies
├── yarn.lock                 # Yarn lockfile
├── tsconfig.json             # TypeScript configuration
├── next.config.ts            # Next.js configuration
├── postcss.config.mjs         # PostCSS/Tailwind config
├── eslint.config.mjs         # ESLint configuration
├── .env.local                # Local environment variables (gitignored)
├── .gitignore                # Git ignore rules
├── README.md                 # Project documentation
├── credentials.json          # Google Cloud credentials (gitignored)
└── modal_tts.py              # Legacy Python TTS script (not in use)
```

## Directory Purposes

**src/app:**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components (.tsx), API handlers (.ts), layout wrapper, globals.css
- Key files: `page.tsx` (home), `drill/[id]/page.tsx` (conversation), `api/*/route.ts` (handlers)

**src/components:**
- Purpose: Reusable React UI components
- Contains: 5 presentational components + 1 barrel export
- Key files: ConversationView (messages), MicButton (input), FeedbackCard (results)

**src/hooks:**
- Purpose: Custom React hooks encapsulating browser APIs and client-side logic
- Contains: useSpeechRecognition (Web Speech API + MediaRecorder fallback), useSpeechSynthesis (TTS client)

**src/services:**
- Purpose: Server-side business logic and external API integration
- Contains: gemini.ts - all Gemini API calls for chat, evaluation, suggestions, translation

**src/config:**
- Purpose: Static game configuration and content
- Contains: 5 Yoruba practice scenarios with character, context, difficulty, gender

**src/types:**
- Purpose: TypeScript type definitions and interfaces
- Contains: Scenario, Message, Evaluation, DrillSession, ConversationMetrics, ProficiencyLevel, etc.

## Key File Locations

**Entry Points:**

- `src/app/page.tsx` - Home page (scenario list)
- `src/app/drill/[id]/page.tsx` - Drill conversation page
- `src/app/layout.tsx` - Root layout, metadata, fonts
- `src/app/globals.css` - Global Tailwind styles

**Configuration:**

- `tsconfig.json` - TypeScript settings with `@/*` path alias
- `next.config.ts` - Next.js settings
- `postcss.config.mjs` - Tailwind CSS configuration
- `package.json` - Dependencies: next, react, @google-cloud/text-to-speech, @google/genai, tailwindcss
- `.env.local` - Runtime secrets (GEMINI_API_KEY, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)

**Core Logic:**

- `src/services/gemini.ts` - All AI service calls (conversation, evaluation, suggestions)
- `src/config/scenarios.ts` - Scenario definitions and lookup function
- `src/types/index.ts` - Domain type definitions

**Testing:**

- No test files detected in codebase

## Naming Conventions

**Files:**

- Pages: `page.tsx` (Next.js convention for route component)
- Components: `PascalCase.tsx` (React convention)
- API routes: `route.ts` (Next.js convention)
- Hooks: `useCamelCase.ts` (React hook naming)
- Config/Services: `camelCase.ts`
- Dynamic routes: `[id].tsx` (Next.js convention for route parameters)

**Directories:**

- lowercase-kebab-case: `src/components/`, `src/services/`, `src/config/`, `src/hooks/`
- Singular or collection: Mostly singular (`components` collection, `services` folder)
- Route groups: `drill/[id]/` follows Next.js dynamic route pattern

## Where to Add New Code

**New Feature (e.g., difficulty level selection):**
- Primary code: `src/app/drill/[id]/page.tsx` (add state and UI)
- Backend: `src/services/gemini.ts` (update system prompt logic)
- Config: `src/types/index.ts` (extend DrillSession type if needed)
- API: No new endpoint needed if using existing /api/chat

**New Component/Module:**
- Implementation: `src/components/[ComponentName].tsx`
- Export: Add to `src/components/index.ts` (barrel file)
- Usage: Import from `@/components` in page components

**Utilities:**
- Shared helpers: `src/services/` (if backend logic) or `src/hooks/` (if client-side hooks)
- Types: Add to `src/types/index.ts`

**New Scenario:**
- Add to array in `src/config/scenarios.ts`
- Must follow Scenario interface: id, title, titleYoruba, description, icon, context, aiRole, aiRoleYoruba, starterPrompt, difficulty, gender

**New API Endpoint:**
- Create: `src/app/api/[feature]/route.ts`
- Export async POST (or GET/PUT/etc.)
- Call services from `src/services/` as needed
- Return NextResponse.json()

## Special Directories

**src/app/api/:**
- Purpose: Route handlers for HTTP endpoints
- Generated: No
- Committed: Yes
- Pattern: Each folder under api/ becomes a route, route.ts exports HTTP methods

**src/app/drill/[id]/:**
- Purpose: Dynamic route parameter
- Generated: No
- Committed: Yes
- Syntax: [id] becomes route param accessible via useParams()

ORE **.next/:**
- Purpose: Next.js build output
- Generated: Yes (next build)
- Committed: No (.gitignored)
- Contains: Compiled pages, chunks, API handlers, type definitions

**.env.local:**
- Purpose: Local environment variables
- Generated: No (must create manually)
- Committed: No (.gitignored)
- Required vars: GEMINI_API_KEY, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY

---

*Structure analysis: 2026-03-20*
