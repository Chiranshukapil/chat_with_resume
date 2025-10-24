import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

async function listModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();

    console.log("✅ Successfully fetched models. Here are the models available to you:");
    console.log("=====================================================================");

    for (const m of data.models ?? []) {
      const actions =
        m.supported_actions ??
        m.supportedGenerationMethods ??
        [];
      if (actions.includes("generateContent")) {
        console.log(`- ${m.name}`);
      } else {
        console.log(`- ${m.name}`);
      }
    }

    console.log("=====================================================================");
    console.log("📝 Copy one of the model names from this list and paste it into your chat.js file.");
  } catch (error) {
    console.error("❌ Failed to fetch models:", error);
  }
}

listModels();
