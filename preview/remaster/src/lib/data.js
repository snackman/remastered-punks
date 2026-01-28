// Load and parse punk CSV data
export async function loadPunkData(csvPath) {
  const response = await fetch(csvPath);
  const text = await response.text();
  // Handle both \r\n and \n line endings
  const lines = text.trim().replace(/\r\n/g, '\n').split('\n');

  const punkData = {};

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse: id, type, gender, skin tone, count, accessories
    const match = line.match(/^(\d+),\s*(\w+),\s*(\w+),\s*(\w+),\s*(\d+),\s*(.*)$/);
    if (match) {
      const id = parseInt(match[1]);
      const type = match[2];
      const gender = match[3];
      const skinTone = match[4];
      const accessoriesStr = match[6].trim();
      const accessories = accessoriesStr ? accessoriesStr.split(' / ').map(a => a.trim()) : [];

      punkData[id] = { id, type, gender, skinTone, accessories };
    }
  }

  return punkData;
}

// Load eligible punks list
export async function loadEligiblePunks(jsonPath) {
  const response = await fetch(jsonPath);
  return response.json();
}
