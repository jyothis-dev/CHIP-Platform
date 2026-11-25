import './Spinner.css';

export function Spinner({ label = 'Loading…' }) {
  return (
    <p className="ui-spinner muted" role="status" aria-live="polite">
      {label}
    </p>
  );
}
