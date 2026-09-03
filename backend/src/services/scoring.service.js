"use strict";

console.log("=== SCORING SERVICE LOADED — VERSION 2 ===");

/**
 * Scoring Service — FIXED
 *
 * Fixes applied:
 *   1. record null guard — no crash when people_records row missing
 *   2. joinDate → users.created_at (platform onboarding date, not employment start)
 *   3. taskRate null → 0 points (not 50% neutral — zero tasks = zero task score)
 *   4. assignee_id → assignee_id (correct tasks column)
 *   5. 2 decimal places throughout
 *   6. computeMissingScores loops last 8 weeks, not just 1
 */

const supabase = require("../config/supabase");
const notify = require("./notification-triggers.service");

const GLOBAL_ADMIN_ROLES = [
  "super_admin",
  "ceo",
  "managing_director",
  "creative_director",
  "strategy_director",
  "account_director",
];

// ── Helpers ───────────────────────────────────────────────────────

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function lastCompletedWeekStart() {
  const now = new Date();
  const thisMonday = mondayOf(now);
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
  return lastMonday;
}

/**
 * Returns an array of Mondays from weeksBack weeks ago
 * up to and including lastCompletedWeekStart.
 */
function getWeekRange(weeksBack = 8) {
  const base = lastCompletedWeekStart();
  const weeks = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 7 * 86400000);
    weeks.push(d);
  }
  return weeks;
}

// ── Config ────────────────────────────────────────────────────────

async function getConfig() {
  const { data, error } = await supabase
    .from("scoring_config")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("[getConfig] Failed to fetch scoring_config, using fallback defaults:", error);
  }

  return (
    data ?? {
      staff_satisfaction_weight: 30,
      staff_task_weight: 30,
      staff_manager_rating_weight: 25,
      staff_contribution_weight: 15,
      brand_admin_clarity_weight: 35,
      brand_admin_task_weight: 25,
      brand_admin_rating_weight: 25,
      brand_admin_contribution_weight: 15,
      brand_admin_weekly_task_target: 8, // NEW: tasks verified for full "Team Completion" marks
    }
  );
}

// ── Rolling average ───────────────────────────────────────────────

async function getRollingAverage(
  userId,
  scoreType,
  windowSize = 4,
  offsetWeeks = 0,
) {
  const limit = windowSize + offsetWeeks + 2;
  const { data } = await supabase
    .from("weekly_scores")
    .select("total, week_start, excluded")
    .eq("user_id", userId)
    .eq("score_type", scoreType)
    .order("week_start", { ascending: false })
    .limit(limit);

  const usable = (data ?? [])
    .filter((s) => !s.excluded)
    .slice(offsetWeeks, offsetWeeks + windowSize);

  if (usable.length === 0) return null;
  const avg = usable.reduce((s, w) => s + Number(w.total), 0) / usable.length;
  return Math.round(avg * 100) / 100; // FIX 5: 2 decimal places
}

// ── Staff score ───────────────────────────────────────────────────

async function computeStaffScore(userId, weekStartDate, config) {
  const weekStart = toDateStr(weekStartDate);
  const weekEnd = toDateStr(new Date(weekStartDate.getTime() + 7 * 86400000));

  // On leave this week?
  const { data: leave } = await supabase
    .from("staff_leave")
    .select("id")
    .eq("staff_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (leave)
    return { excluded: true, components: { reason: "on_leave" }, total: 0 };

  const { data: user } = await supabase
    .from("users")
    .select("role, created_at")
    .eq("id", userId)
    .single();
  if (!user) return null;

  const { data: record } = await supabase
    .from("people_records")
    .select("start_date")
    .eq("user_id", userId)
    .single();

  const joinDate = record?.start_date
    ? new Date(record.start_date)
    : new Date(user.created_at);
  const weeksSinceJoin =
    (weekStartDate.getTime() - joinDate.getTime()) / (7 * 86400000);

  if (weeksSinceJoin < 0) {
    return {
      excluded: true,
      components: { reason: "not_joined_yet" },
      total: 0,
    };
  }
  if (weeksSinceJoin < 2) {
    return { excluded: true, components: { reason: "new_staff" }, total: 0 };
  }

  const { data: assignments } = await supabase
    .from("staff_brand_assignments")
    .select("brand_id")
    .eq("staff_id", userId);

  const brandIds = (assignments ?? []).map((a) => a.brand_id);
  const hasClientBrands = brandIds.length > 0;

  // ── 1. Client Satisfaction ──────────────────────────────────────
  let satisfactionRaw = null;
  if (hasClientBrands) {
    const { data: ratings } = await supabase
      .from("client_satisfaction")
      .select("nps_score, brand_id, created_at")
      .in("brand_id", brandIds)
      .lte("created_at", weekEnd);

    const thisWeek = (ratings ?? []).filter(
      (r) => r.created_at >= weekStart && r.created_at < weekEnd,
    );
    if (thisWeek.length > 0) {
      satisfactionRaw =
        thisWeek.reduce((s, r) => s + r.nps_score, 0) / thisWeek.length;
    } else {
      const threeWeeksAgo = toDateStr(
        new Date(weekStartDate.getTime() - 21 * 86400000),
      );
      const recent = (ratings ?? [])
        .filter((r) => r.created_at >= threeWeeksAgo)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (recent.length > 0) satisfactionRaw = recent[0].nps_score;
    }
  }

  // ── 2. Task Completion (weekly-scoped) ──────────────────────────
  // NOTE: confirm "assigned_to" vs "assignee_id" against your actual schema
  // (FIX 4 elsewhere in this codebase says assigned_to is correct).
  const TASK_ASSIGNEE_COL = "assignee_id";

  const { data: openBacklog } = await supabase
    .from("tasks")
    .select("id")
    .eq(TASK_ASSIGNEE_COL, userId)
    .not("status", "in", "(cancelled,archived)")
    .lt("created_at", weekStart);

  const { data: newAssignedThisWeek } = await supabase
    .from("tasks")
    .select("id")
    .eq(TASK_ASSIGNEE_COL, userId)
    .gte("created_at", weekStart)
    .lt("created_at", weekEnd)
    .not("status", "in", "(cancelled,archived)");

  const { data: verifiedThisWeek } = await supabase
    .from("tasks")
    .select("id")
    .eq(TASK_ASSIGNEE_COL, userId)
    .eq("status", "verified")
    .gte("updated_at", weekStart)
    .lt("updated_at", weekEnd);

  const openBacklogCount = (openBacklog ?? []).length;
  const newAssignedCount = (newAssignedThisWeek ?? []).length;
  const totalAssigned = openBacklogCount + newAssignedCount;
  const verifiedCount = (verifiedThisWeek ?? []).length;
  const taskRate = totalAssigned > 0 ? verifiedCount / totalAssigned : null;

  console.log(
    `[score] ${userId} week=${weekStart} tasks: ${verifiedCount} verified / ${totalAssigned} active (backlog=${openBacklogCount}, new=${newAssignedCount}) → taskRate=${taskRate?.toFixed(2) ?? "null"}`,
  );

  // ── 3. Manager Rating ───────────────────────────────────────────
  const { data: mgrRatings } = await supabase
    .from("weekly_ratings")
    .select("score, is_creative_of_week")
    .eq("staff_id", userId)
    .eq("week_start", weekStart);

    const hasNoActivity =
  satisfactionRaw === null &&
  verifiedCount === 0 &&
  (mgrRatings ?? []).length === 0 &&
  contributionPoints === 0;

if (hasNoActivity) {
  const result = { excluded: true, components: { reason: "no_activity" }, total: 0 };
  await saveScore(userId, "brand_admin", weekStart, result);
  return result;
}

  const managerRatingRaw = mgrRatings?.length
    ? mgrRatings.reduce((s, r) => s + r.score, 0) / mgrRatings.length
    : 3;

  const isCreativeOfWeek = (mgrRatings ?? []).some(
    (r) => r.is_creative_of_week,
  );

  // ── 4. Contributions ────────────────────────────────────────────
  const { data: claims } = await supabase
    .from("contribution_claims")
    .select("points_awarded")
    .eq("staff_id", userId)
    .eq("week_start", weekStart)
    .eq("status", "verified")
    .order("points_awarded", { ascending: false })
    .limit(2);

  const contributionPoints = (claims ?? []).reduce(
    (s, c) => s + (c.points_awarded || 0),
    0,
  );

  // ── Weights ─────────────────────────────────────────────────────
  let wSat = config.staff_satisfaction_weight;
  let wTask = config.staff_task_weight;
  let wMgr = config.staff_manager_rating_weight;
  let wContrib = config.staff_contribution_weight;

  if (!hasClientBrands || satisfactionRaw === null) {
    const redistribute = wSat;
    wSat = 0;
    wMgr += Math.round(redistribute * 0.6);
    wTask += redistribute - Math.round(redistribute * 0.6);
  }

  const satisfactionPoints =
    satisfactionRaw !== null ? (satisfactionRaw / 10) * wSat : 0;
  const taskPoints = taskRate !== null ? taskRate * wTask : 0;
  const managerPoints = (managerRatingRaw / 5) * wMgr;
  const contribPoints = Math.min(contributionPoints, wContrib);
  const creativeBonus = isCreativeOfWeek ? 5 : 0;

  const total =
    Math.round(
      (satisfactionPoints +
        taskPoints +
        managerPoints +
        contribPoints +
        creativeBonus) *
        100,
    ) / 100;

//   console.log(`[score] ${userId} week=${weekStart} total=${total}
// satisfaction: raw=${satisfactionRaw} points=${Math.round(satisfactionPoints * 100) / 100} weight=${wSat}
// tasks: raw=${taskRate} verified=${verifiedCount} assigned=${totalAssigned} points=${Math.round(taskPoints * 100) / 100} weight=${wTask}
// managerRating: raw=${managerRatingRaw} points=${Math.round(managerPoints * 100) / 100} weight=${wMgr}
// contributions: raw=${contributionPoints} points=${Math.round(contribPoints * 100) / 100} weight=${wContrib}
// creativeBonus: ${creativeBonus}`);

  return {
    excluded: false,
    total,
    components: {
      satisfaction: {
        raw: satisfactionRaw,
        points: Math.round(satisfactionPoints * 100) / 100,
        weight: wSat,
      },
      tasks: {
        raw: taskRate,
        verified: verifiedCount,
        assigned: totalAssigned,
        points: Math.round(taskPoints * 100) / 100,
        weight: wTask,
      },
      managerRating: {
        raw: managerRatingRaw,
        wasDefaulted: !mgrRatings?.length,
        points: Math.round(managerPoints * 100) / 100,
        weight: wMgr,
      },
      contributions: {
        raw: contributionPoints,
        points: Math.round(contribPoints * 100) / 100,
        weight: wContrib,
      },
      creativeBonus: {
        raw: isCreativeOfWeek ? 1 : 0,
        points: creativeBonus,
        weight: 5,
        isCreativeOfWeek,
      },
    },
  };
}

async function scoreCompute(userId, weekStart, config) {
  const weekStartDate = new Date(weekStart);
  const weekStartStr = toDateStr(weekStartDate);
  const weekEndDate = new Date(weekStartDate.getTime() + 7 * 86400000);
  const weekEndStr = toDateStr(weekEndDate);

  // On leave this week?
  const { data: leave } = await supabase
    .from("staff_leave")
    .select("id")
    .eq("staff_id", userId)
    .eq("week_start", weekStartStr)
    .maybeSingle();
  if (leave)
    return { excluded: true, components: { reason: "on_leave" }, total: 0 };

  const { data: user } = await supabase
    .from("users")
    .select("role, created_at")
    .eq("id", userId)
    .single();
  if (!user) return null;

  const joinDate = new Date(user.created_at);
  const weeksSinceJoin =
    (weekStartDate.getTime() - joinDate.getTime()) / (7 * 86400000);

  if (weeksSinceJoin < 0) {
    return {
      excluded: true,
      components: { reason: "not_joined_yet" },
      total: 0,
    };
  }
  if (weeksSinceJoin < 2) {
    return { excluded: true, components: { reason: "new_staff" }, total: 0 };
  }

  const { data: assignments } = await supabase
    .from("staff_brand_assignments")
    .select("brand_id")
    .eq("staff_id", userId);

  const brandIds = (assignments ?? []).map((a) => a.brand_id);
  const hasClientBrands = brandIds.length > 0;

  // ── 1. Client Satisfaction ──────────────────────────────────────
  let satisfactionRaw = null;
  if (hasClientBrands) {
    const { data: ratings } = await supabase
      .from("client_satisfaction")
      .select("nps_score, brand_id, created_at")
      .in("brand_id", brandIds)
      .lte("created_at", weekEndStr); // FIX: weekEnd → weekEndStr

    const thisWeek = (ratings ?? []).filter(
      (r) => r.created_at >= weekStartStr && r.created_at < weekEndStr, // FIX: weekEnd → weekEndStr
    );
    if (thisWeek.length > 0) {
      satisfactionRaw =
        thisWeek.reduce((s, r) => s + r.nps_score, 0) / thisWeek.length;
    } else {
      const threeWeeksAgo = toDateStr(
        new Date(weekStartDate.getTime() - 21 * 86400000),
      );
      const recent = (ratings ?? [])
        .filter((r) => r.created_at >= threeWeeksAgo)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (recent.length > 0) satisfactionRaw = recent[0].nps_score;
    }
  }

  // ── 2. Task Completion ───────────────────────────────────────────
  // Denominator: tasks still OPEN (not cancelled/archived/verified) as of
  // the start of this week — genuinely outstanding work.
  const { data: openBacklog, error: openBacklogError } = await supabase
    .from("tasks")
    .select("id, status, updated_at")
    .eq("assignee_id", userId)
    .not("status", "in", "(cancelled,archived,verified)") // FIX: exclude verified too
    .lt("created_at", weekStartStr);

  if (openBacklogError) {
    console.error("[scoreCompute] openBacklog error:", openBacklogError);
  }

  // Numerator: tasks verified DURING this week specifically — queried
  // separately since a verified task is excluded from openBacklog above.
  const { data: verifiedThisWeekRows, error: verifiedError } = await supabase
    .from("tasks")
    .select("id, status, updated_at, created_at")
    .eq("assignee_id", userId)
    .eq("status", "verified")
    .lt("created_at", weekStartStr) // only counts pre-existing backlog, not tasks created this week
    .gte("updated_at", weekStartStr)
    .lt("updated_at", weekEndStr);

  if (verifiedError) {
    console.error("[scoreCompute] verifiedThisWeek error:", verifiedError);
  }

  const totalAssigned =
    (openBacklog ?? []).length + (verifiedThisWeekRows ?? []).length;
  const verifiedThisWeek = (verifiedThisWeekRows ?? []).length;

  const taskRate = totalAssigned > 0 ? verifiedThisWeek / totalAssigned : null;

  console.log("[scoreCompute] taskRate:", taskRate);

  // ── 3. Manager Rating ─────────────────────────────────────────────
  const { data: mgrRatings } = await supabase
    .from("weekly_ratings")
    .select("score, is_creative_of_week")
    .eq("staff_id", userId)
    .eq("week_start", weekStartStr);

  const managerRatingRaw = mgrRatings?.length
    ? mgrRatings.reduce((s, r) => s + r.score, 0) / mgrRatings.length
    : 3;

  const isCreativeOfWeek = (mgrRatings ?? []).some(
    (r) => r.is_creative_of_week,
  );

  console.log(
    "[scoreCompute] managerRatingRaw:",
    managerRatingRaw,
    "isCreativeOfWeek:",
    isCreativeOfWeek,
  );

  // ── 4. Contributions ────────────────────────────────────────────
  const { data: claims } = await supabase
    .from("contribution_claims")
    .select("points_awarded")
    .eq("staff_id", userId)
    .eq("week_start", weekStartStr)
    .eq("status", "verified")
    .order("points_awarded", { ascending: false })
    .limit(2);

  const contributionPoints = (claims ?? []).reduce(
    (s, c) => s + (c.points_awarded || 0),
    0,
  );
  console.log("[scoreCompute] contributionPoints:", contributionPoints);

  // ── Weights ─────────────────────────────────────────────────────
  let wSat = config.staff_satisfaction_weight;
  let wTask = config.staff_task_weight;
  let wMgr = config.staff_manager_rating_weight;
  let wContrib = config.staff_contribution_weight;

  if (!hasClientBrands || satisfactionRaw === null) {
    const redistribute = wSat;
    wSat = 0;
    wMgr += Math.round(redistribute * 0.6);
    wTask += redistribute - Math.round(redistribute * 0.6);
  }

  const satisfactionPoints =
    satisfactionRaw !== null ? (satisfactionRaw / 10) * wSat : 0;
  const taskPoints =
    taskRate !== null ? Math.round(taskRate * wTask * 100) / 100 : 0;
  const managerPoints = (managerRatingRaw / 5) * wMgr;
  const contribPoints = Math.min(contributionPoints, wContrib);
  const creativeBonus = isCreativeOfWeek ? 5 : 0;

  const total =
    Math.round(
      (satisfactionPoints +
        taskPoints +
        managerPoints +
        contribPoints +
        creativeBonus) *
        100,
    ) / 100;

  const result = {
    excluded: false,
    total,
    components: {
      satisfaction: {
        raw: satisfactionRaw,
        points: Math.round(satisfactionPoints * 100) / 100,
        weight: wSat,
      },
      tasks: {
        raw: taskRate,
        verified: verifiedThisWeek,
        assigned: totalAssigned,
        points: taskPoints,
        weight: wTask,
      },
      managerRating: {
        raw: managerRatingRaw,
        wasDefaulted: !mgrRatings?.length,
        points: Math.round(managerPoints * 100) / 100,
        weight: wMgr,
      },
      contributions: {
        raw: contributionPoints,
        points: Math.round(contribPoints * 100) / 100,
        weight: wContrib,
      },
      creativeBonus: {
        raw: isCreativeOfWeek ? 1 : 0,
        points: creativeBonus,
        weight: 5,
        isCreativeOfWeek,
      },
    },
  };
  await saveScore(userId, "staff", weekStartStr, result);
  return result;
}

// ── Persistence helper ───────────────────────────────────────────
async function saveScore(userId, scoreType, weekStartStr, result) {
  const { error } = await supabase.from("weekly_scores").upsert(
    {
      user_id: userId,
      score_type: scoreType,
      week_start: weekStartStr,
      components: result.components,
      total: result.total,
      excluded: result.excluded,
    },
    { onConflict: "user_id,score_type,week_start" },
  );

  if (error) {
    console.error(
      `[scoreCompute] Failed saving score user=${userId} week=${weekStartStr}:`,
      error,
    );
  }
}

// ── Brand Admin score ─────────────────────────────────────────────

async function computeBrandAdminScore(userId, brandId, weekStartDate, config) {
  const weekStart = toDateStr(weekStartDate);
  const weekEnd = toDateStr(new Date(weekStartDate.getTime() + 7 * 86400000));

  const { data: leave } = await supabase
    .from("staff_leave")
    .select("id")
    .eq("staff_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (leave) {
    const result = { excluded: true, components: { reason: "on_leave" }, total: 0 };
    await saveScore(userId, "brand_admin", weekStart, result);
    return result;
  }

  const { data: user } = await supabase
    .from("users")
    .select("created_at")
    .eq("id", userId)
    .single();
  if (!user) return null;

  const weeksSinceJoin =
    (weekStartDate.getTime() - new Date(user.created_at).getTime()) /
    (7 * 86400000);
  if (weeksSinceJoin < 2) {
    const result = { excluded: true, components: { reason: "new_staff" }, total: 0 };
    await saveScore(userId, "brand_admin", weekStart, result);
    return result;
  }

  // ── 1. Client Satisfaction (30) ──────────────────────────────────
  const { data: ratings } = await supabase
    .from("client_satisfaction")
    .select("nps_score, created_at")
    .eq("brand_id", brandId)
    .lte("created_at", weekEnd);

  const thisWeek = (ratings ?? []).filter(
    (r) => r.created_at >= weekStart && r.created_at < weekEnd,
  );
  let satisfactionRaw = thisWeek.length
    ? thisWeek.reduce((s, r) => s + r.nps_score, 0) / thisWeek.length
    : null;

  if (satisfactionRaw === null) {
    const threeWeeksAgo = toDateStr(
      new Date(weekStartDate.getTime() - 21 * 86400000),
    );
    const recent = (ratings ?? [])
      .filter((r) => r.created_at >= threeWeeksAgo)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (recent.length > 0) satisfactionRaw = recent[0].nps_score;
  }

  // ── 2. Team Completion (25) — raw count of tasks verified this week,
  // scaled against a weekly target. No backlog, no ratio, no assignee
  // matching beyond "verified by this user this week."
  const weeklyTaskTarget = config.brand_admin_weekly_task_target ?? 8;

  const { data: verifiedThisWeekRows, error: verifiedError } = await supabase
   .from("tasks")
  .select("id")
  .eq("verified_by", userId)   // I am the one who verified it — not who it's assigned to
  .eq("status", "verified")    // it's actually in the verified state
  .gte("updated_at", weekStart)  // the verification happened on/after this week started
  .lt("updated_at", weekEnd); 

if (verifiedError) {
  console.error("[computeBrandAdminScore] verifiedThisWeek error:", verifiedError);
}

console.log("[computeBrandAdminScore] verifiedThisWeekRows:", verifiedThisWeekRows.length);

const verifiedCount = (verifiedThisWeekRows ?? []).length;
const taskRate = Math.min(verifiedCount / weeklyTaskTarget, 1);

  // ── 3. Goal Achievement (25) — same as Manager Rating ────────────
  const { data: mgrRatings } = await supabase
    .from("weekly_ratings")
    .select("score")
    .eq("staff_id", userId)
    .eq("week_start", weekStart);

  const managerRatingRaw = mgrRatings?.length
    ? mgrRatings.reduce((s, r) => s + r.score, 0) / mgrRatings.length
    : 3;

  // ── 4. New Brief Revenue (20) — same as Contributions ────────────
  const { data: claims } = await supabase
    .from("contribution_claims")
    .select("points_awarded")
    .eq("staff_id", userId)
    .eq("week_start", weekStart)
    .eq("status", "verified")
    .order("points_awarded", { ascending: false })
    .limit(2);

  const contributionPoints = (claims ?? []).reduce(
    (s, c) => s + (c.points_awarded || 0),
    0,
  );

  // ── Weights ───────────────────────────────────────────────────────
  const wSat = satisfactionRaw !== null ? config.brand_admin_clarity_weight : 0;
  const wTask =
    config.brand_admin_task_weight +
    (satisfactionRaw === null
      ? Math.round(config.brand_admin_clarity_weight * 0.4)
      : 0);
  const wMgr =
    config.brand_admin_rating_weight +
    (satisfactionRaw === null
      ? Math.round(config.brand_admin_clarity_weight * 0.6)
      : 0);
  const wContrib = config.brand_admin_contribution_weight;

  const satisfactionPoints =
    satisfactionRaw !== null ? (satisfactionRaw / 10) * wSat : 0;
  const taskPoints = Math.round(taskRate * wTask * 100) / 100;
  const managerPoints = (managerRatingRaw / 5) * wMgr;
  const contribPoints = Math.min(contributionPoints, wContrib);

  const total =
    Math.round(
      (satisfactionPoints + taskPoints + managerPoints + contribPoints) * 100,
    ) / 100;

  const result = {
    excluded: false,
    total,
    components: {
      satisfaction: { raw: satisfactionRaw, points: Math.round(satisfactionPoints * 100) / 100, weight: wSat },
      tasks: { raw: verifiedCount, target: weeklyTaskTarget, points: taskPoints, weight: wTask },
      managerRating: { raw: managerRatingRaw, wasDefaulted: !mgrRatings?.length, points: Math.round(managerPoints * 100) / 100, weight: wMgr },
      contributions: { raw: contributionPoints, points: Math.round(contribPoints * 100) / 100, weight: wContrib },
    },
  };

  await saveScore(userId, "brand_admin", weekStart, result);
  return result;
}

// ── Compute missing scores — FIXED ───────────────────────────────
// FIX 6: loops through last weeksBack weeks (not just one)

async function computeMissingScores(weeksBack = 8, force = false) {
  const config = await getConfig();
  const weekRange = getWeekRange(weeksBack);
  const computed = [];

  const { data: staff, error: staffError } = await supabase
    .from("users")
    .select("id, created_at")
    .eq("is_active", true);

  if (staffError) throw staffError;

  const staffMap = new Map(
    (staff ?? []).map((s) => [s.id, { id: s.id, created_at: s.created_at }]),
  );

  const { data: brandAdmins, error: brandAdminError } = await supabase
    .from("staff_brand_assignments")
    .select("staff_id, brand_id, roles_on_brand")
    .contains("roles_on_brand", ["brand_admin"]);

  if (brandAdminError) throw brandAdminError;

  for (const week of weekRange) {
    const weekStr = toDateStr(week);

    // ============================================================
    // STAFF SCORES — now via scoreCompute (the sanctioned staff path)
    // ============================================================
    for (const s of staff ?? []) {
      const joinDate = new Date(s.created_at);
      if (joinDate >= week) {
        console.log(`[score] ${s.id} week=${weekStr} skipped=not_joined_yet`);
        continue;
      }

      if (!force) {
        const { data: existing, error: existingError } = await supabase
          .from("weekly_scores")
          .select("id, excluded")
          .eq("user_id", s.id)
          .eq("score_type", "staff")
          .eq("week_start", weekStr)
          .maybeSingle();

        if (existingError) {
          console.error(
            `[score] Failed checking existing staff score user=${s.id} week=${weekStr}:`,
            existingError,
          );
          continue;
        }

        if (existing && !existing.excluded) {
          continue; // already scored under the current formula, don't redo
        }
      }

      // scoreCompute saves internally — no manual upsert needed here.
      const result = await scoreCompute(s.id, week, config);
      if (!result) continue;

      if (!result.excluded) {
        const rolling = await getRollingAverage(s.id, "staff");
        computed.push({
          user_id: s.id,
          total: result.total,
          rolling_avg: rolling ?? result.total,
        });
      }
    }

    // ============================================================
    // BRAND ADMIN SCORES
    // ============================================================
    for (const ba of brandAdmins ?? []) {
      const user = staffMap.get(ba.staff_id);
      if (!user) {
        console.log(`[score] ${ba.staff_id} week=${weekStr} brand_admin_skipped=user_not_active`);
        continue;
      }

      const joinDate = new Date(user.created_at);
      if (joinDate >= week) {
        console.log(`[score] ${ba.staff_id} week=${weekStr} brand_admin_skipped=not_joined_yet`);
        continue;
      }

      if (!force) {
        const { data: existing, error: existingError } = await supabase
          .from("weekly_scores")
          .select("id, excluded")
          .eq("user_id", ba.staff_id)
          .eq("score_type", "brand_admin")
          .eq("week_start", weekStr)
          .maybeSingle();

        if (existingError) {
          console.error(
            `[score] Failed checking existing brand admin score user=${ba.staff_id} week=${weekStr}:`,
            existingError,
          );
          continue;
        }

        if (existing && !existing.excluded) {
          continue; // already scored under the current formula, don't redo
        }
      }

      // computeBrandAdminScore also saves internally now.
      const result = await computeBrandAdminScore(ba.staff_id, ba.brand_id, week, config);
      if (!result) continue;

      if (!result.excluded) {
        const rolling = await getRollingAverage(ba.staff_id, "brand_admin");
        computed.push({
          user_id: ba.staff_id,
          total: result.total,
          rolling_avg: rolling ?? result.total,
        });
      }
    }
  }

  if (computed.length > 0) {
    notify.onScoresPublished(computed);
  }

  return {
    weeks: weekRange.map(toDateStr),
    computed: computed.length,
    forced: force,
  };
}

// One-time backfill after the Team Completion / task-rate formula rework.
// Recomputes and overwrites ALL weeks in range, even ones that already
// have a non-excluded score — use once, then go back to normal scheduled
// runs (force=false, the default) so future calls don't redo settled weeks.
async function backfillWithNewFormula(weeksBack = 12) {
  console.log(`[backfillWithNewFormula] Recomputing last ${weeksBack} weeks under the new formula...`);
  const result = await computeMissingScores(weeksBack, true);
  console.log(`[backfillWithNewFormula] Done:`, result);
  return result;
}

// ── One-time backfill ─────────────────────────────────────────────

async function backfillAllScores(weeksBack = 12) {
  // Delete all stale new_staff exclusions — they will be recomputed
  await supabase
    .from("weekly_scores")
    .delete()
    .eq("excluded", true)
    .filter("components->reason", "eq", "new_staff");

  return computeMissingScores(weeksBack);
}

module.exports = {
  computeMissingScores,
  computeStaffScore,
  computeBrandAdminScore,
  backfillAllScores,
  getRollingAverage,
  backfillWithNewFormula,
  getConfig,
  toDateStr,
  lastCompletedWeekStart,
  mondayOf,
  scoreCompute,
};
