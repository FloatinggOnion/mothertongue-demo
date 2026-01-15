import { scenarios } from '@/config/scenarios';
import { ScenarioCard } from '@/components';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      {/* Hero Section */}
      <section className="relative px-6 py-16 md:py-24 text-center overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Logo/Title */}
          <div className="mb-6">
            <span className="text-6xl md:text-7xl">🗣️</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Mother
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              tongue
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-2">
            Speak Yoruba with confidence
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-8">
            Practice real conversations with an AI partner who understands Nigerian culture.
            No judgment, just progress.
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-8 mb-12">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">5</div>
              <div className="text-xs text-slate-500">Scenarios</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-400">∞</div>
              <div className="text-xs text-slate-500">Practice</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">0</div>
              <div className="text-xs text-slate-500">Judgment</div>
            </div>
          </div>
        </div>
      </section>

      {/* Scenarios Section */}
      <section className="px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            Choose a Scenario
          </h2>
          <p className="text-slate-400 text-center mb-8">
            Pick a real-life situation to practice
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenarios.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-8 text-center">
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 rounded-xl p-6 text-center border border-white/10">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-semibold text-white mb-2">Pick a Scenario</h3>
              <p className="text-sm text-slate-400">
                Choose a real-life situation like market haggling or greeting elders
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-6 text-center border border-white/10">
              <div className="text-3xl mb-3">🎙️</div>
              <h3 className="font-semibold text-white mb-2">Speak Freely</h3>
              <p className="text-sm text-slate-400">
                Have a natural conversation with your AI partner - no interruptions
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-6 text-center border border-white/10">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-semibold text-white mb-2">Get Feedback</h3>
              <p className="text-sm text-slate-400">
                Receive personalized feedback after each drill to improve faster
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-500 text-sm">
            Powered by{' '}
            <span className="text-emerald-400 font-medium">Gemini 3</span>
            {' '}• Built for the Gemini Hackathon
          </p>
        </div>
      </footer>
    </main>
  );
}
