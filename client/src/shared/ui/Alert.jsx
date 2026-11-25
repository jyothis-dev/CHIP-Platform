import './Alert.css';

export function Alert({ children, tone = 'danger' }) {
  if (!children) return null;
  return (
    <p className={`ui-alert ui-alert-${tone}`} role="alert" aria-live="polite">
      {children}
    </p>
  );
}
