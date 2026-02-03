/**
 * Thermal Simulation Module - Comprehensive
 * Time-based thermal behavior with asymptotic equilibrium approach
 * All cooling and airflow parameters affect behavior meaningfully
 */

// Thermal Constants
const THERMAL_CONSTANTS = {
    // Base thermal mass of CPU package/IHS (small, responds quickly)
    CPU_PACKAGE_MASS: 0.03,
    // Rate constants
    MIN_FAN_SPEED: 20,
    // Case thermal characteristics
    CASE_THERMAL_MASS: 500, // Large mass, changes slowly
    // Asymptotic approach rate constant
    APPROACH_RATE: 0.05
};

/**
 * Create initial thermal state
 */
export function createThermalState(ambientTemp = 25) {
    return {
        cpuTemp: ambientTemp,
        gpuTemp: ambientTemp,
        caseTemp: ambientTemp + 2, // Slight offset from ambient
        coolantTemp: ambientTemp,
        ambientTemp: ambientTemp,
        throttlePercent: 0,
        isThrottling: false,
        fanSpeed: THERMAL_CONSTANTS.MIN_FAN_SPEED,
        noiseLevel: 20,
        heatGenerated: 0,
        heatDissipated: 0,
        equilibriumTemp: ambientTemp,
        coolingCapacity: 100,
        thermalHeadroom: 100,
        timeToEquilibrium: 0,
        explanation: ''
    };
}

/**
 * Calculate raw heat generation from all components
 */
export function calculateHeatGenerated(params) {
    const { cpuPower, gpuPower, memoryHeat, psuHeatWaste, storageHeat = 0 } = params;

    // Nearly 100% of electrical power becomes heat
    const cpuHeat = cpuPower;
    const gpuHeat = gpuPower;

    // Memory/storage heat scaled appropriately
    const memHeat = (memoryHeat || 0) * 40;
    const storeHeat = (storageHeat || 0) * 30;

    return {
        total: cpuHeat + gpuHeat + memHeat + psuHeatWaste + storeHeat,
        cpu: cpuHeat,
        gpu: gpuHeat,
        memory: memHeat,
        storage: storeHeat,
        psu: psuHeatWaste,
        system: memHeat + psuHeatWaste + storeHeat
    };
}

/**
 * Calculate effective cooling capacity considering all factors
 * Returns watts of heat that can be dissipated at a given temperature delta
 */
export function calculateCoolingCapacity(cooling, fanCount, fanSpeed, airflowQuality, caseTemp) {
    if (!cooling) return { capacity: 100, effectiveness: 0.5 };

    // Base cooler capacity
    const baseCapacity = cooling.heatDissipation;

    // Fan speed affects cooling (not linear - law of diminishing returns at high speeds)
    const fanRatio = fanSpeed / 100;
    const fanEfficiency = 0.15 + 0.85 * Math.pow(fanRatio, 1.1);

    // Airflow quality significantly affects cooler performance
    // Poor airflow = hot air recirculates = reduced ΔT potential
    const airflowPenalty = 0.5 + (airflowQuality * 0.5);

    // Case fans improve airflow, diminishing returns
    const fanBonus = 1 + Math.log2(Math.max(1, fanCount)) * 0.06;

    // Elevated case temp reduces cooling potential
    // If case is 10°C over ambient, cooler loses ~15% effectiveness
    const caseTempPenalty = caseTemp > 35 ? 1 - ((caseTemp - 35) * 0.015) : 1;

    // Cooler's inherent effectiveness rating
    const coolerEffectiveness = cooling.airflowEffectiveness || 0.8;

    const effectiveCapacity = baseCapacity * fanEfficiency * airflowPenalty * fanBonus * caseTempPenalty * coolerEffectiveness;

    return {
        capacity: Math.max(50, effectiveCapacity),
        baseCapacity,
        effectiveness: fanEfficiency * airflowPenalty * fanBonus * caseTempPenalty * coolerEffectiveness,
        breakdown: {
            fanEfficiency,
            airflowPenalty,
            fanBonus,
            caseTempPenalty,
            coolerEffectiveness
        }
    };
}

/**
 * Calculate equilibrium temperature - the temperature the system will stabilize at
 * Uses inverse relationship: higher heat load = higher delta from ambient
 */
export function calculateEquilibriumTemp(cpuHeat, cooling, fanCount, fanSpeed, airflowQuality, ambientTemp, caseTemp) {
    if (!cooling || cpuHeat <= 0) return ambientTemp;

    const coolingData = calculateCoolingCapacity(cooling, fanCount, fanSpeed, airflowQuality, caseTemp);
    const effectiveCapacity = coolingData.capacity;

    // At equilibrium: Heat In = Heat Out
    // Heat Out = Conductivity × (T_cpu - T_ambient)
    // Therefore: T_cpu = T_ambient + Heat_In / Conductivity

    // Convert capacity to conductivity (W per °C of delta)
    // If cooler can dissipate 250W at 60°C delta, conductivity = 250/60 ≈ 4.17 W/°C
    const referenceDetla = 60; // Typical design point
    const conductivity = effectiveCapacity / referenceDetla;

    // Equilibrium delta
    const requiredDelta = cpuHeat / conductivity;

    // Add case temp influence (elevated case temp raises floor)
    const caseTempOffset = Math.max(0, (caseTemp - ambientTemp) * 0.3);

    return ambientTemp + requiredDelta + caseTempOffset;
}

/**
 * Calculate time to reach equilibrium (in simulated seconds)
 */
export function calculateTimeToEquilibrium(currentTemp, equilibriumTemp, thermalMass) {
    const delta = Math.abs(equilibriumTemp - currentTemp);
    if (delta < 1) return 0;

    // Time constant based on thermal mass
    // Larger thermal mass = longer time
    const timeConstant = thermalMass * 200; // seconds

    // Time to reach ~95% of way to equilibrium (3 time constants)
    return timeConstant * 3;
}

/**
 * Calculate fan speed based on temperature curve
 */
function calculateFanSpeed(currentTemp, maxSafeTemp, ambientTemp, cooling) {
    const idleTemp = ambientTemp + 12;   // Where fan starts ramping
    const loadTemp = maxSafeTemp - 8;    // Near max = full speed

    if (currentTemp <= idleTemp) {
        return THERMAL_CONSTANTS.MIN_FAN_SPEED;
    }
    if (currentTemp >= maxSafeTemp) {
        return 100;
    }
    if (currentTemp >= loadTemp) {
        // Aggressive ramp in danger zone
        const overshoot = (currentTemp - loadTemp) / (maxSafeTemp - loadTemp);
        return 85 + overshoot * 15;
    }

    // Normal curve - slightly aggressive
    const range = loadTemp - idleTemp;
    const position = (currentTemp - idleTemp) / range;
    const curve = Math.pow(position, 1.3); // Slightly aggressive curve

    return THERMAL_CONSTANTS.MIN_FAN_SPEED + curve * (85 - THERMAL_CONSTANTS.MIN_FAN_SPEED);
}

/**
 * Calculate noise level based on cooling solution and fan speed
 */
function calculateNoise(cooling, fanSpeed, fanCount) {
    if (!cooling) return 30;

    const speedRatio = fanSpeed / 100;

    // Cooler base noise + fan curve
    const coolerNoise = cooling.noiseBaseline + (cooling.noiseMax - cooling.noiseBaseline) * Math.pow(speedRatio, 1.8);

    // Adding case fans adds ~2dB per doubling (less than pure additive)
    const fanAdder = 2 * Math.log2(Math.max(1, fanCount));

    return coolerNoise + fanAdder;
}

/**
 * Update thermal simulation state - asymptotic approach to equilibrium
 */
export function updateThermalState(state, params) {
    const {
        cpuPower, gpuPower, memoryHeat, psuHeatWaste, storageHeat,
        cooling, fanCount, maxCpuTemp, throttleTemp,
        airflowQuality, deltaTime = 0.1
    } = params;

    const ambientTemp = state.ambientTemp;

    // 1. Calculate total heat being generated
    const heat = calculateHeatGenerated({
        cpuPower, gpuPower, memoryHeat, psuHeatWaste, storageHeat
    });

    // 2. Calculate fan response (fans respond to current temp, with inertia)
    const targetFanSpeed = calculateFanSpeed(state.cpuTemp, maxCpuTemp, ambientTemp, cooling);
    const fanResponseRate = 0.08 * deltaTime * 10; // ~1.2 seconds to spin up
    const fanSpeed = state.fanSpeed + (targetFanSpeed - state.fanSpeed) * fanResponseRate;

    // 3. Calculate cooling capacity
    const coolingData = calculateCoolingCapacity(
        cooling, fanCount, fanSpeed, airflowQuality, state.caseTemp
    );

    // 4. Calculate equilibrium temperature (where we're heading)
    const equilibriumTemp = calculateEquilibriumTemp(
        heat.cpu, cooling, fanCount, fanSpeed, airflowQuality, ambientTemp, state.caseTemp
    );

    // 5. ASYMPTOTIC TEMPERATURE APPROACH
    // Temperature changes faster when far from equilibrium, slower when close
    // This creates realistic thermal behavior

    // Thermal mass combines CPU package and cooler
    const coolerMass = cooling ? cooling.thermalMass : 0.1;
    const responseTime = cooling ? (cooling.responseTime || 2.0) : 1.0;
    const totalThermalMass = THERMAL_CONSTANTS.CPU_PACKAGE_MASS + coolerMass;

    // Asymptotic approach: T(t+dt) = T(t) + (T_eq - T(t)) * (1 - e^(-dt/τ))
    // Simplified to: T(t+dt) = T(t) + (T_eq - T(t)) * rate
    // Rate decreases as we approach equilibrium

    const tempDiff = equilibriumTemp - state.cpuTemp;
    const approachRate = THERMAL_CONSTANTS.APPROACH_RATE / (totalThermalMass * responseTime);
    const tempChange = tempDiff * approachRate * deltaTime;

    let newCpuTemp = state.cpuTemp + tempChange;

    // Clamp to minimum of ambient
    newCpuTemp = Math.max(ambientTemp, newCpuTemp);

    // 6. Calculate actual heat dissipation (for display)
    const currentDelta = newCpuTemp - ambientTemp;
    const conductivity = coolingData.capacity / 60;
    const heatDissipated = conductivity * currentDelta;

    // 7. Throttling Logic - Gradual onset
    const effectiveThrottleTemp = throttleTemp || (maxCpuTemp - 5);
    let newThrottlePercent = state.throttlePercent;

    if (newCpuTemp > effectiveThrottleTemp) {
        // Throttle ramps up based on how far over we are
        const over = newCpuTemp - effectiveThrottleTemp;
        const targetThrottle = Math.min(95, over * 4); // 4% per degree over
        // Ramp up moderately fast
        newThrottlePercent = state.throttlePercent + (targetThrottle - state.throttlePercent) * 0.15;
    } else if (newCpuTemp < effectiveThrottleTemp - 3 && state.throttlePercent > 0) {
        // Hysteresis: start releasing throttle only when significantly below threshold
        newThrottlePercent = state.throttlePercent * 0.92;
        if (newThrottlePercent < 0.5) newThrottlePercent = 0;
    }

    // 8. Case Temperature Simulation
    // Case warms from internal heat, cools via case fans
    const internalHeat = heat.system + (heat.cpu + heat.gpu) * 0.15; // Some CPU/GPU heat leaks to case
    const caseExhaustRate = (fanCount * 12 * airflowQuality);
    const caseCooling = caseExhaustRate * (state.caseTemp - ambientTemp);
    const caseNetHeat = internalHeat - caseCooling;
    const newCaseTemp = state.caseTemp + (caseNetHeat / THERMAL_CONSTANTS.CASE_THERMAL_MASS) * deltaTime;

    // 9. Calculate time to equilibrium
    const timeToEq = calculateTimeToEquilibrium(newCpuTemp, equilibriumTemp, totalThermalMass);

    // 10. Calculate thermal headroom
    const thermalHeadroom = Math.max(0, maxCpuTemp - equilibriumTemp);

    // 11. Generate explanation
    const explanation = generateThermalExplanation({
        cpuTemp: newCpuTemp,
        equilibriumTemp,
        maxCpuTemp,
        throttleTemp: effectiveThrottleTemp,
        isThrottling: newThrottlePercent > 0,
        throttlePercent: newThrottlePercent,
        heatGenerated: heat.cpu,
        coolingCapacity: coolingData.capacity,
        thermalHeadroom,
        fanSpeed,
        cooling
    });

    return {
        ...state,
        cpuTemp: newCpuTemp,
        gpuTemp: ambientTemp + (gpuPower / 4), // Simplified GPU temp model
        caseTemp: Math.max(ambientTemp, Math.min(newCaseTemp, ambientTemp + 25)),
        fanSpeed,
        throttlePercent: newThrottlePercent,
        isThrottling: newThrottlePercent > 0,
        heatGenerated: heat.cpu,
        heatDissipated,
        equilibriumTemp,
        coolingCapacity: coolingData.capacity,
        thermalHeadroom,
        timeToEquilibrium: timeToEq,
        noiseLevel: calculateNoise(cooling, fanSpeed, fanCount),
        explanation
    };
}

/**
 * Generate dynamic thermal explanation based on current state
 */
function generateThermalExplanation(params) {
    const {
        cpuTemp, equilibriumTemp, maxCpuTemp, throttleTemp,
        isThrottling, throttlePercent, heatGenerated, coolingCapacity,
        thermalHeadroom, fanSpeed, cooling
    } = params;

    if (!cooling) return 'No cooling solution selected.';

    const capacityPercent = (heatGenerated / coolingCapacity) * 100;

    if (isThrottling) {
        return `Thermal throttling active at ${throttlePercent.toFixed(0)}%. CPU temperature (${cpuTemp.toFixed(1)}°C) has exceeded the throttle threshold (${throttleTemp}°C). The system is reducing clockspeeds to limit heat generation. Current cooling is handling ${capacityPercent.toFixed(0)}% of maximum capacity. Upgrade cooling or reduce workload intensity.`;
    }

    if (equilibriumTemp > maxCpuTemp) {
        return `Warning: Projected equilibrium (${equilibriumTemp.toFixed(1)}°C) exceeds CPU thermal limit (${maxCpuTemp}°C). The ${cooling.name} cannot dissipate ${heatGenerated.toFixed(0)}W of heat fast enough. Throttling will occur until heat output is reduced. Consider a more capable cooling solution.`;
    }

    if (thermalHeadroom < 5) {
        return `Near thermal limits. Equilibrium temperature ${equilibriumTemp.toFixed(1)}°C leaves only ${thermalHeadroom.toFixed(0)}°C headroom to ${maxCpuTemp}°C limit. Fan speed at ${fanSpeed.toFixed(0)}%. Additional workload or higher ambient temperature may trigger throttling.`;
    }

    if (capacityPercent > 80) {
        return `High thermal load using ${capacityPercent.toFixed(0)}% of cooling capacity. Temperature stabilizing at ${equilibriumTemp.toFixed(1)}°C with ${thermalHeadroom.toFixed(0)}°C headroom. ${fanSpeed > 70 ? 'Fans running at elevated speeds to maintain stability.' : ''}`;
    }

    if (cpuTemp < equilibriumTemp - 5) {
        const direction = 'rising toward';
        return `Temperature ${direction} equilibrium at ${equilibriumTemp.toFixed(1)}°C. Currently at ${cpuTemp.toFixed(1)}°C. The ${cooling.name} is absorbing heat (thermal mass soak). ${thermalHeadroom.toFixed(0)}°C headroom below ${maxCpuTemp}°C limit.`;
    }

    if (cpuTemp > equilibriumTemp + 3) {
        return `Temperature decreasing toward equilibrium at ${equilibriumTemp.toFixed(1)}°C. Heat dissipation exceeds current generation. Workload change detected.`;
    }

    return `Stable operation at ${cpuTemp.toFixed(1)}°C. Equilibrium at ${equilibriumTemp.toFixed(1)}°C with ${thermalHeadroom.toFixed(0)}°C headroom. Cooling system at ${capacityPercent.toFixed(0)}% capacity. Fan speed ${fanSpeed.toFixed(0)}%.`;
}

export function setAmbientTemp(state, temp) {
    return { ...state, ambientTemp: temp };
}

/**
 * Get thermal explanation for external use
 */
export function getThermalExplanation(state, cooling, maxTemp) {
    if (!cooling) return 'No cooling solution selected.';
    return state.explanation || 'Thermal analysis initializing...';
}
