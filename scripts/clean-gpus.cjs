const fs = require('fs');
const path = require('path');

// Read GPU data
const gpusPath = path.join(__dirname, '../public/data/gpus.json');
const gpus = JSON.parse(fs.readFileSync(gpusPath, 'utf8'));

console.log(`Original: ${gpus.length} GPUs`);

// Deduplicate by name + vram, keeping first occurrence (sorted by year, so we keep newest variant)
const seen = new Map();
gpus.forEach(gpu => {
    const key = `${gpu.name}-${gpu.vram}`;
    if (!seen.has(key)) {
        seen.set(key, gpu);
    }
});

const deduped = Array.from(seen.values());
console.log(`After dedup: ${deduped.length} GPUs`);

// Fix generation names based on GPU model
deduped.forEach(gpu => {
    const name = gpu.name.toLowerCase();

    // NVIDIA generations
    if (gpu.vendor === 'NVIDIA') {
        // Datacenter/Workstation GPUs first
        if (name.includes('h100') || name.includes('h200') || name.includes('h800') || name.includes('b100') || name.includes('b200') || name.includes('gb10') || name.includes('gb20')) {
            gpu.generation = 'Hopper/Blackwell';
        } else if (name.includes('l40') || name.includes('l20') || name.includes('l4 ') || name.match(/\bl4\b/) || name.includes(' l4')) {
            gpu.generation = 'Ada Lovelace';
        } else if (name.includes('a100') || name.includes('a800') || name.includes('a30') || name.includes('a40') || name.includes('a16') || name.includes('a10') || name.includes('cmp')) {
            gpu.generation = 'Ampere';
        } else if (name.includes('rtx a') || name.includes('quadro rtx')) {
            gpu.generation = 'Workstation';
        } else if (name.includes('t4') || name.includes('quadro t')) {
            gpu.generation = 'Turing';
            // Consumer GPUs  
        } else if (name.includes('rtx 50') || name.includes('rtx50') || name.includes('blackwell')) {
            gpu.generation = 'Blackwell';
        } else if (name.includes('rtx 40') || name.includes('rtx40') || name.includes('ada') || name.includes('4090') || name.includes('4080') || name.includes('4070') || name.includes('4060')) {
            gpu.generation = 'Ada Lovelace';
        } else if (name.includes('rtx 30') || name.includes('rtx30') || name.includes('ampere') || name.includes('3090') || name.includes('3080') || name.includes('3070') || name.includes('3060') || name.includes('3050')) {
            gpu.generation = 'Ampere';
        } else if (name.includes('rtx 20') || name.includes('rtx20') || name.includes('2080') || name.includes('2070') || name.includes('2060') || name.includes('gtx 16') || name.includes('1660') || name.includes('1650')) {
            gpu.generation = 'Turing';
        } else if (name.includes('gtx 10') || name.includes('gtx10') || name.includes('1080') || name.includes('1070') || name.includes('1060') || name.includes('1050')) {
            gpu.generation = 'Pascal';
        } else if (name.includes('gtx 9') || name.includes('980') || name.includes('970') || name.includes('960') || name.includes('950')) {
            gpu.generation = 'Maxwell';
        } else if (name.includes('gtx 7') || name.includes('titan') || name.includes('780') || name.includes('770') || name.includes('760') || name.includes('750')) {
            gpu.generation = 'Kepler';
        } else if (name.includes('jetson') || name.includes('switch')) {
            gpu.generation = 'Embedded';
        } else if (gpu.generation === 'Legacy NVIDIA' && gpu.year >= 2024) {
            gpu.generation = 'Blackwell';
        }
    }

    // AMD generations  
    if (gpu.vendor === 'AMD') {
        if (name.includes('rx 90') || name.includes('9070') || name.includes('rdna 4')) {
            gpu.generation = 'RDNA 4';
        } else if (name.includes('rx 7') || name.includes('7900') || name.includes('7800') || name.includes('7700') || name.includes('7600') || name.includes('rdna 3')) {
            gpu.generation = 'RDNA 3';
        } else if (name.includes('rx 6') || name.includes('6900') || name.includes('6800') || name.includes('6700') || name.includes('6600') || name.includes('6500') || name.includes('rdna 2')) {
            gpu.generation = 'RDNA 2';
        } else if (name.includes('rx 5') || name.includes('5700') || name.includes('5600') || name.includes('5500') || name.includes('rdna')) {
            gpu.generation = 'RDNA';
        } else if (name.includes('vega') || name.includes('rx 590') || name.includes('rx 580') || name.includes('rx 570') || name.includes('rx 560') || name.includes('rx 550')) {
            gpu.generation = 'Polaris/Vega';
        } else if (name.includes('instinct') || name.includes('pro w') || name.includes('radeon pro')) {
            gpu.generation = 'Workstation';
        }
    }

    // Intel generations
    if (gpu.vendor === 'Intel') {
        if (name.includes('arc a7') || name.includes('a770') || name.includes('a750')) {
            gpu.generation = 'Arc Alchemist';
        } else if (name.includes('arc a5') || name.includes('a580') || name.includes('a550')) {
            gpu.generation = 'Arc Alchemist';
        } else if (name.includes('arc a3') || name.includes('a380') || name.includes('a310')) {
            gpu.generation = 'Arc Alchemist';
        } else if (name.includes('uhd') || name.includes('iris')) {
            gpu.generation = 'Integrated';
        }
    }
});

// Sort by vendor (NVIDIA, AMD, Intel), then year desc, then boardPower desc
const vendorOrder = { 'NVIDIA': 0, 'AMD': 1, 'Intel': 2 };
deduped.sort((a, b) => {
    const vendorA = vendorOrder[a.vendor] !== undefined ? vendorOrder[a.vendor] : 99;
    const vendorB = vendorOrder[b.vendor] !== undefined ? vendorOrder[b.vendor] : 99;
    if (vendorA !== vendorB) return vendorA - vendorB;
    if (a.year !== b.year) return (b.year || 2020) - (a.year || 2020);
    return (b.boardPower || 0) - (a.boardPower || 0);
});

// Write back
fs.writeFileSync(gpusPath, JSON.stringify(deduped, null, 2));
console.log(`Saved cleaned data to ${gpusPath}`);

// Also update src/data/gpus.json
const srcPath = path.join(__dirname, '../src/data/gpus.json');
fs.writeFileSync(srcPath, JSON.stringify(deduped, null, 2));
console.log(`Saved cleaned data to ${srcPath}`);
