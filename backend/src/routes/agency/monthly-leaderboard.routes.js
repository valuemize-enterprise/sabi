"use strict";
const router = require("express").Router();
const supabase = require("../../config/supabase");
const { authenticate } = require("../../middleware/auth.middleware");
const { sendSuccess, sendError } = require("../../utils/response.utils");
const scoringService = require("../../services/scoring.service");

const GLOBAL_ADMIN_ROLES = [
  "super_admin",
  "ceo",
  "managing_director",
  "creative_director",
  "strategy_director",
  "account_director",
];
const isGlobalAdmin = (role) => GLOBAL_ADMIN_ROLES.includes(role);

function scoreBand(score) {
  if (score >= 90) return { band: "Exceptional", color: "purple" };
  if (score >= 75) return { band: "Strong", color: "green" };
  if (score >= 60) return { band: "Solid", color: "blue" };
  if (score >= 40) return { band: "Building", color: "amber" };
  return { band: "Building momentum", color: "gray" };
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getMondaysInMonth(year, month) {
  const mondays = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  let current = new Date(firstDay);
  while (current <= lastDay) {
    if (current.getUTCDay() === 1) mondays.push(new Date(current));
    current = new Date(current.getTime() + 86400000);
  }
  return mondays;
}

function average(nums) {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const type = req.query.type === "brand_admin" ? "brand_admin" : "staff";

    const now = new Date();
    const currentMonthYear = monthKey(now.getFullYear(), now.getMonth() + 1);
    const monthYear = req.query.month || currentMonthYear;
    const [year, month] = monthYear.split("-").map(Number);

    // Lock the current month (and any future month) until it has fully elapsed.
    if (monthYear >= currentMonthYear) {
      return sendSuccess(res, {
        type,
        period: "month",
        month: monthYear,
        isCurrentMonth: monthYear === currentMonthYear,
        locked: true,
        leaderboard: [],
        myRank: null,
        message:
          monthYear === currentMonthYear
            ? "This month's rankings will be available once the month ends."
            : "Rankings for this month aren't available yet.",
      });
    }

    const mondays = getMondaysInMonth(year, month);
    const requestedMondays = mondays.map((m) => scoringService.toDateStr(m));

    // Brand admins are excluded from the staff leaderboard.
    let brandAdminIds = new Set();
    if (type === "staff") {
      const { data: ba } = await supabase
        .from("staff_brand_assignments")
        .select("staff_id")
        .contains("roles_on_brand", ["brand_admin"]);
      brandAdminIds = new Set((ba ?? []).map((r) => r.staff_id));
    }

    // Every week in the requested month.
    const { data: raw, error } = await supabase
      .from("weekly_scores")
      .select(
        "user_id,total,week_start,users!user_id(id,full_name,avatar_url,role)",
      )
      .eq("score_type", type)
      .eq("excluded", false)
      .in("week_start", requestedMondays);
    if (error) throw error;

    const data = (raw ?? []).filter((r) => !brandAdminIds.has(r.user_id));

    const byUser = {};
    data.forEach((row) => {
      if (!byUser[row.user_id]) {
        byUser[row.user_id] = { user: row.users, scores: [] };
      }
      byUser[row.user_id].scores.push(Number(row.total));
    });

    let entries = Object.values(byUser)
      .map((v) => ({ user: v.user, score: average(v.scores) }))
      .filter((e) => e.user && e.score != null);

    // Previous month, for trend comparison.
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMondays = getMondaysInMonth(prevYear, prevMonth).map((m) =>
      scoringService.toDateStr(m),
    );

    const { data: rawPrev } = await supabase
      .from("weekly_scores")
      .select("user_id,total,week_start")
      .eq("score_type", type)
      .eq("excluded", false)
      .in("week_start", prevMondays);

    const prevData = (rawPrev ?? []).filter(
      (r) => !brandAdminIds.has(r.user_id),
    );
    const prevByUser = {};
    prevData.forEach((row) => {
      if (!prevByUser[row.user_id]) prevByUser[row.user_id] = [];
      prevByUser[row.user_id].push(Number(row.total));
    });

    entries = entries
      .map((e) => ({ ...e, prevScore: average(prevByUser[e.user.id] ?? []) }))
      .sort((a, b) => b.score - a.score);

    // Creative of the Week is tied to the last Monday of this (now-complete) month.
    let creativeOfWeekIds = new Set();
    if (type === "staff" && requestedMondays.length) {
      const lastMondayStr = requestedMondays[requestedMondays.length - 1];
      const { data: cow } = await supabase
        .from("weekly_ratings")
        .select("staff_id")
        .eq("week_start", lastMondayStr)
        .eq("is_creative_of_week", true);
      creativeOfWeekIds = new Set((cow ?? []).map((c) => c.staff_id));
    }

    const showFullScore = isGlobalAdmin(req.user.role);
    const ranked = entries.map((e, i) => {
      const sb = scoreBand(e.score);
      let trend = "same";
      if (e.prevScore != null) {
        const diff = e.score - e.prevScore;
        if (diff > 0.5) trend = "up";
        else if (diff < -0.5) trend = "down";
      }
      return {
        rank: i + 1,
        user_id: e.user.id,
        full_name: e.user.full_name,
        avatar_url: e.user.avatar_url,
        role: e.user.role,
        scoreBand: sb.band,
        scoreBandColor: sb.color,
        isCreativeOfWeek: creativeOfWeekIds.has(e.user.id),
        isSelf: e.user.id === req.user.id,
        trend,
        fullScore:
          showFullScore || e.user.id === req.user.id
            ? Math.round(e.score * 100) / 100
            : undefined,
      };
    });

    sendSuccess(res, {
      type,
      period: "month",
      month: monthYear,
      isCurrentMonth: false,
      locked: false,
      leaderboard: ranked,
      myRank: ranked.find((r) => r.isSelf)?.rank ?? null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;