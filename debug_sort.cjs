const fs = require('fs');
const path = require('path');

const gpus = JSON.parse(fs.readFileSync('public/data/gpus.json', 'utf8'));

const genRank = {
    // NVIDIA
    'Blackwell': 100,
    'Hopper/Blackwell': 99,
    'Ada Lovelace': 90,
    'Ampere': 80,
    'Turing': 70,
    'Volta': 65,
    'Pascal': 60,
    'Maxwell': 50,
    'Kepler': 40,
    'Fermi': 30,
    'Tesla': 20,

    // AMD
    'RDNA 4': 100,
    'RDNA 3': 90,
    'RDNA 2': 80,
    'RDNA': 70,
    'Vega': 60,
    'Polaris/Vega': 55,
    'Polaris': 50,

    // Intel
    'Arc Alchemist': 80,
    'Integrated': 10,

    // Other
    'Workstation': 85,
    'Embedded': 5,
    'Legacy NVIDIA': 0,
    'Legacy AMD': 0
};

const getModelScore = (name) => {
    name = name.toLowerCase();
    let score = 0;

    // Extract primary model number (e.g. 4090, 7900, 3060)
    const match = name.match(/(\d{3,4})/);
    if (match) {
        let num = parseInt(match[1]);
        score = num * 100;
    }

    // Suffix ranking
    if (name.includes('titan')) score += 5000;
    if (name.includes('ti')) score += 50;
    if (name.includes('super')) score += 25;
    if (name.includes('xtx')) score += 60;
    if (name.includes('xt')) score += 40;
    if (name.includes('gre')) score += 30;
    if (name.includes('x3d')) score += 10;

    return score;
};

const sortGpu = (a, b) => {
    // Current fallback logic in ui.js
    const rankA = genRank[a.generation] !== undefined ? genRank[a.generation] : (a.year - 1900);
    const rankB = genRank[b.generation] !== undefined ? genRank[b.generation] : (b.year - 1900);

    if (rankA !== rankB) return rankB - rankA; // Higher rank first

    const scoreA = getModelScore(a.name);
    const scoreB = getModelScore(b.name);
    if (scoreA !== scoreB) return scoreB - scoreA;

    return (b.boardPower || 0) - (a.boardPower || 0);
};

const nvidia = gpus.filter(g => g.vendor === 'NVIDIA').sort(sortGpu);

console.log("--- TOP 5 NVIDIA ---");
nvidia.slice(0, 5).forEach(g => console.log(`[${g.generation}] ${g.name} (Rank: ${genRank[g.generation] ?? (g.year - 1900)})`));

console.log("\n--- BOTTOM 5 NVIDIA ---");
nvidia.slice(-5).forEach(g => console.log(`[${g.generation}] ${g.name} (Rank: ${genRank[g.generation] ?? (g.year - 1900)})`));

// Check specifically for 5080 position
const idx5080 = nvidia.findIndex(g => g.name.includes('5080'));
console.log(`\nRTX 5080 is at index: ${idx5080} / ${nvidia.length}`);
