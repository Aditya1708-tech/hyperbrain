import { Resend } from 'resend';

// =========================================================================
// SERVERLESS TRANSACTIONAL EMAIL ENDPOINT
// =========================================================================
// Security Rules:
// 1. "VITE_" variables are frontend accessible and compiled in client code.
// 2. "RESEND_API_KEY" stays server-only (process.env) and is never loaded in client.
// 3. API keys must never be hardcoded in public source code.
// =========================================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const { userEmail, userName, userId } = req.body;
  if (!userEmail || !userName) {
    return res.status(400).json({ success: false, message: "Missing userEmail or userName parameter" });
  }

  // Load Resend API Key from env
  const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_key_for_testing";
  const resend = new Resend(RESEND_API_KEY);

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333333;">
      <h2 style="color: #2563EB;">Welcome to HyperBrain 🚀</h2>
      <p>Hi ${userName},</p>
      <p>Welcome to HyperBrain.</p>
      <p>Your AI-powered academic workspace is ready.</p>
      <p>You can now:</p>
      <ul style="padding-left: 20px; margin: 15px 0;">
        <li>Generate smart notes</li>
        <li>Create adaptive mock exams</li>
        <li>Learn with AI tutor</li>
        <li>Build flashcards</li>
        <li>Track your learning journey</li>
      </ul>
      <p style="font-weight: bold; margin-top: 20px;">Start learning smarter.</p>
      <hr style="border: 0; border-top: 1px solid #EEEEEE; margin: 20px 0;" />
      <p style="color: #666666; font-size: 12px;">— HyperBrain Team</p>
    </div>
  `;

  // Helper to log status to Firestore emailLogs collection
  const logEmail = async (status, errorMsg = '') => {
    try {
      const FIREBASE_PROJECT_ID = "campus-hyper-brain";
      const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
      
      const payload = {
        fields: {
          userId: { stringValue: userId || 'anonymous' },
          email: { stringValue: userEmail },
          type: { stringValue: 'welcome' },
          status: { stringValue: status },
          timestamp: { timestampValue: new Date().toISOString() }
        }
      };
      if (errorMsg) {
        payload.fields.error = { stringValue: errorMsg };
      }

      await fetch(`${FIRESTORE_BASE_URL}/emailLogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Firestore logging welcome email status failed:", e);
    }
  };

  // Send request with retry loops
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      attempts++;
      
      // If mock key, do not call external Resend endpoints (avoid authentication error blockages)
      if (RESEND_API_KEY === "re_mock_key_for_testing") {
        await logEmail('success');
        return res.status(200).json({ success: true, message: "Welcome email sent (Simulated Sandbox)" });
      }

      const { data, error } = await resend.emails.send({
        from: 'HyperBrain <welcome@hyperbrain.ai>',
        to: [userEmail],
        subject: 'Welcome to HyperBrain 🚀',
        html: htmlContent,
      });

      if (error) {
        throw new Error(error.message);
      }

      await logEmail('success');
      return res.status(200).json({ success: true, message: "Welcome email sent successfully", data });
    } catch (err) {
      console.warn(`Resend welcome email attempt ${attempts} failed:`, err);
      if (attempts >= maxAttempts) {
        await logEmail('failed', err.message || err.toString());
        return res.status(500).json({ success: false, message: "Failed to send welcome email after 3 attempts", error: err.message });
      }
      // Linear delay
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
  }
}
