import express from 'express';
import GenericDoc from '../models/GenericDoc.js';

const router = express.Router();

// Normalize collection paths e.g. "users/123/subjects"
const formatColName = (col, docId, subcol) => {
  if (docId && subcol) {
    return `${col}__${docId}__${subcol}`;
  }
  return col;
};

// GET /api/db/:collection
router.get('/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const limit = parseInt(req.query.limit, 10) || 100;
    
    // Parse filter conditions passed via query
    const filter = { collectionName: collection };
    for (const [key, val] of Object.entries(req.query)) {
      if (key !== 'limit' && key !== 'sort' && key !== 'orderBy') {
        filter[`data.${key}`] = val === 'true' ? true : val === 'false' ? false : isNaN(val) ? val : Number(val);
      }
    }

    const docs = await GenericDoc.find(filter).sort({ updatedAt: -1 }).limit(limit);
    const results = docs.map(d => ({
      id: d.docId,
      ...d.data
    }));

    return res.json({ success: true, documents: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/db/:collection/:docId
router.get('/:collection/:docId', async (req, res) => {
  try {
    const { collection, docId } = req.params;
    const doc = await GenericDoc.findOne({ collectionName: collection, docId });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    return res.json({
      success: true,
      document: {
        id: doc.docId,
        ...doc.data
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/db/:collection (create new document)
router.post('/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const data = req.body;
    const docId = data.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const doc = await GenericDoc.findOneAndUpdate(
      { collectionName: collection, docId },
      {
        collectionName: collection,
        docId,
        data: { ...data, id: docId },
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      success: true,
      id: docId,
      document: { id: docId, ...doc.data }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/db/:collection/:docId (set with merge)
router.put('/:collection/:docId', async (req, res) => {
  try {
    const { collection, docId } = req.params;
    const data = req.body;

    const existing = await GenericDoc.findOne({ collectionName: collection, docId });
    const mergedData = existing ? { ...existing.data, ...data, id: docId } : { ...data, id: docId };

    const doc = await GenericDoc.findOneAndUpdate(
      { collectionName: collection, docId },
      {
        collectionName: collection,
        docId,
        data: mergedData,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      id: docId,
      document: { id: docId, ...doc.data }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/db/:collection/:docId
router.patch('/:collection/:docId', async (req, res) => {
  try {
    const { collection, docId } = req.params;
    const data = req.body;

    const existing = await GenericDoc.findOne({ collectionName: collection, docId });
    const merged = existing ? { ...existing.data, ...data, id: docId } : { ...data, id: docId };

    const doc = await GenericDoc.findOneAndUpdate(
      { collectionName: collection, docId },
      {
        collectionName: collection,
        docId,
        data: merged,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      id: docId,
      document: { id: docId, ...doc.data }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/db/:collection/:docId
router.delete('/:collection/:docId', async (req, res) => {
  try {
    const { collection, docId } = req.params;
    await GenericDoc.findOneAndDelete({ collectionName: collection, docId });
    return res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// SUBCOLLECTION SUPPORT: /api/db/:collection/:docId/:subcollection
router.get('/:collection/:docId/:subcollection', async (req, res) => {
  try {
    const { collection, docId, subcollection } = req.params;
    const colName = formatColName(collection, docId, subcollection);
    const docs = await GenericDoc.find({ collectionName: colName }).sort({ updatedAt: -1 });
    return res.json({ success: true, documents: docs.map(d => ({ id: d.docId, ...d.data })) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:collection/:docId/:subcollection', async (req, res) => {
  try {
    const { collection, docId, subcollection } = req.params;
    const colName = formatColName(collection, docId, subcollection);
    const data = req.body;
    const subDocId = data.id || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const doc = await GenericDoc.findOneAndUpdate(
      { collectionName: colName, docId: subDocId },
      { collectionName: colName, docId: subDocId, data: { ...data, id: subDocId }, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    return res.status(201).json({ success: true, id: subDocId, document: { id: subDocId, ...doc.data } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
