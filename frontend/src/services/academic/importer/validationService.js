/**
 * =========================================================================
 * HYPERBRAIN INGESTION SYSTEM - VALIDATION SERVICE (Phase 1.3)
 * =========================================================================
 * Performs structural validation audits on parsed syllabus candidates,
 * generating list of warnings, errors, and an overall confidence score.
 * =========================================================================
 */

export const validationService = {
  
  /**
   * Audit syllabus candidate record
   * @param {Object} candidate - Output from extractionService
   * @returns {Object} Audit report detailing confidence and errors
   */
  validateSyllabus(candidate) {
    const report = {
      errors: [],
      warnings: [],
      confidenceScore: 100, // Starts at 100%
      canAutoApprove: false,
      statistics: {
        semestersCount: 0,
        subjectsCount: 0,
        topicsCount: 0
      }
    };

    if (!candidate) {
      report.errors.push("Empty candidate record provided.");
      report.confidenceScore = 0;
      return report;
    }

    const { program, semesters } = candidate;

    // 1. Program validations
    if (!program) {
      report.errors.push("Missing Program metadata.");
      report.confidenceScore -= 50;
    } else {
      if (!program.displayName) {
        report.errors.push("Program displayName is missing.");
        report.confidenceScore -= 15;
      }
      if (!program.slug) {
        report.warnings.push("Program slug was auto-generated due to missing slug input.");
        report.confidenceScore -= 5;
      }
      if (!program.category) {
        report.warnings.push("Program category not classified; defaulted to undergraduate.");
        report.confidenceScore -= 10;
      }
    }

    // 2. Semesters & subjects validations
    if (!semesters || Object.keys(semesters).length === 0) {
      report.errors.push("Candidate contains no semester semesters mapping.");
      report.confidenceScore -= 40;
    } else {
      const semesterNames = Object.keys(semesters);
      report.statistics.semestersCount = semesterNames.length;

      const subjectSlugs = new Set();
      
      semesterNames.forEach(semName => {
        const subjects = semesters[semName];
        if (!Array.isArray(subjects) || subjects.length === 0) {
          report.warnings.push(`Semester "${semName}" contains no subject items.`);
          report.confidenceScore -= 10;
          return;
        }

        report.statistics.subjectsCount += subjects.length;

        subjects.forEach(sub => {
          if (!sub.displayName) {
            report.errors.push(`Subject in "${semName}" lacks displayName.`);
            report.confidenceScore -= 15;
          }

          if (sub.slug) {
            if (subjectSlugs.has(sub.slug)) {
              report.errors.push(`Duplicate subject slug detected: "${sub.slug}" in "${semName}".`);
              report.confidenceScore -= 20;
            } else {
              subjectSlugs.add(sub.slug);
            }
          }

          // Topics validations
          if (!sub.topics || !Array.isArray(sub.topics) || sub.topics.length === 0) {
            report.warnings.push(`Subject "${sub.displayName}" contains no topics list.`);
            report.confidenceScore -= 10;
          } else {
            report.statistics.topicsCount += sub.topics.length;
            let lastChapterNum = 0;
            const topicSlugs = new Set();

            sub.topics.forEach((top, idx) => {
              if (!top.displayName) {
                report.errors.push(`Topic at index ${idx} in Subject "${sub.displayName}" lacks displayName.`);
                report.confidenceScore -= 10;
              }

              if (top.slug) {
                const topicKey = `${sub.slug}_${top.slug}`;
                if (topicSlugs.has(topicKey)) {
                  report.warnings.push(`Duplicate topic slug detected: "${top.slug}" under Subject "${sub.displayName}".`);
                  report.confidenceScore -= 5;
                } else {
                  topicSlugs.add(topicKey);
                }
              }

              // Check ordering
              if (top.chapterNumber) {
                if (top.chapterNumber !== lastChapterNum + 1) {
                  report.warnings.push(`Broken sequence ordering in Subject "${sub.displayName}": Chapter ${top.chapterNumber} follows ${lastChapterNum}.`);
                  report.confidenceScore -= 5;
                }
                lastChapterNum = top.chapterNumber;
              } else {
                report.warnings.push(`Topic "${top.displayName}" lacks chapterNumber mapping.`);
                report.confidenceScore -= 5;
              }
            });
          }
        });
      });
    }

    // Floor confidence score at 0
    report.confidenceScore = Math.max(0, report.confidenceScore);
    
    // Auto Approve conditions
    if (report.confidenceScore >= 90 && report.errors.length === 0) {
      report.canAutoApprove = true;
    }

    return report;
  }
};
