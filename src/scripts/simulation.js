/**
 * Simulation Engine - Comprehensive
 * Orchestrates real-time simulation with immediate config updates
 */

import { calculateTotalPower, calculateWallPower, applyThrottling, getWorkloadExplanation, getWorkloadInfo, calculateEffectiveCooling } from './power.js';
import { createThermalState, updateThermalState, setAmbientTemp, getThermalExplanation } from './thermal.js';
import { generateWarnings } from './warnings.js';
import { addPowerHistory } from './state.js';

const TICK_RATE = 100; // 10 updates per second for smooth visualization
const HISTORY_RATE = 1000; // Save history every 1 second
let simulationInterval = null;
let lastTickTime = 0;
let lastHistoryTime = 0;

/**
 * Initialize simulation with current configuration
 */
export function initializeSimulation(store) {
    const state = store.get();
    const thermal = createThermalState(state.ambientTemp);

    // Calculate initial power state
    const power = calculateTotalPower({
        cpu: state.cpu,
        gpu: state.gpu,
        memory: state.memory,
        workload: state.workload,
        fanCount: state.fanCount,
        storageConfig: state.storageConfig,
        fanSpeed: 30,
        ambientTemp: state.ambientTemp
    }, state.boostState);

    const psuInfo = calculateWallPower(power.sustainedTotal, power.transientPeak, state.psu);

    // Calculate effective cooling capacity
    const coolingInfo = state.cooling
        ? calculateEffectiveCooling(state.cooling, state.fanCount, state.airflowQuality)
        : null;

    store.set({
        thermal,
        power,
        psuInfo,
        coolingInfo,
        workloadExplanation: getWorkloadExplanation(state.workload),
        lastUpdate: Date.now()
    });
}

/**
 * Core simulation calculation - processes one tick
 */
function calculateSimulationState(store, deltaTime = 0.1) {
    const state = store.get();

    // Update boost state based on workload
    let boostState = { ...state.boostState };
    const workloadInfo = getWorkloadInfo(state.workload);
    const isHighLoad = ['rendering', 'stress', 'compiling', 'streaming'].includes(state.workload);

    if (isHighLoad && state.cpu?.shortBoostDuration > 0) {
        if (!boostState.boostActive && boostState.boostTimeRemaining === 0) {
            // Start boost period
            boostState.boostTimeRemaining = state.cpu.shortBoostDuration;
            boostState.boostActive = true;
        } else if (boostState.boostTimeRemaining > 0) {
            // Countdown boost
            boostState.boostTimeRemaining = Math.max(0, boostState.boostTimeRemaining - deltaTime);
            if (boostState.boostTimeRemaining === 0) {
                boostState.boostActive = false;
            }
        }
    } else if (!isHighLoad) {
        // Reset boost when workload becomes light
        boostState = { currentPower: state.power?.cpu || 0, boostTimeRemaining: 0, boostActive: false };
    }

    // Calculate power with current thermal state (for throttling)
    let power = calculateTotalPower({
        cpu: state.cpu,
        gpu: state.gpu,
        memory: state.memory,
        workload: state.workload,
        fanCount: state.fanCount,
        storageConfig: state.storageConfig,
        fanSpeed: state.thermal?.fanSpeed || 30,
        ambientTemp: state.ambientTemp
    }, { ...boostState, currentPower: state.power?.cpu || 0 }, state.thermal);

    // Apply throttling to power draw (already done in calculateTotalPower, but double-check for display)
    if (state.thermal?.isThrottling) {
        const throttledCpu = applyThrottling(power.cpu, state.thermal.throttlePercent);
        const throttledGpu = applyThrottling(power.gpu, state.thermal.throttlePercent * 0.35);

        power = {
            ...power,
            cpu: throttledCpu,
            gpu: throttledGpu,
            sustainedTotal: throttledCpu + throttledGpu + power.memory + power.motherboard +
                power.storage + power.fans + power.peripherals + power.rgb,
            transientPeak: throttledCpu + throttledGpu * (state.gpu?.transientMultiplier || 1.5) +
                power.motherboard + power.memory + power.storage + power.fans +
                power.peripherals + power.rgb
        };
    }

    boostState.currentPower = power.cpu;

    // Calculate PSU stats
    const psuInfo = calculateWallPower(power.sustainedTotal, power.transientPeak, state.psu);

    // Update thermal simulation
    const thermalState = state.thermal || createThermalState(state.ambientTemp);
    const newThermal = updateThermalState(thermalState, {
        cpuPower: power.cpu,
        gpuPower: power.gpu,
        memoryHeat: power.memoryHeat || 0,
        psuHeatWaste: psuInfo.heatWaste,
        storageHeat: (power.storage || 0) * 0.6,
        cooling: state.cooling,
        fanCount: state.fanCount,
        maxCpuTemp: state.cpu?.maxSafeTemp || 90,
        throttleTemp: state.cpu?.throttleTemp || 95,
        airflowQuality: state.airflowQuality,
        deltaTime
    });

    // Generate warnings
    const warnings = generateWarnings({
        power,
        thermal: newThermal,
        psuInfo,
        psu: state.psu,
        cooling: state.cooling,
        cpu: state.cpu,
        gpu: state.gpu,
        memory: state.memory,
        workload: state.workload
    });

    // Get thermal explanation
    const thermalExplanation = getThermalExplanation(newThermal, state.cooling, state.cpu?.maxSafeTemp || 90);

    // Calculate cooling info for display
    const coolingInfo = state.cooling
        ? calculateEffectiveCooling(state.cooling, state.fanCount, state.airflowQuality)
        : null;

    return {
        power,
        psuInfo,
        thermal: newThermal,
        boostState,
        warnings,
        thermalExplanation,
        coolingInfo
    };
}

/**
 * Simulation tick - called by interval
 */
function simulationTick(store) {
    const state = store.get();

    if (!state.isRunning || state.isPaused) return;

    const now = Date.now();
    const rawDelta = (now - lastTickTime) / 1000;
    const deltaTime = Math.min(rawDelta, 2) * state.simulationSpeed;
    lastTickTime = now;

    const result = calculateSimulationState(store, deltaTime);

    store.set({
        ...result,
        lastUpdate: now,
        simulatedTime: state.simulatedTime + deltaTime
    });

    // Update history periodically
    if (now - lastHistoryTime >= HISTORY_RATE) {
        addPowerHistory(store, result.power.sustainedTotal, result.thermal.cpuTemp);
        lastHistoryTime = now;
    }
}

/**
 * Immediate update - for when settings change
 * Updates power/PSU/warnings instantly without waiting for next tick
 */
function immediateUpdate(store) {
    const state = store.get();

    // Create fresh thermal state if needed
    const thermal = state.thermal || createThermalState(state.ambientTemp);

    // Calculate new equilibrium and power immediately
    const result = calculateSimulationState(store, 0);

    store.set({
        power: result.power,
        psuInfo: result.psuInfo,
        warnings: result.warnings,
        thermalExplanation: result.thermalExplanation,
        coolingInfo: result.coolingInfo,
        workloadExplanation: getWorkloadExplanation(state.workload),
        // Update thermal with new equilibrium but keep current temp (it will approach)
        thermal: {
            ...thermal,
            equilibriumTemp: result.thermal.equilibriumTemp,
            coolingCapacity: result.thermal.coolingCapacity,
            thermalHeadroom: result.thermal.thermalHeadroom
        },
        boostState: result.boostState,
        lastUpdate: Date.now()
    });
}

/**
 * Start simulation
 */
export function startSimulation(store) {
    if (simulationInterval) return;

    lastTickTime = Date.now();
    lastHistoryTime = Date.now();
    store.set({ isRunning: true, isPaused: false });

    simulationInterval = setInterval(() => simulationTick(store), TICK_RATE);
}

/**
 * Stop simulation
 */
export function stopSimulation(store) {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    store.set({ isRunning: false });
}

/**
 * Pause/resume
 */
export function togglePause(store) {
    const state = store.get();
    if (state.isPaused) {
        lastTickTime = Date.now();
    }
    store.set({ isPaused: !state.isPaused });
}

/**
 * Reset simulation - return to ambient temperatures
 */
export function resetSimulation(store) {
    const state = store.get();
    const thermal = createThermalState(state.ambientTemp);
    store.set({
        thermal,
        powerHistory: [],
        tempHistory: [],
        simulatedTime: 0,
        boostState: { currentPower: 0, boostTimeRemaining: 0, boostActive: false },
        historyIndex: -1
    });
    // Immediately recalculate with new thermal state
    immediateUpdate(store);
}

/**
 * Check memory compatibility with selected CPU
 */
export function checkMemoryCompatibility(cpu, memory) {
    if (!cpu || !memory) return { compatible: true, reason: '' };

    const supportedTypes = cpu.supportedMemory || ['DDR4'];

    if (!supportedTypes.includes(memory.type)) {
        return {
            compatible: false,
            reason: `${cpu.name} (${cpu.generation}) only supports ${supportedTypes.join(' or ')}. ${memory.name} is ${memory.type}.`
        };
    }

    return { compatible: true, reason: '' };
}

/**
 * Select hardware - INSTANT UPDATE
 */
export function selectHardware(store, type, id) {
    const state = store.get();
    let list;

    if (type === 'memory') {
        list = state.hardwareData.memory;
    } else if (type === 'cooling') {
        list = state.hardwareData.cooling;
    } else {
        list = state.hardwareData[type + 's'] || state.hardwareData[type];
    }

    const selected = list?.find(item => item.id === id);

    if (selected) {
        const updates = { [type]: selected };

        // Reset boost when changing CPU
        if (type === 'cpu') {
            updates.boostState = { currentPower: 0, boostTimeRemaining: 0, boostActive: false };

            // Check if current memory is compatible
            const memoryCompat = checkMemoryCompatibility(selected, state.memory);
            if (!memoryCompat.compatible) {
                // Find compatible memory
                const compatibleMem = state.hardwareData.memory.find(m =>
                    selected.supportedMemory?.includes(m.type)
                );
                if (compatibleMem) {
                    updates.memory = compatibleMem;
                    updates.compatibilityWarning = memoryCompat.reason;
                }
            } else {
                updates.compatibilityWarning = null;
            }
        }

        // Check memory compatibility when changing memory
        if (type === 'memory') {
            const memoryCompat = checkMemoryCompatibility(state.cpu, selected);
            if (!memoryCompat.compatible) {
                updates.compatibilityWarning = memoryCompat.reason;
            } else {
                updates.compatibilityWarning = null;
            }
        }

        store.set(updates);
        // Immediate recalculation
        immediateUpdate(store);
    }
}

/**
 * Update config - INSTANT UPDATE
 * Any configuration change triggers immediate recalculation
 */
export function updateConfig(store, config) {
    store.set(config);

    const state = store.get();

    // Update workload explanation if workload changed
    if (config.workload) {
        const workloadInfo = getWorkloadInfo(config.workload);
        const isHighLoad = ['rendering', 'stress', 'compiling', 'streaming'].includes(config.workload);

        store.set({
            workloadExplanation: getWorkloadExplanation(config.workload),
            boostState: {
                currentPower: state.power?.cpu || 0,
                boostTimeRemaining: isHighLoad && state.cpu?.shortBoostDuration > 0
                    ? state.cpu.shortBoostDuration
                    : 0,
                boostActive: isHighLoad && state.cpu?.shortBoostDuration > 0
            }
        });
    }

    // Update ambient temp in thermal state
    if (config.ambientTemp !== undefined) {
        const thermal = setAmbientTemp(state.thermal || createThermalState(config.ambientTemp), config.ambientTemp);
        store.set({ thermal });
    }

    // Immediate recalculation
    immediateUpdate(store);
}

/**
 * Set simulation speed
 */
export function setSimulationSpeed(store, speed) {
    store.set({ simulationSpeed: Math.max(0.25, Math.min(speed, 10)) });
}

/**
 * Get component info for help panel
 */
export function getComponentInfo(store, type) {
    const state = store.get();
    const component = state[type];

    if (!component) return null;

    return {
        ...component,
        currentPower: state.power?.[type] || 0,
        thermalState: type === 'cpu' ? state.thermal?.cpuTemp : null
    };
}
