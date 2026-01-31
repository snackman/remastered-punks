import { readFileSync } from 'fs';

// Load and parse punk CSV data
export function loadPunkData(csvPath) {
  const text = readFileSync(csvPath, 'utf-8');
  // Handle both \r\n and \n line endings
  const lines = text.trim().replace(/\r\n/g, '\n').split('\n');

  const punkData = {};

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse: id, type, gender, skin tone, count, accessories
    // Skin tone can be empty for Zombie/Ape/Alien types
    const match = line.match(/^(\d+),\s*(\w+),\s*(\w+),\s*(\w*),\s*(\d+),\s*(.*)$/);
    if (match) {
      const id = parseInt(match[1]);
      const type = match[2];
      const gender = match[3];
      const skinTone = match[4] || null;
      const accessoriesStr = match[6].trim();
      const accessories = accessoriesStr ? accessoriesStr.split(' / ').map(a => a.trim()) : [];

      punkData[id] = { id, type, gender, skinTone, accessories };
    }
  }

  return punkData;
}

// Load eligible punks list
export function loadEligiblePunks(jsonPath) {
  const text = readFileSync(jsonPath, 'utf-8');
  return JSON.parse(text);
}
