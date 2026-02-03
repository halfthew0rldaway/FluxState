/**
 * CSV to JSON Converter for Hardware Data
 * Parses chip_dataset.csv and gpu_1986-2026.csv to create comprehensive JSON files
 * INCLUSIVE VERSION: Includes all valid entries + Manual Overrides
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CSV helper
function parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const headers = parseCSVLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length >= headers.length - 5) { // Allow some missing columns
            const row = {};
            headers.forEach((h, idx) => {
                row[h.trim()] = values[idx]?.trim() || '';
            });
            data.push(row);
        }
    }
    return data;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function generateCpuId(name) {
    return name.toLowerCase().replace(/intel\s+/i, '').replace(/amd\s+/i, '').replace(/core\s+/i, '').replace(/ryzen\s+/i, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 40);
}

function determineMemorySupport(releaseDate, name, vendor) {
    const year = parseInt(releaseDate?.substring(0, 4)) || 2015;
    if (vendor === 'Intel') {
        if (year >= 2021) return ['DDR4', 'DDR5'];
        if (year >= 2015) return ['DDR4'];
        return ['DDR3'];
    } else {
        if (year >= 2022) return ['DDR5'];
        if (year >= 2017) return ['DDR4'];
        return ['DDR3'];
    }
}

function determineIntelGeneration(name, year) {
    if (name.includes('14') && name.includes('i')) return 'Raptor Lake Refresh';
    if (name.includes('13') && name.includes('i')) return 'Raptor Lake';
    if (name.includes('12') && name.includes('i')) return 'Alder Lake';
    if (name.includes('11') && name.includes('i')) return 'Rocket Lake';
    if (name.includes('10') && name.includes('i')) return 'Comet Lake';
    if (name.includes('9') && year >= 2018) return 'Coffee Lake Refresh';
    if (name.includes('8') && year >= 2017) return 'Coffee Lake';
    if (name.includes('7') && year >= 2016) return 'Kaby Lake';
    if (name.includes('6') && year >= 2015) return 'Skylake';
    if (name.includes('5') && year >= 2014) return 'Broadwell';
    if (name.includes('4') && year >= 2013) return 'Haswell';
    if (name.includes('3') && year >= 2012) return 'Ivy Bridge';
    if (name.includes('2') && year >= 2011) return 'Sandy Bridge';
    if (year >= 2008) return 'Nehalem';
    return 'Legacy Intel';
}

function determineAmdGeneration(name, year) {
    if (name.includes('7950X3D') || name.includes('7800X3D')) return 'Zen 4 V-Cache';
    if (name.includes('7') && name.includes('Ryzen') && year >= 2022) return 'Zen 4';
    if (name.includes('5800X3D')) return 'Zen 3 V-Cache';
    if (name.includes('5') && name.includes('Ryzen') && year >= 2020) return 'Zen 3';
    if (name.includes('3') && name.includes('Ryzen') && year >= 2019) return 'Zen 2';
    if (name.includes('2') && name.includes('Ryzen')) return 'Zen+';
    if (name.includes('1') && name.includes('Ryzen')) return 'Zen';
    if (name.includes('FX')) return 'Bulldozer';
    if (name.includes('Phenom')) return 'K10';
    if (name.includes('Athlon')) return 'Athlon';
    return 'Legacy AMD';
}

function determineSocket(vendor, generation, year) {
    if (vendor === 'Intel') {
        if (generation.includes('Raptor') || generation.includes('Alder')) return 'LGA1700';
        if (generation.includes('Rocket') || generation.includes('Comet')) return 'LGA1200';
        if (generation.includes('Coffee')) return 'LGA1151-v2';
        if (generation.includes('Kaby') || generation.includes('Skylake')) return 'LGA1151';
        if (generation.includes('Broadwell') || generation.includes('Haswell')) return 'LGA1150';
        return 'LGA1155';
    } else {
        if (generation.includes('Zen 4')) return 'AM5';
        if (generation.includes('Zen')) return 'AM4';
        return 'AM3+';
    }
}

const MANUAL_CPUS = {
    'Core i9-14900K': { cores: 24, threads: 32, base: 3.2, boost: 6.0, tdp: 125, gen: 'Raptor Lake Refresh' },
    'Core i7-14700K': { cores: 20, threads: 28, base: 3.4, boost: 5.6, tdp: 125, gen: 'Raptor Lake Refresh' },
    'Core i5-14600K': { cores: 14, threads: 20, base: 3.5, boost: 5.3, tdp: 125, gen: 'Raptor Lake Refresh' },
    'Core i9-13900K': { cores: 24, threads: 32, base: 3.0, boost: 5.8, tdp: 125, gen: 'Raptor Lake' },
    'Core i7-13700K': { cores: 16, threads: 24, base: 3.4, boost: 5.4, tdp: 125, gen: 'Raptor Lake' },
    'Core i5-13600K': { cores: 14, threads: 20, base: 3.5, boost: 5.1, tdp: 125, gen: 'Raptor Lake' },
    'Core i9-12900K': { cores: 16, threads: 24, base: 3.2, boost: 5.2, tdp: 125, gen: 'Alder Lake' },
    'Core i7-12700K': { cores: 12, threads: 20, base: 3.6, boost: 5.0, tdp: 125, gen: 'Alder Lake' },
    'Core i5-12600K': { cores: 10, threads: 16, base: 3.7, boost: 4.9, tdp: 125, gen: 'Alder Lake' },
    'Ryzen 9 7950X3D': { cores: 16, threads: 32, base: 4.2, boost: 5.7, tdp: 120, gen: 'Zen 4 V-Cache' },
    'Ryzen 9 7950X': { cores: 16, threads: 32, base: 4.5, boost: 5.7, tdp: 170, gen: 'Zen 4' },
    'Ryzen 7 7800X3D': { cores: 8, threads: 16, base: 4.2, boost: 5.0, tdp: 120, gen: 'Zen 4 V-Cache' },
    'Ryzen 5 7600X': { cores: 6, threads: 12, base: 4.7, boost: 5.3, tdp: 105, gen: 'Zen 4' },
    'Ryzen 9 5950X': { cores: 16, threads: 32, base: 3.4, boost: 4.9, tdp: 105, gen: 'Zen 3' },
    'Ryzen 9 5900X': { cores: 12, threads: 24, base: 3.7, boost: 4.8, tdp: 105, gen: 'Zen 3' },
    'Ryzen 7 5800X3D': { cores: 8, threads: 16, base: 3.4, boost: 4.5, tdp: 105, gen: 'Zen 3 V-Cache' },
    'Ryzen 5 5600X': { cores: 6, threads: 12, base: 3.7, boost: 4.6, tdp: 65, gen: 'Zen 3' }
};

function processCPUs(data) {
    const cpus = [];
    const seen = new Set();

    // Add Manual first
    Object.entries(MANUAL_CPUS).forEach(([name, specs]) => {
        const vendor = name.includes('Ryzen') ? 'AMD' : 'Intel';
        const id = generateCpuId(vendor + ' ' + name);
        seen.add(id);
        const year = specs.gen.includes('14') ? 2023 : specs.gen.includes('12') ? 2021 : 2020;
        cpus.push({
            id, name: `${vendor} ${name}`, vendor, generation: specs.gen, generationYear: year, socket: determineSocket(vendor, specs.gen, year),
            process: vendor === 'Intel' ? '10nm' : '5nm', supportedMemory: determineMemorySupport(null, name, vendor),
            cores: specs.cores, threads: specs.threads, baseClock: specs.base, boostClock: specs.boost, allCoreTurbo: specs.boost - 0.4,
            clockUnit: 'GHz', tdp: specs.tdp, idlePower: Math.round(specs.tdp * 0.08), lightLoadPower: Math.round(specs.tdp * 0.25),
            gamingPower: Math.round(specs.tdp * 0.65), renderingPower: Math.round(specs.tdp * 1.1), stressPower: Math.round(specs.tdp * 1.3),
            shortBoostPower: Math.round(specs.tdp * 1.5), shortBoostDuration: 56, sustainedPower: specs.tdp,
            maxSafeTemp: 100, throttleTemp: 100, thermalDensity: 0.95
        });
    });

    // INCLUSIVE LOOP
    for (const row of data.filter(r => r.Type === 'CPU')) {
        const name = row.Product || '';
        if (!name) continue;

        // Only minimal filtering: remove actual junk/malformed
        if (name.includes('Atom') && !name.includes('x5')) continue;

        let id = generateCpuId(name);
        if (seen.has(id)) {
            id = `${id}-${row['Release Date']?.substring(0, 4) || 'dupe'}`;
            if (seen.has(id)) continue;
        }
        seen.add(id);

        const vendor = row.Vendor || (name.includes('AMD') || name.includes('Ryzen') ? 'AMD' : 'Intel');
        // Assume recent if date missing to ensure inclusion? No, assume old.
        const year = parseInt(row['Release Date']?.substring(0, 4)) || 2010;

        const freq = parseFloat(row['Freq (MHz)']) || 2000;
        const tdp = parseFloat(row['TDP (W)']) || 65;

        let generation = vendor === 'Intel' ? determineIntelGeneration(name, year) : determineAmdGeneration(name, year);
        if (generation.includes('Legacy') && year > 2015) generation = 'Mobile/Other';

        let cores = 2;
        if (row['Cores']) cores = parseInt(row['Cores']);
        else {
            // Heuristic fallback
            if (name.includes('Quad') || name.includes('X4')) cores = 4;
            else if (name.includes('Hexa') || name.includes('X6') || name.includes('Ryzen 5')) cores = 6;
            else if (name.includes('Octa') || name.includes('X8') || name.includes('Ryzen 7')) cores = 8;
            else if (name.includes('i7') || name.includes('i9') || name.includes('Ryzen 9')) cores = 8;
            else if (name.includes('i5')) cores = 4;
            else if (name.includes('i3')) cores = 2;
        }

        const baseClock = freq / 1000;

        cpus.push({
            id, name, vendor, generation, generationYear: year, socket: determineSocket(vendor, generation, year),
            process: 'Unknown', supportedMemory: determineMemorySupport(row['Release Date'], name, vendor),
            cores, threads: cores * 2, baseClock: parseFloat(baseClock.toFixed(2)), boostClock: parseFloat((baseClock * 1.2).toFixed(2)),
            allCoreTurbo: parseFloat((baseClock * 1.1).toFixed(2)), clockUnit: 'GHz', tdp: Math.round(tdp),
            idlePower: Math.round(tdp * 0.1), lightLoadPower: Math.round(tdp * 0.3), gamingPower: Math.round(tdp * 0.7),
            renderingPower: Math.round(tdp), stressPower: Math.round(tdp * 1.1), shortBoostPower: Math.round(tdp * 1.25),
            shortBoostDuration: 28, sustainedPower: Math.round(tdp), maxSafeTemp: 90, throttleTemp: 100, thermalDensity: 0.8
        });
    }
    return cpus.sort((a, b) => b.generationYear - a.generationYear || b.cores - a.cores);
}

function generateGpuId(name) {
    return name.toLowerCase().replace(/geforce\s+/i, '').replace(/radeon\s+/i, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 40);
}

const MANUAL_GPUS = {
    // NVIDIA RTX 40 Series (Ada Lovelace)
    'GeForce RTX 4090': { vram: 24, type: 'GDDR6X', base: 2235, boost: 2520, tdp: 450, gen: 'Ada Lovelace', year: 2022 },
    'GeForce RTX 4080 SUPER': { vram: 16, type: 'GDDR6X', base: 2295, boost: 2550, tdp: 320, gen: 'Ada Lovelace', year: 2024 },
    'GeForce RTX 4080': { vram: 16, type: 'GDDR6X', base: 2205, boost: 2505, tdp: 320, gen: 'Ada Lovelace', year: 2022 },
    'GeForce RTX 4070 Ti SUPER': { vram: 16, type: 'GDDR6X', base: 2340, boost: 2610, tdp: 285, gen: 'Ada Lovelace', year: 2024 },
    'GeForce RTX 4070 Ti': { vram: 12, type: 'GDDR6X', base: 2310, boost: 2610, tdp: 285, gen: 'Ada Lovelace', year: 2023 },
    'GeForce RTX 4070 SUPER': { vram: 12, type: 'GDDR6X', base: 1980, boost: 2475, tdp: 220, gen: 'Ada Lovelace', year: 2024 },
    'GeForce RTX 4070': { vram: 12, type: 'GDDR6X', base: 1920, boost: 2475, tdp: 200, gen: 'Ada Lovelace', year: 2023 },
    'GeForce RTX 4060 Ti 16GB': { vram: 16, type: 'GDDR6', base: 2310, boost: 2535, tdp: 165, gen: 'Ada Lovelace', year: 2023 },
    'GeForce RTX 4060 Ti': { vram: 8, type: 'GDDR6', base: 2310, boost: 2535, tdp: 160, gen: 'Ada Lovelace', year: 2023 },
    'GeForce RTX 4060': { vram: 8, type: 'GDDR6', base: 1830, boost: 2460, tdp: 115, gen: 'Ada Lovelace', year: 2023 },
    
    // NVIDIA RTX 30 Series (Ampere)
    'GeForce RTX 3090 Ti': { vram: 24, type: 'GDDR6X', base: 1560, boost: 1860, tdp: 450, gen: 'Ampere', year: 2022 },
    'GeForce RTX 3090': { vram: 24, type: 'GDDR6X', base: 1395, boost: 1695, tdp: 350, gen: 'Ampere', year: 2020 },
    'GeForce RTX 3080 Ti': { vram: 12, type: 'GDDR6X', base: 1365, boost: 1665, tdp: 350, gen: 'Ampere', year: 2021 },
    'GeForce RTX 3080 12GB': { vram: 12, type: 'GDDR6X', base: 1260, boost: 1710, tdp: 350, gen: 'Ampere', year: 2022 },
    'GeForce RTX 3080': { vram: 10, type: 'GDDR6X', base: 1440, boost: 1710, tdp: 320, gen: 'Ampere', year: 2020 },
    'GeForce RTX 3070 Ti': { vram: 8, type: 'GDDR6X', base: 1575, boost: 1770, tdp: 290, gen: 'Ampere', year: 2021 },
    'GeForce RTX 3070': { vram: 8, type: 'GDDR6', base: 1500, boost: 1725, tdp: 220, gen: 'Ampere', year: 2020 },
    'GeForce RTX 3060 Ti': { vram: 8, type: 'GDDR6', base: 1410, boost: 1665, tdp: 200, gen: 'Ampere', year: 2020 },
    'GeForce RTX 3060 12GB': { vram: 12, type: 'GDDR6', base: 1320, boost: 1777, tdp: 170, gen: 'Ampere', year: 2021 },
    'GeForce RTX 3060': { vram: 8, type: 'GDDR6', base: 1320, boost: 1777, tdp: 170, gen: 'Ampere', year: 2022 },
    'GeForce RTX 3050': { vram: 8, type: 'GDDR6', base: 1552, boost: 1777, tdp: 130, gen: 'Ampere', year: 2022 },
    
    // AMD RX 7000 Series (RDNA 3)
    'Radeon RX 7900 XTX': { vram: 24, type: 'GDDR6', base: 2300, boost: 2500, tdp: 355, gen: 'RDNA 3', year: 2022 },
    'Radeon RX 7900 XT': { vram: 20, type: 'GDDR6', base: 2000, boost: 2400, tdp: 315, gen: 'RDNA 3', year: 2022 },
    'Radeon RX 7900 GRE': { vram: 16, type: 'GDDR6', base: 1880, boost: 2245, tdp: 260, gen: 'RDNA 3', year: 2023 },
    'Radeon RX 7800 XT': { vram: 16, type: 'GDDR6', base: 2124, boost: 2430, tdp: 263, gen: 'RDNA 3', year: 2023 },
    'Radeon RX 7700 XT': { vram: 12, type: 'GDDR6', base: 2171, boost: 2544, tdp: 245, gen: 'RDNA 3', year: 2023 },
    'Radeon RX 7600 XT': { vram: 16, type: 'GDDR6', base: 1900, boost: 2755, tdp: 190, gen: 'RDNA 3', year: 2024 },
    'Radeon RX 7600': { vram: 8, type: 'GDDR6', base: 1720, boost: 2655, tdp: 165, gen: 'RDNA 3', year: 2023 },
    
    // AMD RX 6000 Series (RDNA 2)
    'Radeon RX 6950 XT': { vram: 16, type: 'GDDR6', base: 2100, boost: 2310, tdp: 335, gen: 'RDNA 2', year: 2022 },
    'Radeon RX 6900 XT': { vram: 16, type: 'GDDR6', base: 2015, boost: 2250, tdp: 300, gen: 'RDNA 2', year: 2020 },
    'Radeon RX 6800 XT': { vram: 16, type: 'GDDR6', base: 2015, boost: 2250, tdp: 300, gen: 'RDNA 2', year: 2020 },
    'Radeon RX 6800': { vram: 16, type: 'GDDR6', base: 1700, boost: 2105, tdp: 250, gen: 'RDNA 2', year: 2020 },
    'Radeon RX 6750 XT': { vram: 12, type: 'GDDR6', base: 2150, boost: 2600, tdp: 250, gen: 'RDNA 2', year: 2022 },
    'Radeon RX 6700 XT': { vram: 12, type: 'GDDR6', base: 2321, boost: 2581, tdp: 230, gen: 'RDNA 2', year: 2021 },
    'Radeon RX 6700': { vram: 10, type: 'GDDR6', base: 2174, boost: 2450, tdp: 175, gen: 'RDNA 2', year: 2021 },
    'Radeon RX 6650 XT': { vram: 8, type: 'GDDR6', base: 2055, boost: 2635, tdp: 176, gen: 'RDNA 2', year: 2022 },
    'Radeon RX 6600 XT': { vram: 8, type: 'GDDR6', base: 1968, boost: 2589, tdp: 160, gen: 'RDNA 2', year: 2021 },
    'Radeon RX 6600': { vram: 8, type: 'GDDR6', base: 1626, boost: 2491, tdp: 132, gen: 'RDNA 2', year: 2021 },
    'Radeon RX 6500 XT': { vram: 4, type: 'GDDR6', base: 2310, boost: 2815, tdp: 107, gen: 'RDNA 2', year: 2022 },
    'Radeon RX 6400': { vram: 4, type: 'GDDR6', base: 2039, boost: 2321, tdp: 53, gen: 'RDNA 2', year: 2022 }
};

function processGPUs(data) {
    const gpus = [];
    const seen = new Set();

    // Manual Overrides
    Object.entries(MANUAL_GPUS).forEach(([name, specs]) => {
        const id = generateGpuId(name);
        seen.add(id);
        const vendor = name.includes('GeForce') || name.includes('Quadro') || name.includes('Titan') ? 'NVIDIA' : 'AMD';

        let transientMult = 1.3;
        if (specs.gen === 'Ada Lovelace') transientMult = 1.9;
        else if (specs.gen === 'Ampere') transientMult = 1.7;
        else if (specs.gen === 'RDNA 3' || specs.gen === 'RDNA 2') transientMult = 1.5;

        gpus.push({
            id, name, vendor, generation: specs.gen, year: specs.year, vram: specs.vram, memoryType: specs.type,
            baseClock: specs.base, boostClock: specs.boost, memClock: specs.type === 'GDDR6X' ? '21000 MHz eff' : '16000 MHz eff',
            boardPower: specs.tdp, idleDraw: Math.round(specs.tdp * 0.05 + 10), lightLoadDraw: Math.round(specs.tdp * 0.25),
            gamingDraw: Math.round(specs.tdp * 0.90), renderingDraw: Math.round(specs.tdp * 0.85), stressDraw: specs.tdp,
            transientMultiplier: parseFloat(transientMult.toFixed(2)), transientDuration: 20, recommendedPsu: Math.round((specs.tdp + 250) / 50) * 50
        });
    });

    // INCLUSIVE LOOP for GPUs - prioritize modern cards
    for (const row of data) {
        let name = row.Name || '';
        if (!name) continue;

        const vendor = row.Brand || '';
        if (!['NVIDIA', 'AMD', 'Intel', 'ATI'].includes(vendor)) continue;

        const releaseYear = parseInt((row['Graphics Card__Release Date'] || '').match(/\d{4}/)?.[0]) || 0;
        
        // Filter: Focus on modern GPUs (2015+) and exclude mobile/workstation variants for now
        if (releaseYear < 2015) continue;
        if (name.includes('Mobile') || name.includes('Mobility') || name.includes('Quadro') || 
            name.includes('FirePro') || name.includes('Tesla') || name.includes('Titan')) continue;

        let id = generateGpuId(name);
        if (seen.has(id)) {
            id = `${id}-${releaseYear}`;
            if (seen.has(id)) continue;
        }
        seen.add(id);

        // Clean name
        name = name.replace(/NVIDIA\s+/i, '').replace(/AMD\s+/i, '');
        if (vendor === 'NVIDIA' && !name.includes('GeForce') && !name.includes('Titan') && !name.includes('Quadro')) {
            name = 'GeForce ' + name;
        }
        if ((vendor === 'AMD' || vendor === 'ATI') && !name.includes('Radeon')) {
            name = 'Radeon ' + name;
        }

        // Broad Generation logic
        let generation = 'Other';
        if (vendor === 'NVIDIA') {
            if (name.includes('RTX 4')) generation = 'Ada Lovelace';
            else if (name.includes('RTX 3')) generation = 'Ampere';
            else if (name.includes('RTX 2')) generation = 'Turing';
            else if (name.includes('GTX 16')) generation = 'Turing';
            else if (name.includes('GTX 1')) generation = 'Pascal';
            else if (name.includes('GTX 9') || name.includes('GTX 7')) generation = 'Maxwell';
            else generation = 'Legacy NVIDIA';
        } else if (vendor === 'AMD' || vendor === 'ATI') {
            if (name.includes('RX 7')) generation = 'RDNA 3';
            else if (name.includes('RX 6')) generation = 'RDNA 2';
            else if (name.includes('RX 5')) generation = 'RDNA';
            else if (name.includes('RX 4') || name.includes('RX Vega')) generation = 'Vega';
            else generation = 'Legacy AMD';
        }

        const tdp = parseInt(row['Board Design__TDP']?.match(/\d+/)?.[0]) || 75;
        const vram = parseInt(row['Memory__Memory Size']?.match(/\d+/)?.[0]) || 4;
        const boostClock = parseInt(row['Clock Speeds__Boost Clock']?.match(/\d+/)?.[0]) ||
            parseInt(row['Clock Speeds__GPU Clock']?.match(/\d+/)?.[0]) || 1000;
        const baseClock = parseInt(row['Clock Speeds__Base Clock']?.match(/\d+/)?.[0]) || (boostClock - 200);

        // Determine memory type
        let memType = 'GDDR6';
        const memTypeRaw = row['Memory__Memory Type'] || '';
        if (memTypeRaw.includes('GDDR6X')) memType = 'GDDR6X';
        else if (memTypeRaw.includes('GDDR5')) memType = 'GDDR5';
        else if (memTypeRaw.includes('HBM')) memType = 'HBM2';

        // Determine transient multiplier based on generation
        let transientMult = 1.25;
        if (generation === 'Ada Lovelace') transientMult = 1.9;
        else if (generation === 'Ampere') transientMult = 1.7;
        else if (generation === 'RDNA 3' || generation === 'RDNA 2') transientMult = 1.5;
        else if (generation === 'Turing') transientMult = 1.6;

        gpus.push({
            id, name, vendor, generation, year: releaseYear, vram, memoryType: memType,
            baseClock, boostClock, memClock: memType === 'GDDR6X' ? '19000 MHz eff' : 'Unknown',
            boardPower: tdp, idleDraw: Math.round(tdp * 0.1), lightLoadDraw: Math.round(tdp * 0.3),
            gamingDraw: Math.round(tdp * 0.85), renderingDraw: Math.round(tdp * 0.9), stressDraw: tdp,
            transientMultiplier: parseFloat(transientMult.toFixed(2)), transientDuration: 15, 
            recommendedPsu: Math.round((tdp + 150) / 50) * 50
        });
    }

    // Sort: Manuals (by implicit gen) -> Newest -> Highest Power
    const genOrder = { 'Ada Lovelace': 100, 'RDNA 3': 95, 'Ampere': 90, 'RDNA 2': 85, 'Turing': 80, 'RDNA': 75, 'Pascal': 70 };
    return gpus.sort((a, b) => {
        const orderA = genOrder[a.generation] || 0;
        const orderB = genOrder[b.generation] || 0;
        if (orderA !== orderB) return orderB - orderA;
        return b.year - a.year || b.boardPower - a.boardPower;
    });
}

// Main execution
async function main() {
    console.log('Reading CSV files...');
    const chipData = fs.readFileSync('datasets/chip_dataset.csv', 'utf-8');
    const gpuData = fs.readFileSync('datasets/gpu_1986-2026.csv', 'utf-8');

    console.log('Parsing CPUs...');
    const parsedChips = parseCSV(chipData);
    const cpus = processCPUs(parsedChips);
    console.log(`Generated ${cpus.length} CPUs`);

    console.log('Parsing GPUs...');
    const parsedGpus = parseCSV(gpuData);
    const gpus = processGPUs(parsedGpus);
    console.log(`Generated ${gpus.length} GPUs`);

    fs.writeFileSync('src/data/cpus.json', JSON.stringify(cpus, null, 2));
    fs.writeFileSync('src/data/gpus.json', JSON.stringify(gpus, null, 2));

    fs.mkdirSync('public/data', { recursive: true });
    fs.copyFileSync('src/data/cpus.json', 'public/data/cpus.json');
    fs.copyFileSync('src/data/gpus.json', 'public/data/gpus.json');

    console.log('Done! Files written to src/data/ and public/data/');
}

main().catch(console.error);
