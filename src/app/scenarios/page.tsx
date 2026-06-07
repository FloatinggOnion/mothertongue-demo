'use client';

import { scenarios } from '@/config/scenarios';
import { ScenarioCard } from '@/components';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

/* Hallmark · genre: editorial · macrostructure: Scenarios Grid · design-system: design.md */

export default function ScenariosPage() {
  return (
    <Suspense>
      <ScenariosContent />
    </Suspense>
  );
}

function ScenariosContent() {
  const searchParams = useSearchParams();
  
  // Extract and normalize the selected language parameter ('yoruba' | 'hausa')
  const selectedLang = searchParams.get('lang')?.toLowerCase() || 'yoruba';

  // Filter scenarios to match only the active language selection
  const filteredScenarios = scenarios.filter(
    (scenario) => scenario.language === selectedLang
  );

  return (
    <main className="relative min-h-screen bg-paper selection:bg-accent/30 overflow-x-hidden flex">
      {/* Left Rail (Desktop) */}
      <aside className="hidden md:flex w-[120px] lg:w-[140px] flex-col items-center py-12 border-r border-divider sticky top-0 h-screen shrink-0 z-20">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <span className="font-display text-xl tracking-tight text-dark">Mother Tongue</span>
          <div className="h-px w-8 bg-divider" />
          <span className="font-ui text-[9px] uppercase tracking-[0.2em] text-text-secondary leading-tight">Language as Inheritance</span>
        </div>
      </aside>

      {/* Global floating rosettes */}
      <img 
        src="/native.jpg" 
        alt="" 
        aria-hidden="true" 
        className="absolute top-[5%] right-[-5%] w-[350px] opacity-[0.06] rotate-[15deg] pointer-events-none z-0" 
      />
      <img 
        src="/native.jpg" 
        alt="" 
        aria-hidden="true" 
        className="absolute bottom-0 left-0 w-[150px] opacity-[0.10] rotate-[-15deg] pointer-events-none z-0" 
      />
      
      <div className="flex-grow max-w-[1200px] mx-auto px-6 md:px-16 lg:px-24 py-12 md:py-20 relative z-10">
        {/* Navigation Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-6 mb-12">
          {/* Back Arrow */}
          <Link 
            href="/" 
            className="inline-flex items-center gap-3 text-text-secondary hover:text-accent transition-all duration-base group"
          >
            <div className="w-10 h-10 rounded-full border border-divider flex items-center justify-center group-hover:border-accent group-hover:bg-accent/5 transition-all">
              <svg 
                className="w-5 h-5 transition-transform group-hover:translate-x-[-2px]" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <span className="font-ui text-[10px] uppercase tracking-[0.25em]">Back to Home</span>
          </Link>

          {/* Quick Filter Language Toggle Tab */}
          <div className="flex items-center gap-2 border border-divider p-1 rounded-md bg-paper/50 backdrop-blur-sm">
            <Link
              href="/scenarios?lang=yoruba"
              className={`px-4 py-1.5 font-ui text-[10px] uppercase tracking-wider font-medium rounded transition-all duration-fast ${
                selectedLang === 'yoruba'
                  ? 'bg-accent text-text-inverse shadow-sm'
                  : 'text-text-secondary hover:text-dark'
              }`}
            >
              Yoruba
            </Link>
            <Link
              href="/scenarios?lang=hausa"
              className={`px-4 py-1.5 font-ui text-[10px] uppercase tracking-wider font-medium rounded transition-all duration-fast ${
                selectedLang === 'hausa'
                  ? 'bg-accent text-text-inverse shadow-sm'
                  : 'text-text-secondary hover:text-dark'
              }`}
            >
              Hausa
            </Link>
          </div>
        </div>

        {/* Header Area */}
        <header className="mb-12">
          <h1 className="font-display text-text text-[3.5rem] md:text-hero leading-[1.1] mb-6 tracking-tight capitalize animate-fade-in">
            {selectedLang} Scenarios
          </h1>
          <p className="font-body text-text-secondary text-body-lg leading-prose max-w-[50ch] animate-fade-in [animation-delay:100ms]">
            {selectedLang === 'hausa' 
              ? 'Pick a real-life northern scenario to test your fluency. Practice natural conversation protocols with cultural context.'
              : 'Pick a real-life situation to test your fluency. From market haggling to greeting elders with proper respect.'
            }
          </p>
        </header>

        {/* Divider */}
        <div className="h-px bg-divider w-full mb-12" />

        {/* Scenarios Grid */}
        <section className="hero-pattern animate-fade-in [animation-delay:200ms]">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredScenarios.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}