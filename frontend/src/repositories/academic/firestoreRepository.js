import { db } from '../../services/firebase/firebase';
import { 
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc, 
  query, where, getDocs, limit 
} from 'firebase/firestore';
import { api } from '../../services/api/apiClient';

/**
 * Universal Repository Helper syncing with Express + MongoDB and Firestore
 */
export const firestoreRepository = {
  /**
   * Save or overwrite a document in MongoDB via Express & Firestore
   */
  async save(colName, docId, data) {
    const payload = {
      ...data,
      id: docId,
      updatedAt: new Date().toISOString()
    };

    // 1. Sync with Express MongoDB
    try {
      await api.put(`/api/db/${colName}/${docId}`, payload);
    } catch (e) {
      console.warn(`[Repo] MongoDB save error for ${colName}/${docId}:`, e.message);
    }

    // 2. Sync with client firestore if available
    try {
      if (db) {
        const docRef = doc(db, colName, docId);
        await setDoc(docRef, payload, { merge: true });
      }
    } catch (fbErr) {
      // non-fatal
    }

    return docId;
  },

  /**
   * Fetch a single document by ID from MongoDB or Firestore
   */
  async findById(colName, docId) {
    // 1. Try MongoDB via Express API
    try {
      const res = await api.get(`/api/db/${colName}/${docId}`);
      if (res && res.success && res.document) {
        return res.document;
      }
    } catch (e) {
      // fallback
    }

    // 2. Try Firestore
    try {
      if (db) {
        const docRef = doc(db, colName, docId);
        const snap = await getDoc(docRef);
        if (snap && snap.exists()) {
          return snap.data();
        }
      }
    } catch (e) {
      // ignore
    }

    return null;
  },

  /**
   * Update specific fields of a document
   */
  async update(colName, docId, data) {
    const payload = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    try {
      await api.patch(`/api/db/${colName}/${docId}`, payload);
    } catch (e) {
      // fallback
    }

    try {
      if (db) {
        const docRef = doc(db, colName, docId);
        await updateDoc(docRef, payload);
      }
    } catch (e) {
      // ignore
    }

    return docId;
  },

  /**
   * Delete a document
   */
  async delete(colName, docId) {
    try {
      await api.delete(`/api/db/${colName}/${docId}`);
    } catch (e) {
      // ignore
    }

    try {
      if (db) {
        const docRef = doc(db, colName, docId);
        await deleteDoc(docRef);
      }
    } catch (e) {
      // ignore
    }

    return docId;
  },

  /**
   * Query documents matching equality clauses
   */
  async queryDocs(colName, conditions = [], maxResults = 50) {
    // 1. Try Express MongoDB query
    try {
      let queryParams = `?limit=${maxResults}`;
      for (const c of conditions) {
        if (c.op === '==' || c.op === '===') {
          queryParams += `&${c.field}=${encodeURIComponent(c.value)}`;
        }
      }
      const res = await api.get(`/api/db/${colName}${queryParams}`);
      if (res && res.success && Array.isArray(res.documents) && res.documents.length > 0) {
        return res.documents;
      }
    } catch (e) {
      // fallback
    }

    // 2. Firestore query
    try {
      if (db) {
        let q = collection(db, colName);
        if (conditions.length > 0) {
          const clauses = conditions.map(c => where(c.field, c.op, c.value));
          q = query(q, ...clauses, limit(maxResults));
        } else {
          q = query(q, limit(maxResults));
        }
        const snap = await getDocs(q);
        return snap.docs.map(docSnap => docSnap.data());
      }
    } catch (e) {
      // ignore
    }

    return [];
  }
};

export default firestoreRepository;
