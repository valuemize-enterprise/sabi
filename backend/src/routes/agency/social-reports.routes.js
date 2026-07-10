/**
 * Social Reports Routes
 * Account managers upload platform reports (PDF/image).
 * ARIA analyses them and generates client-ready summaries.
 *
 * GET    /api/agency/social-reports
 * POST   /api/agency/social-reports
 * POST   /api/agency/social-reports/:id/analyse   — trigger ARIA analysis
 * PUT    /api/agency/social-reports/:id/publish    — make visible to client
 * DELETE /api/agency/social-reports/:id
 */
'use strict';

const router      = require('express').Router();
const supabase    = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const ariaService = require('../../services/aria/aria-strategy.service');

// Only these roles can upload + manage social reports
const REPORT_ROLES = [
  'super_admin','ceo','managing_director','creative_director',
  'strategy_director','account_director','account_manager',
  // Brand admins also allowed (checked via brand assignment)
];

// ── GET /api/agency/social-reports ───────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, platform, status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('social_reports')
      .select(`
        id, platform, report_period, report_date, file_name, file_type,
        status, published_to_client, ai_generated_at, created_at,
        brand_id,
        brands ( id, name ),
        users!uploaded_by ( id, full_name, role )
      `, { count: 'exact' });

    if (brand_id)  query = query.eq('brand_id', brand_id);
    if (platform)  query = query.eq('platform', platform);
    if (status)    query = query.eq('status', status);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    sendPaginated(res, data || [], count, page, limit);
  } catch (err) { next(err); }
});

// ── POST /api/agency/social-reports ──────────────────────────
// Upload a report. File text is extracted and stored for AI analysis.
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      brand_id, platform, report_period, report_date,
      file_url, file_name, file_type,
      extracted_text, // text extracted from PDF on client side (optional)
    } = req.body;

    if (!brand_id)  return sendError(res, 400, 'brand_id is required');
    if (!platform)  return sendError(res, 400, 'platform is required');
    if (!file_url)  return sendError(res, 400, 'file_url is required (upload to storage first)');

    // Super admin doesn't have a real user record, so skip uploaded_by
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.user.id);
    const { data: report, error } = await supabase
      .from('social_reports')
      .insert({
        brand_id,
        uploaded_by:   isUUID ? req.user.id : null,
        platform,
        report_period: report_period || null,
        report_date:   report_date   || null,
        file_url,
        file_name:     file_name || 'report',
        file_type:     file_type || 'pdf',
        raw_data:      extracted_text ? { text: extracted_text } : {},
        status:        'uploaded',
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-trigger ARIA analysis if we have text
    if (extracted_text) {
      ariaService.analyseSocialReport({
        platform,
        reportText:    extracted_text,
        brandName:     brand_id,
        period:        report_period,
      }).then(async insights => {
        await supabase.from('social_reports').update({
          ai_summary:      insights.client_narrative || insights.summary,
          ai_metrics:      insights,
          status:          'analysed',
          ai_generated_at: new Date().toISOString(),
        }).eq('id', report.id);
      }).catch(() => {});
    }

    sendSuccess(res, { report }, 'Report uploaded', 201);
  } catch (err) { next(err); }
});

// ── POST /api/agency/social-reports/:id/analyse ──────────────
// Manually trigger ARIA analysis (or re-run it)
router.post('/:id/analyse', authenticate, async (req, res, next) => {
  try {
    const { extracted_text } = req.body;

    const { data: report } = await supabase
      .from('social_reports')
      .select('*, brands(name)')
      .eq('id', req.params.id)
      .single();

    if (!report) return sendError(res, 404, 'Report not found');

    const text = extracted_text || report.raw_data?.text;
    if (!text) return sendError(res, 400, 'No report text available for analysis. Please provide extracted_text.');

    // Set to analysing
    await supabase.from('social_reports').update({ status: 'analysing' }).eq('id', req.params.id);

    const insights = await ariaService.analyseSocialReport({
      platform:   report.platform,
      reportText: text,
      brandName:  report.brands?.name || 'Brand',
      period:     report.report_period,
    });

    const { data: updated, error } = await supabase
      .from('social_reports')
      .update({
        ai_summary:      insights.client_narrative || insights.summary,
        ai_metrics:      insights,
        status:          'analysed',
        ai_generated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    sendSuccess(res, { report: updated, insights }, 'ARIA analysis complete');
  } catch (err) { next(err); }
});

// ── PUT /api/agency/social-reports/:id/publish ───────────────
// Make the AI-analysed report visible to the client
router.put('/:id/publish', authenticate, async (req, res, next) => {
  try {
    const { data: report, error } = await supabase
      .from('social_reports')
      .update({ published_to_client: true, status: 'published' })
      .eq('id', req.params.id)
      .select('id, platform, brand_id, report_period')
      .single();

    if (error) throw error;

    // Notify all clients of this brand
    const { data: clients } = await supabase
      .from('clients').select('id').eq('brand_id', report.brand_id).eq('is_active', true);

    if (clients?.length) {
      await supabase.from('client_notifications').insert(
        clients.map(c => ({
          client_id: c.id,
          brand_id:  report.brand_id,
          type:      'social_report_published',
          title:     `📊 New ${report.platform} Report Available`,
          body:      `Your ${report.report_period || 'latest'} ${report.platform} performance report is ready to view.`,
          metadata:  { social_report_id: report.id },
          is_read:   false,
        }))
      );
    }

    sendSuccess(res, { report }, 'Report published to client portal');
  } catch (err) { next(err); }
});

// ── DELETE /api/agency/social-reports/:id ────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await supabase.from('social_reports').delete().eq('id', req.params.id);
    sendSuccess(res, null, 'Report deleted');
  } catch (err) { next(err); }
});

module.exports = router;
