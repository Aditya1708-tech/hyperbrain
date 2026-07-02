import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const match = envFile.match(/RESEND_API_KEY=(.*)/);
const key = match ? match[1].trim() : null;

console.log("Testing Resend with key:", key);

if (!key) {
  console.error("RESEND_API_KEY not found in .env");
  process.exit(1);
}

try {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: 'delivered@resend.dev',
      subject: 'Resend Verification Test',
      html: '<p>Standard verification test content.</p>'
    })
  });

  const data = await res.json();
  console.log("Response status:", res.status);
  console.log("Response data:", JSON.stringify(data, null, 2));
} catch (error) {
  console.error("Resend call failed:", error);
}
