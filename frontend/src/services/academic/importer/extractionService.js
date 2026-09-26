import { generateAI } from '../aiService';

/**
 * =========================================================================
 * HYPERBRAIN INGESTION SYSTEM - AI EXTRACTION SERVICE (Phase 1.3)
 * =========================================================================
 * Orchestrates raw text extraction using Gemini AI to construct valid
 * academic hierarchical schemas without hallucinations.
 * =========================================================================
 */

export const extractionService = {
  
  /**
   * Process raw text and extract structured syllabus candidate record
   * @param {string} rawText - Unstructured document text
   * @param {string} sourceName - Source description (e.g. "UGC Physics Syllabus 2026")
   * @returns {Promise<Object>} Candidate program payload
   */
  async extractSyllabus(rawText, sourceName) {
    console.log("Starting syllabus extraction for source:", sourceName);
    
    if (!rawText || rawText.trim().length < 50) {
      throw new Error("Invalid raw text. Document content is too short to parse a structured syllabus.");
    }

    const prompt = `You are the core HyperBrain Academic Ingestion AI.
    Your task is to parse, extract, and structure a standard curriculum hierarchy from this raw text syllabus:
    
    TEXT SOURCE: "${sourceName}"
    CONTENT:
    ${rawText.slice(0, 15000)} // Bounded to prevent token limits
    
    STRICT RULES:
    1. Extract the program name, description, duration, category, and eligibility parameters.
    2. Map semesters or levels cleanly (e.g., "Semester 1", "Semester 2").
    3. Under each semester, extract the official subject names.
    4. For each subject, extract the topics/chapters exactly as they appear in the source text.
    5. Maintain the exact sequence from the text.
    6. Never generate topics or chapters that do not exist in the raw text. Do not write placeholders.
    7. Return STRICTLY a valid JSON object matching this schema:
    {
      "program": {
        "displayName": "Full Human Readable Program Name",
        "slug": "url-friendly-slug-e.g-btech-cse",
        "description": "Program overview description.",
        "category": "Undergraduate Degrees" | "Professional Programs" | "School Education" | "Competitive Exams" | "Technology & Skills",
        "duration": "Duration length",
        "eligibility": "Qualification details",
        "source": "${sourceName}"
      },
      "semesters": {
        "Semester 1": [
          {
            "displayName": "Subject Name",
            "slug": "subject-slug",
            "topics": [
              {
                "chapterNumber": 1,
                "displayName": "Topic Name",
                "slug": "topic-slug",
                "description": "Topic brief description.",
                "difficulty": "Easy" | "Medium" | "Hard",
                "summary": "Core notes summary details."
              }
            ]
          }
        ]
      }
    }
    
    Do NOT include markdown block wraps in your response other than valid JSON.`;

    try {
      const response = await generateAI(prompt, 'notes');
      let parsed = {};
      
      if (typeof response === 'string') {
        const cleanJson = response.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanJson);
      } else {
        parsed = response;
      }

      // Basic Normalization
      if (!parsed.program || !parsed.program.displayName) {
        throw new Error("AI response did not contain required Program metadata.");
      }

      return parsed;
    } catch (err) {
      console.error("AI Syllabus Extraction failed:", err);
      throw new Error(`Extraction error: ${err.message}`);
    }
  }
};
