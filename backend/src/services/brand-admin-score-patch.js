/**
 * Brand Admin Score Patch — Finance Phase 2
 *
 * Replaces the "New Brief Revenue" scoring component (20% weight)
 * with actual paid invoice revenue instead of brief.expected_revenue.
 *
 * HOW TO APPLY:
 *   Find your existing Brand Admin score function — it's in whichever
 *   service computes the 4-component weekly score. Look for:
 *
 *     "New Brief Revenue"  or  "newBriefRevenue"  or  "revenue_score"
 *
 *   Replace the revenue component calculation with getActualRevenueScore()
 *   from this file.
 *
 * BEFORE (using brief expected revenue):
 *   const revenue = approvedBriefs.reduce((s, b) => s + b.expected_revenue, 0);
 *   const revenueScore = Math.min(revenue / monthlyTarget, 1) * 20;
 *
 * AFTER (using actual paid revenue):
 *   const { score: revenueScore } = await getActualRevenueScore(brandId, weekStart, weekEnd);
 */

"use strict";

const supabase = require("../config/supabase");
const { getActuals } = require("./revenue-tracker.service");

// ── Monthly retainer target per brand (₦) ────────────────────────────────────
// Reads from brands.retainer_amount if set, else falls back to agency-wide target.
// If neither is set, returns null (component weight redistributed by scoring engine).
async function getBrandMonthlyTarget(brandId) {
  const { data: brand } = await supabase
    .from("brands")
    .select("retainer_amount")
    .eq("id", brandId)
    .single();

  if (brand?.retainer_amount) return Number(brand.retainer_amount);

  // Fall back to annual total target / 12 / estimated active brand count
  const { data: targets } = await supabase
    .from("finance_targets")
    .select("target_amount")
    .eq("year", new Date().getFullYear())
    .is("quarter", null)
    .eq("target_type", "total")
    .single();

  if (!targets) return null;

  const { count } = await supabase
    .from("brands")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const activeBrands = count || 1;
  return Number(targets.target_amount) / 12 / activeBrands;
}

// ── Actual paid revenue for a brand in a date range ───────────────────────────
async function getActualPaidRevenue(brandId, fromDate, toDate) {
  const { data, error } = await supabase
    .from("payments")
    .select("amount")
    .eq("brand_id", brandId)
    .gte("payment_date", fromDate)
    .lte("payment_date", toDate);

  if (error) return 0;
  return (data || []).reduce((s, p) => s + Number(p.amount), 0);
}

// ── Revenue score component (0 to 20 points) ─────────────────────────────────
async function getActualRevenueScore(brandId, weekStart, weekEnd) {
  // Revenue scoring uses the calendar month, not just the week
  // (aligns with how retainers and invoices work — monthly cycles)
  const monthStart = weekStart.slice(0, 8) + "01"; // first of the month

  const [paidRevenue, monthlyTarget] = await Promise.all([
    getActualPaidRevenue(brandId, monthStart, weekEnd),
    getBrandMonthlyTarget(brandId),
  ]);

  if (!monthlyTarget) {
    // No target set — return neutral score (10/20 = 50%)
    return {
      score: 10,
      raw_revenue: paidRevenue,
      target: null,
      pct_of_target: null,
    };
  }

  // Score: 0-20 points proportional to how much of monthly target has been paid
  // Cap at 20 (can't earn more than 20 by over-achieving)
  const pctOfTarget = paidRevenue / monthlyTarget;
  const score = Math.min(Math.round(pctOfTarget * 20 * 10) / 10, 20);

  return {
    score,
    raw_revenue: paidRevenue,
    target: monthlyTarget,
    pct_of_target: Math.round(pctOfTarget * 100),
  };
}

// ── Drop-in patch for the scoring engine ─────────────────────────────────────
// Call this from your existing Brand Admin weekly score computation.
// It replaces the current revenue_score variable.
//
// Example integration in your scoring service:
//
//   const { getActualRevenueScore } = require('./brand-admin-score-patch');
//
//   // Replace your current revenue component with:
//   const revenueComponent = await getActualRevenueScore(brandId, weekStart, weekEnd);
//   const revenue_score = revenueComponent.score; // 0-20 points
//
//   // Include in the total score as before:
//   const totalScore = clientSatisfactionScore   // 30%
//                    + goalAchievementScore        // 25%
//                    + teamVerifiedScore           // 25%
//                    + revenue_score;              // 20%

module.exports = {
  getActualRevenueScore,
  getActualPaidRevenue,
  getBrandMonthlyTarget,
};
