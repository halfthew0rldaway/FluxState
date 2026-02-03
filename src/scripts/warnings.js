/**
 * Warnings Module - Comprehensive
 * Generates detailed, contextual system warnings
 */

const THRESHOLDS = {
    psuLoad: { info: 65, warning: 80, danger: 95 },
    psuTransient: { warning: 90, danger: 105 },
    temperature: { warning: 0.85, danger: 0.95 },
    cooling: { warning: 0.85, danger: 1.0 }
};

export const WarningType = {
    PSU_LOAD_HIGH: 'psu_load_high',
    PSU_LOAD_CRITICAL: 'psu_load_critical',
    PSU_TRANSIENT: 'psu_transient',
    THERMAL_THROTTLE: 'thermal_throttle',
    THERMAL_WARNING: 'thermal_warning',
    COOLING_INSUFFICIENT: 'cooling_insufficient',
    COOLING_MARGINAL: 'cooling_marginal',
    MEMORY_INCOMPATIBLE: 'memory_incompatible',
    EQUILIBRIUM_EXCEEDED: 'equilibrium_exceeded',
    BOOST_ENDED: 'boost_ended'
};

function checkPsuLoadWarning(sustainedLoad, psu) {
    if (sustainedLoad >= THRESHOLDS.psuLoad.danger) {
        return {
            type: WarningType.PSU_LOAD_CRITICAL,
            severity: 'danger',
            title: 'PSU Overload Risk',
            message: `Sustained load at ${sustainedLoad.toFixed(0)}% exceeds safe limits. The ${psu?.name || 'PSU'} may trigger overcurrent protection (OCP) or experience accelerated degradation. Modern power supplies can technically deliver 100% continuously but efficiency drops and lifespan is reduced. Consider a higher wattage unit.`,
            value: sustainedLoad
        };
    }

    if (sustainedLoad >= THRESHOLDS.psuLoad.warning) {
        return {
            type: WarningType.PSU_LOAD_HIGH,
            severity: 'warning',
            title: 'High PSU Load',
            message: `Sustained load at ${sustainedLoad.toFixed(0)}% leaves minimal headroom for GPU transient spikes. PSU efficiency peaks around 50% load—higher loads increase waste heat and reduce efficiency. For sustained heavy workloads, recommend upgrading to a higher wattage PSU.`,
            value: sustainedLoad
        };
    }

    return null;
}

function checkPsuTransientWarning(transientLoad, sustainedLoad, psu) {
    const transientResponse = psu?.transientResponse || 0.8;
    // Higher quality PSUs handle bigger transients
    const effectiveLimit = 100 + (transientResponse - 0.7) * 80;

    if (transientLoad >= effectiveLimit) {
        return {
            type: WarningType.PSU_TRANSIENT,
            severity: 'danger',
            title: 'Transient Spike Instability',
            message: `GPU transient spikes reaching ${transientLoad.toFixed(0)}% of PSU capacity may trigger overcurrent protection, causing system shutdowns. Modern high-end GPUs (RTX 30/40, RX 6000/7000 series) exhibit microsecond power spikes 1.5-2× above average draw during load transitions. The ${psu?.name || 'PSU'} transient response rating (${(transientResponse * 100).toFixed(0)}%) is insufficient. Upgrade to a higher wattage or higher tier unit with better transient handling.`,
            value: transientLoad
        };
    }

    if (transientLoad >= THRESHOLDS.psuTransient.warning && transientLoad > sustainedLoad + 10) {
        return {
            type: WarningType.PSU_TRANSIENT,
            severity: 'warning',
            title: 'Transient Spike Concern',
            message: `GPU transient spikes reaching ${transientLoad.toFixed(0)}% of rated capacity. While within limits, minimal margin exists. Gaming workloads with rapid scene changes may cause momentary voltage dips. High-quality ${psu?.rating || '80+'} PSUs with robust transient response handle this better.`,
            value: transientLoad
        };
    }

    return null;
}

function checkThermalWarning(cpuTemp, maxTemp, throttleTemp, isThrottling, throttlePercent, equilibriumTemp) {
    if (isThrottling) {
        const perfLoss = throttlePercent.toFixed(0);
        return {
            type: WarningType.THERMAL_THROTTLE,
            severity: 'danger',
            title: 'Thermal Throttling Active',
            message: `CPU temperature at ${cpuTemp.toFixed(1)}°C has exceeded the throttle threshold (${throttleTemp}°C). Protective thermal throttling is reducing clocks and power draw by ${perfLoss}%. Performance is degraded to prevent thermal damage. Temperature will stabilize but at reduced performance. Improve cooling, reduce ambient temperature, or lower workload intensity.`,
            value: cpuTemp
        };
    }

    const tempRatio = cpuTemp / maxTemp;
    if (tempRatio >= THRESHOLDS.temperature.warning) {
        return {
            type: WarningType.THERMAL_WARNING,
            severity: 'warning',
            title: 'Elevated Temperature',
            message: `CPU temperature at ${cpuTemp.toFixed(1)}°C approaching thermal limit of ${maxTemp}°C. Throttling will begin at ${throttleTemp}°C. Consider improving case airflow, adding fans, or upgrading the CPU cooler. High ambient temperatures also reduce thermal headroom.`,
            value: cpuTemp
        };
    }

    return null;
}

function checkEquilibriumWarning(equilibriumTemp, maxTemp, heatGenerated, coolingCapacity, cooling) {
    if (equilibriumTemp > maxTemp) {
        const overBy = (equilibriumTemp - maxTemp).toFixed(0);
        return {
            type: WarningType.EQUILIBRIUM_EXCEEDED,
            severity: 'danger',
            title: 'Cooling Capacity Exceeded',
            message: `Projected equilibrium temperature (${equilibriumTemp.toFixed(1)}°C) exceeds CPU thermal limit (${maxTemp}°C) by ${overBy}°C. The ${cooling?.name || 'current cooler'} cannot adequately dissipate ${heatGenerated.toFixed(0)}W of heat. System will thermally throttle indefinitely under this workload. Upgrade to a more capable cooling solution or reduce CPU power limits in BIOS.`,
            value: equilibriumTemp
        };
    }

    return null;
}

function checkCoolingWarning(heatGenerated, coolingCapacity, equilibriumTemp, maxTemp, cooling) {
    if (!cooling) return null;

    const capacityRatio = heatGenerated / coolingCapacity;

    if (capacityRatio >= THRESHOLDS.cooling.danger - 0.1 && equilibriumTemp > maxTemp - 8) {
        return {
            type: WarningType.COOLING_MARGINAL,
            severity: 'warning',
            title: 'Cooling Near Capacity',
            message: `The ${cooling.name} is operating at ${(capacityRatio * 100).toFixed(0)}% of effective capacity. Heat generation (${heatGenerated.toFixed(0)}W) approaches the cooler's limits. Equilibrium temperature of ${equilibriumTemp.toFixed(1)}°C provides only ${(maxTemp - equilibriumTemp).toFixed(0)}°C of thermal headroom. Additional load, higher ambient temps, or sustained boost may trigger throttling.`,
            value: heatGenerated
        };
    }

    // Check if cooler is undersized for the CPU
    if (cooling.maxRecommendedTdp && heatGenerated > cooling.maxRecommendedTdp) {
        return {
            type: WarningType.COOLING_INSUFFICIENT,
            severity: 'warning',
            title: 'Cooler Undersized',
            message: `Current heat output (${heatGenerated.toFixed(0)}W) exceeds the ${cooling.name}'s recommended TDP of ${cooling.maxRecommendedTdp}W. While the system may function, thermals will be marginal under sustained loads. Consider a cooler rated for ${Math.ceil(heatGenerated / 50) * 50}W+ for optimal temperatures.`,
            value: heatGenerated
        };
    }

    return null;
}

function checkMemoryCompatibilityWarning(cpu, memory) {
    if (!cpu || !memory) return null;

    const supportedTypes = cpu.supportedMemory || ['DDR4'];

    if (!supportedTypes.includes(memory.type)) {
        return {
            type: WarningType.MEMORY_INCOMPATIBLE,
            severity: 'danger',
            title: 'Memory Incompatibility',
            message: `${cpu.name} (${cpu.generation}) only supports ${supportedTypes.join(' or ')} memory. The selected ${memory.name} is ${memory.type}, which is physically and electrically incompatible with this platform. ${cpu.supportedMemoryNote || ''}`,
            value: 0
        };
    }

    return null;
}

/**
 * Generate all warnings based on current system state
 */
export function generateWarnings(state) {
    const warnings = [];
    const { power, thermal, psuInfo, psu, cooling, cpu, gpu, memory, workload } = state;

    if (!power || !thermal || !psuInfo) return warnings;

    // Memory compatibility (critical)
    const memoryWarning = checkMemoryCompatibilityWarning(cpu, memory);
    if (memoryWarning) warnings.push(memoryWarning);

    // Equilibrium exceeded (before throttling occurs)
    if (cooling) {
        const equilibriumWarning = checkEquilibriumWarning(
            thermal.equilibriumTemp,
            cpu?.maxSafeTemp || 90,
            thermal.heatGenerated,
            thermal.coolingCapacity,
            cooling
        );
        if (equilibriumWarning) warnings.push(equilibriumWarning);
    }

    // Thermal warnings
    const thermalWarning = checkThermalWarning(
        thermal.cpuTemp,
        cpu?.maxSafeTemp || 90,
        cpu?.throttleTemp || 95,
        thermal.isThrottling,
        thermal.throttlePercent,
        thermal.equilibriumTemp
    );
    if (thermalWarning) warnings.push(thermalWarning);

    // Cooling capacity warnings
    const coolingWarning = checkCoolingWarning(
        thermal.heatGenerated,
        thermal.coolingCapacity || cooling?.heatDissipation || 100,
        thermal.equilibriumTemp,
        cpu?.maxSafeTemp || 90,
        cooling
    );
    if (coolingWarning) warnings.push(coolingWarning);

    // PSU load warnings
    const psuLoadWarning = checkPsuLoadWarning(psuInfo.loadPercent, psu);
    if (psuLoadWarning) warnings.push(psuLoadWarning);

    // PSU transient warnings
    const psuTransientWarning = checkPsuTransientWarning(psuInfo.transientLoad, psuInfo.loadPercent, psu);
    if (psuTransientWarning) warnings.push(psuTransientWarning);

    return warnings;
}

export function getSeverityPriority(severity) {
    switch (severity) {
        case 'danger': return 3;
        case 'warning': return 2;
        case 'info': return 1;
        default: return 0;
    }
}

export function getHighestSeverity(warnings) {
    if (!warnings || warnings.length === 0) return 'none';

    const hasDanger = warnings.some(w => w.severity === 'danger');
    if (hasDanger) return 'danger';

    const hasWarning = warnings.some(w => w.severity === 'warning');
    if (hasWarning) return 'warning';

    return 'info';
}
