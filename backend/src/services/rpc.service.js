const supabase = require("../config/supabase");

// services/people.service.js
async function setOnboardingStep(userId, step) {
  const { error } = await supabase.rpc('set_onboarding_step', {
    p_user_id: userId,
    p_step: step,
  });
  if (error) throw new Error(error.message);
}

module.exports = { setOnboardingStep };