import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const match = envFile.match(/VITE_GROQ_API_KEY=(.*)/);
const key = match ? match[1].trim() : null;

console.log("Testing Groq with key:", key);

if (!key) {
  console.error("VITE_GROQ_API_KEY not found in .env");
  process.exit(1);
}

try {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: "Say hello" }]
    })
  });

  const data = await res.json();
  console.log("Response status:", res.status);
  console.log("Response data:", JSON.stringify(data, null, 2));
} catch (error) {
  console.error("Groq call failed:", error);
}
