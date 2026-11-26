import axios from 'axios';
import { AppError } from '../../shared/errors.js';
import { getGatewayToken } from './session.js';

/**
 * The HIP posts to the HIU's dataPushUrl directly, with the gateway access
 * token as the bearer (hiecm.callback.m2-on-data-notification).
 */
export async function pushHealthInformation({ url, body, http = axios, token }) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(400, 'DATA_PUSH_URL_INVALID', 'The health information push URL is not a URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new AppError(400, 'DATA_PUSH_URL_INVALID', 'The health information push URL must use HTTPS');
  }

  const bearer = token ?? (await getGatewayToken({ http })).accessToken;
  try {
    const response = await http.request({
      method: 'POST',
      url: parsed.toString(),
      data: body,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
      timeout: 30_000,
      maxRedirects: 0,
      validateStatus: () => true,
    });
    return { status: response.status, body: response.data };
  } catch (err) {
    throw new AppError(502, 'DATA_PUSH_FAILED', 'The health information push failed', { cause: err });
  }
}
