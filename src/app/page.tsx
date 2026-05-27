import { scenarios } from '@/config/scenarios';
import { ScenarioCard } from '@/components';
import Link from 'next/link';

/* Hallmark · genre: editorial · macrostructure: Editorial Split · design-system: design.md */

export default function Home() {
  return (
    <main className="relative min-h-screen selection:bg-accent/30">
      {/* Decorative Motif Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <svg width="100%" height="100%" className="w-full h-full opacity-[0.04]">
          <pattern id="motif-spiral" x="0" y="0" width="400" height="400" patternUnits="userSpaceOnUse">
            <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="1" className="text-dark" />
            <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" strokeWidth="1" className="text-dark" strokeDasharray="4 8" />
            <path d="M200 20L200 380 M20 200L380 200 M72.7 72.7L327.3 327.3 M72.7 327.3L327.3 72.7" stroke="currentColor" strokeWidth="0.5" className="text-dark" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#motif-spiral)" />
        </svg>
        {/* Global floating rosettes */}
        <img src="/native.jpg" alt="" aria-hidden="true" className="absolute top-[15%] right-[-5%] w-[300px] opacity-[0.07] rotate-[15deg] pointer-events-none z-0" />
        <img src="/native.jpg" alt="" aria-hidden="true" className="absolute bottom-[10%] left-[-5%] w-[250px] opacity-[0.06] rotate-[-10deg] pointer-events-none z-0" />
        <img src="/native.jpg" alt="" aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] opacity-[0.03] rotate-[45deg] pointer-events-none z-0" />
      </div>
      <div className="flex flex-col md:flex-row min-h-screen">
        {/* Left Rail (Desktop) */}
        <aside className="hidden md:flex w-[120px] lg:w-[140px] flex-col items-center py-12 border-r border-divider sticky top-0 h-screen shrink-0">
          <div className="flex flex-col items-center gap-4 text-center px-4">
            <span className="font-display text-xl tracking-tight text-dark">Mother Tongue</span>
            <div className="h-px w-8 bg-divider" />
            <span className="font-ui text-[9px] uppercase tracking-[0.2em] text-text-secondary leading-tight">Language as Inheritance</span>
          </div>
          
        </aside>

        {/* Content Area */}
        <div className="flex-grow">
          {/* Mobile Header */}
          <header className="md:hidden px-6 py-8 border-b border-divider flex justify-between items-center bg-paper/80 backdrop-blur-sm sticky top-0 z-sticky">
            <span className="font-display text-xl text-dark">Mother Tongue</span>
            <div className="w-8 h-8 rounded-full bg-accent" />
          </header>

          <div className="max-w-6xl px-6 md:px-16 lg:px-24">
            
            {/* Hero Section */}
            <section className="relative hero-pattern pt-16 md:pt-32 pb-24 border-b border-divider/50">
              <div className="max-w-[75ch] relative z-10">
                <blockquote className="font-display italic text-text-secondary text-lg md:text-xl mb-8 pl-6 border-l-2 border-accent">
                  "Àjàlórá ni orí, kì í ṣe àjàlórá ni ẹsẹ̀."
                  <cite className="block not-italic text-sm mt-2 text-text-secondary opacity-80">— The head is a treasure, not the feet.</cite>
                </blockquote>
                
                <h1 className="font-display text-text text-hero leading-[1.1] mb-8 tracking-tight animate-fade-in">
                  Your language is your inheritance.
                </h1>
                
                <p className="font-body text-text-secondary text-body-lg leading-prose mb-12 max-w-[55ch]">
                  Fluency is built lesson by lesson, memory by memory, story by story. 
                  Practice Yoruba with an AI partner who understands the nuance of heritage and culture.
                </p>

                <div className="flex flex-col sm:flex-row gap-6">
                  <Link 
                    href="#scenarios" 
                    className="inline-flex items-center justify-center px-8 py-3 bg-accent text-text-inverse font-ui text-caption font-medium rounded-md hover:bg-[#A84E22] transition-colors duration-fast ease-out"
                  >
                    Start a Conversation
                  </Link>
                  <Link 
                    href="/about" 
                    className="inline-flex items-center justify-center px-8 py-3 border-1.5 border-accent text-accent font-ui text-caption font-medium rounded-md hover:bg-accent/5 transition-colors duration-fast ease-out"
                  >
                    Our Philosophy
                  </Link>
                </div>
              </div>

              <img src="/native.jpg" alt="Nigerian Pattern" className="absolute -top-10 -left-10 w-[240px] transform rotate-12 opacity-8 pointer-events-none" aria-hidden="true" />
              <img src="/native.jpg" alt="Nigerian Pattern" className="absolute bottom-0 right-0 w-[180px] transform -rotate-12 opacity-7 pointer-events-none" aria-hidden="true" />
            </section>
            <div className="section-divider" aria-hidden="true" />
            {/* Scenarios Section */}
            <section id="scenarios" className="relative hero-pattern py-24 border-b border-divider/50">
              <header className="mb-12">
                <span className="font-ui text-label uppercase tracking-[0.1em] text-accent font-semibold block mb-4">Practice Grounds</span>
                <h2 className="font-display text-display text-text leading-tight mb-4">Choose a Scenario</h2>
                <p className="font-body text-text-secondary text-body leading-prose max-w-[50ch]">
                  Pick a real-life situation to test your fluency. From market haggling to greeting elders with respect.
                </p>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {scenarios.map((scenario) => (
                  <ScenarioCard key={scenario.id} scenario={scenario} />
                ))}
              </div>
              <img src="/native.jpg" alt="Nigerian Pattern" className="absolute top-1/4 -left-12 w-[220px] transform -rotate-12 opacity-8 pointer-events-none" aria-hidden="true" />
              <img src="/native.jpg" alt="Nigerian Pattern" className="absolute top-0 right-10 w-[160px] transform rotate-45 opacity-6 pointer-events-none" aria-hidden="true" />
              <img src="/native.jpg" alt="Nigerian Pattern" className="absolute bottom-0 left-1/4 w-[180px] transform rotate-12 opacity-7 pointer-events-none" aria-hidden="true" />
            </section>
            <div className="section-divider" aria-hidden="true" />
            {/* Narrative / How it works */}
            <section className="relative hero-pattern py-24">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-5">
                  <span className="font-ui text-label uppercase tracking-[0.1em] text-accent font-semibold block mb-4">Methodology</span>
                  <h2 className="font-display text-display text-text leading-tight mb-6">Built for depth, not just vocabulary.</h2>
                  <p className="font-body text-text-secondary text-body leading-prose">
                    Most tools treat language as a set of labels. We treat it as a conversation. 
                    Our AI partner is trained on the nuances of Nigerian social protocols—knowing when to use 
                    honourifics and how to navigate the rhythm of daily life.
                  </p>
                </div>
                
                <div className="lg:col-span-6 lg:col-start-7 flex flex-col gap-12">
                  <div className="flex gap-6">
                    <span className="font-display text-3xl text-divider shrink-0 select-none">01</span>
                    <div>
                      <h3 className="font-display text-xl text-dark mb-2">Immersion First</h3>
                      <p className="font-body text-text-secondary text-body leading-prose">
                        Choose a scenario that matters to your day-to-day life or heritage.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <span className="font-display text-3xl text-divider shrink-0 select-none">02</span>
                    <div>
                      <h3 className="font-display text-xl text-dark mb-2">Natural Cadence</h3>
                      <p className="font-body text-text-secondary text-body leading-prose">
                        Speak freely. No multiple-choice tests. Just real responses to real prompts.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <span className="font-display text-3xl text-divider shrink-0 select-none">03</span>
                    <div>
                      <h3 className="font-display text-xl text-dark mb-2">Cultural Feedback</h3>
                      <p className="font-body text-text-secondary text-body leading-prose">
                        Receive corrections not just on grammar, but on cultural appropriateness and tone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <img src="/native.jpg" alt="Nigerian Pattern" className="absolute -top-10 right-0 w-[200px] transform rotate-12 opacity-6 pointer-events-none" aria-hidden="true" />
              <img src="/native.jpg" alt="Nigerian Pattern" className="absolute bottom-10 left-0 w-[160px] transform -rotate-12 opacity-8 pointer-events-none" aria-hidden="true" />
            </section>

            {/* Footer */}
            <footer className="pt-24 pb-12 border-t border-divider mt-24">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12">
                <div className="max-w-[40ch]">
                  <p className="font-display text-2xl text-text leading-tight mb-6">
                    Fluency is built memory by memory.
                  </p>
                  <div className="flex gap-4">
                    <span className="font-ui text-label text-text-secondary uppercase tracking-widest">Built for depth</span>
                    <span className="text-divider">•</span>
                    <span className="font-ui text-label text-text-secondary uppercase tracking-widest">Culture first</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-start md:items-end gap-4">
                  <span className="font-display text-xl text-dark">Mother Tongue</span>
                  <p className="text-text-secondary text-[10px] font-ui uppercase tracking-widest">
                    © 2026 • Powered by Gemini • Built for the Heritage
                  </p>
                </div>
              </div>
            </footer>

          </div>
        </div>
      </div>
    </main>
  );
}

