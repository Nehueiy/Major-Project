import React from 'react';
import { Sparkles, Bot, Loader2 } from 'lucide-react';

export default function FinalDestinationView({ trip, data, members = [], onAccept, hasAccepted, onRegenerate, generating }) {
  const budget = data?.budget || "N/A";
  const destination = data?.destination || "Unknown";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[var(--text)] font-bold text-lg flex items-center gap-2">
            <Sparkles size={18} /> Final recommendation: {destination}
          </h2>
          <p className="text-[var(--text-dim)] text-sm mt-1">Estimated budget per person: <span className="font-semibold">{budget}</span></p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--text-dim)]">Trip</p>
          <p className="font-semibold">{trip?.name}</p>
        </div>
      </div>

      {data?.whyChosen && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Why this was chosen</h3>
          <p className="text-[var(--text-dim)] text-sm mt-1 whitespace-pre-wrap">{data.whyChosen}</p>
        </div>
      )}

      {data?.itinerary && Array.isArray(data.itinerary) && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Suggested itinerary</h3>
          <ol className="mt-2 space-y-2 list-decimal list-inside text-[var(--text-dim)] text-sm">
            {data.itinerary.map((d, i) => (
              <li key={i}><span className="font-semibold mr-2">Day {d.day}:</span> {d.plan}</li>
            ))}
          </ol>
        </div>
      )}

      {data?.matchScores && Array.isArray(data.matchScores) && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Match scores</h3>
          <ul className="mt-2 space-y-1 text-[var(--text-dim)] text-sm">
            {data.matchScores.map((m, i) => (
              <li key={i}>
                <span className="font-semibold">{m.memberName}:</span> {m.score}% — {m.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data?.alternatives && Array.isArray(data.alternatives) && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Alternatives</h3>
          <ul className="mt-2 space-y-1 text-[var(--text-dim)] text-sm">
            {data.alternatives.map((a, i) => (
              <li key={i} className="font-medium">{a.name} — <span className="text-[var(--text-dim)]">{a.reason}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-[var(--text-dim)]">Recommended dates: <span className="font-semibold text-[var(--text)]">{data?.bestDates || 'Anytime'}</span></div>
        <div className="flex items-center gap-3">
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={generating}
              className={`btn px-4 py-2 text-xs font-bold border border-[var(--border)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[var(--accent)] transition-colors flex items-center gap-1.5 ${generating ? 'opacity-60 cursor-default' : ''}`}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
              Discuss another place with AI
            </button>
          )}
          <button
            onClick={onAccept}
            disabled={hasAccepted || generating}
            className={`btn btn-primary px-4 py-2 text-xs font-bold ${hasAccepted || generating ? 'opacity-60 cursor-default' : ''}`}
          >
            {hasAccepted ? 'Accepted' : 'Accept recommendation'}
          </button>
        </div>
      </div>
    </div>
  );
}
