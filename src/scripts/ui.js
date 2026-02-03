/**
 * UI Rendering Module - Comprehensive
 * Handles DOM interactions with grouped selectors, compatibility warnings, and dynamic help
 */

import { createSimulatorGraphs } from './graph.js';
import { WORKLOAD_PROFILES } from './power.js';
import { getSeverityPriority, getHighestSeverity } from './warnings.js';

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
        helpPanel: document.getElementById('help-panel')
    };
}

// Comprehensive help text database
const HELP_TEXT = {
    cpu: {
        title: 'CPU (Processor)',
        text: `The central processing unit determines base system power and thermal requirements. Key factors:
• **Idle Power**: 5-15W for modern CPUs
• **Gaming**: Varies by game, typically 50-120W
• **Rendering/Stress**: Can exceed TDP ratings during boost periods
• **Boost Duration**: Higher-end CPUs maintain boost longer before thermal limits

Different generations have different memory compatibility. DDR3-only platforms (pre-Skylake) cannot use DDR4/DDR5. Modern Intel (12th gen+) often supports DDR4 or DDR5 depending on motherboard.`
    },
    gpu: {
        title: 'GPU (Graphics Card)',
        text: `Graphics cards dominate power consumption in gaming workloads. Critical behaviors:
• **Transient Spikes**: Modern GPUs (especially NVIDIA 30/40 series) produce power spikes 1.5-2× average during load changes
• **Cooling Dependency**: Insufficient cooling increases power via thermal leakage
• **Gaming vs Stress**: Full stress tests often draw less than peak gaming due to consistent load patterns

Transient spikes can trip PSU overcurrent protection, causing shutdowns. Higher-quality PSUs handle this better.`
    },
    psu: {
        title: 'Power Supply Unit',
        text: `The PSU converts wall AC to system DC power. Important characteristics:
• **Efficiency Curve**: Peaks around 50% load (92-94% for Gold/Platinum), drops at low and high loads
• **Transient Response**: Higher-tier PSUs handle GPU power spikes better
• **80+ Ratings**: Bronze (~85%), Gold (~90%), Platinum (~92%), Titanium (~94%) efficiency at 50% load

Waste heat from inefficiency adds to system thermal load. Oversized PSUs run cooler but at lower efficiency at idle.`
    },
    cooling: {
        title: 'CPU Cooling Solution',
        text: `CPU cooling determines maximum sustainable power and thermal behavior:
• **Heat Dissipation**: Rated in watts, determines max heat that can be removed
• **Thermal Mass**: Larger coolers absorb heat spikes better (liquid has more mass than air)
• **Response Time**: Big liquid coolers take longer to heat up AND cool down

Stock coolers are only adequate for low-power CPUs. High-power CPUs (125W+) require substantial aftermarket cooling. Case airflow significantly affects cooler performance.`
    },
    memory: {
        title: 'System Memory (RAM)',
        text: `Memory generation affects power efficiency and platform compatibility:
• **DDR3**: Older, ~1.5V, higher power per GB
• **DDR4**: Standard, ~1.2V, efficient
• **DDR5**: Latest, ~1.1V with on-DIMM power management (PMIC adds some heat)

More DIMMs = more power draw. 4-stick configurations draw more than 2-stick at same capacity. Memory type must match CPU/motherboard support—this is a physical constraint, not just preference.`
    },
    storage: {
        title: 'Storage Drives',
        text: `Different storage types have different power profiles:
• **NVMe SSD**: Low idle (1-2W), moderate load (5-8W), minimal heat
• **SATA SSD**: Very low power (0.5-3W), negligible heat
• **HDD**: Higher idle (4-5W), mechanical power draw, significant heat

HDDs add mechanical vibration and more ambient heat. Multiple drives increase idle power linearly. Compiling and rendering workloads stress storage more than gaming.`
    },
    fans: {
        title: 'Case Fans',
        text: `Case fans directly affect cooling effectiveness:
• **More Fans**: Better airflow, diminishing returns after 4-5
• **Fan Speed**: Power consumption scales approximately with cube of speed
• **Noise**: More fans at lower speed is quieter than fewer fans at high speed

Insufficient case fans cause hot air recirculation, reducing CPU cooler effectiveness by up to 40% in restricted cases.`
    },
    ambient: {
        title: 'Ambient Temperature',
        text: `Room temperature sets the baseline for all system temperatures:
• **Every 1°C increase in ambient** raises component temperatures by roughly 1°C
• **Higher ambient** reduces thermal headroom linearly
• **Typical range**: 20-25°C is standard, 30°C+ requires more cooling capacity

Air conditioning or winter conditions can significantly improve thermal performance. Summer heat waves often trigger throttling in previously stable systems.`
    },
    airflow: {
        title: 'Case Airflow Quality',
        text: `Case airflow determines how effectively heat is removed from the chassis:
• **Restricted**: Solid panels, poor cable management (50-60% effectiveness)
• **Average**: Standard mid-tower with some ventilation (70-80%)
• **Good**: Mesh front panel, proper fan setup (85-95%)
• **Excellent**: High-airflow mesh case or open bench (100%)

Poor airflow causes hot air to recirculate through the CPU cooler, dramatically reducing cooling performance. The case is often the bottleneck for high-power systems.`
    },
    workload: {
        title: 'Workload Profile',
        text: `Different tasks stress components differently:
• **Idle**: Minimal power, all components in low-power states
• **Gaming**: GPU-heavy, CPU moderate, steady-state load
• **Rendering**: CPU at 100%, GPU assists, memory-intensive
• **Compiling**: CPU-heavy with high storage I/O
• **Stress Test**: Synthetic maximum, unrealistic but reveals limits

Initial load application triggers boost behavior—CPU power spikes then decays as thermal limits engage. Equilibrium temperature is reached after 1-5 minutes depending on thermal mass.`
    }
};

/**
 * Populate selects with grouped options
 */
function populateSelects(elements, hardwareData) {
    try {
        const { cpus, gpus, psus, cooling, memory } = hardwareData;

        // CPUs: Group by vendor then generation
        if (elements.cpuSelect) {
            const intelCpus = cpus.filter(c => c.vendor === 'Intel').sort((a, b) => b.generationYear - a.generationYear || b.cores - a.cores);
            const amdCpus = cpus.filter(c => c.vendor === 'AMD').sort((a, b) => b.generationYear - a.generationYear || b.cores - a.cores);

            const formatCpuOption = (cpu) => {
                const clockStr = cpu.baseClock && cpu.boostClock
                    ? ` [${cpu.baseClock}-${cpu.boostClock} GHz]`
                    : '';
                return `${cpu.name}${clockStr}`;
            };

            let html = '<optgroup label="Intel">';
            let currentGen = '';
            intelCpus.forEach(cpu => {
                if (cpu.generation !== currentGen) {
                    if (currentGen) html += '</optgroup>';
                    html += `<optgroup label="Intel ${cpu.generation}">`;
                    currentGen = cpu.generation;
                }
                html += `<option value="${cpu.id}">${formatCpuOption(cpu)}</option>`;
            });
            html += '</optgroup>';

            html += '<optgroup label="AMD">';
            currentGen = '';
            amdCpus.forEach(cpu => {
                if (cpu.generation !== currentGen) {
                    if (currentGen) html += '</optgroup>';
                    html += `<optgroup label="AMD ${cpu.generation}">`;
                    currentGen = cpu.generation;
                }
                html += `<option value="${cpu.id}">${formatCpuOption(cpu)}</option>`;
            });
            html += '</optgroup>';

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

/**
 * Update memory options based on CPU compatibility
 */
function updateMemoryOptions(elements, hardwareData, cpuId) {
    const { cpus, memory } = hardwareData;
    const cpu = cpus.find(c => c.id === cpuId);
    if (!cpu || !elements.memorySelect) return null;

    const supportedTypes = cpu.supportedMemory || ['DDR4'];
    const compatibleMemory = memory.filter(m => supportedTypes.includes(m.type));

    const currentSelection = elements.memorySelect.value;

    // Group by type
    let html = '';
    ['DDR3', 'DDR4', 'DDR5'].forEach(type => {
        const group = compatibleMemory.filter(m => m.type === type).sort((a, b) => a.speed - b.speed || a.capacity - b.capacity);
        if (group.length > 0) {
            html += `<optgroup label="${type}">`;
            group.forEach(m => {
                const speedStr = m.speed ? ` ${m.speed} MT/s` : '';
                const timingStr = m.timings ? ` ${m.timings}` : '';
                html += `<option value="${m.id}">${m.capacity}GB${speedStr}${timingStr}</option>`;
            });
            html += '</optgroup>';
        }
    });

    elements.memorySelect.innerHTML = html;

    // Try to preserve selection if compatible
    if (compatibleMemory.find(m => m.id === currentSelection)) {
        elements.memorySelect.value = currentSelection;
        return null;
    } else {
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
            const allCoreStr = data.allCoreTurbo ? ` / ${data.allCoreTurbo} (all-core)` : '';
            html = `
                <div class="detail-section">
                    <div class="detail-header">${data.name}</div>
                    <div class="detail-row"><span class="detail-label">Architecture</span><span class="detail-value">${data.generation} (${data.process || 'N/A'})</span></div>
                    <div class="detail-row"><span class="detail-label">Cores / Threads</span><span class="detail-value">${data.cores}C / ${data.threads}T</span></div>
                    <div class="detail-row"><span class="detail-label">Base / Boost</span><span class="detail-value">${data.baseClock || '--'} / ${data.boostClock || '--'} GHz${allCoreStr}</span></div>
                    <div class="detail-row"><span class="detail-label">TDP / Boost Power</span><span class="detail-value">${data.sustainedPower || data.tdp}W / ${data.shortBoostPower}W</span></div>
                    <div class="detail-row"><span class="detail-label">Memory Support</span><span class="detail-value">${(data.supportedMemory || ['DDR4']).join(' / ')}</span></div>
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
                    <div class="detail-row"><span class="detail-label">VRAM</span><span class="detail-value">${data.vram} GB ${data.memoryType || ''}</span></div>
                    <div class="detail-row"><span class="detail-label">Base / Boost</span><span class="detail-value">${data.baseClock || '--'} / ${data.boostClock || '--'} MHz</span></div>
                    <div class="detail-row"><span class="detail-label">Memory Speed</span><span class="detail-value">${data.memClock || '--'}</span></div>
                    <div class="detail-row"><span class="detail-label">Board Power</span><span class="detail-value">${data.boardPower}W</span></div>
                    <div class="detail-row"><span class="detail-label">Transient Peak</span><span class="detail-value">${(data.boardPower * data.transientMultiplier).toFixed(0)}W (${data.transientMultiplier}×)</span></div>
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
                    <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${data.type === 'liquid' ? 'Liquid' : 'Air'}</span></div>
                    <div class="detail-row"><span class="detail-label">Capacity</span><span class="detail-value">${data.heatDissipation}W</span></div>
                    <div class="detail-row"><span class="detail-label">Max TDP Rated</span><span class="detail-value">${data.maxRecommendedTdp || '--'}W</span></div>
                    <div class="detail-row"><span class="detail-label">Thermal Mass</span><span class="detail-value">${data.thermalMass < 0.2 ? 'Low' : data.thermalMass < 0.35 ? 'Medium' : 'High'}</span></div>
                    <div class="detail-row"><span class="detail-label">Noise Range</span><span class="detail-value">${data.noiseBaseline}-${data.noiseMax} dB</span></div>
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
        elements.helpPanel?.classList.toggle('visible');
    });
}

function updatePowerDisplay(elements, power, psuInfo, cpu, gpu, memory, workload) {
    if (!power || !psuInfo) return;

    if (elements.cpuPowerValue) {
        elements.cpuPowerValue.textContent = formatNumber(power.cpu, 0) + 'W';
        elements.cpuPowerValue.classList.toggle('boost', power.cpuIsBoost);
    }
    if (elements.gpuPowerValue) elements.gpuPowerValue.textContent = formatNumber(power.gpu, 0) + 'W';
    if (elements.systemPowerValue) elements.systemPowerValue.textContent = formatNumber(power.sustainedTotal, 0) + 'W';
    if (elements.wallPowerValue) elements.wallPowerValue.textContent = formatNumber(psuInfo.wallPower, 0) + 'W';

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

    if (elements.efficiencyValue) elements.efficiencyValue.textContent = formatNumber(psuInfo.efficiency * 100, 1) + '%';
    if (elements.heatWasteValue) elements.heatWasteValue.textContent = formatNumber(psuInfo.heatWaste, 0) + 'W';

    if (elements.cpuInfo && cpu) {
        const clockInfo = cpu.baseClock && cpu.boostClock
            ? `${cpu.baseClock}-${cpu.boostClock} GHz`
            : '';
        elements.cpuInfo.textContent = `${cpu.socket} • ${cpu.generation} • ${clockInfo}`;
    }
    if (elements.gpuInfo && gpu) {
        const clockInfo = gpu.boostClock ? `${gpu.boostClock} MHz boost` : '';
        elements.gpuInfo.textContent = `${gpu.vram}GB ${gpu.memoryType} • ${clockInfo}`;
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

function renderWarnings(container, warnings) {
    if (!container) return;

    if (!warnings || warnings.length === 0) {
        container.innerHTML = '<div class="no-warnings">System operating within normal parameters</div>';
        return;
    }

    const sorted = [...warnings].sort((a, b) => getSeverityPriority(b.severity) - getSeverityPriority(a.severity));

    container.innerHTML = sorted.map(w => `
        <div class="warning-item ${w.severity}">
            <div class="warning-header">
                <span class="warning-icon">${w.severity === 'danger' ? '⚠' : 'ℹ'}</span>
                <span class="warning-title">${w.title}</span>
            </div>
            <p class="warning-message">${w.message}</p>
        </div>
    `).join('');
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

export function initializeUI(hardwareData, handlers) {
    const elements = getElements();

    populateSelects(elements, hardwareData);

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

    // Update function called on every state change
    function update(state) {
        updatePowerDisplay(elements, state.power, state.psuInfo, state.cpu, state.gpu, state.memory, state.workload);
        updateThermalDisplay(elements, state.thermal, state.cpu, state.boostState, state.cooling);
        renderWarnings(elements.warningsContainer, state.warnings);
        updateExplanations(elements, state);
        updateControls(elements, state);

        // Update component details based on current focus
        if (state.cpu) {
            renderComponentDetails(elements.componentDetails, 'cpu', state.cpu, state);
        }

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
// Cache bust: 1770085859
