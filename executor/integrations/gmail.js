const nodemailer = require('nodemailer');

async function send(item) {
  const {
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN,
    GMAIL_FROM = 'hello@bridgeworksconsulting.com',
  } = process.env;

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error(
      'Gmail credentials missing. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN in ~/.agent_env'
    );
  }

  const meta = item.metadata || {};
  if (!meta.toEmail) {
    throw new Error(`EMAIL_OUTREACH item "${item.title}" has no metadata.toEmail`);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: GMAIL_FROM,
      clientId: GMAIL_CLIENT_ID,
      clientSecret: GMAIL_CLIENT_SECRET,
      refreshToken: GMAIL_REFRESH_TOKEN,
    },
  });

  const subject = meta.subject || item.title;
  const info = await transporter.sendMail({
    from: `Scott Lasswell <${GMAIL_FROM}>`,
    to: meta.toEmail,
    subject,
    text: item.body,
  });

  console.log(`[gmail] Sent to ${meta.toEmail} — messageId: ${info.messageId}`);

  // Store send metadata back on item for dashboard visibility
  item.metadata = {
    ...meta,
    gmailMessageId: info.messageId,
    sentAt: new Date().toISOString(),
    sentTo: meta.toEmail,
  };
}

module.exports = { send };
