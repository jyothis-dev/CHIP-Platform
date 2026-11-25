export function PageHeader({ title, description }) {
  return (
    <div className="ui-page-header">
      <h1>{title}</h1>
      {description ? <p className="muted">{description}</p> : null}
    </div>
  );
}
