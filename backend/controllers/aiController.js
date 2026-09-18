const Groq = require("groq-sdk");

const pool = require("../config/db");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = "llama3-70b-8192";

console.log("[aiController] GROQ_API_KEY loaded:", process.env.GROQ_API_KEY ? `${process.env.GROQ_API_KEY.slice(0, 8)}...` : "MISSING!");

const SYSTEM_PROMPT = `You are YatraVerse AI, a friendly and knowledgeable Nepal travel guide. 
You help travelers plan trips in Nepal — covering destinations, trekking routes, budgets, 
food, accommodation, culture, and itineraries. Keep responses concise, helpful, and warm.
Use occasional Nepali words like Namaste, Dhanyabad naturally. Format responses clearly.`;

exports.chat = async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      max_tokens: 1024,
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error("CHAT ERROR:", err.message);
    res.status(500).json({ error: "AI request failed", details: err.message });
  }
};

exports.tripPlan = async (req, res) => {
  const { tripName, members, preferences } = req.body;

  if (!preferences?.length) {
    return res.status(400).json({ error: "No preferences provided" });
  }

  const prefSummary = preferences
    .map(
      (p) => `
Member: ${p.name}
- Budget: ${p.budget ? `Rs. ${Number(p.budget).toLocaleString()}` : "Not specified"}
- Trip Type: ${Array.isArray(p.trip_types) && p.trip_types.length ? p.trip_types.join(", ") : "Not specified"}
- Food: ${p.food_preference || "Not specified"}
- Accommodation: ${p.accommodation || "Not specified"}
- Notes: ${p.notes || "None"}
  `,
    )
    .join("\n---\n");

  const budgets = preferences
    .filter((p) => p.budget && Number(p.budget) > 0)
    .map((p) => Number(p.budget));
  const lowestBudget = budgets.length ? Math.min(...budgets) : null;

  const prompt = `You are planning a group trip to Nepal called "${tripName}" for ${members.length} people.

Here are each member's preferences:
${prefSummary}

${
  lowestBudget
    ? `The lowest budget among members is Rs. ${lowestBudget.toLocaleString()} — use this as the limit.`
    : "No budget was specified — suggest a reasonable budget."
}

Based on ALL members' preferences, create a detailed, balanced group trip plan that works for everyone.
Find common ground and suggest compromises where needed.

Please provide:
1. 🎯 Recommended Destination(s)
2. 📅 Suggested Itinerary (day by day)
3. 🏨 Accommodation Recommendation
4. 🍽️ Food Plan (considering all dietary preferences)
5. 💰 Estimated Budget Breakdown
6. 🎒 Activities that suit everyone
7. ⚠️ Things to keep in mind for this group

Be specific, practical, and exciting!`;

  try {
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `You are YatraVerse AI, an expert Nepal travel planner. Create detailed, 
practical group trip plans. Be specific about places, costs in Nepali Rupees, and realistic timing. 
Format with clear sections and emojis.`,
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2048,
    });
    res.json({ plan: response.choices[0].message.content });
  } catch (err) {
    console.error("TRIP PLAN ERROR:", err.message);
    res.status(500).json({ error: "Failed to generate trip plan", details: err.message });
  }
};

exports.finalRecommendation = async (req, res) => {
  console.log(">>> finalRecommendation CALLED");
  const { tripId, tripName, members, preferences, chatHistory, overrideDestination } = req.body;

  console.log(">>> tripId:", tripId, "| tripName:", tripName, "| members:", members?.length, "| prefs:", preferences?.length);

  if (!tripId) {
    return res.status(400).json({ error: "tripId is required" });
  }

  if (!preferences?.length || !members?.length) {
    console.log(">>> REJECTED: missing prefs or members");
    return res.status(400).json({ error: "Missing required data" });
  }

  try {
    console.log(">>> Step 1: Updating trip status to ai_processing...");
    await pool.query(`UPDATE trips SET status = 'ai_processing' WHERE id = $1`, [tripId]);

    const prefSummary = preferences.map((p) => `
Member: ${p.name}
- Budget: ${p.budget ? `Rs. ${Number(p.budget).toLocaleString()}` : "Not specified"}
- Trip Type: ${Array.isArray(p.trip_types) && p.trip_types.length ? p.trip_types.join(", ") : "Not specified"}
- Food: ${p.food_preference || "Not specified"}
- Accommodation: ${p.accommodation || "Not specified"}
- Notes: ${p.notes || "None"}
    `).join("\n---\n");

    const chatContextText = chatHistory && chatHistory.length > 0
      ? `\nThe users also had the following recent discussion about their destination preferences. You MUST prioritize these specific requests in your final choice:\n${chatHistory.map(m => `${m.sender}: ${m.text}`).join('\n')}\n`
      : "";

    const overrideText = overrideDestination 
      ? `\nCRITICAL INSTRUCTION: The user has EXPLICITLY chosen "${overrideDestination}" as the final destination. You MUST build the itinerary, budget, and details specifically for "${overrideDestination}". Ignore other preferences if they conflict with this choice.\n` 
      : "";

    const prompt = `You are YatraVerse AI, an expert Nepal travel planner.
You are finalizing a group trip called "${tripName}" for ${members.length} people.
Here are the preferences for each member:
${prefSummary}
${chatContextText}${overrideText}
Analyze all preferences and the chat discussion (if any), and generate the ultimate final destination in Nepal that best balances everyone's needs (or fulfills their specific requests).
You MUST reply with a VALID JSON object (and absolutely nothing else) in the following format:
{
  "destination": "Name of the place",
  "matchScores": [
    { "memberName": "...", "score": 95, "reason": "..." }
  ],
  "whyChosen": "Detailed explanation of why this destination balances the group's preferences",
  "budget": "Estimated budget per person in Rs",
  "weather": "Expected weather summary",
  "bestDates": "Suggested time of year or dates",
  "itinerary": [
    { "day": 1, "plan": "...", "places": [{"name": "Name of Place", "details": "Brief details"}] }
  ],
  "alternatives": [
    { "name": "...", "reason": "..." }
  ]
}
`;

    console.log(`>>> Step 2: Calling Groq API (${GROQ_MODEL})...`);
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: "You are a travel AI that strictly outputs JSON data." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 3000,
    });
    console.log(">>> Step 3: Groq API responded successfully");


    const rawContent = response.choices[0].message.content;
    let aiData;
    try {
      aiData = JSON.parse(rawContent);
    } catch (parseErr) {
      console.warn("Direct JSON.parse failed. Attempting regex extraction. Raw content:", rawContent);
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          aiData = JSON.parse(match[0]);
        } catch (regexParseErr) {
          throw new Error("Failed to parse JSON even after regex extraction. Raw text: " + rawContent);
        }
      } else {
        throw new Error("No JSON found in response. Raw text: " + rawContent);
      }
    }

    // NOTE: jsonb columns need a JSON string, not a raw JS object — pg will
    // otherwise call .toString() on it and store "[object Object]".
    await pool.query(
      `UPDATE trips SET status = 'recommendation_ready', final_destination_data = $1 WHERE id = $2`,
      [JSON.stringify(aiData), tripId]
    );

    const membersList = await pool.query(`SELECT user_id FROM trip_members WHERE trip_id = $1`, [tripId]);

    // Parallelize independent inserts instead of awaiting sequentially.
    await Promise.all(
      membersList.rows.map((m) =>
        pool.query(
          `INSERT INTO notifications (user_id, trip_id, type, message, link) 
           VALUES ($1, $2, 'recommendation_ready', '🎉 Your group''s AI trip recommendation is ready!', $3)`,
          [m.user_id, tripId, `/planner/${tripId}`]
        )
      )
    );

    res.json({ message: "Final recommendation generated successfully", data: aiData });
  } catch (err) {
    console.error("FINAL REC ERROR:", err);
    if (tripId) {
      await pool.query(`UPDATE trips SET status = 'planning' WHERE id = $1`, [tripId]);
    }
    res.status(500).json({ error: `Failed to generate: ${err.message || "Unknown error"}`, details: err.message });
  }
};

exports.getHistory = async (req, res) => {
  const { trip_id } = req.query;
  try {
    const result = await pool.query(
      `SELECT * FROM ai_messages 
       WHERE user_id = $1 AND ($2::integer IS NULL OR trip_id = $2)
       ORDER BY created_at ASC`,
      [req.userId, trip_id || null]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load history" });
  }
};

exports.saveHistory = async (req, res) => {
  const { sender, message, trip_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO ai_messages (user_id, trip_id, sender, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.userId, trip_id || null, sender, message]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save message" });
  }
};

exports.clearHistory = async (req, res) => {
  const { trip_id } = req.query;
  try {
    await pool.query(
      `DELETE FROM ai_messages 
       WHERE user_id = $1 AND ($2::integer IS NULL OR trip_id = $2)`,
      [req.userId, trip_id || null]
    );
    res.json({ message: "History cleared" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clear history" });
  }
};