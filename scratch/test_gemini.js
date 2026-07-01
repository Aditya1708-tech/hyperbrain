import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

// Read API key from .env manually since dotenv might not be installed
const envFile = fs.readFileSync(".env", "utf8");
const match = envFile.match(/VITE_GEMINI_API_KEY=(.*)/);
const key = match ? match[1].trim() : null;

console.log("Testing with key:", key);

if (!key) {
  console.error("VITE_GEMINI_API_KEY not found in .env");
  process.exit(1);
}

try {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent("Say hello");
  console.log("Success! Response:", result.response.text());
} catch (error) {
  console.error("Gemini call failed:", error);
}
