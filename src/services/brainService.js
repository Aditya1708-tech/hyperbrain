const getGeminiApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env && process.env.VITE_GEMINI_API_KEY) {
    return process.env.VITE_GEMINI_API_KEY;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  return '';
};

const getGeminiUrl = () => {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getGeminiApiKey()}`;
};

async function callGemini(prompt) {
  try {
    const url = getGeminiUrl();
    const fetchPromise = fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request Timeout")), 20000)
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    if (!response.ok) {
      throw new Error(`Gemini status code ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return {
      parsed: JSON.parse(cleanJson),
      totalTokens: data.usageMetadata?.totalTokens || 850
    };
  } catch (error) {
    console.error("BrainService Error:", error);
    throw error;
  }
}

const brainService = {
  initializeModel() {
    console.log("BrainService: Gemini model configuration initialized.");
  },

  async generateTopicContent(subjectName, topicName) {
    try {
      const prompt = `Create comprehensive study content for the topic "${topicName}" in the course "${subjectName}". 
      REQUIRED STRUCTURE:
      1. "summary": Provide a detailed explanation (approx 400 words).
      2. "flashcards": Create 5-8 key concept cards.
      3. "quiz": You MUST generate AT LEAST 10 distinct Multiple Choice Questions (MCQs).
      4. "exam_questions": List 5-7 high-probability theory questions.
      Return strictly valid JSON: 
      {"summary": "...", "flashcards": [{"front": "Q", "back": "A"}], "quiz": [{"question": "Q?", "options": ["A","B","C","D"], "answer": "A", "explanation": "Why?"}], "exam_questions": ["Q1"]}`;
      
      const result = await callGemini(prompt);
      return result;
    } catch (error) {
      console.error("BrainService Error:", error);
      throw error;
    }
  },

  async generateNotes(subjectName, topicName) {
    try {
      return await this.generateTopicContent(subjectName, topicName);
    } catch (error) {
      console.error("BrainService Error:", error);
      throw error;
    }
  },

  async generateFlashcards(subjectName, topicName) {
    try {
      const prompt = `Create 5 high-quality conceptual flashcards for the topic "${topicName}" in "${subjectName}". 
      Return strictly a valid JSON array matching this exact schema:
      [{"front": "Question?", "back": "Detailed answer explanation."}]`;
      
      const result = await callGemini(prompt);
      return result;
    } catch (error) {
      console.error("BrainService Error:", error);
      throw error;
    }
  },

  async generateMockExam(subjectName, sectionName, questionType, count, marksPerQuestion, topicsList, customDifficulty) {
    try {
      const topicsText = topicsList && topicsList.length > 0
        ? topicsList.map(t => typeof t === 'string' ? t : t.title).join(", ")
        : "General core principles";

      let prompt = "";
      if (questionType === 'mcq') {
        prompt = `Generate exactly ${count} Multiple Choice Questions (MCQs) for the subject "${subjectName}" under the section "${sectionName}". Difficulty: ${customDifficulty || 'Medium'}. Focus topics: [${topicsText}]. Each question is worth ${marksPerQuestion} mark(s).
        Return strictly a valid JSON array matching this exact schema:
        [{"type": "mcq", "question": "Question text?", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "Option A", "marks": ${marksPerQuestion}, "explanation": "Brief explanation."}]`;
      } else {
        prompt = `Generate exactly ${count} theoretical/short-answer questions for the subject "${subjectName}" under the section "${sectionName}". Difficulty: ${customDifficulty || 'Medium'}. Focus topics: [${topicsText}]. Each question is worth ${marksPerQuestion} mark(s).
        Return strictly a valid JSON array matching this exact schema:
        [{"type": "theory", "question": "Question text?", "model_answer": "Model answer explanation.", "marks": ${marksPerQuestion}}]`;
      }

      const result = await callGemini(prompt);
      return result;
    } catch (error) {
      console.error("BrainService Error:", error);
      throw error;
    }
  },

  async sendMessage(userQuestion) {
    try {
      const systemInstruction = `
      You are a precise mobile tutor. 
      Rules:
      1. Answer in strictly under 60 words.
      2. Use bullet points for lists.
      3. Do not use conversational filler.
      4. Focus on the direct syllabus answer only.
      `;
      const prompt = `${systemInstruction}\n\nUser Question: ${userQuestion}`;
      
      const result = await callGemini(prompt);
      // For plain text, returns parsed text or parsed.stringValue if present
      return typeof result.parsed === 'string' ? result.parsed : JSON.stringify(result.parsed);
    } catch (error) {
      console.error("BrainService Error:", error);
      throw error;
    }
  }
};

brainService.initializeModel();

export default brainService;
