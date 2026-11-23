import { calculateNextDue } from './schedule.js';

const schedule = [
  { vaccineCode: 'BCG', vaccineName: 'BCG', doseNumber: 1, dueAgeDays: 0 },
  { vaccineCode: 'HEPB', vaccineName: 'Hepatitis B', doseNumber: 0, dueAgeDays: 0 },
  { vaccineCode: 'OPV', vaccineName: 'Oral polio', doseNumber: 1, dueAgeDays: 42 },
];

describe('calculateNextDue', () => {
  it('returns the birth dose as due on the date of birth', () => {
    const next = calculateNextDue(schedule, [], '2026-01-01', new Date('2026-01-01T12:00:00Z'));
    expect(next).toMatchObject({ vaccineCode: 'BCG', doseNumber: 1, status: 'due', dueDate: '2026-01-01' });
  });

  it('skips recorded doses and marks a future dose upcoming', () => {
    const next = calculateNextDue(
      schedule,
      [
        { vaccineCode: 'BCG', doseNumber: 1 },
        { vaccineCode: 'HEPB', doseNumber: 0 },
      ],
      '2026-01-01',
      new Date('2026-01-02T00:00:00Z'),
    );
    expect(next).toMatchObject({ vaccineCode: 'OPV', doseNumber: 1, status: 'upcoming', dueDate: '2026-02-12' });
  });

  it('marks a missed birth dose overdue', () => {
    const next = calculateNextDue(schedule, [], '2026-01-01', new Date('2026-02-01T00:00:00Z'));
    expect(next).toMatchObject({ vaccineCode: 'BCG', status: 'overdue' });
  });

  it('returns null when every dose is recorded', () => {
    const next = calculateNextDue(
      schedule,
      schedule.map((item) => ({ vaccineCode: item.vaccineCode, doseNumber: item.doseNumber })),
      '2026-01-01',
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(next).toBeNull();
  });
});
