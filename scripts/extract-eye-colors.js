// Extract exact eye shadow colors from punk images
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

// Punks with known skin tones (female):
// Light: punk 106
// Medium: punk 64
// Dark: punk 70
// Albino: punk 1857

const PUNKS_TO_CHECK = [
    { id: 106, skinTone: 'Light' },
    { id: 64, skinTone: 'Medium' },
    { id: 70, skinTone: 'Dark' },
    { id: 1857, skinTone: 'Albino' },
];

// Eye shadow pixel positions (bottom-right of each 2x2 eye)
// These are approximate - may need adjustment
const EYE_POSITIONS = [
    { x: 10, y: 13 },  // Left eye (viewer's right)
    { x: 15, y: 13 },  // Right eye (viewer's left)
];

async function extractColors() {
    const punksImg = await loadImage('data/punks.png');
    const canvas = createCanvas(24, 24);
    const ctx = canvas.getContext('2d');

    for (const punk of PUNKS_TO_CHECK) {
        const row = Math.floor(punk.id / 100);
        const col = punk.id % 100;

        ctx.clearRect(0, 0, 24, 24);
        ctx.drawImage(punksImg, col * 24, row * 24, 24, 24, 0, 0, 24, 24);

        const imageData = ctx.getImageData(0, 0, 24, 24);

        console.log(`\nPunk #${punk.id} (${punk.skinTone}):`);

        for (const pos of EYE_POSITIONS) {
            const idx = (pos.y * 24 + pos.x) * 4;
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
            console.log(`  Eye at (${pos.x}, ${pos.y}): RGB(${r}, ${g}, ${b}) = ${hex}`);
        }

        // Also print main skin color for reference (sample from cheek area)
        const skinIdx = (15 * 24 + 12) * 4;
        const sr = imageData.data[skinIdx];
        const sg = imageData.data[skinIdx + 1];
        const sb = imageData.data[skinIdx + 2];
        const skinHex = '#' + [sr, sg, sb].map(c => c.toString(16).padStart(2, '0')).join('');
        console.log(`  Skin at (12, 15): RGB(${sr}, ${sg}, ${sb}) = ${skinHex}`);
    }
}

extractColors().catch(console.error);
