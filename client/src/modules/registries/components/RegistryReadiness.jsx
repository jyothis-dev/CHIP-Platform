import { Alert } from '@/shared/ui/index.js';
import { useRegistryReadiness } from '../hooks/useRegistries.js';

/** Says what cannot work yet, in the same way the HIP and HIU screens do. */
export function RegistryReadiness() {
  const readiness = useRegistryReadiness();
  const data = readiness.data;
  if (readiness.error) return <Alert>{readiness.error.message}</Alert>;
  if (!data) return null;
  return (
    <>
      {data.blockers.length > 0 ? (
        <Alert tone="danger">
          {data.blockers.map((line) => <span key={line} className="registry-line">{line}</span>)}
        </Alert>
      ) : null}
      {data.warnings.length > 0 ? (
        <Alert tone="warning">
          {data.warnings.map((line) => <span key={line} className="registry-line">{line}</span>)}
        </Alert>
      ) : null}
    </>
  );
}
