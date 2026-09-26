import express from 'express';
import { Resend } from 'resend';

const router = express.Router();

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes('your_key')) {
    return null;
  }
  return new Resend(apiKey);
};

// POST /api/email/send or /api/send-email
router.post('/send', async (req, res) => {
  try {
    const { to, subject, html, text, type, name, link } = req.body;

    if (!to) {
      return res.status(400).json({ success: false, message: 'Recipient email is required' });
    }

    const resend = getResendClient();

    let finalSubject = subject || 'Notification from HyperBrain';
    let finalHtml = html || text || '<p>Hello from HyperBrain!</p>';

    if (type === 'welcome') {
      finalSubject = finalSubject || 'Welcome to HyperBrain!';
      finalHtml = `<h1>Welcome to HyperBrain, ${name || 'Learner'}!</h1><p>We are thrilled to accompany you on your academic journey. Explore Smart Notes, Flashcards, and Adaptive Mock Exams now.</p>`;
    } else if (type === 'reset-password') {
      finalSubject = 'Reset Your HyperBrain Password';
      finalHtml = `<h1>Password Reset</h1><p>Click <a href="${link || '#'}">here</a> to reset your password.</p>`;
    }

    if (resend) {
      const emailResponse = await resend.emails.send({
        from: 'HyperBrain <onboarding@resend.dev>',
        to: [to],
        subject: finalSubject,
        html: finalHtml
      });
      return res.json({ success: true, emailResponse });
    } else {
      console.log(`[Email Simulator] To: ${to}, Subject: ${finalSubject}`);
      return res.json({ success: true, isSimulated: true, message: 'Email recorded in development mode' });
    }
  } catch (error) {
    console.error('Email sending error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
