/**
 * Warnings Module - Enhanced
 * Generates detailed system warnings
 */

const THRESHOLDS = {
    psuLoad: { warning: 80, danger: 95 },
    psuTransient: { warning: 90, danger: 105 },
    temperature: { warning: 0.85, danger: 0.95 }
};

export const WarningType = {
    PSU_LOAD_HIGH: 'psu_load_high',
    PSU_LOAD_CRITICAL: 'psu_load_critical',
    PSU_TRANSIENT: 'psu_transient',
    THERMAL_THROTTLE: 'thermal_throttle',
    THERMAL_WARNING: 'thermal_warning',
    COOLING_INSUFFICIENT: 'cooling_insufficient',
    BOOST_ENDED: 'boost_ended'
};

function checkPsuLoadWarning(sustainedLoad) {
    if (sustainedLoad >= THRESHOLDS.psuLoad.danger) {
        return {
            type: WarningType.PSU_LOAD_CRITICAL,
            severity: 'danger',
            title: 'PSU Overload Risk',
            message: `Sustained load at ${sustainedLoad.toFixed(0)}% exceeds safe operating limits. The PSU may trigger overcurrent protection or experience accelerated wear. Modern power supplies are rated for continuous operation at 100% but with reduced lifespan and lower efficiency.`,
            value: sustainedLoad
        };
    }

    if (sustainedLoad >= THRESHOLDS.psuLoad.warning) {
        return {
            type: WarningType.PSU_LOAD_HIGH,
            severity: 'warning',
            title: 'High PSU Load',
            message: `Sustained load at ${sustainedLoad.toFixed(0)}% leaves minimal headroom for transient spikes. PSU efficiency decreases at high loads, generating more waste heat. Recommended to maintain under 80% for sustained operation.`,
            value: sustainedLoad
        };
    }

    return null;
}

function checkPsuTransientWarning(transientLoad, sustainedLoad, psu) {
    const transientResponse = psu?.transientResponse || 0.85;
    const effectiveLimit = 100 + (transientResponse - 0.8) * 50;

    if (transientLoad >= effectiveLimit) {
        return {
            type: WarningType.PSU_TRANSIENT,
            severity: 'danger',
            title: 'Transient Spike Instability',
            message: `GPU transient power spikes reaching ${transientLoad.toFixed(0)}% of PSU capacity may trigger overcurrent protection. Modern GPUs exhibit microsecond-scale power surges 1.5-2x above average draw during load changes. A higher wattage or higher quality PSU with better transient response is recommended.`,
            value: transientLoad
        };
    }

    if (transientLoad >= THRESHOLDS.psuTransient.warning && transientLoad > sustainedLoad + 10) {
        return {
            type: WarningType.PSU_TRANSIENT,
            severity: 'warning',
            title: 'Transient Spike Concern',
            message: `GPU transient spikes reaching ${transientLoad.toFixed(0)}% of PSU capacity. While within nominal limits, minimal margin exists for additional transients. High-quality PSUs with robust transient response handle this better.`,
            value: transientLoad
        };
    }

    return null;
}

function checkThermalWarning(cpuTemp, maxTemp, throttleTemp, isThrottling, throttlePercent) {
    if (isThrottling) {
        return {
            type: WarningType.THERMAL_THROTTLE,
            severity: 'danger',
            title: 'Thermal Throttling Active',
            message: `CPU temperature at ${cpuTemp.toFixed(0)}°C has triggered protective thermal throttling. Clock speeds and power draw reduced by ${throttlePercent.toFixed(0)}% to prevent thermal damage. This indicates cooling capacity is insufficient for the current workload. Temperature will stabilize but performance is degraded.`,
            value: cpuTemp
        };
    }

    const tempRatio = cpuTemp / maxTemp;
    if (tempRatio >= THRESHOLDS.temperature.warning) {
        return {
            type: WarningType.THERMAL_WARNING,
            severity: 'warning',
            title: 'Elevated Temperature',
            message: `CPU temperature at ${cpuTemp.toFixed(0)}°C approaching thermal limit of ${maxTemp}°C. Throttling will activate at ${throttleTemp || maxTemp - 5}°C. Consider improved cooling, better case airflow, or reduced ambient temperature.`,
            value: cpuTemp
        };
    }

    return null;
}

function checkCoolingWarning(heatGenerated, coolingCapacity, heatDissipated, equilibriumTemp, maxTemp) {
    if (equilibriumTemp > maxTemp) {
        return {
            type: WarningType.COOLING_INSUFFICIENT,
            severity: 'danger',
            title: 'Cooling Capacity Exceeded',
            message: `Projected equilibrium temperature (${equilibriumTemp.toFixed(0)}°C) exceeds CPU thermal limit (${maxTemp}°C). Current cooling solution cannot adequately dissipate ${heatGenerated.toFixed(0)}W of heat. System will thermally throttle indefinitely under this workload.`,
            value: equilibriumTemp
        };
    }

    if (heatGenerated > coolingCapacity * 0.85 && equilibriumTemp > maxTemp - 10) {
        return {
            type: WarningType.COOLING_INSUFFICIENT,
            severity: 'warning',
            title: 'Cooling Near Capacity',
            message: `Cooling solution operating at ${((heatGenerated / coolingCapacity) * 100).toFixed(0)}% of rated capacity. Heat generation of ${heatGenerated.toFixed(0)}W approaches cooler limits. Equilibrium temperature of ${equilibriumTemp.toFixed(0)}°C provides minimal thermal headroom.`,
            value: heatGenerated
        };
    }

    return null;
}

/**
 * Generate all warnings
 */
export function generateWarnings(state) {
    const warnings = [];
    const { power, thermal, psuInfo, psu, cooling, cpu, gpu } = state;

    if (!power || !thermal || !psuInfo) return warnings;

    // PSU warnings
    const psuLoadWarning = checkPsuLoadWarning(psuInfo.loadPercent);
    if (psuLoadWarning) warnings.push(psuLoadWarning);

    const psuTransientWarning = checkPsuTransientWarning(psuInfo.transientLoad, psuInfo.loadPercent, psu);
    if (psuTransientWarning) warnings.push(psuTransientWarning);

    // Thermal warnings
    const thermalWarning = checkThermalWarning(
        thermal.cpuTemp,
        cpu?.maxSafeTemp || 90,
        cpu?.throttleTemp || 95,
        thermal.isThrottling,
        thermal.throttlePercent
    );
    if (thermalWarning) warnings.push(thermalWarning);

    // Cooling warnings
    const coolingWarning = checkCoolingWarning(
        thermal.heatGenerated,
        cooling?.heatDissipation || 100,
        thermal.heatDissipated,
        thermal.equilibriumTemp,
        cpu?.maxSafeTemp || 90
    );
    if (coolingWarning) warnings.push(coolingWarning);

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
