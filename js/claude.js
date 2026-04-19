// js/claude.js — Claude API integration (browser-side)

import { CLAUDE_MODEL, CONSTRAINTS, NIGHT_TYPES } from './config.js';

const CLAUDE_KEY = 'mealplanner_claude_key';

export function getClaudeKey() {
  return localStorage.getItem(CLAUDE_KEY) || '';
}

export function saveClaudeKey(key) {
  localStorage.setItem(CLAUDE_KEY, key);
}

async function callClaude(messages, system = '', usePdfBeta = false) {
  const key = getClaudeKey();
  if (!key) throw new Error('Claude API key not set. Go to Settings.');

  const headers = {
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
  };
  if (usePdfBeta) headers['anthropic-beta'] = 'pdfs-2024-09-25';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

// --- PDF Metadata Extraction ---
export async function extractRecipeMetadata(pdfBase64) {
  const system = `You are a recipe data extractor. Given a recipe (from a PDF), extract structured metadata and return ONLY valid JSON matching the schema exactly. Do not include any text outside the JSON.`;

  const schema = `{
  "name": "string",
  "description": "string (1-2 sentence summary)",
  "total_time": "number (minutes, null if unknown)",
  "active_cook_time": "number (minutes, null if unknown)",
  "prep_time": "number (minutes, null if unknown)",
  "servings": "string",
  "ingredients": ["array of ingredient strings"],
  "directions": "string (full directions text)",
  "notes": "string",
  "cuisine_type": "string (e.g. Italian, American, Thai, etc.)",
  "spice_level": "one of: mild, medium, spicy",
  "make_ahead_potential": "boolean",
  "is_vegetarian": "boolean",
  "is_fish": "boolean (true if main protein is seafood/fish)",
  "is_pasta": "boolean (true if pasta is the main component)",
  "categories": ["array of category tags"],
  "source_url": "string or null"
}`;

  const userMessage = {
    role: 'user',
    content: [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: pdfBase64,
        },
      },
      {
        type: 'text',
        text: `Extract recipe metadata from this PDF and return JSON matching this schema:\n${schema}\n\nReturn ONLY the JSON object, no other text.`,
      },
    ],
  };

  const text = await callClaude([userMessage], system, true);

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude returned no JSON for recipe extraction.');
  return JSON.parse(jsonMatch[0]);
}

// --- Weekly Plan Generation ---
export async function generateWeeklyPlan({ recipes, votes, nights, history }) {
  const system = `You are a helpful family meal planner. Generate a weekly dinner plan based on family votes, dietary constraints, and cooking time preferences. Return ONLY valid JSON.`;

  // Build recipe summaries with vote scores
  const voteData = votes?.votes || {};
  const rankedRecipes = recipes
    .filter(r => r.approved)
    .map(r => {
      const v = voteData[r.id] || { thumbs_up: 0, thumbs_down: 0, neutral: 0 };
      const score = (v.thumbs_up * 2) - (v.thumbs_down * 2) + (v.neutral * 0);
      return { ...r, vote_score: score, vote_data: v };
    })
    .sort((a, b) => b.vote_score - a.vote_score);

  // Recent history (avoid repeats)
  const recentIds = new Set(
    (history || [])
      .slice(-4)
      .flatMap(w => (w.nights || []).map(n => n.recipe_id))
  );

  const recipeList = rankedRecipes.slice(0, 30).map(r =>
    `- ID: ${r.id} | "${r.name}" | Score: ${r.vote_score} | ` +
    `Time: ${r.total_time ?? '?'}min total, ${r.active_cook_time ?? '?'}min active | ` +
    `Veg: ${r.is_vegetarian} | Fish: ${r.is_fish} | Pasta: ${r.is_pasta} | ` +
    `Spice: ${r.spice_level} | Cuisine: ${r.cuisine_type} | ` +
    `MakeAhead: ${r.make_ahead_potential} | Ingredients: ${(r.ingredients || []).slice(0, 5).join(', ')} | ` +
    `Recently used: ${recentIds.has(r.id)}`
  ).join('\n');

  const nightList = nights.map((n, i) =>
    `Night ${i + 1} (${n.day}): ${NIGHT_TYPES[n.type]?.emoji} ${n.type} — ${NIGHT_TYPES[n.type]?.desc}`
  ).join('\n');

  const prompt = `Plan ${nights.length} dinners for this week.

NIGHT REQUIREMENTS:
${nightList}

HARD CONSTRAINTS:
- Max ${CONSTRAINTS.max_fish} fish/seafood dish per week
- Max ${CONSTRAINTS.max_pasta} pasta dish per week
- At least ${CONSTRAINTS.min_vegetarian} vegetarian dish per week
- For "quick" nights: recipe must have total_time < 45 min
- For "minimal" nights: recipe must have make_ahead_potential = true OR active_cook_time < 15 min
- Avoid recently used recipes (marked "Recently used: true") if possible

SOFT CONSTRAINTS (optimize for):
- Use higher vote scores preferentially
- Vary cuisine types across the week
- Balance spice levels (not all spicy or all mild)
- Identify "cook once, use twice" opportunities where recipe ingredients overlap
- Consider ingredient overlap for efficiency

AVAILABLE RECIPES:
${recipeList}

Return JSON in this exact format:
{
  "nights": [
    { "day": "Monday", "date": "YYYY-MM-DD", "type": "normal", "recipe_id": "exact-id-from-list", "notes": "" }
  ],
  "cook_once_suggestions": ["suggestion string", ...],
  "prep_ahead_suggestions": ["suggestion string", ...]
}

Use the exact recipe IDs from the list. Return ONLY JSON.`;

  const text = await callClaude([{ role: 'user', content: prompt }], system);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude returned no JSON for plan generation.');
  return JSON.parse(jsonMatch[0]);
}
