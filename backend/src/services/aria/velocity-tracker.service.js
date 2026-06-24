/**
 * VelocityTracker™ Service
 * AI-powered goal acceleration analysis
 */

'use strict';

const { callARIAJson } = require('./aria.service');

async function analyze({ goal, tasks = [], brand }) {
  const completedTasks = tasks.filter(t => t.status === 'done');
  const progress = Math.min(100, (goal.current_value / Math.max(goal.target_value, 1)) * 100);
  const daysLeft = goal.deadline
    ? Math.max(0, Math.ceil((new Date(goal.deadline) - Date.now()) / 86400000))
    : null;
  const requiredRate = daysLeft && daysLeft > 0
    ? ((goal.target_value - goal.current_value) / daysLeft).toFixed(2)
    : null;

  const prompt = `You are VelocityTracker™, analyzing goal acceleration for a Nigerian brand.

BRAND: ${brand?.name || 'Unknown'} (${brand?.industry || 'Unknown industry'})
GOAL: ${goal.title}
METRIC TYPE: ${goal.metric_type}
TARGET: ${goal.target_value} ${goal.unit}
CURRENT: ${goal.current_value} ${goal.unit}
PROGRESS: ${progress.toFixed(1)}%
DAYS REMAINING: ${daysLeft ?? 'No deadline set'}
REQUIRED DAILY RATE: ${requiredRate ?? 'N/A'}
COMPLETED TASKS: ${completedTasks.length} of ${tasks.length} total tasks
GOAL STATUS: ${goal.status}

Analyze this goal's velocity and respond with this exact JSON:
{
  "velocityScore": <0-100 number representing pace toward goal>,
  "trajectoryLabel": "<On Track|Accelerating|Decelerating|At Risk|Critical>",
  "projectedCompletion": "<date string or 'On time' or 'Overdue'>",
  "velocityInsight": "<1 sentence on current trajectory>",
  "accelerators": ["<action 1>", "<action 2>"],
  "blockers": ["<risk 1>", "<risk 2>"],
  "recommendation": "<specific single most impactful action>",
  "nigerianContext": "<any Nigerian market factor relevant to this goal>"
}`;

  return await callARIAJson(prompt, null, 512);
}

module.exports = { analyze };
