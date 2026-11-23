function startOfUtcDay(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function calculateNextDue(schedule, records, dateOfBirth, today = new Date()) {
  const done = new Set(records.map((record) => `${record.vaccineCode}:${record.doseNumber}`));
  const ordered = [...schedule].sort((left, right) => {
    if (left.dueAgeDays !== right.dueAgeDays) return left.dueAgeDays - right.dueAgeDays;
    if (left.vaccineCode !== right.vaccineCode) return left.vaccineCode.localeCompare(right.vaccineCode);
    return left.doseNumber - right.doseNumber;
  });
  const dob = startOfUtcDay(dateOfBirth);
  const now = startOfUtcDay(today);

  for (const item of ordered) {
    if (done.has(`${item.vaccineCode}:${item.doseNumber}`)) continue;
    const due = addUtcDays(dob, item.dueAgeDays);
    let status = 'upcoming';
    if (due.getTime() < now.getTime()) status = 'overdue';
    else if (due.getTime() === now.getTime()) status = 'due';
    return {
      vaccineCode: item.vaccineCode,
      vaccineName: item.vaccineName,
      doseNumber: item.doseNumber,
      dueAgeDays: item.dueAgeDays,
      dueDate: due.toISOString().slice(0, 10),
      status,
    };
  }
  return null;
}
