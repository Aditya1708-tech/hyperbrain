import { api } from './api/apiClient';

export const examService = {
  /**
   * Grade a student's theoretical answer using AI
   */
  async gradeTheoryAnswer(question, modelAnswer, studentAnswer, maxMarks = 5) {
    const prompt = `Grade this student answer for an academic exam question:
Question: ${question}
Model / Key Answer: ${modelAnswer || 'Comprehensive explanation'}
Student Answer: ${studentAnswer}
Maximum Marks: ${maxMarks}

Evaluate the student answer objectively.
Output strictly a JSON object:
{
  "score": <number between 0 and ${maxMarks}>,
  "feedback": "<2-sentence critique on what was correct and what was missing or incorrect>"
}
Return raw JSON only.`;

    try {
      const res = await api.post('/api/ai/tutor', {
        question: prompt,
        difficulty: 'Academic Examiner'
      });

      if (res && res.text) {
        const clean = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        return {
          score: typeof parsed.score === 'number' ? parsed.score : Math.round(maxMarks * 0.7),
          feedback: parsed.feedback || 'Good attempt covering core points.'
        };
      }
    } catch (e) {
      console.warn('[ExamService] AI grading fallback:', e.message);
    }

    // Heuristic fallback if AI service is offline
    const lengthRatio = Math.min(1, studentAnswer.trim().length / 80);
    const score = Math.round(lengthRatio * maxMarks);
    return {
      score,
      feedback: score > 2 ? 'Answer addresses the question concepts.' : 'Answer is too brief; please provide more details and key concepts.'
    };
  }
};

export default examService;
