import { firestoreRepository } from '../../../repositories/academic/firestoreRepository';
import { academicService } from '../academicService';

/**
 * =========================================================================
 * HYPERBRAIN INGESTION SYSTEM - REPOSITORY WRITER (Phase 1.3)
 * =========================================================================
 * Safely writes ingestion candidates to Firestore based on conflict
 * resolution strategies (merge, replace, or newVersion).
 * =========================================================================
 */

export const repositoryWriter = {
  
  /**
   * Write syllabus candidate to Academic Repository
   * @param {Object} candidate - Normal structured syllabus payload
   * @param {'merge'|'replace'|'newVersion'} strategy - Collision resolution
   * @returns {Promise<string>} Created or Updated Program ID
   */
  async writeToRepository(candidate, strategy = 'merge') {
    const { program, semesters } = candidate;
    const programId = `prog_${program.slug.replace(/\s+/g, '_').toLowerCase()}`;

    // Verify existing program
    const existing = await academicService.getProgram(programId);

    if (!existing) {
      // Direct initial write
      return await this._executeRawIngest(programId, candidate, 1);
    }

    if (strategy === 'replace') {
      console.log(`Ingestion replacing existing program: ${programId}`);
      // 1. Delete associated semesters & subjects (Clean replace)
      const existingSemesters = await firestoreRepository.queryDocs('semesters', [
        { field: 'programId', op: '==', value: programId }
      ], 100);

      for (const sem of existingSemesters) {
        // Query and delete subjects
        const subjectsList = await firestoreRepository.queryDocs('subjects', [
          { field: 'semesterId', op: '==', value: sem.id }
        ], 100);
        for (const sub of subjectsList) {
          await firestoreRepository.delete('subjects', sub.id);
        }
        await firestoreRepository.delete('semesters', sem.id);
      }

      // 2. Write candidate
      return await this._executeRawIngest(programId, candidate, existing.version || 1);
    }

    if (strategy === 'newVersion') {
      const nextVersion = (existing.version || 1) + 1;
      console.log(`Ingestion creating version ${nextVersion} for program: ${programId}`);
      
      // We update program node with incremented version and write new semester layouts
      return await this._executeRawIngest(programId, candidate, nextVersion);
    }

    // Default strategy: Merge
    console.log(`Ingestion merging updates into program: ${programId}`);
    
    // Update Program details
    await academicService.updateProgram(programId, {
      description: program.description || existing.description,
      eligibility: program.eligibility || existing.eligibility,
      duration: program.duration || existing.duration
    });

    if (semesters) {
      for (const semName of Object.keys(semesters)) {
        const semId = `sem_${programId}_${semName.replace(/\s+/g, '_').toLowerCase()}`;
        
        // Find or create semester
        let semesterDoc = await firestoreRepository.findById('semesters', semId);
        if (!semesterDoc) {
          await academicService.createSemester({
            id: semId,
            programId,
            slug: semName.replace(/\s+/g, '-'),
            displayName: semName,
            status: 'published'
          });
        }

        const subjectsList = semesters[semName] || [];
        for (const sub of subjectsList) {
          const subId = `sub_${semId}_${sub.slug}`;
          let subjectDoc = await firestoreRepository.findById('subjects', subId);
          if (!subjectDoc) {
            await academicService.createSubject({
              id: subId,
              programId,
              semesterId: semId,
              slug: sub.slug,
              displayName: sub.displayName,
              status: 'published'
            });
          }

          // Merge topics
          if (sub.topics) {
            for (const top of sub.topics) {
              const topId = `top_unit_${subId}_${top.slug}`;
              let topicDoc = await firestoreRepository.findById('topics', topId);
              if (!topicDoc) {
                // Save topic
                await academicService.createTopic({
                  id: topId,
                  subjectId: subId,
                  unitId: `unit_${subId}_default`, // Maps to standard subject unit wrapper
                  slug: top.slug,
                  displayName: top.displayName,
                  description: top.description,
                  summary: top.summary,
                  chapterNumber: top.chapterNumber,
                  difficulty: top.difficulty || 'Medium',
                  status: 'published'
                });
              }
            }
          }
        }
      }
    }

    return programId;
  },

  /**
   * Low-level raw database ingestion helper
   * @private
   */
  async _executeRawIngest(programId, candidate, targetVersion) {
    const { program, semesters } = candidate;

    // Create Program node
    await academicService.createProgram({
      id: programId,
      slug: program.slug,
      displayName: program.displayName,
      description: program.description,
      category: program.category,
      duration: program.duration,
      eligibility: program.eligibility,
      version: targetVersion,
      source: program.source,
      status: 'published'
    });

    if (semesters) {
      for (const semName of Object.keys(semesters)) {
        const semId = `sem_${programId}_${semName.replace(/\s+/g, '_').toLowerCase()}`;
        
        await academicService.createSemester({
          id: semId,
          programId,
          slug: semName.replace(/\s+/g, '-'),
          displayName: semName,
          version: targetVersion,
          status: 'published'
        });

        const subjectsList = semesters[semName] || [];
        for (const sub of subjectsList) {
          const subId = `sub_${semId}_${sub.slug}`;
          
          await academicService.createSubject({
            id: subId,
            programId,
            semesterId: semId,
            slug: sub.slug,
            displayName: sub.displayName,
            version: targetVersion,
            status: 'published'
          });

          if (sub.topics) {
            for (const top of sub.topics) {
              const topId = `top_unit_${subId}_${top.slug}`;
              
              await academicService.createTopic({
                id: topId,
                subjectId: subId,
                unitId: `unit_${subId}_default`,
                slug: top.slug,
                displayName: top.displayName,
                description: top.description,
                summary: top.summary,
                chapterNumber: top.chapterNumber,
                difficulty: top.difficulty || 'Medium',
                version: targetVersion,
                status: 'published'
              });
            }
          }
        }
      }
    }

    return programId;
  }
};
