'use client';

import { Scenario } from '@/types';
import Link from 'next/link';

/* Hallmark · component: ScenarioCard · genre: editorial · theme: custom (Mother Tongue)
 * states: default · hover · focus · active · disabled · loading · error · success
 */

interface ScenarioCardProps {
  scenario: Scenario;
}

export function ScenarioCard({ scenario }: ScenarioCardProps) {
  const difficultyLabels = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };

  return (
    <Link href={`/drill/${scenario.id}`} className="group block focus-visible:outline-none">
      <div className="relative bg-paper border border-divider border-l-4 border-l-accent rounded-sm p-6 lg:p-8 transition-all duration-base ease-out group-hover:translate-y-[-2px] group-hover:bg-surface group-hover:shadow-[0_4px_12px_rgba(44,24,16,0.08)] group-focus-visible:ring-2 group-focus-visible:ring-accent group-active:translate-y-[1px]">
        
        <div className="flex justify-between items-start mb-6">
          <span className="font-ui text-label uppercase tracking-[0.12em] text-text-secondary font-medium">
            {difficultyLabels[scenario.difficulty]}
          </span>
          <span className="text-2xl opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-base">
            {scenario.icon}
          </span>
        </div>

        <h3 className="font-display text-xl text-text mb-1 leading-tight group-hover:text-accent transition-colors duration-fast">
          {scenario.title}
        </h3>
        <p className="font-display italic text-sm text-accent mb-4 opacity-80 italic">
          {scenario.titleYoruba}
        </p>

        <p className="font-body text-text-secondary text-sm leading-prose line-clamp-2 mb-6">
          {scenario.description}
        </p>

        <div className="pt-4 border-t border-divider/50 flex items-center justify-between">
          <div className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-widest text-text-secondary">
            <span>Talk to:</span>
            <span className="text-dark font-medium">{scenario.aiRole}</span>
          </div>
          
          <svg
            className="w-4 h-4 text-accent translate-x-[-4px] opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-base ease-out"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}
