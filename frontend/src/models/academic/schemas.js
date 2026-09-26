/**
 * =========================================================================
 * HYPERBRAIN ACADEMIC REPOSITORY SCHEMAS (Phase 1.1)
 * =========================================================================
 * This file serves as the single source of truth for Firestore schema
 * definitions used across the Academic Repository.
 * =========================================================================
 */

/**
 * @typedef {Object} AcademicMetadata
 * @property {string} id - Unique document identifier.
 * @property {string} slug - Unique URL-friendly slug (e.g., "btech-cse", "semester-3").
 * @property {string} displayName - Human-readable name.
 * @property {string} description - Comprehensive description.
 * @property {number} version - Schema/curriculum revision version.
 * @property {string} source - Source origin authority (e.g., "AICTE", "UGC", "CBSE", "ICAI").
 * @property {string} lastUpdated - ISO timestamp of last syllabus revision.
 * @property {string} createdAt - Document creation ISO timestamp.
 * @property {string} updatedAt - Document modification ISO timestamp.
 * @property {'draft'|'published'|'archived'} status - Publishing state status.
 */

/**
 * @typedef {Object} Program
 * @property {string} id - Unique document identifier.
 * @property {string} slug - Unique URL-friendly slug (e.g., "bca").
 * @property {string} displayName - Human-readable name (e.g., "Bachelor of Computer Applications").
 * @property {string} description - Detailed description.
 * @property {number} version - Schema/curriculum revision version.
 * @property {string} source - Source origin authority (e.g., "UGC").
 * @property {string} lastUpdated - ISO timestamp of last syllabus revision.
 * @property {string} createdAt - Document creation ISO timestamp.
 * @property {string} updatedAt - Document modification ISO timestamp.
 * @property {'draft'|'published'|'archived'} status - Publishing state status.
 * @property {'Undergraduate Degrees'|'Professional Programs'|'School Education'|'Competitive Exams'|'Technology & Skills'|'Business'} category - Stream categorization level.
 * @property {string} duration - Estimated program duration (e.g. "3 Years").
 * @property {string} eligibility - Entrance prerequisites qualification.
 */

/**
 * @typedef {Object} Semester
 * @property {string} id - Unique document identifier.
 * @property {string} programId - Reference to parent Program document ID.
 * @property {string} slug - URL-friendly slug.
 * @property {string} displayName - Name of term (e.g. "Semester 3" or "Intermediate Phase").
 * @property {string} description - Detailed description.
 * @property {number} levelNumber - Order representation index (1, 2, 3, etc.).
 * @property {number} version - Schema/curriculum revision version.
 * @property {string} source - Source origin authority.
 * @property {string} lastUpdated - ISO timestamp.
 * @property {string} createdAt - Document creation ISO timestamp.
 * @property {string} updatedAt - Document modification ISO timestamp.
 * @property {'draft'|'published'|'archived'} status - Publishing state status.
 */

/**
 * @typedef {Object} Subject
 * @property {string} id - Unique document identifier.
 * @property {string} programId - Reference to parent Program document ID.
 * @property {string} semesterId - Reference to parent Semester/Level document ID.
 * @property {string} slug - URL-friendly slug.
 * @property {string} displayName - Name of subject (e.g., "Operating Systems").
 * @property {string} description - Course description.
 * @property {number} version - Schema/curriculum revision version.
 * @property {string} source - Source origin authority.
 * @property {string} lastUpdated - ISO timestamp.
 * @property {string} createdAt - Document creation ISO timestamp.
 * @property {string} updatedAt - Document modification ISO timestamp.
 * @property {'draft'|'published'|'archived'} status - Publishing state status.
 */

/**
 * @typedef {Object} Unit
 * @property {string} id - Unique document identifier.
 * @property {string} subjectId - Reference to parent Subject document ID.
 * @property {string} slug - URL-friendly slug.
 * @property {string} displayName - Name of unit (e.g., "Unit 1: Process Management").
 * @property {string} description - Detailed unit summary.
 * @property {number} unitNumber - Sequence order index.
 * @property {number} version - Schema/curriculum revision version.
 * @property {string} source - Source origin authority.
 * @property {string} lastUpdated - ISO timestamp.
 * @property {string} createdAt - Document creation ISO timestamp.
 * @property {string} updatedAt - Document modification ISO timestamp.
 * @property {'draft'|'published'|'archived'} status - Publishing state status.
 */

/**
 * @typedef {Object} Topic
 * @property {string} id - Unique document identifier.
 * @property {string} subjectId - Reference to parent Subject document ID.
 * @property {string} unitId - Reference to parent Unit document ID.
 * @property {string} slug - URL-friendly slug.
 * @property {string} displayName - Name of topic/chapter (e.g. "FCFS CPU Scheduling").
 * @property {string} description - Brief summary.
 * @property {string} summary - Core notes summary context.
 * @property {number} chapterNumber - Sequence order index.
 * @property {number} version - Schema/curriculum revision version.
 * @property {string} source - Source origin authority.
 * @property {string} lastUpdated - ISO timestamp.
 * @property {string} createdAt - Document creation ISO timestamp.
 * @property {string} updatedAt - Document modification ISO timestamp.
 * @property {'draft'|'published'|'archived'} status - Publishing state status.
 * @property {'Easy'|'Medium'|'Hard'} difficulty - Conceptual challenge classification.
 */

export const AcademicStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};
