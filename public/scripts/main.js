/**
 * Main Application Entry Point - Robust Initialization
 */

import { createSimulatorState, setHistoryIndex } from './state.js';
import { initializeSimulation, startSimulation, togglePause, resetSimulation, selectHardware, updateConfig, setSimulationSpeed } from './simulation.js';
import { initializeUI } from './ui.js';
import { validateHardwareData, findDefaults, InitializationError } from './init.js';

let hardwareData = null;
let store = null;
let ui = null;

/**
 * Show loading overlay
 */
function showLoadingState(message = 'Loading hardware data...') {
    const container = document.querySelector('.simulator-container');
    if (!container) return;

    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(10, 10, 12, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-family: var(--font-mono);
        color: var(--text-primary);
    `;
    overlay.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">⚡</div>
            <div style="font-size: 1rem; color: var(--text-secondary);">${message}</div>
            <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-tertiary);">Initializing...</div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideLoadingState() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease';
        setTimeout(() => overlay.remove(), 300);
    }
}

/**
 * Load hardware datasets with validation
 */
async function loadHardwareData() {
    console.log('🚀 Starting hardware data load...');
    const startTime = performance.now();

    try {
        const [cpus, gpus, psus, cooling, memory, storage] = await Promise.all([
            fetch('/data/cpus.json').then(r => {
                if (!r.ok) throw new Error(`Failed to load CPUs: ${r.statusText}`);
                return r.json();
            }),
            fetch('/data/gpus.json').then(r => {
                if (!r.ok) throw new Error(`Failed to load GPUs: ${r.statusText}`);
                return r.json();
            }),
            fetch('/data/psus.json').then(r => {
                if (!r.ok) throw new Error(`Failed to load PSUs: ${r.statusText}`);
                return r.json();
            }),
            fetch('/data/cooling.json').then(r => {
                if (!r.ok) throw new Error(`Failed to load cooling: ${r.statusText}`);
                return r.json();
            }),
            fetch('/data/memory.json').then(r => {
                if (!r.ok) throw new Error(`Failed to load memory: ${r.statusText}`);
                return r.json();
            }),
            fetch('/data/storage.json').then(r => r.json()).catch(() => {
                console.warn('Storage data not available, using fallback');
                return [];
            })
        ]);

        const loadTime = (performance.now() - startTime).toFixed(0);
        console.log(`✅ Hardware data loaded in ${loadTime}ms`);

        return { cpus, gpus, psus, cooling, memory, storage };
    } catch (error) {
        throw new InitializationError('Failed to load hardware datasets', { originalError: error });
    }
}

/**
 * Initialize the simulator
 */
async function init() {
    try {
        console.log('═══════════════════════════════════════════════');
        console.log('  PC Power & Thermal Simulator - Initializing');
        console.log('═══════════════════════════════════════════════');

        showLoadingState('Loading hardware data...');

        // Load hardware data
        hardwareData = await loadHardwareData();

        // Validate datasets
        console.log('🔍 Validating hardware datasets...');
        const validation = validateHardwareData(hardwareData);
        if (!validation.valid) {
            throw new InitializationError(
                'Hardware data validation failed',
                { errors: validation.errors }
            );
        }

        // Create state store with validated data
        console.log('🏗️  Creating state store...');
        store = createSimulatorState(hardwareData);

        // Verify defaults were set
        const state = store.get();
        if (!state.cpu || !state.gpu || !state.psu || !state.cooling || !state.memory) {
            console.error('❌ Default component selection failed:', {
                cpu: !!state.cpu,
                gpu: !!state.gpu,
                psu: !!state.psu,
                cooling: !!state.cooling,
                memory: !!state.memory
            });
            throw new InitializationError('Failed to initialize default components');
        }

        console.log('✅ Initial state validated:', {
            cpu: state.cpu.name,
            gpu: state.gpu.name,
            psu: state.psu.name,
            cooling: state.cooling.name,
            memory: `${state.memory.capacity}GB ${state.memory.type}`
        });

        // Initialize simulation engine
        console.log('⚙️  Initializing simulation engine...');
        initializeSimulation(store);

        // Initialize UI
        console.log('🎨 Initializing user interface...');
        ui = initializeUI(hardwareData, {
            onSelectHardware: (type, id) => {
                console.log(`🔧 Hardware changed: ${type} → ${id}`);
                selectHardware(store, type, id);
            },
            onUpdateConfig: (config) => {
                console.log('⚙️  Config updated:', config);
                updateConfig(store, config);
            },
            onTogglePause: () => togglePause(store),
            onReset: () => {
                console.log('🔄 Simulation reset');
                resetSimulation(store);
            },
            onSetSpeed: (speed) => setSimulationSpeed(store, speed),
            onScrubHistory: (index) => setHistoryIndex(store, index)
        });

        // Subscribe UI to state changes
        store.subscribe((state) => ui.update(state));

        // Initial UI update
        ui.update(store.get());

        // Start simulation
        console.log('▶️  Starting simulation loop...');
        startSimulation(store);

        hideLoadingState();

        console.log('═══════════════════════════════════════════════');
        console.log('  ✅  Simulator initialized successfully');
        console.log('═══════════════════════════════════════════════');
        console.log('💡 Tip: Open DevTools Console for detailed simulation logs');

    } catch (error) {
        console.error('═══════════════════════════════════════════════');
        console.error('  ❌  INITIALIZATION FAILED');
        console.error('═══════════════════════════════════════════════');
        console.error('Error:', error);
        if (error.details) {
            console.error('Details:', error.details);
        }

        hideLoadingState();

        // Show user-friendly error screen
        const errorDetails = error.details?.errors?.join('\n') || error.message;
        const stackTrace = error.stack || 'No stack trace available';

        document.body.innerHTML = `
            <div style="
                background: #0a0a0c;
                color: #ef4444;
                padding: 2rem;
                font-family: 'JetBrains Mono', monospace;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            ">
                <div style="max-width: 800px; width: 100%;">
                    <div style="font-size: 3rem; margin-bottom: 1rem; text-align: center;">⚠️</div>
                    <h1 style="
                        font-size: 1.5rem;
                        margin-bottom: 1rem;
                        color: #ef4444;
                        text-align: center;
                        font-weight: 600;
                    ">Initialization Failure</h1>
                    
                    <div style="
                        background: #111;
                        border-left: 3px solid #ef4444;
                        padding: 1rem;
                        margin-bottom: 1rem;
                        border-radius: 4px;
                    ">
                        <div style="color: #fbbf24; margin-bottom: 0.5rem; font-weight: 600;">Error Message:</div>
                        <div style="color: #f87171; font-size: 0.9rem;">${error.message}</div>
                    </div>

                    ${error.details?.errors ? `
                        <div style="
                            background: #111;
                            border-left: 3px solid #f59e0b;
                            padding: 1rem;
                            margin-bottom: 1rem;
                            border-radius: 4px;
                        ">
                            <div style="color: #fbbf24; margin-bottom: 0.5rem; font-weight: 600;">Details:</div>
                            <pre style="
                                color: #fcd34d;
                                font-size: 0.8rem;
                                white-space: pre-wrap;
                                word-wrap: break-word;
                                margin: 0;
                            ">${errorDetails}</pre>
                        </div>
                    ` : ''}

                    <details style="margin-bottom: 1rem;">
                        <summary style="
                            cursor: pointer;
                            color: #9ca3af;
                            margin-bottom: 0.5rem;
                            user-select: none;
                        ">Stack Trace (click to expand)</summary>
                        <pre style="
                            background: #111;
                            padding: 1rem;
                            border-radius: 4px;
                            overflow: auto;
                            font-size: 0.75rem;
                            color: #6b7280;
                            border-left: 3px solid #374151;
                        ">${stackTrace}</pre>
                    </details>

                    <div style="
                        text-align: center;
                        color: #9ca3af;
                        font-size: 0.875rem;
                        margin-top: 2rem;
                        padding-top: 2rem;
                        border-top: 1px solid #1f2937;
                    ">
                        <p style="margin-bottom: 0.5rem;">The simulator failed to initialize. Possible causes:</p>
                        <ul style="text-align: left; max-width: 500px; margin: 1rem auto; line-height: 1.6;">
                            <li>Hardware data files are missing or corrupted</li>
                            <li>Network error loading datasets</li>
                            <li>Browser compatibility issue</li>
                        </ul>
                        <button onclick="location.reload()" style="
                            margin-top: 1rem;
                            padding: 0.75rem 1.5rem;
                            background: #1f2937;
                            color: #f3f4f6;
                            border: 1px solid #374151;
                            border-radius: 4px;
                            font-family: inherit;
                            font-size: 0.875rem;
                            cursor: pointer;
                            transition: all 0.2s;
                        " onmouseover="this.style.background='#374151'" onmouseout="this.style.background='#1f2937'">
                            Reload Page
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
