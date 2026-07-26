/**
 * Goal Generator Routes — Sabi Intelligence Suite
 *
 * Mount in server.js (before any existing /api/goals route):
 *
 *   const goalRouter = require('./routes/goal-generator.routes');
 *   app.use('/api/goals', goalRouter);
 *
 * Endpoints:
 *
 *   POST   /api/goals/generate               Upload docs → AI goals (multipart)
 *   POST   /api/goals/save                   Save reviewed goals to DB
 *   GET    /api/goals/:brandId               Get all goals for a brand
 *   PATCH  /api/goals/:goalId                Direct edit (SA only)
 *   DELETE /api/goals/:goalId                Direct delete (SA only)
 *   PATCH  /api/goals/:goalId/kr             Update one KR's current_value
 *   POST   /api/goals/:goalId/change-request  BA submits edit/delete request
 *   GET    /api/goals/change-requests/:brandId Pending requests (SA view)
 *   GET    /api/goals/my-requests            My requests (BA view)
 *   PATCH  /api/goals/change-requests/:requestId/decide  SA approves/denies
 */

'use strict';

const express     = require('express');
const multer      = require('multer');
const router      = express.Router();
const { supabase }          = require('../config/supabase');
const { authenticate } = require("../middleware/auth.middleware");
const { parseDocuments }    = require('../services/document-parser.service');
const {
  generateGoals, saveGoals, updateKeyResult, getBrandGoals,
} = require('../services/goal-generator.service');
const {
  editGoalDirect, deleteGoalDirect,
  submitChangeRequest, decideChangeRequest,
  getPendingRequests, getMyRequests, SUPER_ROLES,
} = require('../services/goal-permissions.service');

// ── File upload config ────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:  20 * 1024 * 1024, // 20 MB per file
    files:     5,                 // max 5 files per request
  },
  fileFilter: (req, file, cb) => {
    const ALLOWED = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'image/jpeg',
      'image/png',
    ];
    // Also allow by extension for browsers that send generic types
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    const ALLOWED_EXT = ['pdf', 'docx', 'xlsx', 'xls', 'jpg', 'jpeg', 'png'];
    if (ALLOWED.includes(file.mimetype) || ALLOWED_EXT.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`"${file.originalname}" is not a supported file type.`));
    }
  },
});

const fail = (res, err) =>
  res.status(err.status || 500).json({ success: false, error: err.message || String(err) });

const isBrandAdmin = async (userId, brandId) => {
  const { data } = await supabase.from('brand_admins')
    .select('brand_id').eq('user_id', userId).eq('brand_id', brandId);
  return (data || []).length > 0;
};

// ── POST /api/goals/generate ──────────────────────────────────────────────────
// Accepts multipart: files[] + brand_id
// Returns structured OKR goals for review (does NOT save to DB yet)
router.post('/generate', authenticate, upload.array('documents', 5), async (req, res) => {
  try {
    const { brand_id } = req.body;
    if (!brand_id) return res.status(400).json({ success: false, error: 'brand_id is required.' });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one file is required.' });
    }

    // Permission: SA/admin/md or Brand Admin for this brand
    if (!SUPER_ROLES.has(req.user.role)) {
      const ok = await isBrandAdmin(req.user.id, brand_id);
      if (!ok) return res.status(403).json({ success: false, error: 'Not your brand.' });
    }

    // Fetch brand name for the AI prompt
    const { data: brand } = await supabase.from('brands')
      .select('name').eq('id', brand_id).single();
    const brandName = brand?.name || 'this brand';

    // 1. Parse all uploaded documents
    const { parsed: parsedDocs, errors: parseErrors } = await parseDocuments(req.files);

    // 2. Store document metadata in Supabase
    const docRecords = await Promise.all(
      req.files.map(async (file, i) => {
        const ext = (file.originalname.split('.').pop() || '').toLowerCase();
        // Optionally upload to Supabase Storage:
        // await supabase.storage.from('goal-documents').upload(`${brand_id}/${Date.now()}-${file.originalname}`, file.buffer);
        const { data } = await supabase.from('goal_source_documents').insert({
          brand_id,
          file_name:      file.originalname,
          file_type:      ext,
          file_size_bytes: file.size,
          uploaded_by:    req.user.id,
        }).select('id').single().catch(() => ({ data: null }));
        return { fileIndex: i, documentId: data?.id || null };
      })
    );
    const primaryDocId = docRecords[0]?.documentId || null;

    // 3. Generate goals via Claude
    const result = await generateGoals({ brandId: brand_id, brandName, parsedDocs });

    // 4. Update brief_intelligence on the primary document
    if (primaryDocId && result.brief_intelligence) {
      await supabase.from('goal_source_documents').update({
        brief_intelligence: result.brief_intelligence,
        document_type:      result.document_type || 'unknown',
      }).eq('id', primaryDocId).catch(() => {});
    }

    res.json({
      success:          true,
      source_document_id: primaryDocId,
      parse_warnings:   parseErrors,
      ...result,
    });
  } catch (err) {
    console.error('[goal-generator] POST /generate failed:', err.message);
    fail(res, err);
  }
});

// ── POST /api/goals/save ──────────────────────────────────────────────────────
// Saves the reviewed/edited goals from the review step
router.post('/save', authenticate, async (req, res) => {
  try {
    const { brand_id, goals, source_document_id } = req.body || {};
    if (!brand_id) return res.status(400).json({ success: false, error: 'brand_id is required.' });
    if (!Array.isArray(goals) || goals.length === 0) {
      return res.status(400).json({ success: false, error: 'goals array is required.' });
    }

    if (!SUPER_ROLES.has(req.user.role)) {
      const ok = await isBrandAdmin(req.user.id, brand_id);
      if (!ok) return res.status(403).json({ success: false, error: 'Not your brand.' });
    }

    const saved = await saveGoals({
      brandId:          brand_id,
      goals,
      sourceDocumentId: source_document_id || null,
      callerId:         req.user.id,
    });

    res.status(201).json({ success: true, goals: saved, created: saved.length });
  } catch (err) {
    console.error('[goal-generator] POST /save failed:', err.message);
    fail(res, err);
  }
});

// ── GET /api/goals/:brandId ────────────────────────────────────────────────────
router.get('/change-requests/mine', authenticate, async (req, res) => {
  try {
    const data = await getMyRequests(req.user.id);
    res.json({ success: true, requests: data });
  } catch (err) { fail(res, err); }
});

router.get('/:brandId', authenticate, async (req, res) => {
  try {
    if (!SUPER_ROLES.has(req.user.role)) {
      const ok = await isBrandAdmin(req.user.id, req.params.brandId);
      if (!ok) return res.status(403).json({ success: false, error: 'Not your brand.' });
    }
    const goals = await getBrandGoals(req.params.brandId);
    res.json({ success: true, goals });
  } catch (err) { fail(res, err); }
});

// ── PATCH /api/goals/:goalId (SA only direct edit) ───────────────────────────
router.patch('/:goalId', authenticate, async (req, res) => {
  try {
    const data = await editGoalDirect({
      goalId:  req.params.goalId,
      updates: req.body || {},
      caller:  req.user,
    });
    res.json({ success: true, goal: data });
  } catch (err) { fail(res, err); }
});

// ── DELETE /api/goals/:goalId (SA only direct delete) ────────────────────────
router.delete('/:goalId', authenticate, async (req, res) => {
  try {
    const data = await deleteGoalDirect({ goalId: req.params.goalId, caller: req.user });
    res.json({ success: true, ...data });
  } catch (err) { fail(res, err); }
});

// ── PATCH /api/goals/:goalId/kr — update one KR's current_value ──────────────
router.patch('/:goalId/kr', authenticate, async (req, res) => {
  try {
    const { kr_id, current_value } = req.body || {};
    if (!kr_id || current_value === undefined) {
      return res.status(400).json({ success: false, error: 'kr_id and current_value are required.' });
    }
    const data = await updateKeyResult({
      goalId:       req.params.goalId,
      krId:         kr_id,
      currentValue: current_value,
      callerId:     req.user.id,
    });
    res.json({ success: true, goal: data });
  } catch (err) { fail(res, err); }
});

// ── POST /api/goals/:goalId/change-request (BA submits request) ──────────────
router.post('/:goalId/change-request', authenticate, async (req, res) => {
  try {
    const { request_type, reason, proposed_changes } = req.body || {};
    if (!request_type || !reason) {
      return res.status(400).json({ success: false, error: 'request_type and reason are required.' });
    }
    const data = await submitChangeRequest({
      goalId:          req.params.goalId,
      requestType:     request_type,
      reason,
      proposedChanges: proposed_changes || null,
      caller:          req.user,
    });
    res.status(201).json({ success: true, request: data });
  } catch (err) { fail(res, err); }
});

// ── GET /api/goals/change-requests/:brandId (SA sees pending) ────────────────
router.get('/change-requests/:brandId', authenticate, async (req, res) => {
  try {
    const data = await getPendingRequests(req.params.brandId, req.user);
    res.json({ success: true, requests: data });
  } catch (err) { fail(res, err); }
});

// ── PATCH /api/goals/change-requests/:requestId/decide (SA approves/denies) ──
router.patch('/change-requests/:requestId/decide', authenticate, async (req, res) => {
  try {
    const { approve, denial_reason } = req.body || {};
    if (typeof approve !== 'boolean') {
      return res.status(400).json({ success: false, error: 'approve (true|false) is required.' });
    }
    const data = await decideChangeRequest({
      requestId:    req.params.requestId,
      approve,
      denialReason: denial_reason || null,
      caller:       req.user,
    });
    res.json({ success: true, ...data });
  } catch (err) { fail(res, err); }
});

module.exports = router;
