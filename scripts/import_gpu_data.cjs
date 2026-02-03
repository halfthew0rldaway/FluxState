const fs = require('fs');
const path = require('path');

// Paths
const csvPath = path.join(__dirname, '../datasets/chip_dataset.csv');
const existingJsonPath = path.join(__dirname, '../src/data/gpus.json');
const outputPath = path.join(__dirname, '../public/data/gpus.json');
const srcOutputPath = path.join(__dirname, '../src/data/gpus.json');

// Read existing JSON to preserve high-quality data
let existingGpus = [];
try {
    existingGpus = JSON.parse(fs.readFileSync(existingJsonPath, 'utf8'));
} catch (e) {
    console.log("No existing GPU JSON found or error reading it.");
}

// Map existing GPUs by normalized name for easy lookup
const existingMap = new Map();
existingGpus.forEach(gpu => {
    const key = gpu.name.toLowerCase().replace(/geforce\s+|radeon\s+|arc\s+/g, '').trim();
    existingMap.set(key, gpu);
});

// Helper to parse CSV line correctly (handling quotes)
function parseCSVLine(text) {
    const re_valid = /^\s*(?:'[^']*'|"[^"]*"|[^,'"]*|(?:\s*,\s*)*)(?:\s*,\s*(?:'[^']*'|"[^"]*"|[^,'"]*|(?:\s*,\s*)*))*\s*$/;
    if (!re_valid.test(text)) return null;
    const re_value = /(?!\s*$)\s*(?:'([^']*)'|"([^"]*)"|([^,'"]*))\s*(?:,|$)/g;
    const a = [];
    text.replace(re_value, function (m0, m1, m2, m3) {
        if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
        else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
        else if (m3 !== undefined) a.push(m3);
        return '';
    });
    if (/,\s*$/.test(text)) a.push('');
    return a;
}

// Build generation rules
function getGeneration(vendor, name, year) {
    name = name.toLowerCase();

    if (vendor === 'NVIDIA') {
        if (name.includes('h100') || name.includes('h200') || name.includes('gb200') || name.includes('blackwell')) return 'Blackwell/Hopper';
        if (name.includes('rtx 50') || name.includes('5090') || name.includes('5080')) return 'Blackwell';
        if (name.includes('rtx 40') || name.includes('4090') || name.includes('4080') || name.includes('l40')) return 'Ada Lovelace';
        if (name.includes('rtx 30') || name.includes('a100') || name.includes('a10') || name.includes('a40')) return 'Ampere';
        if (name.includes('rtx 20') || name.includes('1660') || name.includes('1650') || name.includes('t4')) return 'Turing';
        if (name.includes('gtx 10') || name.includes('titan x') || name.includes('p100')) return 'Pascal';
        if (name.includes('gtx 9') || name.includes('titan m') || name.includes('m60')) return 'Maxwell';
        if (name.includes('gtx 7') || name.includes('gtx 6') || name.includes('k80')) return 'Kepler';
        if (name.includes('gtx 5') || name.includes('gtx 4')) return 'Fermi';
        if (year > 2024) return 'Blackwell';
        if (year > 2022) return 'Ada Lovelace';
    }
    else if (vendor === 'AMD') {
        if (name.includes('rx 90') || name.includes('rdna 4')) return 'RDNA 4';
        if (name.includes('rx 7') || name.includes('rdna 3') || name.includes('mi300')) return 'RDNA 3';
        if (name.includes('rx 6') || name.includes('rdna 2') || name.includes('mi200')) return 'RDNA 2';
        if (name.includes('rx 5000') || name.includes('vii') || name.includes('mi100')) return 'RDNA';
        if (name.includes('rx 590') || name.includes('rx 580') || name.includes('rx 480') || name.includes('vega')) return 'Polaris/Vega';
    }
    else if (vendor === 'Intel') {
        if (name.includes('arc') || name.includes('a770') || name.includes('a750')) return 'Arc Alchemist';
    }

    return `Legacy ${vendor}`;
}

// Function to estimate VRAM from name or defaults
function guessVram(name) {
    const vramMatch = name.match(/(\d+)\s*(?:GB|MB)/i);
    if (vramMatch) {
        if (name.toUpperCase().includes('MB')) return Math.round(parseInt(vramMatch[1]) / 1024);
        return parseInt(vramMatch[1]);
    }

    // Heuristics based on model number
    if (name.includes('90') || name.includes('titan') || name.includes('ultra')) return 24;
    if (name.includes('80 ti') || name.includes('80 super')) return 16;
    if (name.includes('80')) return 10; // GTX 1080 was 8GB, RTX 3080 10GB... avg
    if (name.includes('70 ti')) return 12;
    if (name.includes('70')) return 8;
    if (name.includes('60')) return 6; // or 8 or 12
    if (name.includes('50')) return 4;

    return 4; // Default baseline
}

// Process CSV
console.log('Reading CSV...');
const fileContent = fs.readFileSync(csvPath, 'utf8');
const lines = fileContent.split('\n');
const headers = parseCSVLine(lines[0]); // Indices: Product=1, Type=2, Date=3, TDP=5, Vendor=10

const gpuList = [];
const seenGpus = new Set();

// Add existing high-quality JSON data first
existingGpus.forEach(gpu => {
    const key = `${gpu.name}-${gpu.vram}`;
    seenGpus.add(key);
    gpuList.push(gpu);
});

console.log(`Loaded ${existingGpus.length} existing GPUs`);

let csvCount = 0;
// Skip header, process lines
for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols || cols.length < 10) continue;

    const type = cols[2];
    if (type !== 'GPU') continue;

    const name = cols[1].trim();
    if (!name) continue;

    const vendor = cols[10].trim() || 'Unknown';
    if (!['NVIDIA', 'AMD', 'Intel'].includes(vendor)) continue; // Filter obscure vendors to keep list neat matching existing style

    const tdpStr = cols[5];
    const tdp = tdpStr ? parseFloat(tdpStr) : 0;

    const dateStr = cols[3];
    const year = dateStr ? parseInt(dateStr.split('-')[0]) : 2010;

    // Filter really old stuff if user wants "1986-2026" but for a "PC Power Sim" mainly modern is useful
    // But user requested 1986-2026 so valid.

    const vram = guessVram(name);
    // Create ID
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const key = `${name}-${vram}`;

    // Check if we already have this GPU (from JSON)
    // Simplify name for comparison (remove brand)
    const simpleName = name.toLowerCase().replace(/geforce\s+|radeon\s+|arc\s+/g, '').trim();
    if (existingMap.has(simpleName)) {
        // We have a high quality entry for this, skip the CSV one?
        // Or maybe strictly if the VRAM matches?
        // Let's assume JSON is better.
        continue;
    }

    // If not seen yet
    if (!seenGpus.has(key)) {
        seenGpus.add(key);
        csvCount++;

        gpuList.push({
            id: id,
            name: name,
            vendor: vendor,
            generation: getGeneration(vendor, name, year),
            year: year,
            vram: vram,
            memoryType: "Unknown", // CSV doesn't have this
            boardPower: tdp || 75, // Default to 75W if unknown
            idleDraw: Math.round((tdp || 75) * 0.1),
            gamingDraw: Math.round((tdp || 75) * 0.9),
            transientMultiplier: 1.5,
            source: 'csv'
        });
    }
}

console.log(`Added ${csvCount} GPUs from CSV`);

// Sort
const vendorOrder = { 'NVIDIA': 0, 'AMD': 1, 'Intel': 2 };
gpuList.sort((a, b) => {
    const va = vendorOrder[a.vendor] ?? 99;
    const vb = vendorOrder[b.vendor] ?? 99;
    if (va !== vb) return va - vb;

    // Then year desc
    if ((a.year || 0) !== (b.year || 0)) return (b.year || 0) - (a.year || 0);

    // Then power desc
    return (b.boardPower || 0) - (a.boardPower || 0);
});

// Deduplicate one last time by ID to be safe
const finalMap = new Map();
const finalGpus = [];
gpuList.forEach(gpu => {
    if (!finalMap.has(gpu.id)) {
        finalMap.set(gpu.id, true);
        finalGpus.push(gpu);
    }
});

console.log(`Total GPUs: ${finalGpus.length}`);

// Write
fs.writeFileSync(outputPath, JSON.stringify(finalGpus, null, 2));
fs.writeFileSync(srcOutputPath, JSON.stringify(finalGpus, null, 2));
console.log("Done.");
