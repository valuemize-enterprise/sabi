/**
 * ═══════════════════════════════════════════════════════════════
 * Profile Generator — Tier-1 in, draft out, human publishes
 * ═══════════════════════════════════════════════════════════════
 * Hard rule (§03): this module reads people_records through
 * TIER1_FIELDS ONLY. Widening access means editing that whitelist
 * in people.service.js — impossible to do invisibly.
 *
 * ARIA drafts the bio when ANTHROPIC_API_KEY is set; otherwise a
 * deterministic composer produces a solid non-AI draft, so the
 * onboarding flow never blocks on an API.
 */

'use strict';

const supabase = require('../config/supabase');
const { TIER1_FIELDS } = require('./people.service');
const dispatch = require('./email-dispatch.service');

const MODEL = 'claude-sonnet-4-6';

// ── core functions come from platform settings (Super Admin owned)
async function coreFunctionsFor(roleKey) {
  const { data } = await supabase.from('platform_settings')
    .select('value').eq('key', `core_functions_${roleKey}`).maybeSingle();
  if (!data?.value) return [];
  return Array.isArray(data.value) ? data.value
    : String(data.value).split('\n').map(s => s.trim()).filter(Boolean);
}

// ── skills seeded from role core functions ─────────────────────
const ROLE_SKILLS = {
  designer: ['Brand Design', 'Social Media Design', 'Canva', 'Layout & Typography'],
  copywriter: ['Copywriting', 'Brand Voice', 'Campaign Messaging', 'Editing'],
  strategist: ['Marketing Strategy', 'Campaign Planning', 'Audience Research'],
  account_manager: ['Client Relations', 'Project Coordination', 'Reporting'],
  community_manager: ['Community Management', 'Engagement', 'Social Listening'],
  cinematographer: ['Cinematography', 'Video Production', 'Lighting'],
  video_editor: ['Video Editing', 'Motion Graphics', 'Post-Production'],
  analyst: ['Data Analysis', 'Social Analytics', 'Reporting'],
};
const skillsFor = (roleKey, coreFns) =>
  ROLE_SKILLS[roleKey] || coreFns.slice(0, 4).map(f => f.split(' ').slice(0, 3).join(' '));

// ── bio composition ────────────────────────────────────────────
function fallbackBio(t1, coreFns) {
  const dept = t1.department ? ` on the ${t1.department} team` : '';
  const spark = t1.spark_line ? ` ${t1.spark_line.replace(/\.?\s*$/, '.')}` : '';
  const focus = coreFns[0] ? ` Day to day, that means ${coreFns[0].toLowerCase().replace(/\.?\s*$/, '')} — done properly, verified, and always in service of the client's goals.` : '';
  return `${t1.display_name} is a ${t1.role_title}${dept} at Cerebre Media Africa.${spark}${focus} Every piece of work carries one standard: outcomes over activity.`;
}

async function ariaBio(t1, coreFns) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Write a 60-90 word professional bio in third person for a marketing agency team profile that clients will see. Warm, confident, Nigerian-agency energy, no clichés like "passionate" or "results-driven", no emojis.

Name: ${t1.display_name}
Role: ${t1.role_title}${t1.department ? `\nTeam: ${t1.department}` : ''}
Human detail from HR: ${t1.spark_line || '(none provided)'}
What the role does: ${coreFns.slice(0, 3).join('; ') || 'creative marketing work'}

Return ONLY the bio text, nothing else.`,
        }],
      }),
    });
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return text && text.length > 40 ? text : null;
  } catch (err) {
    console.error('[generator] ARIA bio failed, using fallback:', err.message);
    return null;
  }
}

// ═══════════════ MAIN: generate (or regenerate) ════════════════
async function generateProfile(userId, { regenerate = false } = {}) {
  // TIER-1 STRUCTURAL READ — the whole point of the whitelist:
  const { data: t1, error } = await supabase.from('people_records')
    .select(TIER1_FIELDS.join(', ')).eq('user_id', userId).single();
  if (error || !t1) throw new Error(`No people record for ${userId}`);

  const coreFns = await coreFunctionsFor(t1.role_key);
  const bio = (await ariaBio(t1, coreFns)) || fallbackBio(t1, coreFns);
  const skills = skillsFor(t1.role_key, coreFns);
  const startLabel = new Date(t1.start_date)
    .toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

  const { data: existing } = await supabase.from('staff_profiles')
    .select('id, state, generation_version').eq('user_id', userId).maybeSingle();

  const row = {
    user_id: userId,
    display_name: t1.display_name,
    role_title: t1.role_title,            // read-only mirror of Tier 1
    department: t1.department,
    start_date: t1.start_date,
    bio, skills,
    work_history: [{ org: 'Cerebre Media Africa', title: t1.role_title,
                     from: startLabel, current: true }],
    state: existing?.state === 'published' && !regenerate ? 'published' : 'draft',
    generated_at: new Date().toISOString(),
    generation_version: (existing?.generation_version || 0) + 1,
  };

  if (existing) {
    await supabase.from('staff_profiles').update(row).eq('id', existing.id);
  } else {
    await supabase.from('staff_profiles').insert(row);
  }

  // onboarding + claim email (first generation only — regenerate is silent)
  const { setOnboardingStep } = require('./people.service');
  await setOnboardingStep(userId, 'profile_draft', true);

  if (!existing || !regenerate) {
    const { data: user } = await supabase.from('users')
      .select('id, email, full_name').eq('id', userId).single();
    if (user) await dispatch.send('profile_draft_ready', {
      to: user, entityId: userId, dedupe: 'once',
      data: { name: t1.display_name.split(' ')[0], roleTitle: t1.role_title },
    });
    await supabase.from('users').update({ onboarding_state: 'profile_draft' }).eq('id', userId);
  }
  return { state: row.state, generation_version: row.generation_version };
}

/** Staff publishes their reviewed draft. */
async function publishProfile(userId) {
  const { error } = await supabase.from('staff_profiles')
    .update({ state: 'published', published_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  const { setOnboardingStep } = require('./people.service');
  await setOnboardingStep(userId, 'profile_published', true);
  await supabase.from('users').update({ onboarding_state: 'profile_live' }).eq('id', userId);
  return { state: 'published' };
}

module.exports = { generateProfile, publishProfile };
