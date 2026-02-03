/**
 * UI Rendering Module - Comprehensive
 * Handles DOM interactions with grouped selectors, compatibility warnings, and dynamic help
 */

import { createSimulatorGraphs } from './graph.js';
import { WORKLOAD_PROFILES } from './power.js';
import { getSeverityPriority } from './warnings.js';
import { SearchableDropdown } from './searchable-dropdown.js';
import { valueTracker } from './value-tracker.js';

function formatNumber(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) return '--';
    return value.toFixed(decimals);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getElements() {
    return {
        cpuSelect: document.getElementById('cpu-select'),
        gpuSelect: document.getElementById('gpu-select'),
        psuSelect: document.getElementById('psu-select'),
        coolingSelect: document.getElementById('cooling-select'),
        memorySelect: document.getElementById('memory-select'),
        fanCountInput: document.getElementById('fan-count'),
        storageNvmeInput: document.getElementById('storage-nvme'),
        storageSataInput: document.getElementById('storage-sata'),
        storageHddInput: document.getElementById('storage-hdd'),
        workloadSelect: document.getElementById('workload-select'),
        ambientTempInput: document.getElementById('ambient-temp'),
        airflowSelect: document.getElementById('airflow-select'),

        cpuPowerValue: document.getElementById('cpu-power-value'),
        gpuPowerValue: document.getElementById('gpu-power-value'),
        systemPowerValue: document.getElementById('system-power-value'),
        wallPowerValue: document.getElementById('wall-power-value'),
        transientPeakValue: document.getElementById('transient-peak-value'),
        psuLoadValue: document.getElementById('psu-load-value'),
        psuLoadBar: document.getElementById('psu-load-bar'),
        efficiencyValue: document.getElementById('efficiency-value'),
        heatWasteValue: document.getElementById('heat-waste-value'),

        cpuTempValue: document.getElementById('cpu-temp-value'),
        cpuTempBar: document.getElementById('cpu-temp-bar'),
        equilibriumValue: document.getElementById('equilibrium-value'),
        fanSpeedValue: document.getElementById('fan-speed-value'),
        noiseValue: document.getElementById('noise-value'),
        coolingCapacityValue: document.getElementById('cooling-capacity-value'),
        thermalHeadroomValue: document.getElementById('thermal-headroom-value'),
        throttleIndicator: document.getElementById('throttle-indicator'),
        boostIndicator: document.getElementById('boost-indicator'),

        powerCanvas: document.getElementById('power-graph'),
        tempCanvas: document.getElementById('temp-graph'),
        historySlider: document.getElementById('history-slider'),

        warningsContainer: document.getElementById('warnings-container'),
        workloadExplanation: document.getElementById('workload-explanation'),
        thermalExplanation: document.getElementById('thermal-explanation'),
        contextHelp: document.getElementById('context-help'),
        componentDetails: document.getElementById('component-details'),
        compatibilityWarning: document.getElementById('compatibility-warning'),

        pauseButton: document.getElementById('pause-button'),
        resetButton: document.getElementById('reset-button'),
        speedSelect: document.getElementById('speed-select'),
        simulatedTimeValue: document.getElementById('simulated-time-value'),

        cpuInfo: document.getElementById('cpu-info'),
        gpuInfo: document.getElementById('gpu-info'),

        cpuClockValue: document.getElementById('cpu-clock-value'),
        gpuClockValue: document.getElementById('gpu-clock-value'),
        cpuClockFull: document.getElementById('cpu-clock-full'),
        gpuClockFull: document.getElementById('gpu-clock-full'),
        memClockFull: document.getElementById('mem-clock-full'),

        helpToggle: document.getElementById('help-toggle'),
        helpPanel: document.getElementById('help-panel'),

        detailsToggle: document.getElementById('details-toggle'),
        detailsPanel: document.getElementById('details-panel'),
        detailsTabs: document.querySelectorAll('.tab-btn'),

        // Score Panel
        gradeRing: document.getElementById('grade-ring'),
        gradeValue: document.getElementById('grade-value'),
        scoreEffVal: document.getElementById('score-eff-val'),
        scoreEffBar: document.getElementById('score-eff-bar'),
        scoreThermVal: document.getElementById('score-therm-val'),
        scoreThermBar: document.getElementById('score-therm-bar'),
        scoreStabVal: document.getElementById('score-stab-val'),
        scoreStabBar: document.getElementById('score-stab-bar'),

        // Efficiency Indicator
        efficiencyIndicator: document.getElementById('efficiency-indicator'),
        efficiencyIndicatorText: document.getElementById('efficiency-indicator-text'),

        // Thermal Headroom Bar
        thermalHeadroomFill: document.getElementById('thermal-headroom-fill')
    };
}

// Comprehensive help text database
const HELP_TEXT = {
    cpu: {
        title: 'CPU (Processor)',
        text: `The central processing unit determines base system power and thermal requirements. Key factors:
<i class="ph-bold ph-caret-right"></i> <strong>Idle Power</strong>: 5-15W for modern CPUs
<i class="ph-bold ph-caret-right"></i> <strong>Gaming</strong>: Varies by game, typically 50-120W
<i class="ph-bold ph-caret-right"></i> <strong>Rendering/Stress</strong>: Can exceed TDP ratings during boost periods
<i class="ph-bold ph-caret-right"></i> <strong>Boost Duration</strong>: Higher-end CPUs maintain boost longer before thermal limits

Different generations have different memory compatibility. DDR3-only platforms (pre-Skylake) cannot use DDR4/DDR5. Modern Intel (12th gen+) often supports DDR4 or DDR5 depending on motherboard.`
    },
    gpu: {
        title: 'GPU (Graphics Card)',
        text: `Graphics cards dominate power consumption in gaming workloads. Critical behaviors:
<i class="ph-bold ph-caret-right"></i> <strong>Transient Spikes</strong>: Modern GPUs (especially NVIDIA 30/40 series) produce power spikes 1.5-2× average during load changes
<i class="ph-bold ph-caret-right"></i> <strong>Cooling Dependency</strong>: Insufficient cooling increases power via thermal leakage
<i class="ph-bold ph-caret-right"></i> <strong>Gaming vs Stress</strong>: Full stress tests often draw less than peak gaming due to consistent load patterns

Transient spikes can trip PSU overcurrent protection, causing shutdowns. Higher-quality PSUs handle this better.`
    },
    psu: {
        title: 'Power Supply Unit',
        text: `The PSU converts wall AC to system DC power. Important characteristics:
<i class="ph-bold ph-caret-right"></i> <strong>Efficiency Curve</strong>: Peaks around 50% load (92-94% for Gold/Platinum), drops at low and high loads
<i class="ph-bold ph-caret-right"></i> <strong>Transient Response</strong>: Higher-tier PSUs handle GPU power spikes better
<i class="ph-bold ph-caret-right"></i> <strong>80+ Ratings</strong>: Bronze (~85%), Gold (~90%), Platinum (~92%), Titanium (~94%) efficiency at 50% load

Waste heat from inefficiency adds to system thermal load. Oversized PSUs run cooler but at lower efficiency at idle.`
    },
    cooling: {
        title: 'CPU Cooling Solution',
        text: `CPU cooling determines maximum sustainable power and thermal behavior:
<i class="ph-bold ph-caret-right"></i> <strong>Heat Dissipation</strong>: Rated in watts, determines max heat that can be removed
<i class="ph-bold ph-caret-right"></i> <strong>Thermal Mass</strong>: Larger coolers absorb heat spikes better (liquid has more mass than air)
<i class="ph-bold ph-caret-right"></i> <strong>Response Time</strong>: Big liquid coolers take longer to heat up AND cool down

Stock coolers are only adequate for low-power CPUs. High-power CPUs (125W+) require substantial aftermarket cooling. Case airflow significantly affects cooler performance.`
    },
    memory: {
        title: 'System Memory (RAM)',
        text: `Memory generation affects power efficiency and platform compatibility:
<i class="ph-bold ph-caret-right"></i> <strong>DDR3</strong>: Older, ~1.5V, higher power per GB
<i class="ph-bold ph-caret-right"></i> <strong>DDR4</strong>: Standard, ~1.2V, efficient
<i class="ph-bold ph-caret-right"></i> <strong>DDR5</strong>: Latest, ~1.1V with on-DIMM power management (PMIC adds some heat)

More DIMMs = more power draw. 4-stick configurations draw more than 2-stick at same capacity. Memory type must match CPU/motherboard support—this is a physical constraint, not just preference.`
    },
    storage: {
        title: 'Storage Drives',
        text: `Different storage types have different power profiles:
<i class="ph-bold ph-caret-right"></i> <strong>NVMe SSD</strong>: Low idle (1-2W), moderate load (5-8W), minimal heat
<i class="ph-bold ph-caret-right"></i> <strong>SATA SSD</strong>: Very low power (0.5-3W), negligible heat
<i class="ph-bold ph-caret-right"></i> <strong>HDD</strong>: Higher idle (4-5W), mechanical power draw, significant heat

HDDs add mechanical vibration and more ambient heat. Multiple drives increase idle power linearly. Compiling and rendering workloads stress storage more than gaming.`
    },
    fans: {
        title: 'Case Fans',
        text: `Case fans directly affect cooling effectiveness:
<i class="ph-bold ph-caret-right"></i> <strong>More Fans</strong>: Better airflow, diminishing returns after 4-5
<i class="ph-bold ph-caret-right"></i> <strong>Fan Speed</strong>: Power consumption scales approximately with cube of speed
<i class="ph-bold ph-caret-right"></i> <strong>Noise</strong>: More fans at lower speed is quieter than fewer fans at high speed

Insufficient case fans cause hot air recirculation, reducing CPU cooler effectiveness by up to 40% in restricted cases.`
    },
    ambient: {
        title: 'Ambient Temperature',
        text: `Room temperature sets the baseline for all system temperatures:
<i class="ph-bold ph-caret-right"></i> <strong>Every 1°C increase in ambient</strong> raises component temperatures by roughly 1°C
<i class="ph-bold ph-caret-right"></i> <strong>Higher ambient</strong> reduces thermal headroom linearly
<i class="ph-bold ph-caret-right"></i> <strong>Typical range</strong>: 20-25°C is standard, 30°C+ requires more cooling capacity

Air conditioning or winter conditions can significantly improve thermal performance. Summer heat waves often trigger throttling in previously stable systems.`
    },
    airflow: {
        title: 'Case Airflow Quality',
        text: `Case airflow determines how effectively heat is removed from the chassis:
<i class="ph-bold ph-caret-right"></i> <strong>Restricted</strong>: Solid panels, poor cable management (50-60% effectiveness)
<i class="ph-bold ph-caret-right"></i> <strong>Average</strong>: Standard mid-tower with some ventilation (70-80%)
<i class="ph-bold ph-caret-right"></i> <strong>Good</strong>: Mesh front panel, proper fan setup (85-95%)
<i class="ph-bold ph-caret-right"></i> <strong>Excellent</strong>: High-airflow mesh case or open bench (100%)

Poor airflow causes hot air to recirculate through the CPU cooler, dramatically reducing cooling performance. The case is often the bottleneck for high-power systems.`
    },
    workload: {
        title: 'Workload Profile',
        text: `Different tasks stress components differently:
<i class="ph-bold ph-caret-right"></i> <strong>Idle</strong>: Minimal power, all components in low-power states
<i class="ph-bold ph-caret-right"></i> <strong>Gaming</strong>: GPU-heavy, CPU moderate, steady-state load
<i class="ph-bold ph-caret-right"></i> <strong>Rendering</strong>: CPU at 100%, GPU assists, memory-intensive
<i class="ph-bold ph-caret-right"></i> <strong>Compiling</strong>: CPU-heavy with high storage I/O
<i class="ph-bold ph-caret-right"></i> <strong>Stress Test</strong>: Synthetic maximum, unrealistic but reveals limits

Initial load application triggers boost behavior—CPU power spikes then decays as thermal limits engage. Equilibrium temperature is reached after 1-5 minutes depending on thermal mass.`
    }
};

/**
 * Populate selects with grouped options
 */
function populateSelects(elements, hardwareData) {
    try {
        const { cpus, gpus, psus, cooling, memory } = hardwareData;

        // CPUs: Group by vendor then generation (matching GPU sorting logic)
        if (elements.cpuSelect) {
            // CPU tier extraction and scoring (i3=3, i5=5, i7=7, i9=9, etc.)
            const getCpuTier = (name) => {
                const lowerName = name.toLowerCase();

                // Intel: i3, i5, i7, i9
                if (lowerName.includes('i9')) return 9;
                if (lowerName.includes('i7')) return 7;
                if (lowerName.includes('i5')) return 5;
                if (lowerName.includes('i3')) return 3;
                if (lowerName.includes('pentium')) return 2;
                if (lowerName.includes('celeron')) return 1;

                // AMD Ryzen: 3, 5, 7, 9
                if (lowerName.includes('ryzen 9') || lowerName.includes('9 ')) return 9;
                if (lowerName.includes('ryzen 7') || lowerName.includes('7 ')) return 7;
                if (lowerName.includes('ryzen 5') || lowerName.includes('5 ')) return 5;
                if (lowerName.includes('ryzen 3') || lowerName.includes('3 ')) return 3;
                if (lowerName.includes('athlon')) return 2;

                // Threadripper at top
                if (lowerName.includes('threadripper')) return 10;

                return 5; // Default mid-tier
            };

            const getGenerationRank = (gen) => {
                const ranks = {
                    // Intel
                    'Raptor Lake Refresh': 140, // 14th Gen
                    'Raptor Lake': 130,         // 13th Gen
                    'Alder Lake': 120,          // 12th Gen
                    'Tiger Lake': 115,          // 11th Gen Mobile
                    'Rocket Lake': 110,         // 11th Gen
                    'Ice Lake': 105,            // 10th Gen Mobile
                    'Comet Lake': 100,          // 10th Gen
                    'Coffee Lake Refresh': 90,  // 9th Gen
                    'Coffee Lake': 80,          // 8th Gen
                    'Kaby Lake': 70,            // 7th Gen
                    'Skylake': 60,              // 6th Gen
                    'Broadwell': 50,            // 5th Gen
                    'Haswell': 40,              // 4th Gen
                    'Ivy Bridge': 30,           // 3rd Gen
                    'Sandy Bridge': 20,         // 2nd Gen
                    'Nehalem': 10,              // 1st Gen
                    'Legacy Intel': 5,          // Pre-Core i (Pentium 4, Core 2, etc.)
                    'Server/Workstation': 1,    // Xeons

                    // AMD
                    'Zen 4 V-Cache': 145,
                    'Zen 4': 140,               // Ryzen 7000/8000
                    'Zen 3 V-Cache': 135,
                    'Zen 3': 130,               // Ryzen 5000
                    'Zen 2': 120,               // Ryzen 3000
                    'Zen+': 110,                // Ryzen 2000
                    'Zen': 100,                 // Ryzen 1000
                    'Bulldozer': 50,            // FX Series
                    'K10': 40,                  // Phenom/Athlon
                    'Bristol Ridge': 60
                };
                return ranks[gen] || 0;
            };

            const getGenerationLabel = (cpu) => {
                const gen = cpu.generation;
                if (cpu.vendor === 'Intel') {
                    const generationMap = {
                        'Raptor Lake Refresh': '14th Gen (Raptor Lake Refresh)',
                        'Raptor Lake': '13th Gen (Raptor Lake)',
                        'Alder Lake': '12th Gen (Alder Lake)',
                        'Tiger Lake': '11th Gen Mobile (Tiger Lake)',
                        'Rocket Lake': '11th Gen (Rocket Lake)',
                        'Ice Lake': '10th Gen Mobile (Ice Lake)',
                        'Comet Lake': '10th Gen (Comet Lake)',
                        'Coffee Lake Refresh': '9th Gen (Coffee Lake Refresh)',
                        'Coffee Lake': '8th Gen (Coffee Lake)',
                        'Kaby Lake': '7th Gen (Kaby Lake)',
                        'Skylake': '6th Gen (Skylake)',
                        'Broadwell': '5th Gen (Broadwell)',
                        'Haswell': '4th Gen (Haswell)',
                        'Ivy Bridge': '3rd Gen (Ivy Bridge)',
                        'Sandy Bridge': '2nd Gen (Sandy Bridge)',
                        'Nehalem': '1st Gen (Nehalem)',
                        'Legacy Intel': 'Legacy Intel (Pentium/Core 2)',
                        'Server/Workstation': 'Intel Server/Workstation (Xeon)'
                    };
                    return generationMap[gen] || `Intel ${gen}`;
                }
                // AMD is simpler usually
                return `AMD ${gen}`;
            };

            const sortCpus = (a, b) => {
                // 1. Sort by generation rank (newest first)
                const rankDiff = getGenerationRank(b.generation) - getGenerationRank(a.generation);
                if (rankDiff !== 0) return rankDiff;

                // Fallback to year if unknown gen
                const yearDiff = (b.generationYear || 2020) - (a.generationYear || 2020);
                if (yearDiff !== 0 && getGenerationRank(b.generation) === 0) return yearDiff;

                // 2. Sort by tier (low to high: i3 → i9)
                const tierDiff = getCpuTier(a.name) - getCpuTier(b.name);
                if (tierDiff !== 0) return tierDiff;

                // 3. Sort by cores (low to high)
                const coreDiff = (a.cores || 0) - (b.cores || 0);
                if (coreDiff !== 0) return coreDiff;

                // 4. Sort by power (low to high)
                return (a.tdp || a.sustainedPower || 0) - (b.tdp || b.sustainedPower || 0);
            };

            // Filter out CPUs with no generation info or weird data
            const validCpus = cpus.filter(c => c.name && c.generation);

            const intelCpus = validCpus.filter(c => c.vendor === 'Intel').sort(sortCpus);
            const amdCpus = validCpus.filter(c => c.vendor === 'AMD').sort(sortCpus);

            const formatCpuOption = (cpu) => {
                const clockStr = cpu.baseClock && cpu.boostClock
                    ? ` [${cpu.baseClock}-${cpu.boostClock} GHz]`
                    : '';
                return `${cpu.name}${clockStr}`;
            };

            let html = '';
            let currentGen = '';

            // Intel CPUs
            intelCpus.forEach(cpu => {
                const genLabel = getGenerationLabel(cpu);
                if (genLabel !== currentGen) {
                    if (currentGen) html += '</optgroup>';
                    html += `<optgroup label="${genLabel}">`;
                    currentGen = genLabel;
                }
                html += `<option value="${cpu.id}">${formatCpuOption(cpu)}</option>`;
            });
            if (intelCpus.length > 0) html += '</optgroup>';

            // AMD CPUs
            currentGen = '';
            amdCpus.forEach(cpu => {
                const genLabel = getGenerationLabel(cpu);
                if (genLabel !== currentGen) {
                    if (currentGen) html += '</optgroup>';
                    html += `<optgroup label="${genLabel}">`;
                    currentGen = genLabel;
                }
                html += `<option value="${cpu.id}">${formatCpuOption(cpu)}</option>`;
            });
            if (amdCpus.length > 0) html += '</optgroup>';

            elements.cpuSelect.innerHTML = html;
            elements.cpuSelect.value = 'i9-12900k';
        }

        // GPUs: Group by vendor and generation (matching CPU structure)
        if (elements.gpuSelect) {
            // Rank generations to ensure correct ordering (Newest Architecture -> Oldest)
            // High values (10000+) ensure these always sort above fallback year-based entries (which are < 2030)
            const genRank = {
                // NVIDIA
                'Blackwell': 10900,
                'Hopper/Blackwell': 10850,
                'Ada Lovelace': 10800,
                'Ampere': 10700,
                'Turing': 10600,
                'Volta': 10550,
                'Pascal': 10500,
                'Maxwell': 10400,
                'Kepler': 10300,
                'Fermi': 10200,
                'Tesla': 10100,

                // AMD
                'RDNA 4': 10900,
                'RDNA 3': 10800,
                'RDNA 2': 10700,
                'RDNA': 10600,
                'Vega': 10500,
                'Polaris/Vega': 10450,
                'Polaris': 10400,

                // Intel
                'Arc Alchemist': 10700,
                'Integrated': 5000,

                // Other
                'Workstation': 9000,
                'Embedded': 2000,
                'Legacy NVIDIA': 1000,
                'Legacy AMD': 1000
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
                if (name.includes('titan')) score += 5000; // Titans always top
                if (name.includes('ti')) score += 50;
                if (name.includes('super')) score += 25;
                if (name.includes('xtx')) score += 60;
                if (name.includes('xt')) score += 40;
                if (name.includes('gre')) score += 30;
                if (name.includes('x3d')) score += 10;

                return score;
            };

            const sortGpu = (a, b) => {
                try {
                    // Robust rank lookup (Generations: Newest First)
                    const rankA = genRank[a.generation] !== undefined ? genRank[a.generation] : (a.year || 2000);
                    const rankB = genRank[b.generation] !== undefined ? genRank[b.generation] : (b.year || 2000);

                    // 1. Sort by Generation Rank (Highest/Newest first)
                    if (rankA !== rankB) return rankB - rankA;

                    // 2. Sort by Model Tier ASCENDING (Low to High: 5050 -> 5090)
                    const scoreA = getModelScore(a.name);
                    const scoreB = getModelScore(b.name);
                    if (scoreA !== scoreB) return scoreA - scoreB;

                    // 3. Fallback: Low Power to High Power
                    return (a.boardPower || 0) - (b.boardPower || 0);
                } catch (e) {
                    console.error("Sort error", e);
                    return 0;
                }
            };

            // Deduplicate GPUs by name + VRAM (keep first occurrence which is preferred version)
            const deduplicateGpus = (gpuList) => {
                const seen = new Set();
                return gpuList.filter(gpu => {
                    const key = `${gpu.name}-${gpu.vram}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            };

            const nvidiaGpus = deduplicateGpus(gpus.filter(g => g.vendor === 'NVIDIA').sort(sortGpu));
            const amdGpus = deduplicateGpus(gpus.filter(g => g.vendor === 'AMD').sort(sortGpu));
            const intelGpus = deduplicateGpus(gpus.filter(g => g.vendor === 'Intel').sort(sortGpu));

            const formatGpuOption = (gpu) => {
                let vramStr = '';
                if (gpu.vram > 0) {
                    if (gpu.vram < 1) {
                        vramStr = ` ${Math.round(gpu.vram * 1024)}MB`;
                    } else {
                        vramStr = ` ${gpu.vram}GB`;
                    }
                }

                const tdp = gpu.boardPower ? ` ${gpu.boardPower}W` : '';
                return `${gpu.name}${vramStr}${tdp}`;
            };

            let html = '';
            let currentGen = '';

            // NVIDIA GPUs
            nvidiaGpus.forEach(gpu => {
                if (gpu.generation !== currentGen) {
                    if (currentGen) html += '</optgroup>';
                    html += `<optgroup label="NVIDIA ${gpu.generation}">`;
                    currentGen = gpu.generation;
                }
                html += `<option value="${gpu.id}">${formatGpuOption(gpu)}</option>`;
            });
            if (nvidiaGpus.length > 0) html += '</optgroup>';

            // AMD GPUs
            currentGen = '';
            amdGpus.forEach(gpu => {
                if (gpu.generation !== currentGen) {
                    if (currentGen) html += '</optgroup>';
                    html += `<optgroup label="AMD ${gpu.generation}">`;
                    currentGen = gpu.generation;
                }
                html += `<option value="${gpu.id}">${formatGpuOption(gpu)}</option>`;
            });
            if (amdGpus.length > 0) html += '</optgroup>';

            // Intel GPUs
            if (intelGpus.length > 0) {
                currentGen = '';
                intelGpus.forEach(gpu => {
                    if (gpu.generation !== currentGen) {
                        if (currentGen) html += '</optgroup>';
                        html += `<optgroup label="Intel ${gpu.generation}">`;
                        currentGen = gpu.generation;
                    }
                    html += `<option value="${gpu.id}">${formatGpuOption(gpu)}</option>`;
                });
                html += '</optgroup>';
            }

            elements.gpuSelect.innerHTML = html;
            elements.gpuSelect.value = 'rtx-4070';
        }

        // PSUs: Group by rating
        if (elements.psuSelect) {
            const ratings = ['80+ Bronze', '80+ Gold', '80+ Platinum', '80+ Titanium'];
            let html = '';
            ratings.forEach(rating => {
                const group = psus.filter(p => p.rating === rating).sort((a, b) => a.wattage - b.wattage);
                if (group.length > 0) {
                    html += `<optgroup label="${rating}">`;
                    group.forEach(psu => {
                        html += `<option value="${psu.id}">${psu.name}</option>`;
                    });
                    html += '</optgroup>';
                }
            });
            elements.psuSelect.innerHTML = html;
            elements.psuSelect.value = 'psu-850w-gold';
        }

        // Cooling: Group by type
        if (elements.coolingSelect) {
            const airCoolers = cooling.filter(c => c.type === 'air').sort((a, b) => a.heatDissipation - b.heatDissipation);
            const aios = cooling.filter(c => c.type === 'liquid' && c.category !== 'custom').sort((a, b) => a.heatDissipation - b.heatDissipation);
            const custom = cooling.filter(c => c.category === 'custom');

            let html = '<optgroup label="Air Cooling">';
            airCoolers.forEach(c => {
                html += `<option value="${c.id}">${c.name} (${c.heatDissipation}W)</option>`;
            });
            html += '</optgroup>';

            html += '<optgroup label="AIO Liquid">';
            aios.forEach(c => {
                html += `<option value="${c.id}">${c.name} (${c.heatDissipation}W)</option>`;
            });
            html += '</optgroup>';

            if (custom.length > 0) {
                html += '<optgroup label="Custom Loop">';
                custom.forEach(c => {
                    html += `<option value="${c.id}">${c.name} (${c.heatDissipation}W)</option>`;
                });
                html += '</optgroup>';
            }

            elements.coolingSelect.innerHTML = html;
            elements.coolingSelect.value = 'aio-240';
        }

        // Workload
        if (elements.workloadSelect) {
            elements.workloadSelect.innerHTML = Object.entries(WORKLOAD_PROFILES).map(([key, profile]) =>
                `<option value="${key}">${profile.name} - ${profile.description}</option>`
            ).join('');
        }

        // Airflow
        if (elements.airflowSelect) {
            elements.airflowSelect.innerHTML = `
            <option value="0.4">Restricted (Solid panels)</option>
            <option value="0.55">Poor (Limited ventilation)</option>
            <option value="0.7">Average (Standard case)</option>
            <option value="0.85" selected>Good (Mesh case)</option>
            <option value="1.0">Excellent (Open bench)</option>
        `;
        }
    } catch (e) {
        console.error("Error in populateSelects:", e);
    }
}

function updateMemoryOptions(elements, hardwareData, cpuId) {
    const { cpus, memory } = hardwareData;
    const cpu = cpus.find(c => c.id === cpuId);
    if (!cpu || !elements.memorySelect) return null;

    const supportedTypes = cpu.supportedMemory || ['DDR4'];

    // Lock to the NEWEST DDR generation the CPU supports
    // Priority: DDR5 > DDR4 > DDR3 > DDR2 > DDR
    let lockedType = null;
    const ddrPriority = ['DDR5', 'DDR4', 'DDR3', 'DDR2', 'DDR'];
    for (const type of ddrPriority) {
        if (supportedTypes.includes(type)) {
            lockedType = type;
            break;
        }
    }

    // If no match found, default to DDR4
    if (!lockedType) {
        lockedType = 'DDR4';
        console.warn(`CPU ${cpu.name} has no recognized DDR type, defaulting to DDR4`);
    }

    console.log(`[Locked] Memory locked to ${lockedType} for CPU: ${cpu.name}`);

    // Filter memory to ONLY the locked type
    const compatibleMemory = memory.filter(m => m.type === lockedType);

    const currentSelection = elements.memorySelect.value;

    // Sort by capacity (low to high), then speed (low to high)
    const sortedMemory = compatibleMemory.sort((a, b) => {
        const capDiff = (a.capacity || 0) - (b.capacity || 0);
        if (capDiff !== 0) return capDiff;
        return (a.speed || 0) - (b.speed || 0);
    });

    // Build options (single group since we're locked to one type)
    let html = `<optgroup label="${lockedType}">`;
    sortedMemory.forEach(m => {
        const speedStr = m.speed ? ` ${m.speed} MT/s` : '';
        const timingStr = m.timings ? ` ${m.timings}` : '';
        html += `<option value="${m.id}">${m.capacity}GB${speedStr}${timingStr}</option>`;
    });
    html += '</optgroup>';

    elements.memorySelect.innerHTML = html;

    // Try to preserve selection if compatible
    if (compatibleMemory.find(m => m.id === currentSelection)) {
        elements.memorySelect.value = currentSelection;
        return null;
    } else {
        // Select middle option as default
        const defaultMem = compatibleMemory[Math.floor(compatibleMemory.length / 2)] || compatibleMemory[0];
        elements.memorySelect.value = defaultMem?.id || '';
        return defaultMem?.id;
    }
}

/**
 * Render component details panel
 */
function renderComponentDetails(container, type, data, state) {
    if (!data || !container) return;

    let html = '';
    switch (type) {
        case 'cpu':
            const allCoreTurboStr = data.allCoreTurbo ? `${data.allCoreTurbo} GHz (all-core)` : '--';
            const memSupport = (data.supportedMemory || ['DDR4']).join(', ');
            html = `
                <div class="detail-section">
                    <div class="detail-header">${data.name}</div>
                    <div class="detail-row"><span class="detail-label">Architecture</span><span class="detail-value">${data.generation}</span></div>
                    <div class="detail-row"><span class="detail-label">Process Node</span><span class="detail-value">${data.process || 'Unknown'}</span></div>
                    <div class="detail-row"><span class="detail-label">Cores / Threads</span><span class="detail-value">${data.cores}C / ${data.threads}T</span></div>
                    <div class="detail-row"><span class="detail-label">Base Clock</span><span class="detail-value">${data.baseClock || '--'} GHz</span></div>
                    <div class="detail-row"><span class="detail-label">Boost Clock</span><span class="detail-value">${data.boostClock || '--'} GHz</span></div>
                    <div class="detail-row"><span class="detail-label">All-Core Turbo</span><span class="detail-value">${allCoreTurboStr}</span></div>
                    <div class="detail-row"><span class="detail-label">TDP</span><span class="detail-value">${data.sustainedPower || data.tdp}W</span></div>
                    <div class="detail-row"><span class="detail-label">Boost Power</span><span class="detail-value">${data.shortBoostPower}W</span></div>
                    <div class="detail-row"><span class="detail-label">Memory Support</span><span class="detail-value">${memSupport}</span></div>
                    <div class="detail-row"><span class="detail-label">Max Safe Temp</span><span class="detail-value">${data.maxSafeTemp}°C</span></div>
                    <div class="detail-row"><span class="detail-label">Current Draw</span><span class="detail-value ${state?.power?.cpuIsBoost ? 'boost' : ''}">${formatNumber(state?.power?.cpu, 0)}W</span></div>
                </div>
                ${data.description ? `<div class="detail-description">${data.description}</div>` : ''}
            `;
            break;
        case 'gpu':
            html = `
                <div class="detail-section">
                    <div class="detail-header">${data.name}</div>
                    <div class="detail-row"><span class="detail-label">Architecture</span><span class="detail-value">${data.generation}</span></div>
                    <div class="detail-row"><span class="detail-label">Memory (VRAM)</span><span class="detail-value">${data.vram} GB ${data.memoryType || ''}</span></div>
                    <div class="detail-row"><span class="detail-label">Base Clock</span><span class="detail-value">${data.baseClock || '--'} MHz</span></div>
                    <div class="detail-row"><span class="detail-label">Boost Clock</span><span class="detail-value">${data.boostClock || '--'} MHz</span></div>
                    <div class="detail-row"><span class="detail-label">Memory Speed</span><span class="detail-value">${data.memClock || '--'}</span></div>
                    <div class="detail-row"><span class="detail-label">Total Board Power</span><span class="detail-value">${data.boardPower}W</span></div>
                    <div class="detail-row"><span class="detail-label">Transient Peak (20ms)</span><span class="detail-value">${(data.boardPower * data.transientMultiplier).toFixed(0)}W (${data.transientMultiplier}×)</span></div>
                    <div class="detail-row"><span class="detail-label">Recommended PSU</span><span class="detail-value">${data.recommendedPsu || '--'}W</span></div>
                    <div class="detail-row"><span class="detail-label">Current Draw</span><span class="detail-value">${formatNumber(state?.power?.gpu, 0)}W</span></div>
                </div>
                ${data.description ? `<div class="detail-description">${data.description}</div>` : ''}
            `;
            break;
        case 'cooling':
            html = `
                <div class="detail-section">
                    <div class="detail-header">${data.name}</div>
                    <div class="detail-row"><span class="detail-label">Cooler Type</span><span class="detail-value">${data.type === 'liquid' ? 'Liquid AIO' : 'Air Cooling'}</span></div>
                    <div class="detail-row"><span class="detail-label">Dissipation Capacity</span><span class="detail-value">${data.heatDissipation}W</span></div>
                    <div class="detail-row"><span class="detail-label">Rated Max TDP</span><span class="detail-value">${data.maxRecommendedTdp || '--'}W</span></div>
                    <div class="detail-row"><span class="detail-label">Thermal Mass</span><span class="detail-value">${data.thermalMass < 0.2 ? 'Low (Fast Response)' : data.thermalMass < 0.35 ? 'Medium' : 'High (Slow Soak)'}</span></div>
                    <div class="detail-row"><span class="detail-label">Noise Profile</span><span class="detail-value">${data.noiseBaseline}-${data.noiseMax} dB</span></div>
                    <div class="detail-row"><span class="detail-label">Fan Speed</span><span class="detail-value">${formatNumber(state?.thermal?.fanSpeed, 0)}%</span></div>
                </div>
                ${data.description ? `<div class="detail-description">${data.description}</div>` : ''}
            `;
            break;
        default:
            html = `<div class="detail-placeholder">Select a component to view specifications</div>`;
    }
    container.innerHTML = html;
}

/**
 * Update context help panel
 */
function updateContextHelp(elements, key) {
    if (!elements.contextHelp || !HELP_TEXT[key]) return;

    const help = HELP_TEXT[key];
    elements.contextHelp.innerHTML = `
        <div class="help-title">${help.title}</div>
        <div class="help-content">${help.text.replace(/\n/g, '<br>')}</div>
    `;
}

function bindEvents(elements, handlers, hardwareData) {
    const { onSelectHardware, onUpdateConfig } = handlers;

    // CPU Change - also update memory options
    elements.cpuSelect?.addEventListener('change', e => {
        onSelectHardware('cpu', e.target.value);
        const newMemId = updateMemoryOptions(elements, hardwareData, e.target.value);
        if (newMemId) onSelectHardware('memory', newMemId);
    });

    elements.gpuSelect?.addEventListener('change', e => onSelectHardware('gpu', e.target.value));
    elements.psuSelect?.addEventListener('change', e => onSelectHardware('psu', e.target.value));
    elements.coolingSelect?.addEventListener('change', e => onSelectHardware('cooling', e.target.value));
    elements.memorySelect?.addEventListener('change', e => onSelectHardware('memory', e.target.value));

    // Storage inputs - immediate update
    const updateStorage = () => {
        const config = {
            nvme: parseInt(elements.storageNvmeInput?.value) || 0,
            sata: parseInt(elements.storageSataInput?.value) || 0,
            hdd: parseInt(elements.storageHddInput?.value) || 0
        };
        onUpdateConfig({ storageConfig: config });
    };

    elements.storageNvmeInput?.addEventListener('input', updateStorage);
    elements.storageSataInput?.addEventListener('input', updateStorage);
    elements.storageHddInput?.addEventListener('input', updateStorage);

    elements.fanCountInput?.addEventListener('input', e => onUpdateConfig({ fanCount: parseInt(e.target.value) || 1 }));
    elements.workloadSelect?.addEventListener('change', e => onUpdateConfig({ workload: e.target.value }));
    elements.ambientTempInput?.addEventListener('input', e => onUpdateConfig({ ambientTemp: parseInt(e.target.value) || 25 }));
    elements.airflowSelect?.addEventListener('change', e => onUpdateConfig({ airflowQuality: parseFloat(e.target.value) }));

    elements.pauseButton?.addEventListener('click', handlers.onTogglePause);
    elements.resetButton?.addEventListener('click', handlers.onReset);
    elements.speedSelect?.addEventListener('change', e => handlers.onSetSpeed(parseFloat(e.target.value)));

    elements.historySlider?.addEventListener('input', e => handlers.onScrubHistory(parseInt(e.target.value)));

    // Help system - hover on [data-help] elements
    document.querySelectorAll('[data-help]').forEach(el => {
        el.addEventListener('mouseenter', () => {
            const key = el.getAttribute('data-help');
            updateContextHelp(elements, key);
        });
    });

    // Help panel toggle
    elements.helpToggle?.addEventListener('click', () => {
        elements.helpPanel?.classList.toggle('collapsed');
        elements.helpToggle.classList.toggle('collapsed');
    });
}

function updatePowerDisplay(elements, power, psuInfo, cpu, gpu, memory, workload) {
    if (!power || !psuInfo) return;

    if (elements.cpuPowerValue) {
        const cpuPower = formatNumber(power.cpu, 0);
        valueTracker.update('cpuPower', power.cpu, elements.cpuPowerValue);
        elements.cpuPowerValue.textContent = cpuPower + 'W';
        elements.cpuPowerValue.classList.toggle('boost', power.cpuIsBoost);
    }
    if (elements.gpuPowerValue) {
        const gpuPower = formatNumber(power.gpu, 0);
        valueTracker.update('gpuPower', power.gpu, elements.gpuPowerValue);
        elements.gpuPowerValue.textContent = gpuPower + 'W';
    }
    if (elements.systemPowerValue) {
        const sysPower = formatNumber(power.sustainedTotal, 0);
        valueTracker.update('systemPower', power.sustainedTotal, elements.systemPowerValue);
        elements.systemPowerValue.textContent = sysPower + 'W';
    }
    if (elements.wallPowerValue) {
        const wallPower = formatNumber(psuInfo.wallPower, 0);
        valueTracker.update('wallPower', psuInfo.wallPower, elements.wallPowerValue);
        elements.wallPowerValue.textContent = wallPower + 'W';
    }

    if (elements.transientPeakValue) {
        elements.transientPeakValue.textContent = formatNumber(power.transientPeak, 0) + 'W';
        elements.transientPeakValue.className = 'breakdown-value';
        if (psuInfo.transientLoad > 100) elements.transientPeakValue.classList.add('danger');
        else if (psuInfo.transientLoad > 85) elements.transientPeakValue.classList.add('warning');
    }

    if (elements.psuLoadValue) {
        elements.psuLoadValue.textContent = formatNumber(psuInfo.loadPercent, 1) + '%';
        elements.psuLoadValue.className = 'stat-value';
        if (psuInfo.loadPercent > 95) elements.psuLoadValue.classList.add('danger');
        else if (psuInfo.loadPercent > 80) elements.psuLoadValue.classList.add('warning');
    }

    if (elements.psuLoadBar) {
        elements.psuLoadBar.style.width = Math.min(psuInfo.loadPercent, 100) + '%';
        elements.psuLoadBar.className = 'progress-bar';
        if (psuInfo.loadPercent > 95) elements.psuLoadBar.classList.add('danger');
        else if (psuInfo.loadPercent > 80) elements.psuLoadBar.classList.add('warning');
    }

    // Update efficiency indicator
    if (elements.efficiencyIndicator && elements.efficiencyIndicatorText) {
        const load = psuInfo.loadPercent;
        let status = 'optimal';
        let message = '';
        let icon = 'ph-check-circle';

        if (load > 95) {
            status = 'danger';
            message = 'PSU critically overloaded - upgrade recommended';
            icon = 'ph-warning';
        } else if (load > 85) {
            status = 'warning';
            message = 'PSU near capacity - consider higher wattage';
            icon = 'ph-warning-circle';
        } else if (load > 70) {
            status = 'warning';
            message = 'PSU load high - limited headroom for transients';
            icon = 'ph-info';
        } else if (load >= 40 && load <= 70) {
            status = 'optimal';
            message = 'PSU load optimal - excellent efficiency range';
            icon = 'ph-check-circle';
        } else if (load < 40) {
            status = 'optimal';
            message = 'PSU oversized - stable but lower efficiency';
            icon = 'ph-info';
        }

        elements.efficiencyIndicator.className = `efficiency-indicator ${status}`;
        elements.efficiencyIndicator.style.display = 'flex';
        elements.efficiencyIndicatorText.textContent = message;

        const iconEl = elements.efficiencyIndicator.querySelector('i');
        if (iconEl) {
            iconEl.className = `ph-bold ${icon}`;
        }
    }

    if (elements.efficiencyValue) elements.efficiencyValue.textContent = formatNumber(psuInfo.efficiency * 100, 1) + '%';
    if (elements.heatWasteValue) elements.heatWasteValue.textContent = formatNumber(psuInfo.heatWaste, 0) + 'W';

    if (elements.cpuInfo && cpu) {
        const clockInfo = cpu.baseClock && cpu.boostClock
            ? `${cpu.baseClock}-${cpu.boostClock} GHz`
            : '';
        elements.cpuInfo.textContent = `${cpu.socket} | ${cpu.generation} | ${clockInfo}`;
    }
    if (elements.gpuInfo && gpu) {
        const clockInfo = gpu.boostClock ? `${gpu.boostClock} MHz` : '';
        elements.gpuInfo.textContent = `${gpu.vram}GB ${gpu.memoryType} | ${clockInfo}`;
    }

    // Display clock speeds
    let cpuClock = power.cpuClock;
    let cpuMode = power.cpuMode;
    let gpuClock = power.gpuClock;
    let gpuMode = power.gpuMode;

    // Fallback calculation for CPU if missing (ensures display always works)
    if (cpuClock == null && cpu) {
        const base = cpu.baseClock || 3.0;
        const boost = cpu.boostClock || base + 0.5;
        const allCore = cpu.allCoreTurbo || (base + boost) / 2;

        switch (workload) {
            case 'idle': cpuClock = base * 0.4; cpuMode = 'Idle (C-states)'; break;
            case 'lightLoad': cpuClock = base * 0.7; cpuMode = 'Light (1-2 cores)'; break;
            case 'gaming': cpuClock = allCore * 0.95; cpuMode = 'Gaming (mixed cores)'; break;
            case 'stress': cpuClock = boost; cpuMode = 'All-core load'; break;
            default: cpuClock = base; cpuMode = 'Base';
        }
    }

    // Fallback calculation for GPU if missing
    if (gpuClock == null && gpu) {
        const base = gpu.baseClock || 1500;
        const boost = gpu.boostClock || base + 300;

        switch (workload) {
            case 'idle': gpuClock = 210; gpuMode = 'Idle (2D)'; break;
            case 'gaming': gpuClock = boost; gpuMode = 'Gaming (Boost)'; break;
            case 'stress': gpuClock = boost; gpuMode = 'Max Boost'; break;
            default: gpuClock = base; gpuMode = 'Base';
        }
    }

    // Direct DOM access fallback + robust formatting
    const elCpuVal = elements.cpuClockValue || document.getElementById('cpu-clock-value');
    if (elCpuVal) {
        const val = cpuClock != null ? Number(cpuClock) : 3.0; // Default to 3.0 if null
        elCpuVal.textContent = cpuClock != null ? `${val.toFixed(1)} GHz` : '-- GHz';
    }

    const elCpuFull = elements.cpuClockFull || document.getElementById('cpu-clock-full');
    if (elCpuFull) {
        const val = cpuClock != null ? Number(cpuClock) : 3.0;
        elCpuFull.textContent = cpuClock != null ? `${val.toFixed(2)} GHz • ${cpuMode || 'Standard'}` : '--';
    }

    const elGpuVal = elements.gpuClockValue || document.getElementById('gpu-clock-value');
    if (elGpuVal) {
        const val = gpuClock != null ? Number(gpuClock) : 1500;
        elGpuVal.textContent = gpuClock != null ? `${Math.round(val)} MHz` : '-- MHz';
    }

    const elGpuFull = elements.gpuClockFull || document.getElementById('gpu-clock-full');
    if (elGpuFull) {
        const val = gpuClock != null ? Number(gpuClock) : 1500;
        elGpuFull.textContent = gpuClock != null ? `${Math.round(val)} MHz • ${gpuMode || 'Standard'}` : '--';
    }

    if (memory && elements.memClockFull) {
        elements.memClockFull.textContent = `${memory.speed} MT/s (${memory.type})`;
    }
}

function updateThermalDisplay(elements, thermal, cpu, boostState, cooling) {
    if (!thermal) return;

    const maxTemp = cpu?.maxSafeTemp || 90;
    const tempPercent = Math.min(100, ((thermal.cpuTemp - thermal.ambientTemp) / (maxTemp - thermal.ambientTemp)) * 100);

    if (elements.cpuTempValue) {
        elements.cpuTempValue.textContent = formatNumber(thermal.cpuTemp, 1) + '°C';
        elements.cpuTempValue.className = 'stat-value';
        if (thermal.isThrottling) elements.cpuTempValue.classList.add('danger');
        else if (tempPercent > 85) elements.cpuTempValue.classList.add('warning');
    }

    if (elements.cpuTempBar) {
        elements.cpuTempBar.style.width = Math.max(0, tempPercent) + '%';
        elements.cpuTempBar.className = 'progress-bar temp';
        if (thermal.isThrottling) elements.cpuTempBar.classList.add('danger');
        else if (tempPercent > 85) elements.cpuTempBar.classList.add('warning');
    }

    if (elements.equilibriumValue) {
        elements.equilibriumValue.textContent = formatNumber(thermal.equilibriumTemp, 0) + '°C';
        elements.equilibriumValue.className = 'stat-value-small';
        if (thermal.equilibriumTemp > maxTemp) elements.equilibriumValue.classList.add('danger');
        else if (thermal.equilibriumTemp > maxTemp - 10) elements.equilibriumValue.classList.add('warning');
    }

    if (elements.fanSpeedValue) elements.fanSpeedValue.textContent = formatNumber(thermal.fanSpeed, 0) + '%';
    if (elements.noiseValue) elements.noiseValue.textContent = formatNumber(thermal.noiseLevel, 1) + ' dB';

    if (elements.coolingCapacityValue && cooling) {
        const usedPercent = (thermal.heatGenerated / thermal.coolingCapacity) * 100;
        elements.coolingCapacityValue.textContent = `${formatNumber(usedPercent, 0)}% used`;
        elements.coolingCapacityValue.className = 'stat-value-small';
        if (usedPercent > 95) elements.coolingCapacityValue.classList.add('danger');
        else if (usedPercent > 80) elements.coolingCapacityValue.classList.add('warning');
    }

    if (elements.thermalHeadroomValue) {
        const headroom = maxTemp - thermal.equilibriumTemp;
        elements.thermalHeadroomValue.textContent = `${formatNumber(headroom, 0)}°C`;
        elements.thermalHeadroomValue.className = 'stat-value-small';
        if (headroom < 0) elements.thermalHeadroomValue.classList.add('danger');
        else if (headroom < 5) elements.thermalHeadroomValue.classList.add('warning');

        // Update visual headroom bar
        if (elements.thermalHeadroomFill) {
            const headroomPercent = Math.min(100, Math.max(0, (headroom / 30) * 100)); // 30°C = 100%
            elements.thermalHeadroomFill.style.width = `${headroomPercent}%`;

            let status = 'critical';
            if (headroom >= 20) status = 'excellent';
            else if (headroom >= 10) status = 'good';
            else if (headroom >= 5) status = 'warning';

            elements.thermalHeadroomFill.className = `thermal-headroom-fill ${status}`;
        }
    }

    if (elements.throttleIndicator) {
        if (thermal.isThrottling) {
            elements.throttleIndicator.classList.add('active');
            elements.throttleIndicator.querySelector('.throttle-value').textContent = `-${formatNumber(thermal.throttlePercent, 0)}%`;
        } else {
            elements.throttleIndicator.classList.remove('active');
        }
    }

    if (elements.boostIndicator) {
        if (boostState?.boostActive) {
            elements.boostIndicator.classList.add('active');
            elements.boostIndicator.querySelector('.boost-time').textContent = formatNumber(boostState.boostTimeRemaining, 0) + 's';
        } else {
            elements.boostIndicator.classList.remove('active');
        }
    }
}

let lastWarningsSignature = '';

function renderWarnings(container, warnings) {
    if (!container) return;

    // Create signature based on content to prevent re-renders (blinking)
    // If empty, sig is 'NOMINAL'
    const sig = (!warnings || warnings.length === 0)
        ? 'NOMINAL'
        : warnings.sort((a, b) => a.title.localeCompare(b.title)).map(w => w.severity + w.title).join('|');

    if (sig === lastWarningsSignature) return;
    lastWarningsSignature = sig;

    // Get current time for log
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (!warnings || warnings.length === 0) {
        container.innerHTML = `
            <div class="log-line success">
                <span class="log-time">[${time}]</span>
                <span class="log-level">[SYS]</span>
                <span class="log-msg">System nominal. operating parameters normal.</span>
            </div>`;
        return;
    }

    const sorted = [...warnings].sort((a, b) => getSeverityPriority(b.severity) - getSeverityPriority(a.severity));

    container.innerHTML = sorted.map(w => {
        const levelCode = w.severity === 'danger' ? 'CRIT' : 'WARN';
        return `
        <div class="log-line ${w.severity}">
            <span class="log-time">[${time}]</span>
            <span class="log-level">[${levelCode}]</span>
            <span class="log-msg">${w.title}: ${w.message}</span>
        </div>
    `}).join('');
}

function updateExplanations(elements, state) {
    if (elements.workloadExplanation) {
        elements.workloadExplanation.textContent = state.workloadExplanation || '';
    }
    if (elements.thermalExplanation) {
        elements.thermalExplanation.textContent = state.thermalExplanation || '';
    }
    if (elements.compatibilityWarning) {
        if (state.compatibilityWarning) {
            elements.compatibilityWarning.textContent = state.compatibilityWarning;
            elements.compatibilityWarning.classList.add('visible');
        } else {
            elements.compatibilityWarning.classList.remove('visible');
        }
    }
}

function updateControls(elements, state) {
    if (elements.pauseButton) {
        elements.pauseButton.textContent = state.isPaused ? 'RESUME' : 'PAUSE';
        elements.pauseButton.classList.toggle('paused', state.isPaused);
    }
    if (elements.simulatedTimeValue) {
        elements.simulatedTimeValue.textContent = formatTime(state.simulatedTime || 0);
    }
    if (elements.historySlider) {
        elements.historySlider.max = Math.max(state.powerHistory.length - 1, 0);
        if (state.historyIndex < 0) {
            elements.historySlider.value = elements.historySlider.max;
        }
    }
}

function updateSystemReadiness(state) {
    const container = document.getElementById('system-readiness');
    if (!container) return;

    const issues = [];
    const warnings = [];
    let level = 'valid';

    // Check all required components are selected
    if (!state.cpu || !state.gpu || !state.psu || !state.cooling || !state.memory) {
        level = 'error';
        container.className = 'system-readiness error';
        container.querySelector('.readiness-status').textContent = 'Configuration Incomplete';
        container.querySelector('.readiness-details').textContent = 'Not all components selected';
        return;
    }

    // Check power budget
    const estimatedPower = (state.cpu.tdp || state.cpu.sustainedPower || 0) + (state.gpu.boardPower || 0) + 150;
    const psuCapacity = state.psu.wattage;
    if (estimatedPower > psuCapacity * 0.95) {
        issues.push(`PSU undersized: ~${Math.round(estimatedPower)}W load on ${psuCapacity}W PSU`);
        level = 'error';
    } else if (estimatedPower > psuCapacity * 0.85) {
        warnings.push(`PSU near capacity (${Math.round(estimatedPower / psuCapacity * 100)}% load)`);
        if (level === 'valid') level = 'warning';
    }

    // Check cooling capacity
    const cpuTdp = state.cpu.tdp || state.cpu.sustainedPower || 0;
    if (state.cooling.heatDissipation < cpuTdp) {
        issues.push(`Cooling insufficient: ${state.cooling.heatDissipation}W for ${cpuTdp}W CPU`);
        level = 'error';
    } else if (state.cooling.heatDissipation < cpuTdp * 1.2) {
        warnings.push(`Cooling marginal for sustained loads`);
        if (level === 'valid') level = 'warning';
    }

    // Check memory compatibility
    const cpuMemSupport = state.cpu.supportedMemory || ['DDR4'];
    if (!cpuMemSupport.includes(state.memory.type)) {
        issues.push(`Memory incompatible: CPU needs ${cpuMemSupport.join('/')}, have ${state.memory.type}`);
        level = 'error';
    }

    // Update UI
    container.className = `system-readiness ${level}`;

    const statusEl = container.querySelector('.readiness-status');
    const detailsEl = container.querySelector('.readiness-details');

    if (level === 'valid') {
        statusEl.textContent = 'System Ready';
        detailsEl.textContent = 'Configuration validated';
    } else if (level === 'warning') {
        statusEl.textContent = 'Ready with Warnings';
        const html = warnings.length > 0
            ? `<ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul>`
            : 'Minor configuration warnings';
        detailsEl.innerHTML = html;
    } else {
        statusEl.textContent = 'Configuration Issues';
        const allIssues = [...issues, ...warnings];
        const html = allIssues.length > 0
            ? `<ul>${allIssues.map(i => `<li>${i}</li>`).join('')}</ul>`
            : 'Critical configuration problems detected';
        detailsEl.innerHTML = html;
    }
}

export function initializeUI(hardwareData, handlers) {
    const elements = getElements();

    populateSelects(elements, hardwareData);

    // Initialize searchable dropdowns for CPU and GPU
    if (elements.cpuSelect && hardwareData.cpus) {
        new SearchableDropdown(elements.cpuSelect, hardwareData.cpus, {
            groupBy: 'generation',
            searchKeys: ['name', 'generation', 'vendor'],
            placeholder: 'Search CPUs (e.g., i5, Ryzen 7)...',
            onSelect: (cpu) => {
                updateMemoryOptions(elements, hardwareData, cpu.id);
            }
        });
    }

    if (elements.gpuSelect && hardwareData.gpus) {
        new SearchableDropdown(elements.gpuSelect, hardwareData.gpus, {
            groupBy: 'generation',
            searchKeys: ['name', 'generation', 'vendor'],
            placeholder: 'Search GPUs (e.g., RTX, RX 6800)...',
            onSelect: () => { }
        });
    }

    // Initial memory filtering
    if (elements.cpuSelect) {
        updateMemoryOptions(elements, hardwareData, elements.cpuSelect.value);
    }

    bindEvents(elements, handlers, hardwareData);

    // Initialize graphs
    let graphs = null;
    if (elements.powerCanvas && elements.tempCanvas) {
        const resizeCanvases = () => {
            const pc = elements.powerCanvas.parentElement;
            const tc = elements.tempCanvas.parentElement;
            if (pc) { elements.powerCanvas.width = pc.clientWidth; elements.powerCanvas.height = pc.clientHeight; }
            if (tc) { elements.tempCanvas.width = tc.clientWidth; elements.tempCanvas.height = tc.clientHeight; }
        };
        resizeCanvases();
        window.addEventListener('resize', resizeCanvases);
        graphs = createSimulatorGraphs(elements);
    }

    // Set initial help text
    updateContextHelp(elements, 'workload');

    let activeDetailTab = 'cpu';
    let lastState = null;

    // Bind tab events
    elements.detailsTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.detailsTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeDetailTab = btn.dataset.tab;
            if (lastState && lastState[activeDetailTab]) {
                renderComponentDetails(elements.componentDetails, activeDetailTab, lastState[activeDetailTab], lastState);
            }
        });
    });

    // Panel Toggle
    elements.detailsToggle?.addEventListener('click', () => {
        elements.detailsPanel?.classList.toggle('collapsed');
        elements.detailsToggle.classList.toggle('collapsed');
    });

    // Update function called on every state change
    function update(state) {
        lastState = state;
        updatePowerDisplay(elements, state.power, state.psuInfo, state.cpu, state.gpu, state.memory, state.workload);
        updateThermalDisplay(elements, state.thermal, state.cpu, state.boostState, state.cooling);
        renderWarnings(elements.warningsContainer, state.warnings);
        updateExplanations(elements, state);
        updateControls(elements, state);
        updateSystemReadiness(state); // Check system readiness

        // Update component details based on active tab
        if (state[activeDetailTab]) {
            renderComponentDetails(elements.componentDetails, activeDetailTab, state[activeDetailTab], state);
        }

        // Update score
        updateScore(elements, state);

        // Update graphs
        if (graphs) {
            const powerData = state.powerHistory.map(p => p.value);
            if (powerData.length > 0) {
                const maxPower = Math.max(...powerData, 200);
                const graphMax = Math.ceil(maxPower / 100) * 100 + 100;
                graphs.powerGraph.updateOptions({ maxValue: graphMax });
                graphs.powerGraph.render(powerData);
            }

            const tempData = state.tempHistory.map(t => t.value);
            if (tempData.length > 0) {
                graphs.tempGraph.render(tempData);
            }
        }
    }

    return { update, elements };
}

function updateScore(elements, state) {
    if (!elements.gradeValue) return;

    // 1. Efficiency Score (Ideal PSU load is 50%, curve drops off)
    const load = state.psuInfo?.loadPercent || 0;
    // Score: 100 at 50% load. Drops by 2 points per 1% deviation approximately
    let effScore = Math.max(0, 100 - Math.abs(50 - load) * 1.5);
    if (load > 90) effScore *= 0.5; // Heavy penalty for near-overload
    if (load < 10) effScore *= 0.8; // Penalty for idle inefficiency

    // 2. Thermal Score (Headroom)
    // 20C headroom = 100 score. 0C = 0.
    const headroom = (state.thermal?.headroom || 0);
    let thermScore = Math.min(100, Math.max(0, headroom * 5));
    if (state.thermal?.isThrottling) thermScore = 0;

    // 3. Stability Score (Transient Headroom)
    // Need at least 20% transient headroom for perfect score
    const peak = state.power?.transientPeak || 0;
    const capacity = state.psuInfo?.psuWattage || 1000;
    const margin = capacity - peak;
    let stabScore = 0;

    if (margin > capacity * 0.2) stabScore = 100;
    else if (margin > 0) stabScore = 50 + (margin / (capacity * 0.2)) * 50;
    else stabScore = 0;

    // Weighted Average
    const totalScore = (effScore * 0.3 + thermScore * 0.4 + stabScore * 0.3);

    // Update DOM
    if (elements.scoreEffBar) {
        elements.scoreEffBar.style.width = `${effScore}%`;
        elements.scoreEffVal.textContent = Math.round(effScore);
    }
    if (elements.scoreThermBar) {
        elements.scoreThermBar.style.width = `${thermScore}%`;
        elements.scoreThermVal.textContent = Math.round(thermScore);
    }
    if (elements.scoreStabBar) {
        elements.scoreStabBar.style.width = `${stabScore}%`;
        elements.scoreStabVal.textContent = Math.round(stabScore);
    }

    // Grade Ring and Rank
    const offset = 100 - totalScore;
    if (elements.gradeRing) {
        elements.gradeRing.style.strokeDashoffset = offset;
    }

    let rank = 'F';
    let ringColor = 'var(--color-danger)';

    if (totalScore >= 95) { rank = 'S'; ringColor = '#d946ef'; }
    else if (totalScore >= 85) { rank = 'A'; ringColor = '#10b981'; }
    else if (totalScore >= 70) { rank = 'B'; ringColor = '#3b82f6'; }
    else if (totalScore >= 50) { rank = 'C'; ringColor = '#f59e0b'; }

    if (elements.gradeValue) {
        elements.gradeValue.textContent = rank;
        elements.gradeValue.className = `grade-text rank-${rank}`;
        // Ensure global styles or inline styles support this color if class doesn't override enough
    }
    if (elements.gradeRing) {
        elements.gradeRing.style.stroke = ringColor;
    }
}
// Cache bust: 1770085859
