import { firestoreRepository } from '../../repositories/academic/firestoreRepository';

/**
 * =========================================================================
 * HYPERBRAIN ACADEMIC SERVICE (Phase 1.1)
 * =========================================================================
 * Handles validation, business defaults, and lifecycle management for
 * academic syllabus documents (Programs, Semesters, Subjects, Units, Topics).
 * =========================================================================
 */

export const academicService = {
  
  // ==========================================
  // PROGRAM CRUD OPERATIONS
  // ==========================================

  /**
   * Create an Academic Program
   * @param {Object} data - Program details matching schema typings
   * @returns {Promise<string>} Created Program document ID
   */
  async createProgram(data) {
    if (!data.displayName || !data.slug) {
      throw new Error("displayName and slug are required fields for creating programs.");
    }
    const id = data.id || `prog_${data.slug.replace(/\s+/g, '_').toLowerCase()}`;
    const timestamp = new Date().toISOString();
    
    const programDoc = {
      id,
      displayName: data.displayName,
      slug: data.slug.toLowerCase(),
      description: data.description || '',
      version: data.version || 1,
      source: data.source || 'UGC',
      category: data.category || 'Undergraduate Degrees',
      duration: data.duration || 'Self-paced',
      eligibility: data.eligibility || 'Any Student',
      status: data.status || 'draft',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastUpdated: timestamp
    };

    return await firestoreRepository.save('programs', id, programDoc);
  },

  /**
   * Get Program by ID
   * @param {string} programId 
   * @returns {Promise<Object|null>}
   */
  async getProgram(programId) {
    return await firestoreRepository.findById('programs', programId);
  },

  /**
   * Update Program properties
   * @param {string} programId 
   * @param {Object} updateData 
   */
  async updateProgram(programId, updateData) {
    const data = {
      ...updateData,
      lastUpdated: new Date().toISOString()
    };
    return await firestoreRepository.update('programs', programId, data);
  },

  /**
   * Delete Program document
   * @param {string} programId 
   */
  async deleteProgram(programId) {
    return await firestoreRepository.delete('programs', programId);
  },

  // ==========================================
  // SEMESTER CRUD OPERATIONS
  // ==========================================

  /**
   * Create a Semester/Level
   * @param {Object} data 
   */
  async createSemester(data) {
    if (!data.programId || !data.displayName || !data.slug) {
      throw new Error("programId, displayName, and slug are required for Semesters.");
    }
    const id = data.id || `sem_${data.programId}_${data.slug.replace(/\s+/g, '_').toLowerCase()}`;
    const timestamp = new Date().toISOString();

    const semesterDoc = {
      id,
      programId: data.programId,
      slug: data.slug.toLowerCase(),
      displayName: data.displayName,
      description: data.description || '',
      levelNumber: data.levelNumber || 1,
      version: data.version || 1,
      source: data.source || 'UGC',
      status: data.status || 'draft',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    return await firestoreRepository.save('semesters', id, semesterDoc);
  },

  /**
   * Get Semester details
   * @param {string} semesterId 
   */
  async getSemester(semesterId) {
    return await firestoreRepository.findById('semesters', semesterId);
  },

  // ==========================================
  // SUBJECT CRUD OPERATIONS
  // ==========================================

  /**
   * Create a Subject
   * @param {Object} data 
   */
  async createSubject(data) {
    if (!data.programId || !data.semesterId || !data.displayName || !data.slug) {
      throw new Error("programId, semesterId, displayName, and slug are required for Subjects.");
    }
    const id = data.id || `sub_${data.semesterId}_${data.slug.replace(/\s+/g, '_').toLowerCase()}`;
    const timestamp = new Date().toISOString();

    const subjectDoc = {
      id,
      programId: data.programId,
      semesterId: data.semesterId,
      slug: data.slug.toLowerCase(),
      displayName: data.displayName,
      description: data.description || '',
      version: data.version || 1,
      source: data.source || 'UGC',
      status: data.status || 'draft',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    return await firestoreRepository.save('subjects', id, subjectDoc);
  },

  /**
   * Get Subject details
   * @param {string} subjectId 
   */
  async getSubject(subjectId) {
    return await firestoreRepository.findById('subjects', subjectId);
  },

  // ==========================================
  // UNIT CRUD OPERATIONS
  // ==========================================

  /**
   * Create a Unit
   * @param {Object} data 
   */
  async createUnit(data) {
    if (!data.subjectId || !data.displayName || !data.slug) {
      throw new Error("subjectId, displayName, and slug are required for Units.");
    }
    const id = data.id || `unit_${data.subjectId}_${data.slug.replace(/\s+/g, '_').toLowerCase()}`;
    const timestamp = new Date().toISOString();

    const unitDoc = {
      id,
      subjectId: data.subjectId,
      slug: data.slug.toLowerCase(),
      displayName: data.displayName,
      description: data.description || '',
      unitNumber: data.unitNumber || 1,
      version: data.version || 1,
      source: data.source || 'UGC',
      status: data.status || 'draft',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    return await firestoreRepository.save('units', id, unitDoc);
  },

  // ==========================================
  // TOPIC CRUD OPERATIONS
  // ==========================================

  /**
   * Create a Topic/Chapter
   * @param {Object} data 
   */
  async createTopic(data) {
    if (!data.subjectId || !data.unitId || !data.displayName || !data.slug) {
      throw new Error("subjectId, unitId, displayName, and slug are required for Topics.");
    }
    const id = data.id || `top_${data.unitId}_${data.slug.replace(/\s+/g, '_').toLowerCase()}`;
    const timestamp = new Date().toISOString();

    const topicDoc = {
      id,
      subjectId: data.subjectId,
      unitId: data.unitId,
      slug: data.slug.toLowerCase(),
      displayName: data.displayName,
      description: data.description || '',
      summary: data.summary || '',
      chapterNumber: data.chapterNumber || 1,
      difficulty: data.difficulty || 'Medium',
      version: data.version || 1,
      source: data.source || 'UGC',
      status: data.status || 'draft',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    return await firestoreRepository.save('topics', id, topicDoc);
  },

  // ==========================================
  // QUERY / SEARCH PATTERNS
  // ==========================================

  /**
   * Search Academic Programs with fast local lookup logic
   * @param {string} queryText - Sub-string query to match
   * @param {string} [categoryFilter=''] - Optional stream filter
   * @returns {Promise<Array<Object>>}
   */
  async searchPrograms(queryText, categoryFilter = '') {
    const conditions = [];
    if (categoryFilter) {
      conditions.push({ field: 'category', op: '==', value: categoryFilter });
    }
    // Fetch top 100 matching category or general programs for high-speed sub-string matching
    const programsList = await firestoreRepository.queryDocs('programs', conditions, 100);
    
    if (!queryText.trim()) {
      return programsList;
    }

    const q = queryText.toLowerCase();
    return programsList.filter(prog => 
      prog.displayName.toLowerCase().includes(q) || 
      prog.slug.toLowerCase().includes(q)
    );
  }
};
