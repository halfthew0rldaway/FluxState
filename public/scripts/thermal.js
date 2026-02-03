/**
 * Thermal Simulation Module - Enhanced
 * Time-based thermal behavior with true heat soak and asymptotic approach
 */

// Thermal Constants
const THERMAL_CONSTANTS = {
    // Base thermal mass of the CPU package/IHS
    CPU_THERMAL_MASS: 0.05,
    // Rate at which heat moves from CPU to cooler (coupling)
    COUPLING_RATE: 0.8,
    // Minimum fan speed
    MIN_FAN_SPEED: 20,
    // Ambient influence on case temp
    CASE_AIRFLOW_FACTOR: 0.02
};

/**
 * Create initial thermal state
 */
export function createThermalState(ambientTemp = 25) {
    return {
        cpuTemp: ambientTemp,
        gpuTemp: ambientTemp,
        caseTemp: ambientTemp,
        coolantTemp: ambientTemp, // For AIO/Water
        ambientTemp: ambientTemp,
        throttlePercent: 0,
        isThrottling: false,
        fanSpeed: THERMAL_CONSTANTS.MIN_FAN_SPEED,
        noiseLevel: 20,
        heatGenerated: 0,
        heatDissipated: 0,
        equilibriumTemp: ambientTemp,
        thermalHistory: [],
        maxHistoryLength: 300
    };
}

/**
 * Calculate raw heat generation
 */
export function calculateHeatGenerated(cpuPower, gpuPower, memoryHeat, psuHeatWaste, storageHeat = 0) {
    // Near 100% of power becomes heat
    const cpuHeat = cpuPower;
    const gpuHeat = gpuPower;
    const memHeat = memoryHeat * 40; // Scaling factor for memory heat contribution to case
    const storeHeat = storageHeat * 20;

    return {
        total: cpuHeat + gpuHeat + memHeat + psuHeatWaste + storeHeat,
        cpu: cpuHeat,
        gpu: gpuHeat,
        system: memHeat + psuHeatWaste + storeHeat
    };
}

/**
 * Calculate cooling capacity based on temperature delta
 * Dissipation scales with (Temp - Ambient)
 */
export function calculateCoolingPerformance(cooling, fanCount, fanSpeed, airflowQuality, deltaTemp) {
    if (!cooling) return 1;

    // Cooler base capacity (W/C delta)
    // e.g., 250W capacity at 70C delta -> ~3.5 W/C
    // We model this as efficiency

    const fanRatio = fanSpeed / 100;
    // Fan pressure curve approximation
    const fanEfficiency = 0.2 + 0.8 * Math.pow(fanRatio, 1.2);

    // Case airflow affects cooler efficiency
    // Poor airflow reduces cooler performance up to 40%
    const airflowPenalty = 1 - ((1 - airflowQuality) * 0.4);

    // Base conductivity of the cooler
    const coolerConductivity = (cooling.heatDissipation / 60); // approx W per degree delta

    // Total dissipation capability at this delta
    const dissipation = coolerConductivity * fanEfficiency * airflowPenalty * deltaTemp;

    return dissipation;
}

/**
 * Calculate equilibrium temperature
 */
export function calculateEquilibriumTemp(heatLoad, cooling, fanCount, fanSpeed, airflowQuality, ambientTemp) {
    if (!cooling || heatLoad <= 0) return ambientTemp;

    // Estimate required delta
    // Heat = Conductivity * FanEff * Airflow * Delta
    // Delta = Heat / (Conductivity * FanEff * Airflow)

    const fanRatio = fanSpeed / 100;
    const fanEfficiency = 0.2 + 0.8 * Math.pow(fanRatio, 1.2);
    const airflowPenalty = 1 - ((1 - airflowQuality) * 0.4);
    const coolerConductivity = (cooling.heatDissipation / 60);

    const requiredDelta = heatLoad / (coolerConductivity * fanEfficiency * airflowPenalty);

    return ambientTemp + requiredDelta;
}

/**
 * Update thermal simulation state
 */
export function updateThermalState(state, params) {
    const {
        cpuPower, gpuPower, memoryHeat, psuHeatWaste, storageHeat,
        cooling, fanCount, maxCpuTemp, throttleTemp,
        airflowQuality, deltaTime = 0.1
    } = params;

    const ambientTemp = state.ambientTemp;

    // 1. Calculate Heat Input
    const heat = calculateHeatGenerated(cpuPower, gpuPower, memoryHeat, psuHeatWaste, storageHeat);

    // 2. Determine Fan Speed (Reactionary)
    // Fans react to current CPU temp
    const targetFanSpeed = calculateFanSpeed(state.cpuTemp, maxCpuTemp, ambientTemp);
    // Fan inertia - fans don't spin up instantly
    const fanResponseRate = 0.1 * deltaTime * 10; // ~1 second to spin up
    const fanSpeed = state.fanSpeed + (targetFanSpeed - state.fanSpeed) * fanResponseRate;

    // 3. Calculate Dissipation
    const currentDelta = state.cpuTemp - ambientTemp;
    const dissipation = calculateCoolingPerformance(cooling, fanCount, fanSpeed, airflowQuality, currentDelta);

    // 4. Calculate Temperature Delta
    // Rate of change = Net Heat / Thermal Mass
    // Net Heat = Heat Input - Dissipation
    const netHeat = heat.cpu - dissipation;

    // Thermal mass depends on cooler
    // Liquid coolers have high mass (water), Air coolers lower
    const coolerMass = cooling ? cooling.thermalMass * 500 : 100;
    const totalThermalMass = THERMAL_CONSTANTS.CPU_THERMAL_MASS * 100 + coolerMass;

    // Temp change = (Net Watts / Joules per degree) * time
    const tempChange = (netHeat / totalThermalMass) * deltaTime;

    let newCpuTemp = state.cpuTemp + tempChange;

    // Clamp min temp to ambient (simplified physics, ignoring phase change etc)
    newCpuTemp = Math.max(ambientTemp, newCpuTemp);

    // 5. Throttling Logic
    // Gradual onset
    const throttleThreshold = throttleTemp || (maxCpuTemp - 5);
    let newThrottlePercent = state.throttlePercent;

    if (newCpuTemp > throttleThreshold) {
        const over = newCpuTemp - throttleThreshold;
        // Ramp up throttle based on overshoot
        const targetThrottle = Math.min(100, over * 5); // 5% per degree over
        newThrottlePercent = state.throttlePercent + (targetThrottle - state.throttlePercent) * 0.1;
    } else if (state.throttlePercent > 0) {
        // Ramp down slowly (hysteresis)
        newThrottlePercent = state.throttlePercent * 0.95;
        if (newThrottlePercent < 0.5) newThrottlePercent = 0;
    }

    // 6. Case Temp Simulation
    // Case warms up from total system heat, cools down via airflow
    const caseHeatInput = heat.system + (heat.cpu + heat.gpu) * 0.2; // Some component heat leaks to case
    const caseExhaust = (fanCount * 10 * airflowQuality) * (state.caseTemp - ambientTemp);
    const caseNet = caseHeatInput - caseExhaust;
    const newCaseTemp = state.caseTemp + (caseNet / 1000) * deltaTime;

    // 7. Equilibrium Projection
    // What temp would we stabilize at with CURRENT fan speed?
    const equilibriumTemp = calculateEquilibriumTemp(heat.cpu, cooling, fanCount, fanSpeed, airflowQuality, ambientTemp);

    // History
    const timestamp = Date.now();
    // Only push to history if time has advanced significantly (handled by simulation.js throttling)

    return {
        ...state,
        cpuTemp: newCpuTemp,
        caseTemp: newCaseTemp,
        fanSpeed,
        throttlePercent: newThrottlePercent,
        isThrottling: newThrottlePercent > 0,
        heatGenerated: heat.cpu,
        heatDissipated: dissipation,
        equilibriumTemp: equilibriumTemp,
        // noise level
        noiseLevel: calculateNoise(cooling, fanSpeed, fanCount)
    };
}

function calculateFanSpeed(currentTemp, maxTemp, ambientTemp) {
    // Fan curve
    const idleTemp = ambientTemp + 10;
    const loadTemp = maxTemp - 10;

    if (currentTemp < idleTemp) return THERMAL_CONSTANTS.MIN_FAN_SPEED;
    if (currentTemp >= maxTemp) return 100;

    // Linear interpolation between idle and load
    const pct = (currentTemp - idleTemp) / (loadTemp - idleTemp);
    const curve = Math.pow(pct, 1.5); // Aggressive curve
    return THERMAL_CONSTANTS.MIN_FAN_SPEED + curve * (100 - THERMAL_CONSTANTS.MIN_FAN_SPEED);
}

function calculateNoise(cooling, fanSpeed, fanCount) {
    if (!cooling) return 30;
    const speedRatio = fanSpeed / 100;
    const baseNoise = cooling.noiseBaseline + (cooling.noiseMax - cooling.noiseBaseline) * speedRatio;
    // Adding fans adds 3dB per doubling
    const fanAdder = 3 * Math.log2(Math.max(1, fanCount));
    return baseNoise + fanAdder;
}

export function setAmbientTemp(state, temp) {
    return { ...state, ambientTemp: temp };
}

export function getThermalExplanation(state, cooling, maxTemp) {
    if (!cooling) return "No cooling selected.";

    const { equilibriumTemp, ambientTemp, heatGenerated, heatDissipated } = state;
    const delta = equilibriumTemp - ambientTemp;
    const capacityPct = (heatGenerated / cooling.heatDissipation) * 100;

    if (equilibriumTemp > maxTemp) {
        return `Warning: Equilibrium temperature (${equilibriumTemp.toFixed(1)}°C) exceeds thermal limit. Throttling will limit performance. Cooling capacity insufficient for this load (${capacityPct.toFixed(0)}%).`;
    }

    if (delta > 50) {
        return `High thermal load. Equilibrium at ${equilibriumTemp.toFixed(1)}°C. High fan speeds expected.`;
    }

    return `Stable operation. Equilibrium at ${equilibriumTemp.toFixed(1)}°C. Cooling system adequate (${capacityPct.toFixed(0)}% load).`;
}
