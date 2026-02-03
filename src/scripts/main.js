/**
 * Main Application Entry Point - Comprehensive
 */

import { createSimulatorState, setHistoryIndex } from './state.js';
import { initializeSimulation, startSimulation, togglePause, resetSimulation, selectHardware, updateConfig, setSimulationSpeed } from './simulation.js';
import { initializeUI } from './ui.js';

let hardwareData = null;
let store = null;
let ui = null;

async function loadHardwareData() {
    const [cpus, gpus, psus, cooling, memory, storage] = await Promise.all([
        fetch('/data/cpus.json').then(r => r.json()),
        fetch('/data/gpus.json').then(r => r.json()),
        fetch('/data/psus.json').then(r => r.json()),
        fetch('/data/cooling.json').then(r => r.json()),
        fetch('/data/memory.json').then(r => r.json()),
        fetch('/data/storage.json').then(r => r.json()).catch(() => [])
    ]);
    return { cpus, gpus, psus, cooling, memory, storage };
}

async function init() {
    try {
        // Show loading state
        const container = document.querySelector('.simulator-container');
        if (container) {
            container.style.opacity = '0.5';
        }

        hardwareData = await loadHardwareData();
        console.log('Hardware data loaded:', Object.keys(hardwareData).map(k => `${k}: ${hardwareData[k].length}`));

        store = createSimulatorState(hardwareData);
        initializeSimulation(store);

        ui = initializeUI(hardwareData, {
            onSelectHardware: (type, id) => selectHardware(store, type, id),
            onUpdateConfig: (config) => updateConfig(store, config),
            onTogglePause: () => togglePause(store),
            onReset: () => resetSimulation(store),
            onSetSpeed: (speed) => setSimulationSpeed(store, speed),
            onScrubHistory: (index) => setHistoryIndex(store, index)
        });

        store.subscribe((state) => ui.update(state));
        ui.update(store.get());
        startSimulation(store);

        // Restore opacity
        if (container) {
            container.style.opacity = '1';
            container.style.transition = 'opacity 0.3s ease';
        }

        console.log('PC Power Simulator initialized successfully');
    } catch (error) {
        console.error('Failed to initialize:', error);
        document.body.innerHTML = `
            <div style="color:#ef4444;padding:2rem;font-family:monospace;background:#0a0a0c;min-height:100vh;">
                <h1 style="margin-bottom:1rem;">Initialization Error</h1>
                <p style="margin-bottom:0.5rem;">${error.message}</p>
                <pre style="background:#111;padding:1rem;border-radius:4px;overflow:auto;font-size:0.8rem;">${error.stack}</pre>
            </div>
        `;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
