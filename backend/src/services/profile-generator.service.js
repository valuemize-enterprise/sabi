'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Profile Generator — updated for Staff Profile Form integration
 *
 * CHANGE LOG vs. original (from sabi-people-os):
 *   · getGeneratorContext() now enriches the ARIA prompt with submitted
 *     form data (languages, work history, qualifications) when available.
 *   · ARIA receives richer context → better first-draft bios.
 *   · Deterministic fallback also uses form data when present.
 *   · publishProfile() now checks form submission state and warns HR if
 *     the profile is published before the form is submitted.
 *
 * Hard rule preserved:
 *   Tier-3 (medical) fields NEVER reach this module or the ARIA prompt.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const { supabase }      = require('../config/supabase');
const { TIER1_FIELDS }  = require('./people.service');
const { getGeneratorContext } = require('./profile-form.service');
const dispatch          = require('./email-dispatch.service');

const MODEL = 'claude-sonnet-4-6';

// ── Role skills seed (unchanged from original) ─────────────────────────
const ROLE_SKILLS = {
  designer:           ['Brand Design', 'Social Media Design', 'Canva', 'Layout & Typography'],
  copywriter:         ['Copywriting', 'Brand Voice', 'Campaign Messaging', 'Editing'],
  strategist:         ['Marketing Strategy', 'Campaign Planning', 'Audience Research'],
  account_manager:    ['Client Relations', 'Project Coordination', 'Reporting'],
  community_manager:  ['Community Management', 'Engagement', 'Social Listening'],
  cinematographer:    ['Cinematography', 'Video Production', 'Lighting'],
  video_editor:       ['Video Editing', 'Motion Graphics', 'Post-Production'],
  analyst:            ['Data Analysis', 'Social Analytics', 'Reporting'],
  photographer:       ['Photography', 'Visual Storytelling', 'Studio Lighting'],
  developer:          ['Front-End Development', 'Web Performance', 'React'],
  media_buyer:        ['Media Buying', 'Campaign Optimisation', 'ROI Tracking'],
  pr_specialist:      ['PR', 'Media Relations', 'Press Releases'],
  Executive:     ['SEO', 'Content Strategy', 'Keyword Research'],
  accountant:         ['Financial Reporting', 'Budgeting', 'Reconciliation'],
  operations:         ['Operations', 'Process Improvement', 'Vendor Management'],
};

async function coreFunctionsFor(roleKey) {
  const { data } = await supabase.from('platform_settings')
    .select('value').eq('key', `core_functions_${roleKey}`).maybeSingle();
  if (!data?.value) return [];
  return Array.isArray(data.value)
    ? data.value
    : String(data.value).split('\n').map(s => s.trim()).filter(Boolean);
}

const skillsFor = (roleKey, coreFns) =>
  ROLE_SKILLS[roleKey]
    || coreFns.slice(0, 4).map(f => f.split(' ').slice(0, 3).join(' '));

// ── Bio builders ─────────────────────────────────────────────────────────

function buildLanguageStr(languages = []) {
  if (!languages.length) return null;
  const fluent = languages.filter(l => l.speaking === 'Very Good' && l.language);
  if (!fluent.length) return null;
  const names = fluent.map(l => l.language);
  if (names.length === 1) return names[0] !== 'English' ? `fluent in ${names[0]}` : null;
  return `fluent in ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function buildExperienceStr(workHistory = [], yearsExp) {
  const count = workHistory.filter(w => w.organisation).length;
  if (!count && !yearsExp) return null;
  if (yearsExp && yearsExp >= 2) return `${yearsExp}+ years of professional experience`;
  if (count >= 2) return `background across ${count} organisations`;
  return null;
}

function buildQualStr(professional = []) {
  const certs = professional.filter(p => p.certificate_obtained).map(p => p.certificate_obtained);
  if (!certs.length) return null;
  return certs.slice(0, 2).join(', ');
}

/** Deterministic fallback — used when ANTHROPIC_API_KEY is absent or fails */
function fallbackBio(t1, coreFns, formCtx) {
  const dept   = t1.department ? ` on the ${t1.department} team` : '';
  const spark  = t1.spark_line ? ` ${t1.spark_line.replace(/\.?\s*$/, '.')}` : '';
  const focus  = coreFns[0]
    ? ` Day to day, that means ${coreFns[0].toLowerCase().replace(/\.?\s*$/, '')} — done properly, verified, and always in service of the client's goals.`
    : '';

  // Enrich with form data if available
  const expStr  = formCtx ? buildExperienceStr(formCtx.work_history, formCtx.total_years_experience) : null;
  const langStr = formCtx ? buildLanguageStr(formCtx.languages) : null;
  const expPart = expStr  ? ` With ${expStr}, the work comes from a real body of knowledge.` : '';
  const langPart = langStr ? ` ${langStr.charAt(0).toUpperCase() + langStr.slice(1)}.` : '';

  return `${t1.display_name} is a ${t1.role_title}${dept} at Cerebre Media Africa.${spark}${focus}${expPart}${langPart} Every piece of work carries one standard: outcomes over activity.`;
}

/** ARIA-generated bio — richer context when form data is present */
async function ariaBio(t1, coreFns, formCtx) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const expStr  = formCtx ? buildExperienceStr(formCtx.work_history, formCtx.total_years_experience) : null;
  const langStr = formCtx ? buildLanguageStr(formCtx.languages) : null;
  const qualStr = formCtx ? buildQualStr(formCtx.professional_qualifications) : null;

  const contextLines = [
    `Name: ${t1.display_name}`,
    `Role: ${t1.role_title}`,
    t1.department ? `Team: ${t1.department}` : null,
    `What the role does: ${coreFns.slice(0, 3).join('; ') || 'creative marketing work'}`,
    t1.spark_line ? `Key detail from HR: ${t1.spark_line}` : null,
    expStr        ? `Experience context: ${expStr}` : null,
    langStr       ? `Languages: ${langStr}` : null,
    qualStr       ? `Relevant qualifications: ${qualStr}` : null,
  ].filter(Boolean).join('\n');

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
          content: `Write a 70–100 word professional bio in third person for a marketing agency team profile that clients will see. Warm, confident, Nigerian-agency energy — no clichés like "passionate", "results-driven", or "dedicated to excellence". No emojis.

${contextLines}

Return ONLY the bio text, no preamble, no quotation marks, nothing else.`,
        }],
      }),
    });
    const data = await res.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return text && text.length > 40 ? text : null;
  } catch (e) {
    console.error('[profile-generator] ARIA error:', e?.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// generateProfile(userId, options)
//   · Called by People OS when HR creates a record (onboarding)
//   · Called again via /regenerate if HR or staff requests a refresh
//   · Now also pulls form context if the user has submitted their profile
// ─────────────────────────────────────────────────────────────────────────
async function generateProfile(userId, { regenerate = false } = {}) {
  // Guard: don't overwrite a published profile unless explicitly regenerating
  if (!regenerate) {
    const { data: existing } = await supabase
      .from('staff_profiles').select('state').eq('user_id', userId).maybeSingle();
    if (existing?.state === 'published') return { skipped: true, reason: 'Already published.' };
  }

  // Tier-1 data from people_records (same whitelist as before)
  const { data: t1 } = await supabase
    .from('people_records')
    .select(TIER1_FIELDS.join(', '))
    .eq('user_id', userId)
    .single();

  if (!t1) throw new Error('No people_records row for this user — HR must create the record first.');

  // Enrich from form submission (non-blocking; null if not yet submitted)
  const formCtx = await getGeneratorContext(userId).catch(() => null);

  const coreFns = await coreFunctionsFor(t1.role_key);
  const skills  = skillsFor(t1.role_key, coreFns);

  // Try ARIA, fall back to deterministic
  const bioText = await ariaBio(t1, coreFns, formCtx) || fallbackBio(t1, coreFns, formCtx);

  // Upsert staff_profiles
  const { data: profile, error } = await supabase
    .from('staff_profiles')
    .upsert({
      user_id:            userId,
      bio:                bioText,
      skills,
      state:              'draft',
      generated_at:       new Date().toISOString(),
      generation_version: (await currentVersion(userId)) + 1,
    }, { onConflict: 'user_id', ignoreDuplicates: false })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  // Send "your draft is ready" email
  const { data: user } = await supabase
    .from('users').select('email, full_name').eq('id', userId).single();

  if (user?.email) {
    await dispatch.send('profile_draft_ready', {
      to: { email: user.email, full_name: user.full_name },
      entityId: userId,
      dedupe: 'level',
      level: regenerate ? 2 : 1,
      data: {
        name:    user.full_name?.split(' ')[0],
        claimUrl: `${process.env.APP_URL}/my-profile`,
      },
    }).catch(() => {});
  }

  return { profile, bio: bioText, skills };
}

async function currentVersion(userId) {
  const { data } = await supabase
    .from('staff_profiles').select('generation_version').eq('user_id', userId).maybeSingle();
  return data?.generation_version ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────
// publishProfile(userId)
//   Staff clicks "Publish" on their draft.
//   Warns (but does not block) if form not yet submitted.
// ─────────────────────────────────────────────────────────────────────────
async function publishProfile(userId) {
  // Check form submission state as advisory (not a hard block)
  const { data: pr } = await supabase
    .from('people_records')
    .select('form_submission_state, display_name')
    .eq('user_id', userId)
    .maybeSingle();

  const formWarning = pr?.form_submission_state === 'not_started'
    ? 'Staff record form not yet submitted — HR will not have your official details until you complete My Profile.'
    : null;

  // Flip staff_profiles.state to 'published'
  const { data, error } = await supabase
    .from('staff_profiles')
    .update({ state: 'published', published_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('state', 'draft')
    .select('*')
    .single();

  if (error) throw new Error(error.message || 'No draft to publish — generate a draft first.');

  return { profile: data, formWarning };
}

module.exports = { generateProfile, publishProfile };
