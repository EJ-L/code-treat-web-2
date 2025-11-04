/**
 * Utility functions for loading CSV data
 */

export async function loadModelComparisonCSV(): Promise<string> {
  try {
    const response = await fetch('/data/overall-ranking/model-comparison.csv');
    if (!response.ok) {
      throw new Error(`Failed to load CSV: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Error loading model comparison CSV:', error);
    return '';
  }
}

export interface ModelComparisonData {
  name: string;
  rank: number | string;
  scores: {
    CG: number;
    CS: number;
    CT: number;
    CRv: number;
    CR: number;
    TG: number;
    VD: number;
  };
}

export function parseModelComparisonCSV(csvData: string): ModelComparisonData[] {
  if (!csvData) return [];

  const lines = csvData.trim().split('\n');
  const models: ModelComparisonData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.includes('Human Baseline')) continue;

    const parts = line.split(',');
    if (parts.length < 8) continue;

    const modelName = parts[0].trim();
    
    const scores = {
      CG: parseFloat(parts[1]) || 0,
      CS: parseFloat(parts[2]) || 0,
      CT: parseFloat(parts[3]) || 0,
      CRv: parseFloat(parts[4]) || 0,
      CR: parseFloat(parts[5]) || 0,
      TG: parseFloat(parts[6]) || 0,
      VD: parseFloat(parts[7]) || 0,
    };

    models.push({
      name: modelName,
      rank: i, // Will be updated with actual rankings later
      scores
    });
  }

  return models;
}
