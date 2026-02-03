/**
 * State Management Module - Enhanced
 * Central state store with history scrubbing support
 */

import { findDefaults } from './init.js';

export function createStore(initialState = {}) {
    let state = { ...initialState };
    const listeners = new Set();

    return {
        get(key) {
            if (key === undefined) return { ...state };
            return state[key];
        },

        set(updates) {
            const prevState = { ...state };
            state = { ...state, ...updates };
            listeners.forEach(listener => listener(state, prevState));
        },

        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        getListenerCount() {
            return listeners.size;
        }
    };
}

/**
 * Create simulator state with all configuration options
 */
export function createSimulatorState(hardwareData) {
    // Use robust default finding logic
    const defaults = findDefaults(hardwareData);

    return createStore({
        // Hardware selections (from validated defaults)
        cpu: defaults.cpu,
        gpu: defaults.gpu,
        psu: defaults.psu,
        cooling: defaults.cooling,
        memory: defaults.memory,

        // System configuration
        fanCount: 4,
        storageConfig: { nvme: 1, sata: 0, hdd: 0 },
        workload: 'idle',

        // Environment
        ambientTemp: 25,
        airflowQuality: 0.8, // 0.5 = restricted, 1.0 = excellent

        // Boost tracking
        boostState: {
            currentPower: 0,
            boostTimeRemaining: 0,
            boostActive: false
        },

        // Computed power state
        power: null,
        psuInfo: null,

        // Thermal simulation state
        thermal: null,

        // Warnings
        warnings: [],

        // Simulation control
        isRunning: true,
        isPaused: false,
        simulationSpeed: 1,

        // Time tracking
        lastUpdate: Date.now(),
        simulatedTime: 0,

        // History for scrubbing
        powerHistory: [],
        tempHistory: [],
        maxHistory: 300,
        historyIndex: -1, // -1 = live, 0+ = viewing history

        // Explanations
        workloadExplanation: '',
        thermalExplanation: '',

        // Hardware data reference
        hardwareData
    });
}

/**
 * Add to power history
 */
export function addPowerHistory(store, power, temp) {
    const state = store.get();
    const timestamp = Date.now();

    const powerHistory = [...state.powerHistory, { timestamp, value: power }].slice(-state.maxHistory);
    const tempHistory = [...state.tempHistory, { timestamp, value: temp }].slice(-state.maxHistory);

    store.set({ powerHistory, tempHistory });
}

/**
 * Set history scrub position
 */
export function setHistoryIndex(store, index) {
    const state = store.get();
    const maxIndex = state.powerHistory.length - 1;
    store.set({ historyIndex: Math.min(Math.max(index, -1), maxIndex) });
}

/**
 * Get historical values at index
 */
export function getHistoricalValues(store, index) {
    const state = store.get();
    if (index < 0 || index >= state.powerHistory.length) return null;

    return {
        power: state.powerHistory[index]?.value,
        temp: state.tempHistory[index]?.value,
        timestamp: state.powerHistory[index]?.timestamp
    };
}
