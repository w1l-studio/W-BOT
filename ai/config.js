const path = require("path");
const dotenv = require("dotenv");

// Load the single .env file from the project root.
dotenv.config({ path: path.join(__dirname, "..", ".env") });

module.exports = {
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  // Current production model listed by Groq.
  MODEL_NAME: "openai/gpt-oss-120b",
  TEMPERATURE: 0.7,
  MAX_TOKENS: 1024,
  // Maximum number of individual user/assistant messages kept in RAM per context.
  MAX_HISTORY: 10,
  AI_TIMEOUT: 15000,
  AI_RETRIES: 3,
  EXCLUDED_CHANNELS: ["1558951712834719874"],
};
