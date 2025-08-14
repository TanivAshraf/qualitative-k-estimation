"use client";

import { useState } from "react";

const sampleCsvData = `customer_id,age,visits_per_month,total_spent
1,24,1,50.50
2,45,15,850.75
3,31,3,120.00
4,65,2,75.20
5,22,12,650.00
6,50,16,950.50
7,29,2,90.80
8,38,10,550.00
9,58,4,210.00
10,21,1,45.00
11,48,14,890.25
12,33,4,150.70
13,61,3,110.00
14,25,11,720.50
15,55,18,1100.00
16,28,1,60.00
17,36,9,480.30
18,42,13,780.00
19,68,2,95.50
20,23,10,610.00`;

interface Persona {
  cluster_id: number;
  persona_name: string;
  description: string;
  marketing_strategy: string;
}

interface AnalysisResult {
    k_estimation: {
        k: number;
        reasoning: string;
    };
    personas: Persona[];
}

export default function HomePage() {
  const [csvData, setCsvData] = useState(sampleCsvData);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_data: csvData }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "An unknown error occurred during analysis.");
      }
      
      data.personas.sort((a: Persona, b: Persona) => a.cluster_id - b.cluster_id);
      setResult(data);

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-gray-100">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-center">Qualitative K-Estimation</h1>
        <p className="mt-2 text-center text-gray-600">An AI-powered algorithm to automatically determine the optimal number of clusters and explain them.</p>

        <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
          <label htmlFor="csv-input" className="block text-lg font-medium text-gray-700">Paste your CSV data here:</label>
          <textarea
            id="csv-input"
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            className="w-full h-60 mt-2 p-3 font-mono text-sm border rounded-md"
          />
          <button onClick={handleAnalyze} disabled={isLoading} className="w-full mt-4 px-4 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400">
            {isLoading ? "Analyzing..." : "Analyze Segments"}
          </button>
        </div>

        {error && <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">{error}</div>}

        {result && (
          <div className="mt-8">
            <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                <h3 className="font-bold text-lg text-blue-800">AI Recommendation for K</h3>
                <p className="mt-1">The AI estimated the optimal number of clusters is <strong className="text-xl">{result.k_estimation.k}</strong>.</p>
                <p className="mt-2 text-sm italic text-gray-700"><strong>Reasoning:</strong> "{result.k_estimation.reasoning}"</p>
            </div>

            <h2 className="text-2xl font-bold text-center mb-4">Generated Customer Personas</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {result.personas.map((p: Persona) => (
                <div key={p.cluster_id} className="p-4 bg-white rounded-lg shadow-md border">
                  <h3 className="text-xl font-bold text-blue-700">{p.persona_name}</h3>
                  <p className="text-sm font-medium text-gray-500">Cluster {p.cluster_id}</p>
                  <div className="mt-4 space-y-3">
                    <p><strong>Description:</strong> {p.description}</p>
                    <p><strong>Marketing Strategy:</strong> {p.marketing_strategy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
