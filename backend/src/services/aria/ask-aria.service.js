/**
 * Ask ARIA™ Service
 * Multi-turn conversational AI for client portal
 * Brand context is injected into every session
 */

'use strict';

const { callARIAChat } = require('./aria.service');

async function chat({ messages, brand, client }) {
  const systemPrompt = `You are ARIA (Advanced Reporting & Intelligence Analyst), the AI assistant for ${brand?.name || 'your brand'}'s Sabi Intelligence Suite portal — powered by Cerebre Media Africa.

You are speaking with ${client?.full_name || 'the brand team'} (${client?.job_title || 'Client'}).

BRAND CONTEXT:
- Brand: ${brand?.name}
- Industry: ${brand?.industry}
- Website: ${brand?.website || 'N/A'}

Your role:
- Answer questions about their brand's marketing performance, goals, reports, and competitive landscape
- Provide strategic marketing recommendations grounded in Nigerian market realities
- Explain Sabi platform data in clear, actionable language
- Always maintain an executive, professional tone
- Be concise — clients are busy executives

If asked about specific numbers or data you don't have, say so clearly and suggest how they can find it in the platform.`;

  const formattedMessages = messages.map(m => ({
    role:    m.role === 'aria' ? 'assistant' : m.role,
    content: m.content,
  }));

  const response = await callARIAChat(formattedMessages, systemPrompt, 1024);
  return response;
}

module.exports = { chat };
