import { logger } from '../../shared/logger.js';

function deliver(channel, job) {
  logger.info(
    {
      component: 'worker',
      channel,
      jobId: job.id,
      recipient: job.recipient,
      body: job.body,
    },
    'notification delivered',
  );
}

export function sendSms(job) {
  deliver('SMS', job);
}

export function sendWhatsApp(job) {
  deliver('WHATSAPP', job);
}

export function sendEmail(job) {
  deliver('EMAIL', job);
}

export const adapters = {
  SMS: sendSms,
  WHATSAPP: sendWhatsApp,
  EMAIL: sendEmail,
};
