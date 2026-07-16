/**
 * Agency Reports Routes
 * GET    /api/agency/reports
 * POST   /api/agency/reports
 * GET    /api/agency/reports/:id
 * PUT    /api/agency/reports/:id
 * DELETE /api/agency/reports/:id
 * POST   /api/agency/reports/:id/generate-narrative  (ARIA NarrativeAI™)
 * POST   /api/agency/reports/:id/publish
 */

'use strict';

const router           = require('express').Router();
const supabase         = require('../../config/supabase');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog }     = require('../../middleware/logger.middleware');
const narrativeService = require('../../services/aria/narrative.service');
const emailService = require('../../services/email.service');

// GET /api/agency/reports
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, status, type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('reports')
      .select('id, brand_id, title, type, status, period_start, period_end, clarity_score, published_at, created_at, brands(name, logo_url)', { count: 'exact' });

    if (brand_id) query = query.eq('brand_id', brand_id);
    if (status)   query = query.eq('status', status);
    if (type)     query = query.eq('type', type);

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) { next(err); }
});

// POST /api/agency/reports
router.post('/', authenticate, requirePermission('CREATE_REPORT'), async (req, res, next) => {
  try {
    const { brand_id, title, type, period_start, period_end, content, metrics } = req.body;
    if (!brand_id || !title) return sendError(res, 400, 'brand_id and title required');

    const { data, error } = await supabase.from('reports').insert({
      brand_id, title, type: type || 'weekly', period_start, period_end,
      content: content || {}, metrics: metrics || {},
      created_by: req.user.role !== 'super_admin' ? req.user.id : null,
    }).select().single();

    if (error) throw error;
    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'CREATE_REPORT', resourceType: 'report', resourceId: data.id, details: { title }, req });

    sendSuccess(res, { report: data }, 'Report created', 201);
  } catch (err) { next(err); }
});

// GET /api/agency/reports/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*, brands(name, logo_url, primary_color, industry), users!created_by(full_name)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return sendError(res, 404, 'Report not found');
    sendSuccess(res, { report: data });
  } catch (err) { next(err); }
});

// PUT /api/agency/reports/:id
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['title', 'type', 'period_start', 'period_end', 'content', 'metrics', 'clarity_score'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const { data, error } = await supabase.from('reports').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    sendSuccess(res, { report: data });
  } catch (err) { next(err); }
});

// POST /api/agency/reports/:id/generate-narrative  ← ARIA NarrativeAI™
router.post('/:id/generate-narrative', authenticate, async (req, res, next) => {
  try {
    const { data: report, error } = await supabase
      .from('reports')
      .select('*, brands(name, industry, primary_color)')
      .eq('id', req.params.id)
      .single();

    if (error || !report) return sendError(res, 404, 'Report not found');

    const narrative = await narrativeService.generate({
      report,
      brand:  report.brands,
      metrics: report.metrics || {},
      period:  { start: report.period_start, end: report.period_end },
    });

    await supabase.from('reports').update({ narrative }).eq('id', req.params.id);

    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'GENERATE_NARRATIVE', resourceType: 'report', resourceId: req.params.id, req });

    sendSuccess(res, { narrative });
  } catch (err) { next(err); }
});

// POST /api/agency/reports/:id/publish
router.post('/:id/publish', authenticate, requirePermission('PUBLISH_REPORT'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;
    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'PUBLISH_REPORT', resourceType: 'report', resourceId: req.params.id, req });

    const { data: brand } = await supabase
      .from('brands')
      .select('name, clients(email, full_name)')
      .eq('id', data.brand_id)
      .single();

    for (const client of (brand?.clients || [])) {
      emailService.sendReportPublished({
        clientName:  client.full_name,
        clientEmail: client.email,
        brandName:   brand.name,
        reportTitle: data.title,
        reportUrl:   `${process.env.NEXT_PUBLIC_APP_URL}/client/reports/${data.id}`,
        period:      data.period_start
                       ? `Period: ${data.period_start} to ${data.period_end}`
                       : '',
      }).catch(() => {});
    }

    sendSuccess(res, { report: data }, 'Report published');
  } catch (err) { next(err); }
});

// DELETE /api/agency/reports/:id
router.delete('/:id', authenticate, requirePermission('DELETE_REPORT'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('reports').delete().eq('id', req.params.id);
    if (error) throw error;
    sendSuccess(res, null, 'Report deleted');
  } catch (err) { next(err); }
});

module.exports = router;
