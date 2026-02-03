/**
 * State Management Module - Comprehensive
 * Simple reactive store with hardware lookups
 */

const MAX_HISTORY = 300; // 5 minutes at 1 sample/second

function findById(list, id) {
    return list?.find(item => item.id === id);
}

export function createSimulatorState(hardwareData) {
    // Set defaults based on common configurations
    const defaultCpu = findById(hardwareData.cpus, 'i9-12900k') || hardwareData.cpus[0];
    const defaultGpu = findById(hardwareData.gpus, 'rtx-4070') || hardwareData.gpus[0];
    const defaultPsu = findById(hardwareData.psus, 'psu-850w-gold') || hardwareData.psus[0];
    const defaultCooling = findById(hardwareData.cooling, 'aio-240') || hardwareData.cooling[0];

    // Find compatible memory for the default CPU
    const supportedMemTypes = defaultCpu?.supportedMemory || ['DDR4'];
    const compatibleMemory = hardwareData.memory.filter(m => supportedMemTypes.includes(m.type));
    const defaultMemory = compatibleMemory.find(m => m.capacity >= 32) || compatibleMemory[0];

    let state = {
        // Hardware selections
        cpu: defaultCpu,
        gpu: defaultGpu,
        psu: defaultPsu,
        cooling: defaultCooling,
        memory: defaultMemory,

        // Configuration
        storageConfig: {
            nvme: 1,
            sata: 0,
            hdd: 0
        },
        fanCount: 4,
        ambientTemp: 25,
        airflowQuality: 0.85,
        workload: 'gaming',

        // Simulation state
        isRunning: false,
        isPaused: false,
        simulationSpeed: 1,
        simulatedTime: 0,

        // Boost tracking
        boostState: {
            currentPower: 0,
            boostTimeRemaining: 0,
            boostActive: false
        },

        // Calculated values (updated by simulation)
        power: null,
        psuInfo: null,
        thermal: null,
        coolingInfo: null,
        warnings: [],
        compatibilityWarning: null,

        // Explanations
        workloadExplanation: '',
        thermalExplanation: '',

        // History for graphs
        powerHistory: [],
        tempHistory: [],
        historyIndex: -1, // -1 means live, otherwise fixed position

        // Hardware database reference
        hardwareData,

        lastUpdate: Date.now()
    };

    const subscribers = [];

    function get() {
        return state;
    }

    function set(updates) {
        state = { ...state, ...updates };
        subscribers.forEach(fn => fn(state));
    }

    function subscribe(fn) {
        subscribers.push(fn);
        return () => {
            const idx = subscribers.indexOf(fn);
            if (idx >= 0) subscribers.splice(idx, 1);
        };
    }

    return { get, set, subscribe };
}

export function setHistoryIndex(store, index) {
    const state = store.get();
    if (index >= 0 && index < state.powerHistory.length) {
        store.set({
            historyIndex: index,
            isPaused: true
        });
    } else {
        store.set({
            historyIndex: -1
        });
    }
}

export function addPowerHistory(store, power, temp) {
    const state = store.get();

    const newPowerHistory = [...state.powerHistory, {
        value: power,
        time: state.simulatedTime
    }];

    const newTempHistory = [...state.tempHistory, {
        value: temp,
        time: state.simulatedTime
    }];

    // Trim old entries
    if (newPowerHistory.length > MAX_HISTORY) {
        newPowerHistory.shift();
    }
    if (newTempHistory.length > MAX_HISTORY) {
        newTempHistory.shift();
    }

    store.set({
        powerHistory: newPowerHistory,
        tempHistory: newTempHistory
    });
}
