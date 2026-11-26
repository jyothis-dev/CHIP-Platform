import { useState } from 'react';
import { PageHeader } from '@/shared/ui/index.js';
import { RegistryReadiness } from '../components/RegistryReadiness.jsx';
import { FacilitySearch } from '../components/FacilitySearch.jsx';
import { ProfessionalSearch } from '../components/ProfessionalSearch.jsx';
import '../registries.css';

const TABS = [
  { key: 'facility', label: 'Facility (HFR)' },
  { key: 'professional', label: 'Professional (HPR)' },
];

export default function RegistryLookupPage() {
  const [tab, setTab] = useState('facility');
  return (
    <section className="stack registry-page">
      <PageHeader
        title="Registry lookup"
        description="Look up facilities in the Health Facility Registry and professionals in the Healthcare Professionals Registry. Lookups never create an ID."
      />
      <RegistryReadiness />
      <div className="registry-tabs" role="tablist" aria-label="Registry">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`registry-tab-${item.key}`}
            aria-selected={tab === item.key}
            aria-controls={`registry-panel-${item.key}`}
            className={tab === item.key ? 'registry-tab registry-tab-active' : 'registry-tab'}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`registry-panel-${tab}`} aria-labelledby={`registry-tab-${tab}`}>
        {tab === 'facility' ? <FacilitySearch /> : <ProfessionalSearch />}
      </div>
    </section>
  );
}
