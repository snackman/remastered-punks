// Pure CSV parse + compact (de)serialization of punk attributes. No browser or node
// APIs, so the build script, the browser and the tests all share it.

// Parse cryptopunks.csv text into { [id]: {id,type,gender,skinTone,accessories} }.
export function parsePunkCsv(text) {
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
      const accessoriesStr = match[6].trim();
      punkData[id] = {
        id,
        type: match[2],
        gender: match[3],
        skinTone: match[4] || null,
        accessories: accessoriesStr ? accessoriesStr.split(' / ').map((a) => a.trim()) : [],
      };
    }
  }
  return punkData;
}

// { bases:["Type|Gender|Skin",…], accessories:[…], punks:[[baseIdx, accIdx…] | null, …] }
// punks[id] is the entry for that punk id (null for an id that doesn't exist).
export function encodeCompact(punkData) {
  const bases = [];
  const baseIdx = new Map();
  const accessories = [];
  const accIdx = new Map();
  const punks = [];
  const intern = (list, map, v) => {
    if (!map.has(v)) { map.set(v, list.length); list.push(v); }
    return map.get(v);
  };
  for (const id of Object.keys(punkData).map(Number)) {
    const p = punkData[id];
    const b = intern(bases, baseIdx, `${p.type}|${p.gender}|${p.skinTone ?? ''}`);
    punks[id] = [b, ...p.accessories.map((a) => intern(accessories, accIdx, a))];
  }
  for (let i = 0; i < punks.length; i++) if (!punks[i]) punks[i] = null;
  return { bases, accessories, punks };
}

export function decodeCompact(c) {
  const punkData = {};
  c.punks.forEach((row, id) => {
    if (!row) return;
    const [type, gender, skin] = c.bases[row[0]].split('|');
    punkData[id] = {
      id,
      type,
      gender,
      skinTone: skin || null,
      accessories: row.slice(1).map((i) => c.accessories[i]),
    };
  });
  return punkData;
}
