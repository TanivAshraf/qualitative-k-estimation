import { GoogleGenerativeAI } from "@google/generative-ai";
import Papa from "papaparse";
import { kmeans } from "ml-kmeans";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

function robustJSONParse(rawText) {
  const startIndex = rawText.indexOf('{');
  const endIndex = rawText.lastIndexOf('}');
  if (startIndex === -1 || endIndex === -1) throw new Error("No JSON object found in response.");
  const jsonString = rawText.substring(startIndex, endIndex + 1);
  return JSON.parse(jsonString);
}

// --- Step D: Persona Generation ---
async function getPersonaForCluster(clusterData) {
  if (clusterData.length === 0) return null;
  const stats = clusterData.reduce((acc, row) => {
    Object.keys(row).forEach(key => {
        if (typeof row[key] === 'number') {
            acc[key] = (acc[key] || 0) + row[key];
        }
    });
    return acc;
  }, {});
  Object.keys(stats).forEach(key => { stats[key] /= clusterData.length; });

  // --- THE FIX: A much more forceful and explicit prompt ---
  const prompt = `You are an expert marketing analyst. A customer cluster has these average stats:
  ${JSON.stringify(stats, null, 2)}
  - Number of customers in this segment: ${clusterData.length}

  Create a persona for this segment. Respond ONLY as a JSON object with the keys: "persona_name", "description", and "marketing_strategy".
  - "persona_name": A catchy name (e.g., 'Loyal High-Spenders').
  - "description": A 2-3 sentence summary.
  - "marketing_strategy": A single, actionable marketing tip as a PLAIN STRING. Do NOT use a nested JSON object for the strategy.`;
  
  const result = await model.generateContent(prompt);
  return robustJSONParse(result.response.text());
}


export async function POST(request) {
  try {
    const body = await request.json();
    const csvData = body.csv_data;
    if (!csvData) {
      return new Response(JSON.stringify({ error: "CSV data is required." }), { status: 400 });
    }

    const parsed = Papa.parse(csvData, { header: true, dynamicTyping: true });
    const data = parsed.data.filter(row => row.customer_id != null && Object.keys(row).length > 1);

    // --- Step A: Data Sampling & Description ---
    const dataSample = data.slice(0, 20); 
    
    const kEstimationPrompt = `You are an expert data scientist. Based on the following data sample, estimate the optimal number of clusters (k). Respond ONLY with a JSON object with keys "estimated_k" and "reasoning".
    DATA SAMPLE: ${JSON.stringify(dataSample, null, 2)}`;
    
    const kResult = await model.generateContent(kEstimationPrompt);
    const kEstimationResult = robustJSONParse(kResult.response.text());
    const estimatedK = kEstimationResult.estimated_k;
    const kReasoning = kEstimationResult.reasoning;
    
    if (data.length < estimatedK) {
        return new Response(JSON.stringify({ error: "Not enough data to form the estimated number of clusters." }), { status: 400 });
    }

    // --- Step C: Execution ---
    const featureKeys = Object.keys(data[0]).filter(key => key !== 'customer_id');
    const vectors = data.map(row => featureKeys.map(key => row[key]));
    
    const ans = kmeans(vectors, estimatedK, { initialization: 'kmeans++' });
    const assignments = ans.clusters;

    const clusters = Array.from({ length: estimatedK }, () => []);
    for (let i = 0; i < data.length; i++) {
        if(assignments[i] !== undefined) {
            clusters[assignments[i]].push(data[i]);
        }
    }
    
    const personaPromises = clusters.map(async (clusterData, index) => {
        if (clusterData.length > 0) {
            const persona = await getPersonaForCluster(clusterData);
            persona.cluster_id = index;
            return persona;
        }
        return null;
    });

    const personas = (await Promise.all(personaPromises)).filter(p => p !== null);
    
    const finalResult = {
        k_estimation: { k: estimatedK, reasoning: kReasoning },
        personas: personas
    };
    
    return new Response(JSON.stringify(finalResult), { status: 200 });

  } catch (error) {
    console.error("Error in analysis API:", error);
    return new Response(JSON.stringify({ error: error.message || "An internal server error occurred." }), { status: 500 });
  }
}
