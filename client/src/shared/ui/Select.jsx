export function Select({ id, children, ...props }) {
  return (
    <select id={id} {...props}>
      {children}
    </select>
  );
}
