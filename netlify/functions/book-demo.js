const { Resend } = require('resend');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, email, company, role, message, type } = body;

  if (!name || !email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name and email are required' }) };
  }

  const isDemo = type === 'demo';
  const subject = isDemo
    ? `New Demo Request: ${name} — ${company || 'Unknown Company'}`
    : `New Partnership Enquiry: ${name} — ${company || 'Unknown Company'}`;

  const htmlContent = `
  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #080d10; color: #e8ede9; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #0e2a1e 0%, #0a1a28 100%); padding: 32px 36px 24px; border-bottom: 1px solid #1e3028;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:8px;height:8px;background:#2ecc8a;border-radius:50%;"></div>
        <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#2ecc8a;font-weight:600">KAYO PULSE</span>
      </div>
      <h1 style="font-size:22px;font-weight:700;color:#e8ede9;margin:0 0 4px;">${isDemo ? '🛰️ New Demo Request' : '🤝 New Partnership Enquiry'}</h1>
      <p style="color:#5a736a;font-size:13px;margin:0;">Received via kayopulse.com</p>
    </div>
    <div style="padding: 28px 36px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1e2a24;color:#5a736a;font-size:13px;width:120px;">Name</td>
          <td style="padding:10px 0;border-bottom:1px solid #1e2a24;color:#e8ede9;font-size:14px;font-weight:500;">${name}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1e2a24;color:#5a736a;font-size:13px;">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid #1e2a24;"><a href="mailto:${email}" style="color:#4fb3f6;font-size:14px;text-decoration:none;">${email}</a></td>
        </tr>
        ${company ? `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #1e2a24;color:#5a736a;font-size:13px;">Company</td>
          <td style="padding:10px 0;border-bottom:1px solid #1e2a24;color:#e8ede9;font-size:14px;">${company}</td>
        </tr>` : ''}
        ${role ? `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #1e2a24;color:#5a736a;font-size:13px;">Role</td>
          <td style="padding:10px 0;border-bottom:1px solid #1e2a24;color:#e8ede9;font-size:14px;">${role}</td>
        </tr>` : ''}
        ${message ? `<tr>
          <td style="padding:10px 0;color:#5a736a;font-size:13px;vertical-align:top;">Message</td>
          <td style="padding:10px 0;color:#e8ede9;font-size:14px;line-height:1.6;">${message}</td>
        </tr>` : ''}
      </table>
    </div>
    <div style="background:#0a1510;padding:16px 36px;border-top:1px solid #1e2a24;">
      <p style="color:#3d5c4a;font-size:11px;margin:0;">This notification was sent automatically by the Kayo Pulse platform. Reply directly to this email to respond to ${name}.</p>
    </div>
  </div>`;

  const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  const envKeyName = process.env.RESEND_API_KEY ? 'RESEND_API_KEY' : process.env.RESEND_KEY ? 'RESEND_KEY' : 'none';

  if (!RESEND_API_KEY) {
    console.log('DEMO SUBMISSION (no email API key set):', { name, email, company, role, message, type, envKeyName });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Submission received. Email delivery requires RESEND_API_KEY or RESEND_KEY environment variable.',
        data: { name, email, company }
      })
    };
  }

  const resend = new Resend(RESEND_API_KEY);

  try {
    // Send email to internal team
    const internalResult = await resend.emails.send({
      from: 'Kayo Pulse Platform <noreply@kayopulse.com>',
      to: 'information@kayopulse.com',
      replyTo: email,
      subject,
      html: htmlContent,
    });

    if (internalResult.error) {
      console.error('Resend API error (internal):', internalResult.error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Email delivery failed', details: internalResult.error })
      };
    }

    // Send confirmation email to client
    const confirmationHtml = `
  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #080d10; color: #e8ede9; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #0e2a1e 0%, #0a1a28 100%); padding: 32px 36px 24px; border-bottom: 1px solid #1e3028;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:8px;height:8px;background:#2ecc8a;border-radius:50%;"></div>
        <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#2ecc8a;font-weight:600">KAYO PULSE</span>
      </div>
      <h1 style="font-size:22px;font-weight:700;color:#e8ede9;margin:0 0 4px;">You're on the list!</h1>
      <p style="color:#5a736a;font-size:13px;margin:0;">We've received your request</p>
    </div>
    <div style="padding: 28px 36px;">
      <p style="color:#e8ede9;font-size:14px;line-height:1.8;margin:0 0 16px;">Hi ${name},</p>
      <p style="color:#b3bfbb;font-size:14px;line-height:1.8;margin:0 0 16px;">Thank you for your interest in Kayo Pulse! We've received your ${isDemo ? 'demo request' : 'partnership enquiry'} and appreciate you reaching out.</p>
      <p style="color:#b3bfbb;font-size:14px;line-height:1.8;margin:0 0 16px;">Our team will review your information and get back to you within 24 hours. In the meantime, if you have any questions, feel free to reply to this email.</p>
      <div style="background:#0a1510;padding:16px;border-left:3px solid #2ecc8a;margin:20px 0;border-radius:4px;">
        <p style="color:#2ecc8a;font-size:12px;margin:0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Request Details</p>
        <table style="width:100%;margin-top:12px;border-collapse:collapse;">
          <tr>
            <td style="color:#5a736a;font-size:12px;padding:6px 0;">Email:</td>
            <td style="color:#e8ede9;font-size:12px;padding:6px 0;font-weight:500;">${email}</td>
          </tr>
          ${company ? `<tr>
            <td style="color:#5a736a;font-size:12px;padding:6px 0;">Company:</td>
            <td style="color:#e8ede9;font-size:12px;padding:6px 0;font-weight:500;">${company}</td>
          </tr>` : ''}
          ${role ? `<tr>
            <td style="color:#5a736a;font-size:12px;padding:6px 0;">Role:</td>
            <td style="color:#e8ede9;font-size:12px;padding:6px 0;font-weight:500;">${role}</td>
          </tr>` : ''}
        </table>
      </div>
    </div>
    <div style="background:#0a1510;padding:16px 36px;border-top:1px solid #1e2a24;">
      <p style="color:#3d5c4a;font-size:11px;margin:0;">Best regards,<br/>The Kayo Pulse Team</p>
    </div>
  </div>`;

    const confirmResult = await resend.emails.send({
      from: 'Kayo Pulse Platform <noreply@kayopulse.com>',
      to: email,
      subject: `We've received your ${isDemo ? 'demo request' : 'partnership enquiry'}`,
      html: confirmationHtml,
    });

    if (confirmResult.error) {
      console.error('Resend API error (confirmation):', confirmResult.error);
      console.warn('Confirmation email failed but internal email succeeded');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: internalResult.data.id })
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
