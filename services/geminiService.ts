
import { GoogleGenAI } from "@google/genai";
import { Appliance, EnergyReading } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getEnergyInsights = async (appliances: Appliance[]) => {
  const summary = appliances.map(app => ({
    name: app.name,
    status: app.isOn ? 'ON' : 'OFF',
    currentPower: app.currentPower.toFixed(2),
    powerLoss: app.currentPowerLoss.toFixed(2),
    avgPower: app.basePower
  }));

  const prompt = `Analyze this smart home energy setup: ${JSON.stringify(summary)}. 
  The system voltage limit is 230V. 
  Please provide:
  1. A breakdown of the current energy load and cumulative power loss.
  2. Efficiency recommendations.
  3. Safety warnings.
  Keep it concise and professional.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.8,
      }
    });

    return response.text || "Unable to generate insights at this moment.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The energy analyst is currently offline.";
  }
};

export const predictDeviceType = async (history: EnergyReading[]) => {
  if (history.length === 0) return "Unknown (No Data)";
  
  const samples = history.slice(-10).map(h => h.power.toFixed(2));
  const prompt = `Based on these consecutive power consumption readings (in Watts): [${samples.join(', ')}], 
  predict what type of household appliance this is. 
  Is it an LED bulb, an Incandescent bulb, a Fan, a Laptop, or something else? 
  Give a short 1-sentence explanation of why based on the wattage. 
  Format: "Prediction: [Type] - [Explanation]"`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.2, // Low temperature for more factual prediction
      }
    });
    return response.text?.trim() || "Identification failed.";
  } catch (error) {
    return "AI identification service unavailable.";
  }
};
