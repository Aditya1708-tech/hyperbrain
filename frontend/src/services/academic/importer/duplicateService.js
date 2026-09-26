import { firestoreRepository } from '../../../repositories/academic/firestoreRepository';

/**
 * =========================================================================
 * HYPERBRAIN INGESTION SYSTEM - DUPLICATE SERVICE (Phase 1.3)
 * =========================================================================
 * Scans the Firestore repository for pre-existing records to warn or
 * trigger conflict resolution pipelines.
 * =========================================================================
 */

export const duplicateService = {
  
  /**
   * Scan for duplicate Program records
   * @param {string} slug - Unique lowercase slug of the incoming program
   * @returns {Promise<Object>} Duplicate audit result
   */
  async detectProgramDuplicate(slug) {
    const searchSlug = slug.toLowerCase();
    const mockId = `prog_${searchSlug.replace(/\s+/g, '_')}`;
    
    // Check direct matching ID in Firestore
    const existing = await firestoreRepository.findById('programs', mockId);
    
    if (existing) {
      return {
        isDuplicate: true,
        type: 'Exact ID match',
        existingProgramId: existing.id,
        existingVersion: existing.version || 1,
        message: `A program with the slug/ID "${existing.id}" (Version ${existing.version}) is already registered.`
      };
    }

    // Secondary scan querying by slug key
    const list = await firestoreRepository.queryDocs('programs', [
      { field: 'slug', op: '==', value: searchSlug }
    ], 1);

    if (list.length > 0) {
      return {
        isDuplicate: true,
        type: 'Slug key match',
        existingProgramId: list[0].id,
        existingVersion: list[0].version || 1,
        message: `A program matching the slug "${searchSlug}" already exists under ID: ${list[0].id}.`
      };
    }

    return {
      isDuplicate: false,
      message: "No duplicates detected."
    };
  }
};
