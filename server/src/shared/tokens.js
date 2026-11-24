import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken({ userId }) {
  return jwt.sign({ sub: userId }, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}
