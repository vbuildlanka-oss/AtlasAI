import type { AgentEvent, AgentStage } from '../types';

interface Props {
  events: AgentEvent[];
  running: boolean;
}

const PIPELINE: { stage: AgentStage; label: string; agent: string }[] = [
  { stage: 'planning', label: 'Planning', agent: 'Planner agent' },
  { stage: 'retrieving', label: 'Retrieving', agent: 'Retriever agents' },
  { stage: 'synthesizing', label: 'Synthesizing', agent: 'Synthesizer agent' },
  { stage: 'saving', label: 'Saving', agent: 'Provenance' },
];

/** Live view of which agent is working, driven by the SSE status stream. */
export function AgentStatus({ events, running }: Props) {
  if (!running && events.length === 0) return null;

  const reached = new Set(events.map((e) => e.stage));
  const errored = events.some((e) => e.stage === 'error');
  const done = events.some((e) => e.stage === 'done');
  const currentStage = [...events].reverse()[0]?.stage;
  const latest = [...events].reverse()[0]?.message ?? 'Starting…';

  return (
    <div className={`agent-status ${errored ? 'errored' : ''}`}>
      <div className="agent-track">
        {PIPELINE.map((step) => {
          const isDone = reached.has(step.stage) && (currentStage !== step.stage || done);
          const isActive = running && currentStage === step.stage && !done;
          return (
            <div
              key={step.stage}
              className={`agent-node ${isDone ? 'complete' : ''} ${isActive ? 'active' : ''}`}
            >
              <span className="agent-dot">{isActive ? '◐' : isDone ? '✓' : '○'}</span>
              <span className="agent-label">{step.label}</span>
            </div>
          );
        })}
      </div>
      <div className="agent-message">{errored ? '⚠ ' : ''}{latest}</div>
    </div>
  );
}
