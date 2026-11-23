export async function enqueueMessages(db, messages) {
  const data = messages.filter((message) => message.recipient && message.body);
  if (data.length === 0) return;
  await db.notificationJob.createMany({
    data: data.map((message) => ({
      channel: message.channel,
      recipient: message.recipient,
      body: message.body,
      status: 'PENDING',
    })),
  });
}

export function messagesForContact(contact, body) {
  const messages = [];
  if (contact?.email) messages.push({ channel: 'EMAIL', recipient: contact.email, body });
  if (contact?.phone) {
    messages.push({ channel: 'SMS', recipient: contact.phone, body });
    messages.push({ channel: 'WHATSAPP', recipient: contact.phone, body });
  }
  return messages;
}
