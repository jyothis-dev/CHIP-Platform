import bcrypt from 'bcrypt';

const ROUNDS = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(passwordHash, password) {
  return bcrypt.compare(password, passwordHash);
}
