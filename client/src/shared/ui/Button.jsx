import './Button.css';

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  className = '',
  ...props
}) {
  const variantClass = variant === 'primary'
    ? 'btn-primary'
    : variant === 'ghost'
      ? 'btn-ghost'
      : 'btn';
  return (
    <button type={type} className={`ui-btn ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
