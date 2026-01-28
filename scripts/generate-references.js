const fs = require('fs');

// Load all punk data
const csv = fs.readFileSync('data/punks-attributes/original/cryptopunks.csv', 'utf8');
const lines = csv.trim().split('\n').slice(1); // skip header

// Parse all punks
const allPunks = [];
for (const line of lines) {
    const parts = line.split(', ');
    const id = parseInt(parts[0]);
    const type = parts[1];
    const gender = parts[2];
    const skinTone = parts[3];
    const accessories = parts.slice(5).join(', ').split(' / ').map(s => s.trim()).filter(Boolean);

    allPunks.push({ id, type, gender, skinTone, accessories });
}

// Eligible punks (Regular Shades Female)
const eligible = JSON.parse(fs.readFileSync('data/eligible-punks.json', 'utf8'));

// Eyewear that covers similar area to Regular Shades
const eyewearTraits = new Set([
    'Regular Shades', 'Big Shades', 'Classic Shades', 'Nerd Glasses',
    'Horned Rim Glasses', '3D Glasses', 'VR', 'Welding Goggles', 'Eye Mask', 'Eye Patch'
]);

// Hair/hat traits that matter for matching
const hairTraits = new Set([
    'Bandana', 'Blonde Bob', 'Blonde Short', 'Cap', 'Clown Hair Green', 'Crazy Hair',
    'Dark Hair', 'Frumpy Hair', 'Half Shaved', 'Headband', 'Knitted Cap', 'Messy Hair',
    'Mohawk', 'Mohawk Dark', 'Mohawk Thin', 'Orange Side', 'Pigtails', 'Pilot Helmet',
    'Pink With Hat', 'Red Mohawk', 'Straight Hair', 'Straight Hair Blonde',
    'Straight Hair Dark', 'Stringy Hair', 'Tassle Hat', 'Tiara', 'Wild Blonde',
    'Wild Hair', 'Wild White Hair'
]);

// Find reference punk for each eligible punk
const references = {};
let exactMatches = 0;
let fallbackMatches = 0;
let missingCount = 0;

for (const eligibleId of eligible) {
    const punk = allPunks.find(p => p.id === eligibleId);
    if (!punk) continue;

    // Get this punk's hair trait
    const punkHair = punk.accessories.find(a => hairTraits.has(a)) || null;

    // Find a reference punk with:
    // - Same gender (Female)
    // - Same skin tone
    // - Same hair trait (or no hair if punk has no hair)
    // - NO eyewear

    const candidates = allPunks.filter(p =>
        p.gender === 'Female' &&
        p.skinTone === punk.skinTone &&
        !p.accessories.some(a => eyewearTraits.has(a)) &&
        (punkHair === null
            ? !p.accessories.some(a => hairTraits.has(a))
            : p.accessories.includes(punkHair))
    );

    if (candidates.length > 0) {
        references[eligibleId] = candidates[0].id;
        exactMatches++;
    } else {
        // No exact match - try without hair matching (just skin tone)
        const fallback = allPunks.filter(p =>
            p.gender === 'Female' &&
            p.skinTone === punk.skinTone &&
            !p.accessories.some(a => eyewearTraits.has(a))
        );

        if (fallback.length > 0) {
            references[eligibleId] = fallback[0].id;
            fallbackMatches++;
            console.log(`No exact match for ${eligibleId} (${punkHair}), using fallback ${fallback[0].id}`);
        } else {
            references[eligibleId] = null;
            missingCount++;
            console.error(`No reference found for punk ${eligibleId}`);
        }
    }
}

fs.writeFileSync('data/reference-punks.json', JSON.stringify(references, null, 2));
console.log(`\nGenerated references for ${Object.keys(references).length} punks`);
console.log(`Exact matches: ${exactMatches}`);
console.log(`Fallback matches: ${fallbackMatches}`);
console.log(`Missing: ${missingCount}`);
