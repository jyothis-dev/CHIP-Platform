const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export function ttlToMs(ttl) {
  const match = /^(\d+)([smhd])$/.exec(String(ttl).trim());
  if (!match) {
    throw new Error(`Invalid TTL: ${ttl}`);
  }
  return Number(match[1]) * UNITS[match[2]];
}
