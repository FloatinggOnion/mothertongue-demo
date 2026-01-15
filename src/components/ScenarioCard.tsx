'use client';

import { Scenario } from '@/types';
import Link from 'next/link';

interface ScenarioCardProps {
  scenario: Scenario;
}

export function ScenarioCard({ scenario }: ScenarioCardProps) {
  const difficultyColors = {
    beginner: 'from-emerald-500 to-green-500',
    intermediate: 'from-amber-500 to-orange-500',
    advanced: 'from-red-500 to-rose-500',
  };

  const difficultyLabels = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };

  return (
    <Link href={`/drill/${scenario.id}`}>
      <div className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/10 cursor-pointer">
        {/* Difficulty badge */}
        <div className="absolute top-4 right-4">
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full bg-gradient-to-r ${difficultyColors[scenario.difficulty]} text-white`}
          >
            {difficultyLabels[scenario.difficulty]}
          </span>
        </div>

        {/* Icon */}
        <div className="text-4xl mb-4">{scenario.icon}</div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
          {scenario.title}
        </h3>
        <p className="text-sm text-emerald-400/80 mb-3">{scenario.titleYoruba}</p>

        {/* Description */}
        <p className="text-sm text-slate-400 line-clamp-2">
          {scenario.description}
        </p>

        {/* AI Role preview */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="text-emerald-400">🎭</span>
            <span>You&apos;ll talk to: {scenario.aiRole}</span>
          </div>
        </div>

        {/* Hover arrow */}
        <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg
            className="w-5 h-5 text-emerald-400"
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
