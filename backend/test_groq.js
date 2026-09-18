require('dotenv').config({ path: 'c:/Users/hp/Desktop/ai-trip-recommendation/backend/.env' });
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  try {
    const prompt = "Reply with {\"test\": \"data\"}";
    const response = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      messages: [
        { role: "system", content: "You are a travel AI that strictly outputs JSON data." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 100,
    });
    console.log("SUCCESS");
    console.log(response.choices[0].message.content);
  } catch(e) {
    console.log("ERROR MESSAGE:", e.message);
    if(e.response) {
      console.log("ERROR DATA:", e.response.data);
    }
  }
}

test();
