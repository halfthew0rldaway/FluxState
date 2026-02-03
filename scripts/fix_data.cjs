
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src/data');
const PUBLIC_DIR = path.join(__dirname, '../public/data');

function fixCpuGenerations(cpus) {
    let fixedCount = 0;

    // Helper to check if string matches regex
    const matches = (str, regex) => str && regex.test(str);

    cpus.forEach(cpu => {
        if (cpu.vendor !== 'Intel') return;

        const name = cpu.name || '';
        const id = cpu.id || '';
        let newGen = null;
        let newYear = null;

        // --- SAFEGUARDS FOR LEGACY / WEIRD CHIPS ---
        if (name.includes('Pentium III') || name.includes('Pentium 4') || name.includes('Pentium M') || name.includes('Pentium D') || name.includes('Pentium 4-M')) {
            newGen = 'Legacy Intel';
            newYear = 2002;
        }
        else if (name.includes('Core 2 Duo') || name.includes('Core 2 Quad') || name.includes('Core 2 Extreme')) {
            newGen = 'Legacy Intel';
            newYear = 2008;
        }
        else if (name.includes('Atom')) {
            newGen = 'Legacy Intel';
        }
        else if (name.includes('Xeon Phi')) {
            newGen = 'Legacy Intel'; // Discontinued architecture
        }
        else if (name.includes('Itanium')) {
            newGen = 'Legacy Intel';
        }

        // --- XEON GENERATIONS ---
        else if (name.includes('Xeon')) {
            // Check v-series
            if (matches(name, /v2/)) { newGen = 'Ivy Bridge'; newYear = 2013; }
            else if (matches(name, /v3/)) { newGen = 'Haswell'; newYear = 2014; }
            else if (matches(name, /v4/)) { newGen = 'Broadwell'; newYear = 2015; }
            else if (matches(name, /v5/)) { newGen = 'Skylake'; newYear = 2016; }
            else if (matches(name, /v6/)) { newGen = 'Kaby Lake'; newYear = 2017; }
            // Scalable
            else if (matches(name, /Bronze|Silver|Gold|Platinum/)) {
                // 3rd Gen Scalable (Ice Lake)
                if (matches(name, /(83|63|53|43)\d{2}/)) { newGen = 'Ice Lake'; newYear = 2021; }
                else { newGen = 'Skylake'; newYear = 2017; } // Simplifying Cascade/Skylake SP -> Skylake group
            }
            // Older Xeons (5xxx, 3xxx pre-v2)
            else if (matches(name, /Xeon [EXWL]?\d{4}/)) {
                newGen = 'Legacy Intel'; // Nehalem/Westmere era
            }
            else {
                newGen = 'Server/Workstation'; // Catch-all for unlabeled modern Xeons
            }
        }

        // --- MODERN CORE SERIES / PENTIUM / CELERON FIXES ---
        else {
            // Mobile 11th Gen (Tiger Lake)
            if (matches(id, /i\d-11\d{2}G\d/) || matches(name, /11\d{2}G\d/)) { newGen = 'Tiger Lake'; newYear = 2020; }
            // Mobile 10th Gen (Ice Lake)
            else if (matches(id, /i\d-10\d{2}G\d/) || matches(name, /10\d{2}G\d/)) { newGen = 'Ice Lake'; newYear = 2019; }

            // Core i Series
            else if (matches(id, /i\d-14\d{3}/)) { newGen = 'Raptor Lake Refresh'; newYear = 2023; }
            else if (matches(id, /i\d-13\d{3}/)) { newGen = 'Raptor Lake'; newYear = 2022; }
            else if (matches(id, /i\d-12\d{3}/)) { newGen = 'Alder Lake'; newYear = 2021; }
            else if (matches(id, /i\d-11\d{3}/)) { newGen = 'Rocket Lake'; newYear = 2021; }
            else if (matches(id, /i\d-10\d{3}/)) { newGen = 'Comet Lake'; newYear = 2020; }
            else if (matches(id, /i\d-9\d{3}/)) { newGen = 'Coffee Lake Refresh'; newYear = 2018; }
            else if (matches(id, /i\d-8\d{3}/)) { newGen = 'Coffee Lake'; newYear = 2017; }
            else if (matches(id, /i\d-7\d{3}/)) { newGen = 'Kaby Lake'; newYear = 2016; }
            else if (matches(id, /i\d-6\d{3}/)) { newGen = 'Skylake'; newYear = 2015; }
            else if (matches(id, /i\d-5\d{3}/)) { newGen = 'Broadwell'; newYear = 2014; }
            else if (matches(id, /i\d-4\d{3}/)) { newGen = 'Haswell'; newYear = 2013; }
            // Ivy Bridge (3rd Gen) + Pentium 2129Y (2xxxY matches here if we are careful)
            else if (matches(id, /i\d-3\d{3}/)) { newGen = 'Ivy Bridge'; newYear = 2012; }
            else if (matches(id, /i\d-2\d{3}/)) { newGen = 'Sandy Bridge'; newYear = 2011; }
            else if (matches(id, /i\d-\d{3}$/) || matches(name, /Core i\d-\d{3}\s/)) { newGen = 'Nehalem'; newYear = 2008; }

            // Pentium/Celeron specifics
            else if (name.includes('Pentium') || name.includes('Celeron')) {
                // Y-series (Ivy/Haswell/Broadwell/Skylake/Kaby/Amber) - messy naming
                if (matches(name, /2129Y|2117U|2030M/)) { newGen = 'Ivy Bridge'; }
                else if (matches(name, /3560Y|3556U/)) { newGen = 'Haswell'; }

                // G-series
                else if (matches(name, /G7\d{3}/)) { newGen = 'Alder Lake'; }
                else if (matches(name, /G6\d{3}/)) { newGen = 'Comet Lake'; }
                else if (matches(name, /G5\d{3}/)) { newGen = 'Coffee Lake'; }
                else if (matches(name, /G4\d{3}/)) { newGen = 'Kaby Lake'; } // Simplify G4xxx to Kaby
                else if (matches(name, /G3\d{3}/)) { newGen = 'Haswell'; }
                else if (matches(name, /G2\d{3}/)) { newGen = 'Sandy Bridge'; }

                // N-series / J-series (Atom based usually, but labeled Celeron/Pentium)
                else if (matches(name, /[JN]\d{4}/)) { newGen = 'Legacy Intel'; } // Bay Trail/Braswell etc mapped to legacy/low-end

                // Catch old 3-digit Pentiums
                else if (matches(name, /G\d{3}/)) { newGen = 'Legacy Intel'; }
            }
        }

        // --- FINAL VALIDATION ---
        // If still Alder Lake/Raptor Lake but name looks suspicious, downgrade it
        const currentOrNewGen = newGen || cpu.generation;
        if (currentOrNewGen === 'Alder Lake' || currentOrNewGen === 'Raptor Lake' || currentOrNewGen === 'Raptor Lake Refresh') {
            const isLegit = matches(id, /i\d-(12|13|14)\d{3}/) || matches(name, /G7\d{3}/);
            if (!isLegit) {
                // If it's NOT a legit 12/13/14th gen ID, map it to Legacy Intel
                console.log(`[Validation] Force-fixing suspicious modern chip: ${name} (${currentOrNewGen}) -> Legacy Intel`);
                newGen = 'Legacy Intel';
                newYear = 2010;
            }
        }

        if (newGen && cpu.generation !== newGen) {
            console.log(`Fixing ${cpu.name}: ${cpu.generation} -> ${newGen}`);
            cpu.generation = newGen;
            if (newYear) cpu.generationYear = newYear;
            fixedCount++;
        }
    });
    console.log(`Fixed ${fixedCount} CPU generations`);
    return cpus;
}

function normalizeGpuName(name, vendor) {
    let normalized = name;
    if (vendor === 'NVIDIA' && normalized.startsWith('NVIDIA ')) normalized = normalized.replace('NVIDIA ', '');
    if (vendor === 'AMD' && normalized.startsWith('AMD ')) normalized = normalized.replace('AMD ', '');
    normalized = normalized.replace(/(\d+)\s*GB/i, '$1GB');
    return normalized.trim();
}

function deduplicateGpus(gpus) {
    const unique = new Map();
    const duplicates = [];
    gpus.forEach(gpu => {
        const normalizedName = normalizeGpuName(gpu.name, gpu.vendor);
        const key = `${normalizedName}|${gpu.vendor}|${gpu.vram}`;
        if (unique.has(key)) {
            const existing = unique.get(key);
            if (gpu.name.length < existing.name.length) unique.set(key, gpu);
            duplicates.push(gpu.name);
        } else {
            unique.set(key, gpu);
        }
    });
    console.log(`Removed ${duplicates.length} duplicate GPUs (normalized)`);
    return Array.from(unique.values());
}

async function main() {
    const cpusPath = path.join(SRC_DIR, 'cpus.json');
    const cpus = JSON.parse(fs.readFileSync(cpusPath, 'utf8'));
    const fixedCpus = fixCpuGenerations(cpus);
    fs.writeFileSync(cpusPath, JSON.stringify(fixedCpus, null, 2));
    fs.writeFileSync(path.join(PUBLIC_DIR, 'cpus.json'), JSON.stringify(fixedCpus, null, 2));

    const gpusPath = path.join(SRC_DIR, 'gpus.json');
    const gpus = JSON.parse(fs.readFileSync(gpusPath, 'utf8'));
    const uniqueGpus = deduplicateGpus(gpus);

    const genRank = {
        'Blackwell': 100, 'Ada Lovelace': 90, 'RDNA 3': 85, 'Ampere': 80,
        'RDNA 2': 75, 'Turing': 70, 'RDNA': 65, 'Pascal': 60,
        'Vega': 55, 'Maxwell': 50, 'Polaris': 45
    };
    uniqueGpus.sort((a, b) => {
        const rankA = genRank[a.generation] || 0;
        const rankB = genRank[b.generation] || 0;
        if (rankA !== rankB) return rankB - rankA;
        return (b.boardPower || 0) - (a.boardPower || 0);
    });

    fs.writeFileSync(gpusPath, JSON.stringify(uniqueGpus, null, 2));
    fs.writeFileSync(path.join(PUBLIC_DIR, 'gpus.json'), JSON.stringify(uniqueGpus, null, 2));
    console.log('✅ Data cleanup complete');
}

main();
