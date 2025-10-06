interface ScenarioToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export default function ScenarioToggle({
  enabled,
  onChange,
}: ScenarioToggleProps) {
  return (
    <div
      onClick={() => onChange(!enabled)}
      className={`p-4 rounded-lg border border-border mb-6 cursor-pointer transition-all duration-300 hover:shadow-lg ${
        enabled
          ? 'bg-emerald-400/20 border-emerald-400/50'
          : 'bg-card hover:bg-card/80'
      }`}
    >
      <div>
        <span className="text-lg font-semibold text-text-primary">
          Scenario Analysis Mode
          <span className="ml-2 text-sm font-normal text-text-secondary">
            {enabled ? '(Active)' : '(Click to enable)'}
          </span>
        </span>
        <p className="text-sm text-text-secondary mt-1">
          Compare pessimistic, baseline, and optimistic scenarios for key variables
        </p>
      </div>
    </div>
  );
}
