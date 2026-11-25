import './Field.css';

let fieldId = 0;

export function Field({
  label,
  error,
  children,
  htmlFor,
  className = '',
}) {
  const id = htmlFor || `field-${++fieldId}`;
  const control = typeof children === 'function'
    ? children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${id}-error` : undefined })
    : children;

  return (
    <div className={`field ui-field ${className}`.trim()}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      {control}
      {error ? (
        <span id={`${id}-error`} className="ui-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
