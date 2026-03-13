// Real AI service — calls Anthropic API via Vercel serverless function at /api/claude

const API_URL = '/api/claude'
const MODEL_SONNET = 'claude-sonnet-4-20250514'
const MODEL_OPUS = 'claude-opus-4-20250514'

function buildSchemaPrompt(schema) {
  const cols = Object.entries(schema)
    .filter(([, def]) => def.type !== 'ignore')
    .map(([col, def]) => `- ${col} (${def.type}): "${def.label}"`)
    .join('\n')

  return `You are a senior data analyst. The user has uploaded a dataset with the following columns:

${cols}

IMPORTANT RULES:
- Dimensions are text/category columns for grouping.
- Metrics are numeric columns for aggregation (SUM, COUNT, etc).
- NEVER use AVG on rate columns (CTR, eCPC, eCPM, conversion rate, etc). Always compute rates as ratios: CTR = SUM(clicks)/SUM(impressions), eCPC = SUM(cost)/SUM(clicks), etc.
- When asked about totals, SUM the metric columns.
- When grouping, use SUM for metrics unless the user specifically asks for averages of non-rate columns.
- Be precise with numbers. Format currency with $ and commas. Format percentages with %.
- Keep answers concise and actionable. Use bullet points for clarity.
- If the data doesn't contain what the user is asking about, say so clearly.`
}

function cleanHistory(messages) {
  if (!messages || messages.length === 0) return []
  const recent = messages.slice(-8)
  return recent.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.role === 'user' ? (msg.content || '') : (msg.content || '').slice(0, 400)
  })).filter(msg => msg.content && msg.content.trim().length > 0)
}

function buildQueryPrompt(question, schema, history) {
  const system = buildSchemaPrompt(schema) + `\n\nThe user will ask a question. You may also see previous conversation for context.

Respond with ONLY a JSON object (no markdown, no backticks, no explanation) describing how to aggregate the data:
{
  "dimensions": ["col_name"],
  "metrics": ["col_name"],
  "sort_by": "col_name",
  "sort_dir": "desc",
  "limit": 20,
  "description": "Brief description of what this query does"
}

If the user asks for totals with no grouping, use empty dimensions array.
If the question doesn't relate to the data, respond with: {"error": "I can't answer that from this dataset."}
If the user asks a follow-up question (like "is that a lot?", "break it down", "show me more", "compare that"), use the conversation history to understand what they're referring to and build an appropriate query.`

  const messages = []
  cleanHistory(history).forEach(msg => messages.push(msg))
  messages.push({ role: 'user', content: question })
  return { system, messages }
}

function buildAnswerPrompt(question, schema, queryResult, totalsRow, history) {
  const system = buildSchemaPrompt(schema) + `\n\nYou are answering a data question. You have been given the aggregated results from the user's dataset.

CRITICAL: Use the TOTALS row provided for any aggregate numbers. Do NOT try to sum the result rows yourself — the TOTALS row is computed precisely.

You may also see previous conversation for context. If the user asks follow-up questions, use the conversation history to give a relevant answer.

Provide a clear, concise, actionable answer. Use specific numbers from the data. Format large numbers with commas and appropriate units ($, %, K, M).`

  const dataStr = JSON.stringify({ TOTALS: totalsRow, rows: queryResult.slice(0, 30) })
  const messages = []
  cleanHistory(history).forEach(msg => messages.push(msg))
  messages.push({ role: 'user', content: `Question: ${question}\n\nData results:\n${dataStr}` })
  return { system, messages }
}

async function callClaude(system, messages, maxTokens = 1024, model = MODEL_SONNET) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, max_tokens: maxTokens, model }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'API request failed' }))
    throw new Error(err.error || `API error ${res.status}`)
  }

  const data = await res.json()
  const text = data.content?.map(c => c.text || '').join('') || ''
  const usage = data.usage || {}
  return { text, usage }
}

export async function askAI(question, schema, rawData, aggregateFn, history = []) {
  // Call 1: Get query plan (Sonnet — fast and cheap)
  const { system: sys1, messages: msgs1 } = buildQueryPrompt(question, schema, history)
  const call1 = await callClaude(sys1, msgs1, 500, MODEL_SONNET)

  let queryPlan
  try {
    const cleaned = call1.text.replace(/```json|```/g, '').trim()
    queryPlan = JSON.parse(cleaned)
  } catch {
    return {
      answer: call1.text, sql: null,
      tokensUsed: { input: call1.usage.input_tokens || 0, output: call1.usage.output_tokens || 0 },
      estimatedCost: ((call1.usage.input_tokens || 0) * 3 + (call1.usage.output_tokens || 0) * 15) / 1_000_000,
    }
  }

  if (queryPlan.error) {
    return { answer: queryPlan.error, sql: null, tokensUsed: { input: 0, output: 0 }, estimatedCost: 0 }
  }

  const dims = queryPlan.dimensions || []
  const mets = queryPlan.metrics || []
  let results = aggregateFn(dims, mets)

  if (queryPlan.sort_by && results.length > 0) {
    results.sort((a, b) => {
      const va = a[queryPlan.sort_by] || 0; const vb = b[queryPlan.sort_by] || 0
      return queryPlan.sort_dir === 'asc' ? va - vb : vb - va
    })
  }

  const limit = queryPlan.limit || 200
  results = results.slice(0, limit)

  const totals = { _ROW: 'TOTALS' }
  mets.forEach(m => { totals[m] = results.reduce((sum, row) => sum + (parseFloat(row[m]) || 0), 0) })

  // Call 2: Expert answer (Sonnet — fast and cheap)
  const { system: sys2, messages: msgs2 } = buildAnswerPrompt(question, schema, results, totals, history)
  const call2 = await callClaude(sys2, msgs2, 1024, MODEL_SONNET)

  const totalInput = (call1.usage.input_tokens || 0) + (call2.usage.input_tokens || 0)
  const totalOutput = (call1.usage.output_tokens || 0) + (call2.usage.output_tokens || 0)

  return {
    answer: call2.text,
    sql: `Dimensions: [${dims.join(', ')}]\nMetrics: [${mets.join(', ')}]\nSort: ${queryPlan.sort_by} ${queryPlan.sort_dir}\nLimit: ${limit}\n\n// ${queryPlan.description || ''}`,
    tokensUsed: { input: totalInput, output: totalOutput },
    estimatedCost: (totalInput * 3 + totalOutput * 15) / 1_000_000,
  }
}

export async function getInsights(schema, rawData, aggregateFn) {
  const metrics = Object.entries(schema).filter(([, d]) => d.type === 'metric').map(([col, d]) => ({ col, label: d.label }))
  const dimensions = Object.entries(schema).filter(([, d]) => d.type === 'dimension').map(([col, d]) => ({ col, label: d.label }))

  const summaryParts = []
  metrics.slice(0, 5).forEach(m => {
    const vals = rawData.map(r => parseFloat(String(r[m.col] ?? 0).replace(/[,$%]/g, ''))).filter(v => !isNaN(v))
    summaryParts.push(`${m.label}: total=${vals.reduce((a, b) => a + b, 0).toLocaleString()}, rows=${vals.length}`)
  })

  if (dimensions.length > 0 && metrics.length > 0) {
    const topData = aggregateFn([dimensions[0].col], [metrics[0].col])
      .sort((a, b) => (b[metrics[0].col] || 0) - (a[metrics[0].col] || 0))
      .slice(0, 5)
    summaryParts.push(`\nTop ${dimensions[0].label} by ${metrics[0].label}:\n` +
      topData.map(r => `  ${r[dimensions[0].col]}: ${r[metrics[0].col]?.toLocaleString()}`).join('\n'))
  }

  const system = buildSchemaPrompt(schema) + `\n\nYou are a world-class strategic analyst providing deep, actionable insights from data. Respond with ONLY a JSON array (no markdown, no backticks) of 4-5 insights:
[
  {
    "type": "opportunity|trend|alert|recommendation",
    "title": "Short title",
    "description": "2-3 sentence actionable insight with specific numbers. Be strategic and specific — connect data points to business implications. Don't just state facts, explain what they mean and what action to take.",
    "impact": "high|medium|low"
  }
]

Base insights on the actual data summary provided. Be specific with numbers. Think like a senior strategist presenting to a C-suite executive. Don't be generic.`

  // Use Opus for strategic insights — deeper reasoning
  const call = await callClaude(system, [
    { role: 'user', content: `Data summary (${rawData.length} total rows):\n${summaryParts.join('\n')}\n\nProvide 4-5 strategic insights with specific, actionable recommendations.` }
  ], 1500, MODEL_OPUS)

  try {
    const cleaned = call.text.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return [{ type: 'alert', title: 'Analysis Error', description: call.text, impact: 'medium' }]
  }
}
