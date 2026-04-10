import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getPortfolioInsight(portfolioData: string, userPrompt: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Portfolio Data: ${portfolioData}\n\nUser Question: ${userPrompt}`,
    config: {
      systemInstruction: "You are an expert financial portfolio coach. Analyze the provided portfolio data and answer the user's question with actionable, professional insights.",
    },
  });
  return response.text;
}
