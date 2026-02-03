/**
 * Initialization and Validation Module
 * Ensures the simulator always boots into a valid, interactive state
 */

export class InitializationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'InitializationError';
        this.details = details;
    }
}

/**
 * Validate hardware datasets
 */
export function validateHardwareData(hardwareData) {
    const errors = [];
    const warnings = [];

    // Required datasets
    const required = ['cpus', 'gpus', 'psus', 'cooling', 'memory'];
    for (const dataset of required) {
        if (!hardwareData[dataset]) {
            errors.push(`Missing required dataset: ${dataset}`);
        } else if (!Array.isArray(hardwareData[dataset])) {
            errors.push(`Dataset ${dataset} is not an array`);
        } else if (hardwareData[dataset].length === 0) {
            errors.push(`Dataset ${dataset} is empty`);
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors, warnings };
    }

    // Validate each dataset has required fields
    const cpuFields = ['id', 'name', 'vendor', 'cores', 'threads', 'tdp'];
    const missingCpuFields = validateDatasetFields(hardwareData.cpus, cpuFields, 'cpus');
    if (missingCpuFields) warnings.push(missingCpuFields);

    const gpuFields = ['id', 'name', 'vendor', 'generation', 'boardPower'];
    const missingGpuFields = validateDatasetFields(hardwareData.gpus, gpuFields, 'gpus');
    if (missingGpuFields) warnings.push(missingGpuFields);

    const psuFields = ['id', 'name', 'wattage', 'rating'];
    const missingPsuFields = validateDatasetFields(hardwareData.psus, psuFields, 'psus');
    if (missingPsuFields) warnings.push(missingPsuFields);

    const coolingFields = ['id', 'name', 'type', 'heatDissipation'];
    const missingCoolingFields = validateDatasetFields(hardwareData.cooling, coolingFields, 'cooling');
    if (missingCoolingFields) warnings.push(missingCoolingFields);

    const memoryFields = ['id', 'type', 'capacity'];
    const missingMemoryFields = validateDatasetFields(hardwareData.memory, memoryFields, 'memory');
    if (missingMemoryFields) warnings.push(missingMemoryFields);

    console.log('[Success] Hardware data validation passed');
    console.log(`   CPUs: ${hardwareData.cpus.length} | GPUs: ${hardwareData.gpus.length} | PSUs: ${hardwareData.psus.length}`);
    console.log(`   Cooling: ${hardwareData.cooling.length} | Memory: ${hardwareData.memory.length}`);
    if (warnings.length > 0) {
        console.warn('[Warning]  Validation warnings:', warnings);
    }

    return { valid: true, errors: [], warnings };
}

function validateDatasetFields(dataset, requiredFields, datasetName) {
    const sampleSize = Math.min(5, dataset.length);
    for (let i = 0; i < sampleSize; i++) {
        const item = dataset[i];
        const missing = requiredFields.filter(field => item[field] === undefined);
        if (missing.length > 0) {
            return `Dataset ${datasetName} item ${i} missing fields: ${missing.join(', ')}`;
        }
    }
    return null;
}

/**
 * Find reasonable default components
 */
export function findDefaults(hardwareData) {
    const { cpus, gpus, psus, cooling, memory } = hardwareData;

    console.log('[Search] Finding default components...');

    // CPU: Prefer i5-12600k, fallback to mid-range
    let defaultCpu = cpus.find(c => c.id === 'i5-12600k' || c.id === 'i9-12900k');
    if (!defaultCpu) {
        // Find mid-tier CPU (around 65-125W TDP)
        const midTierCpus = cpus.filter(c => (c.tdp || c.sustainedPower || 0) >= 65 && (c.tdp || c.sustainedPower || 0) <= 125);
        defaultCpu = midTierCpus[Math.floor(midTierCpus.length / 2)] || cpus[Math.floor(cpus.length / 2)];
    }
    if (!defaultCpu) {
        console.error('[Error] CRITICAL: No valid CPU found in dataset');
        throw new Error('CPU dataset is empty or invalid');
    }
    const cpuTdp = defaultCpu.tdp || defaultCpu.sustainedPower || 0;
    console.log(`   CPU: ${defaultCpu.name} (${cpuTdp}W)`);

    // GPU: Prefer RTX 4070, fallback to mid-range
    let defaultGpu = gpus.find(g => g.id === 'rtx-4070' || g.id === 'rtx-4070-super');
    if (!defaultGpu) {
        // Find mid-tier GPU (150-250W) - filter out entries without boardPower
        const midTierGpus = gpus.filter(g => {
            const power = g.boardPower || 0;
            return power >= 150 && power <= 250 && g.vendor === 'NVIDIA';
        });
        defaultGpu = midTierGpus[Math.floor(midTierGpus.length / 2)];
    }
    if (!defaultGpu) {
        // Fallback to any mid-range GPU with valid boardPower
        const validGpus = gpus.filter(g => (g.boardPower || 0) > 0);
        const sortedGpus = [...validGpus].sort((a, b) => (a.boardPower || 0) - (b.boardPower || 0));
        defaultGpu = sortedGpus[Math.floor(sortedGpus.length / 2)];
    }
    if (!defaultGpu) {
        console.error('[Error] CRITICAL: No valid GPU found in dataset');
        throw new Error('GPU dataset is empty or invalid');
    }
    const gpuPower = defaultGpu.boardPower || 0;
    console.log(`   GPU: ${defaultGpu.name} (${gpuPower}W)`);

    // PSU: Calculate recommended based on CPU + GPU + 150W overhead
    const totalPower = cpuTdp + gpuPower + 150;
    const recommendedPsu = Math.ceil(totalPower / 100) * 100; // Round up to nearest 100W
    let defaultPsu = psus.find(p => (p.wattage || 0) >= recommendedPsu && p.rating === '80+ Gold');
    if (!defaultPsu) {
        defaultPsu = psus.find(p => (p.wattage || 0) >= recommendedPsu);
    }
    if (!defaultPsu) {
        // Emergency fallback to highest wattage PSU
        const validPsus = psus.filter(p => (p.wattage || 0) > 0);
        defaultPsu = [...validPsus].sort((a, b) => (b.wattage || 0) - (a.wattage || 0))[0];
    }
    if (!defaultPsu) {
        console.error('[Error] CRITICAL: No valid PSU found in dataset');
        throw new Error('PSU dataset is empty or invalid');
    }
    console.log(`   PSU: ${defaultPsu.name} (recommended ${recommendedPsu}W, selected ${defaultPsu.wattage}W)`);

    // Cooling: AIO 240mm or mid-range air cooler
    let defaultCooling = cooling.find(c => c.id === 'aio-240');
    if (!defaultCooling) {
        // Find cooling adequate for CPU TDP
        const adequateCooling = cooling.filter(c => (c.heatDissipation || 0) >= cpuTdp * 1.2);
        defaultCooling = adequateCooling[Math.floor(adequateCooling.length / 2)] || cooling[Math.floor(cooling.length / 2)];
    }
    if (!defaultCooling) {
        console.error('[Error] CRITICAL: No valid cooling solution found in dataset');
        throw new Error('Cooling dataset is empty or invalid');
    }
    console.log(`   Cooling: ${defaultCooling.name} (${defaultCooling.heatDissipation}W capacity)`);

    // Memory: DDR4 or DDR5 based on CPU support
    const cpuMemSupport = defaultCpu.supportedMemory || ['DDR4'];
    let defaultMemory = memory.find(m => cpuMemSupport.includes(m.type) && (m.capacity || 0) === 16);
    if (!defaultMemory) {
        const compatibleMem = memory.filter(m => cpuMemSupport.includes(m.type));
        defaultMemory = compatibleMem[Math.floor(compatibleMem.length / 2)] || memory[0];
    }
    if (!defaultMemory) {
        console.error('[Error] CRITICAL: No valid memory found in dataset');
        throw new Error('Memory dataset is empty or invalid');
    }
    console.log(`   Memory: ${defaultMemory.capacity}GB ${defaultMemory.type}`);

    console.log('[Success] Default components initialized');

    return {
        cpu: defaultCpu,
        gpu: defaultGpu,
        psu: defaultPsu,
        cooling: defaultCooling,
        memory: defaultMemory
    };
}

/**
 * Check system readiness and generate status
 */
export function checkSystemReadiness(state) {
    const issues = [];
    const warnings = [];
    let level = 'valid'; // valid, warning, error

    // Check all required components are selected
    if (!state.cpu) issues.push('No CPU selected');
    if (!state.gpu) issues.push('No GPU selected');
    if (!state.psu) issues.push('No PSU selected');
    if (!state.cooling) issues.push('No cooling selected');
    if (!state.memory) issues.push('No memory selected');

    if (issues.length > 0) {
        return {
            level: 'error',
            message: 'Configuration incomplete',
            details: issues,
            canSimulate: false
        };
    }

    // Check power budget
    const estimatedPower = state.cpu.tdp + state.gpu.boardPower + 150;
    const psuCapacity = state.psu.wattage;
    if (estimatedPower > psuCapacity * 0.95) {
        issues.push(`PSU undersized: ${estimatedPower}W load on ${psuCapacity}W PSU`);
        level = 'error';
    } else if (estimatedPower > psuCapacity * 0.85) {
        warnings.push(`PSU near capacity: ${(estimatedPower / psuCapacity * 100).toFixed(0)}% load`);
        level = 'warning';
    }

    // Check cooling capacity
    if (state.cooling.heatDissipation < state.cpu.tdp) {
        issues.push(`Cooling insufficient: ${state.cooling.heatDissipation}W cooler for ${state.cpu.tdp}W CPU`);
        level = 'error';
    } else if (state.cooling.heatDissipation < state.cpu.tdp * 1.2) {
        warnings.push(`Cooling marginal for sustained loads`);
        if (level === 'valid') level = 'warning';
    }

    // Check memory compatibility
    const cpuMemSupport = state.cpu.supportedMemory || ['DDR4'];
    if (!cpuMemSupport.includes(state.memory.type)) {
        issues.push(`Incompatible memory: CPU supports ${cpuMemSupport.join('/')}, but ${state.memory.type} selected`);
        level = 'error';
    }

    if (issues.length > 0) {
        return {
            level,
            message: level === 'error' ? 'Configuration has critical issues' : 'Configuration valid with warnings',
            details: [...issues, ...warnings],
            canSimulate: level !== 'error'
        };
    }

    if (warnings.length > 0) {
        return {
            level: 'warning',
            message: 'Configuration valid with warnings',
            details: warnings,
            canSimulate: true
        };
    }

    return {
        level: 'valid',
        message: 'Configuration ready',
        details: [],
        canSimulate: true
    };
}
