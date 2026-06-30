import { Resend } from 'resend';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const { email, firstName } = req.body;
    if (!email || !firstName) {
      return res.status(400).json({
        success: false,
        message: "Missing email or firstName parameters"
      });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      return res.status(200).json({
        success: true,
        message: "Email sending skipped: mock key initialized"
      });
    }

    const resend = new Resend(RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: 'HyperBrain <welcome@campus-hyper-brain.vercel.app>',
      to: [email],
      subject: 'Welcome to HyperBrain!',
      html: `<h1>Welcome, ${firstName}!</h1><p>We are excited to help you prepare for exams, generate custom flashcards, study notes, and master your courses with your personal AI syllabus tutor.</p>`
    });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
      data
    });
  } catch (error) {
    console.error("Welcome email failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
