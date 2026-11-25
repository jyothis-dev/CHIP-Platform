import axios from 'axios';
import { AppError } from '../../shared/errors.js';

export async function pushHealthInformation({ url, body, http = axios }) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(400, 'DATA_PUSH_URL_INVALID', 'The health information push URL is not a URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new AppError(400, 'DATA_PUSH_URL_INVALID', 'The health information push URL must use HTTPS');
  }

  try {
    const response = await http.request({
      method: 'POST',
      url: parsed.toString(),
      data: body,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30_000,
      maxRedirects: 0,
      validateStatus: () => true,
    });
    return { status: response.status, body: response.data };
  } catch (err) {
    throw new AppError(502, 'DATA_PUSH_FAILED', 'The health information push failed', { cause: err });
  }
}
