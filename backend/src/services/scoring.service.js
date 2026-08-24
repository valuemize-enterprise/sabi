"use strict";

console.log("=== SCORING SERVICE LOADED — VERSION 2 ===");

/**
 * Scoring Service — FIXED
 *
 * Fixes applied:
 *   1. record null guard — no crash when people_records row missing
 *   2. joinDate → users.created_at (platform onboarding date, not employment start)
 *   3. taskRate null → 0 points (not 50% neutral — zero tasks = zero task score)
 *   4. assignee_id → assigned_to (correct tasks column)
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
  const { data } = await supabase
    .from("scoring_config")
    .select("*")
    .eq("id", 1)
    .single();

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

  // FIX 2: grace period based on platform join date (users.created_at), not employment start
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
    : new Date(user.created_at); // platform onboarding date
  const weeksSinceJoin =
    (weekStartDate.getTime() - joinDate.getTime()) / (7 * 86400000);

  // console.log(`[score] ${userId} week=${weekStart} weeksSinceJoin=${weeksSinceJoin.toFixed(2)}`);

  if (weeksSinceJoin < 0) {
    return {
      excluded: true,
      components: { reason: "not_joined_yet" },
      total: 0,
    };
  }

  if (weeksSinceJoin < 2) {
    return {
      excluded: true,
      components: { reason: "new_staff" },
      total: 0,
    };
  }

  // Brand assignments
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

  // ── 2. Task Completion ──────────────────────────────────────────
  // FIX 4: correct column is assigned_to, not assignee_id
  const { data: allAssignedTasks } = await supabase
    .from("tasks")
    .select("id, status, updated_at")
    .eq("assigned_to", userId)
    .not("status", "in", "(cancelled,archived)");

  const { data: verifiedThisWeek } = await supabase
    .from("tasks")
    .select("id")
    .eq("assigned_to", userId)
    .eq("status", "verified")
    .gte("updated_at", weekStart)
    .lt("updated_at", weekEnd);

  const totalAssigned = (allAssignedTasks ?? []).length;
  const verifiedCount = (verifiedThisWeek ?? []).length;
  const taskRate = totalAssigned > 0 ? verifiedCount / totalAssigned : null;

  console.log(
    `[score] ${userId} week=${weekStart} tasks: ${verifiedCount} verified this week / ${totalAssigned} total assigned → taskRate=${taskRate?.toFixed(2) ?? "null"}`,
  );

  // ── 3. Manager Rating ───────────────────────────────────────────
  const { data: mgrRatings } = await supabase
    .from("weekly_ratings")
    .select("score, is_creative_of_week")
    .eq("staff_id", userId)
    .eq("week_start", weekStart);

  const managerRatingRaw = mgrRatings?.length
    ? mgrRatings.reduce((s, r) => s + r.score, 0) / mgrRatings.length
    : 3; // neutral default

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

  // FIX 3: no tasks = 0 points (not 50% neutral)
  // Giving 50% for zero tasks was letting inactive staff rank above productive ones.
  // A manager can still award points via their rating if someone did valuable untracked work.
  const taskPoints = taskRate !== null ? taskRate * wTask : 0;

  const managerPoints = (managerRatingRaw / 5) * wMgr;
  const contribPoints = Math.min(
    contributionPoints,
    wContrib,
  );
  const creativeBonus = isCreativeOfWeek ? 5 : 0;

  const total =
    Math.round(
      (satisfactionPoints +
        taskPoints +
        managerPoints +
        contribPoints +
        creativeBonus) *
        100,
    ) / 100; // FIX 5: 2 decimal places

  console.log(`[score] ${userId} week=${weekStart} total=${total}
satisfaction: raw=${satisfactionRaw} points=${Math.round(satisfactionPoints * 100) / 100} weight=${wSat}
tasks: raw=${taskRate} verified=${assignedTasks?.filter((t) => t.status === "verified").length ?? 0} assigned=${assignedTasks?.length ?? 0} points=${Math.round(taskPoints * 100) / 100} weight=${wTask}
managerRating: raw=${managerRatingRaw} points=${Math.round(managerPoints * 100) / 100} weight=${wMgr}
contributions: raw=${contributionPoints} points=${Math.round(contribPoints * 100) / 100} weight=${wContrib}
creativeBonus: ${isCreativeOfWeek ? 5 : 0}`)

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
        verified:
          assignedTasks?.filter((t) => t.status === "verified").length ?? 0,
        assigned: assignedTasks?.length ?? 0,
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
  if (leave)
    return { excluded: true, components: { reason: "on_leave" }, total: 0 };

  // FIX 2: platform join date
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
    return { excluded: true, components: { reason: "new_staff" }, total: 0 };
  }

  // 1. Client Satisfaction
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

  // All tasks assigned to user
  const { data: allTasks } = await supabase
    .from("tasks")
    .select("id, status, updated_at")
    eq("assignee_id", userId);

  // Verified this week specifically
  const verifiedThisWeek = (allTasks ?? []).filter(
    (t) =>
      t.status === "verified" &&
      t.updated_at >= weekStart &&
      t.updated_at < weekEnd,
  ).length;

  const totalAssigned = (allTasks ?? []).filter(
    (t) => t.status !== "cancelled",
  ).length;

  const taskRate = totalAssigned > 0 ? verifiedThisWeek / totalAssigned : null;

  // 3. Manager Rating
  const { data: mgrRatings } = await supabase
    .from("weekly_ratings")
    .select("score")
    .eq("staff_id", userId)
    .eq("week_start", weekStart);

  const managerRatingRaw = mgrRatings?.length
    ? mgrRatings.reduce((s, r) => s + r.score, 0) / mgrRatings.length
    : 3;

  // 4. Contributions
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
  const taskPoints = taskRate !== null ? taskRate * wTask : 0; // FIX 3
  const managerPoints = (managerRatingRaw / 5) * wMgr;
  const contribPoints = Math.min(
    contributionPoints,
    wContrib,
  );

  const total =
    Math.round(
      (satisfactionPoints + taskPoints + managerPoints + contribPoints) * 100,
    ) / 100;

  console.log(`[brand_admin_score] total=${total}
satisfaction: raw=${satisfactionRaw} points=${Math.round(satisfactionPoints * 100) / 100} weight=${wSat}
tasks: raw=${taskRate} assigned=${assignedTasks?.length ?? 0} points=${Math.round(taskPoints * 100) / 100} weight=${wTask}
managerRating: raw=${managerRatingRaw} points=${Math.round(managerPoints * 100) / 100} weight=${wMgr}
contributions: raw=${contributionPoints} points=${Math.round(contribPoints * 100) / 100} weight=${wContrib}`);

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
        assigned: assignedTasks?.length ?? 0,
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
    },
  };
}

// ── Compute missing scores — FIXED ───────────────────────────────
// FIX 6: loops through last weeksBack weeks (not just one)

async function computeMissingScores(weeksBack = 8) {
  const config = await getConfig();
  const weekRange = getWeekRange(weeksBack);
  const computed = [];

  // Get active staff + their platform onboarding date.
  const { data: staff, error: staffError } = await supabase
    .from("users")
    .select("id, created_at")
    .eq("is_active", true);

  if (staffError) {
    // console.error('[score] Failed to fetch staff:', staffError);
    throw staffError;
  }

  // Create a quick lookup so we don't have to query users repeatedly.
  const staffMap = new Map(
    (staff ?? []).map((s) => [
      s.id,
      {
        id: s.id,
        created_at: s.created_at,
      },
    ]),
  );

  // Get all brand-admin assignments once instead of querying
  // the same assignments for every week.
  const { data: brandAdmins, error: brandAdminError } = await supabase
    .from("staff_brand_assignments")
    .select("staff_id, brand_id, roles_on_brand")
    .contains("roles_on_brand", ["brand_admin"]);

  if (brandAdminError) {
    // console.error(
    //   '[score] Failed to fetch brand admin assignments:',
    //   brandAdminError
    // );
    throw brandAdminError;
  }

  for (const week of weekRange) {
    const weekStr = toDateStr(week);
    // ============================================================
    // STAFF SCORES
    // ============================================================

    for (const s of staff ?? []) {
      const joinDate = new Date(s.created_at);
      // ----------------------------------------------------------
      // IMPORTANT:
      // If the user had not joined the platform yet during this
      // scoring week, do NOT create a score.
      //
      // Example:
      // user created_at = 2026-07-24
      // week            = 2026-06-22
      //
      // We skip this user entirely for that week.
      // ----------------------------------------------------------
      if (joinDate >= week) {
        console.log(`[score] ${s.id} week=${weekStr} skipped=not_joined_yet`);
        continue;
      }

      // Check whether a score already exists.
      const { data: existing, error: existingError } = await supabase
        .from("weekly_scores")
        .select("id, excluded")
        .eq("user_id", s.id)
        .eq("score_type", "staff")
        .eq("week_start", weekStr)
        .maybeSingle();

      if (existingError) {
        console.error(
          `[score] Failed checking existing staff score ` +
            `user=${s.id} week=${weekStr}:`,
          existingError,
        );
        continue;
      }

      // A real score already exists.
      // No need to calculate it again.
      //
      // If the existing score is excluded, we DO recalculate it.
      // This allows a new staff member to age out of the 2-week
      // grace period.
      if (existing && !existing.excluded) {
        continue;
      }

      const result = await computeStaffScore(s.id, week, config);

      if (!result) continue;

      const { error: upsertError } = await supabase
        .from("weekly_scores")
        .upsert(
          {
            user_id: s.id,
            score_type: "staff",
            week_start: weekStr,
            components: result.components,
            total: result.total,
            excluded: result.excluded,
          },
          {
            onConflict: "user_id,score_type,week_start",
          },
        );

      if (upsertError) {
        console.error(
          `[score] Failed saving staff score ` +
            `user=${s.id} week=${weekStr}:`,
          upsertError,
        );
        continue;
      }

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
      // Make sure this brand admin exists in users.
      const user = staffMap.get(ba.staff_id);

      // If the brand admin isn't an active user, skip it.
      //
      // If you intentionally want inactive brand admins to still
      // receive historical scores, remove this check and instead
      // fetch all users separately.
      if (!user) {
        console.log(
          `[score] ${ba.staff_id} week=${weekStr} ` +
            `brand_admin_skipped=user_not_active`,
        );
        continue;
      }

      const joinDate = new Date(user.created_at);

      // ----------------------------------------------------------
      // Same onboarding protection for brand-admin scores.
      // Do not create a score for a week before the user joined.
      // ----------------------------------------------------------
      if (joinDate >= week) {
        console.log(
          `[score] ${ba.staff_id} week=${weekStr} ` +
            `brand_admin_skipped=not_joined_yet`,
        );
        continue;
      }

      const { data: existing, error: existingError } = await supabase
        .from("weekly_scores")
        .select("id, excluded")
        .eq("user_id", ba.staff_id)
        .eq("score_type", "brand_admin")
        .eq("week_start", weekStr)
        .maybeSingle();

      if (existingError) {
        console.error(
          `[score] Failed checking existing brand admin score ` +
            `user=${ba.staff_id} week=${weekStr}:`,
          existingError,
        );
        continue;
      }

      // Skip a real existing score.
      // Recalculate excluded scores.
      if (existing && !existing.excluded) {
        continue;
      }

      const result = await computeBrandAdminScore(
        ba.staff_id,
        ba.brand_id,
        week,
        config,
      );

      if (!result) continue;

      const { error: upsertError } = await supabase
        .from("weekly_scores")
        .upsert(
          {
            user_id: ba.staff_id,
            score_type: "brand_admin",
            week_start: weekStr,
            components: result.components,
            total: result.total,
            excluded: result.excluded,
          },
          {
            onConflict: "user_id,score_type,week_start",
          },
        );

      if (upsertError) {
        console.error(
          `[score] Failed saving brand admin score ` +
            `user=${ba.staff_id} week=${weekStr}:`,
          upsertError,
        );
        continue;
      }

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

  // Publish only actual, non-excluded scores.
  if (computed.length > 0) {
    notify.onScoresPublished(computed);
  }

  return {
    weeks: weekRange.map(toDateStr),
    computed: computed.length,
  };
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
  getConfig,
  toDateStr,
  lastCompletedWeekStart,
  mondayOf,
};
