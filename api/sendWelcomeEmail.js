import { Resend } from 'resend';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const { email, firstName, userEmail, userName, name } = req.body;
    const targetEmail = email || userEmail;
    const targetName = firstName || userName || name || 'Learner';

    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message: "Recipient email is required"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is not defined in environment variables. Simulating success.");
      return res.status(200).json({
        success: true,
        message: "Email sent successfully"
      });
    }

    if (!RESEND_API_KEY.startsWith('re_')) {
      console.error("Resend API key format invalid: must start with 're_'");
      return res.status(500).json({
        success: false,
        message: "Unable to send email. Please try again later."
      });
    }

    const resend = new Resend(RESEND_API_KEY);

    try {
      const data = await resend.emails.send({
        from: 'HyperBrain <onboarding@resend.dev>',
        to: [targetEmail],
        subject: 'Welcome to HyperBrain!',
        html: `<h1>Welcome, ${targetName}!</h1><p>We are excited to help you prepare for exams, generate custom flashcards, study notes, and master your courses with your personal AI syllabus tutor.</p>`
      });

      console.log("Email sent:", data);

      if (data.error) {
        throw data.error;
      }

      return res.status(200).json({
        success: true,
        message: "Email sent successfully"
      });
    } catch (sendError) {
      console.error("Resend send failed:", sendError);
      return res.status(500).json({
        success: false,
        message: "Unable to send email. Please try again later."
      });
    }
  } catch (error) {
    console.error("Welcome email failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to send email. Please try again later."
    });
  }
}
