/**
 * Simulation Engine - Enhanced
 * Orchestrates simulation with boost tracking and history
 */

import { calculateTotalPower, calculateWallPower, applyThrottling, getWorkloadExplanation } from './power.js';
import { createThermalState, updateThermalState, setAmbientTemp, getThermalExplanation } from './thermal.js';
import { generateWarnings } from './warnings.js';
import { addPowerHistory } from './state.js';

const TICK_RATE = 100; // 10 updates per second for smoothness
const HISTORY_RATE = 1000; // Save history every 1 second
let simulationInterval = null;
let lastTickTime = 0;
let lastHistoryTime = 0;

/**
 * Initialize simulation
 */
export function initializeSimulation(store) {
    const state = store.get();
    const thermal = createThermalState(state.ambientTemp);

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

    store.set({
        thermal,
        power,
        psuInfo,
        workloadExplanation: getWorkloadExplanation(state.workload),
        lastUpdate: Date.now()
    });
}

/**
 * Core simulation calculation - always runs regardless of pause state
 * Used for immediate updates when settings change
 */
function calculateSimulationState(store, deltaTime = 0.1) {
    const state = store.get();

    // Update boost state
    let boostState = { ...state.boostState };
    const profile = state.workload;
    const isHighLoad = ['rendering', 'stress', 'compiling'].includes(profile);

    if (isHighLoad && state.cpu?.shortBoostDuration > 0) {
        if (!boostState.boostActive && boostState.boostTimeRemaining === 0) {
            boostState.boostTimeRemaining = state.cpu.shortBoostDuration;
            boostState.boostActive = true;
        } else if (boostState.boostTimeRemaining > 0) {
            boostState.boostTimeRemaining = Math.max(0, boostState.boostTimeRemaining - deltaTime);
            if (boostState.boostTimeRemaining === 0) {
                boostState.boostActive = false;
            }
        }
    } else if (!isHighLoad) {
        boostState = { currentPower: state.power?.cpu || 0, boostTimeRemaining: 0, boostActive: false };
    }

    // Calculate power
    let power = calculateTotalPower({
        cpu: state.cpu,
        gpu: state.gpu,
        memory: state.memory,
        workload: state.workload,
        fanCount: state.fanCount,
        storageConfig: state.storageConfig,
        fanSpeed: state.thermal?.fanSpeed || 30,
        ambientTemp: state.ambientTemp
    }, { ...boostState, currentPower: state.power?.cpu || 0 });

    // Apply throttling
    if (state.thermal?.isThrottling) {
        const throttledCpu = applyThrottling(power.cpu, state.thermal.throttlePercent);
        const throttledGpu = applyThrottling(power.gpu, state.thermal.throttlePercent * 0.4);

        power = {
            ...power,
            cpu: throttledCpu,
            gpu: throttledGpu,
            sustainedTotal: throttledCpu + throttledGpu + power.memory + power.motherboard + power.storage + power.fans + power.peripherals + power.rgb,
            transientPeak: throttledCpu + throttledGpu * (state.gpu?.transientMultiplier || 1.5) + power.motherboard + power.memory + power.storage + power.fans + power.peripherals + power.rgb
        };
    }

    boostState.currentPower = power.cpu;

    // PSU stats
    const psuInfo = calculateWallPower(power.sustainedTotal, power.transientPeak, state.psu);

    // Update thermal
    const newThermal = updateThermalState(state.thermal || createThermalState(state.ambientTemp), {
        cpuPower: power.cpu,
        gpuPower: power.gpu,
        memoryHeat: power.memoryHeat || 0,
        psuHeatWaste: psuInfo.heatWaste,
        storageHeat: (power.storage || 0) * 0.8,
        cooling: state.cooling,
        fanCount: state.fanCount,
        maxCpuTemp: state.cpu?.maxSafeTemp || 90,
        throttleTemp: state.cpu?.throttleTemp || 95,
        airflowQuality: state.airflowQuality,
        deltaTime
    });

    // Warnings
    const warnings = generateWarnings({
        power,
        thermal: newThermal,
        psuInfo,
        psu: state.psu,
        cooling: state.cooling,
        cpu: state.cpu,
        gpu: state.gpu
    });

    // Explanations
    const thermalExplanation = getThermalExplanation(newThermal, state.cooling, state.cpu?.maxSafeTemp || 90);

    return {
        power,
        psuInfo,
        thermal: newThermal,
        boostState,
        warnings,
        thermalExplanation
    };
}

/**
 * Simulation tick - called by interval
 */
function simulationTick(store) {
    const state = store.get();

    if (!state.isRunning || state.isPaused) return;

    const now = Date.now();
    const deltaTime = Math.min((now - lastTickTime) / 1000, 2) * state.simulationSpeed;
    lastTickTime = now;

    const result = calculateSimulationState(store, deltaTime);

    store.set({
        ...result,
        lastUpdate: now,
        simulatedTime: state.simulatedTime + deltaTime
    });

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
    const result = calculateSimulationState(store, 0);

    store.set({
        power: result.power,
        psuInfo: result.psuInfo,
        warnings: result.warnings,
        thermalExplanation: result.thermalExplanation,
        // Keep existing thermal state but update equilibrium display
        thermal: {
            ...state.thermal,
            equilibriumTemp: result.thermal.equilibriumTemp,
            headroom: result.thermal.headroom
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
 * Reset simulation
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
 * Select hardware - INSTANT UPDATE
 */
export function selectHardware(store, type, id) {
    const state = store.get();
    let list;
    if (type === 'memory') {
        list = state.hardwareData.memory;
    } else {
        list = state.hardwareData[type + 's'] || state.hardwareData[type];
    }
    const selected = list?.find(item => item.id === id);

    if (selected) {
        const updates = { [type]: selected };

        // Reset boost when changing CPU
        if (type === 'cpu') {
            updates.boostState = { currentPower: 0, boostTimeRemaining: 0, boostActive: false };
        }

        store.set(updates);
        // Immediate recalculation
        immediateUpdate(store);
    }
}

/**
 * Update config - INSTANT UPDATE
 */
export function updateConfig(store, config) {
    store.set(config);

    // Update workload explanation if workload changed
    if (config.workload) {
        const state = store.get();
        store.set({
            workloadExplanation: getWorkloadExplanation(config.workload),
            boostState: {
                currentPower: state.power?.cpu || 0,
                boostTimeRemaining: state.cpu?.shortBoostDuration || 0,
                boostActive: ['rendering', 'stress', 'compiling'].includes(config.workload) && state.cpu?.shortBoostDuration > 0
            }
        });
    }

    // Update ambient temp in thermal state
    if (config.ambientTemp !== undefined) {
        const thermal = setAmbientTemp(store.get('thermal'), config.ambientTemp);
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
