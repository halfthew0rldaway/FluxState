/**
 * Power Calculation Module - Enhanced
 * Calculates power draw for all system components based on hardware selection and workload
 */

// Workload profiles with detailed behavior
export const WORKLOAD_PROFILES = {
  idle: {
    name: 'Idle',
    description: 'Desktop idle, light browsing',
    cpuLoadType: 'idle',
    gpuLoadType: 'idle',
    memoryActivity: 0.1,
    storageActivity: 0.05,
    explanation: 'System at rest with minimal background activity. CPU and GPU run at lowest power states. Memory controllers in low-power mode. This represents a typical desktop scenario with no active applications.'
  },
  gaming: {
    name: 'Gaming',
    description: 'Typical gaming workload (GPU-bound)',
    cpuLoadType: 'gaming',
    gpuLoadType: 'gaming',
    memoryActivity: 0.5,
    storageActivity: 0.3,
    explanation: 'Gaming workloads are typically GPU-bound. The GPU runs near maximum while the CPU handles game logic, physics, and AI at moderate load. Modern games utilize 4-8 threads effectively. CPU power varies with game complexity and frame rate.'
  },
  rendering: {
    name: 'Rendering',
    description: 'CPU rendering, video encoding',
    cpuLoadType: 'rendering',
    gpuLoadType: 'rendering',
    memoryActivity: 0.8,
    storageActivity: 0.6,
    explanation: 'CPU rendering loads all cores at sustained high utilization. Initial burst power from turbo boost decays as thermal limits are reached. Temperature rises steadily until cooling capacity balances heat generation. GPU assists with hardware encoding or CUDA/OpenCL acceleration.'
  },
  compiling: {
    name: 'Compiling',
    description: 'Software compilation, build tasks',
    cpuLoadType: 'rendering',
    gpuLoadType: 'idle',
    memoryActivity: 0.7,
    storageActivity: 0.8,
    explanation: 'Compilation is CPU and I/O intensive. All cores engaged during parallel builds. Frequent storage access for reading source and writing output. Memory pressure from large projects. GPU remains idle unless compute shaders are compiled.'
  },
  stress: {
    name: 'Stress Test',
    description: 'Maximum sustained load (synthetic)',
    cpuLoadType: 'stress',
    gpuLoadType: 'stress',
    memoryActivity: 0.9,
    storageActivity: 0.5,
    explanation: 'Synthetic stress tests push components to absolute maximum sustained power. This represents worst-case thermal and power scenarios unrealistic in normal use. Useful for stability testing and validating cooling capacity. Expect rapid temperature rise and potential throttling with inadequate cooling.'
  }
};

// Power constants
export const FIXED_POWER = {
  motherboard: { idle: 25, load: 45 }, // Chipset + VRM losses
  peripherals: 8,
  rgb: 5,
  fanPerUnit: { min: 1.5, max: 4.5 } // Higher static pressure fans use more power
};

export const STORAGE_POWER = {
  nvme: { idle: 1.2, load: 6.5 },
  sata: { idle: 0.6, load: 3.5 },
  hdd: { idle: 4.5, load: 9.0 }
};

/**
 * Calculate CPU power draw based on workload and boost state
 */
export function calculateCpuPower(cpu, workload, boostState = {}) {
  if (!cpu) return { current: 0, target: 0, isBoost: false };

  const profile = WORKLOAD_PROFILES[workload];
  const loadType = profile.cpuLoadType;

  let targetPower;
  let isBoost = false;

  switch (loadType) {
    case 'idle':
      targetPower = cpu.idlePower;
      break;
    case 'gaming':
      targetPower = cpu.gamingPower;
      break;
    case 'rendering':
      if (boostState.boostTimeRemaining > 0 && cpu.shortBoostDuration > 0) {
        targetPower = cpu.shortBoostPower;
        isBoost = true;
      } else {
        targetPower = cpu.renderingPower;
      }
      break;
    case 'stress':
      if (boostState.boostTimeRemaining > 0 && cpu.shortBoostDuration > 0) {
        targetPower = cpu.shortBoostPower;
        isBoost = true;
      } else {
        targetPower = cpu.stressPower;
      }
      break;
    default:
      targetPower = cpu.lightLoadPower;
  }

  // Power smoothing
  const current = boostState.currentPower || targetPower;
  const transitionRate = 0.2;
  const newPower = current + (targetPower - current) * transitionRate;

  return {
    current: newPower,
    target: targetPower,
    isBoost: isBoost
  };
}

/**
 * Calculate GPU power draw based on workload
 */
export function calculateGpuPower(gpu, workload, ambientTemp = 25) {
  if (!gpu) return { sustained: 0, transient: 0 };

  const profile = WORKLOAD_PROFILES[workload];
  const loadType = profile.gpuLoadType;

  let basePower;
  switch (loadType) {
    case 'idle': basePower = gpu.idleDraw; break;
    case 'gaming': basePower = gpu.gamingDraw; break;
    case 'rendering': basePower = gpu.renderingDraw; break;
    case 'stress': basePower = gpu.stressDraw; break;
    default: basePower = gpu.idleDraw;
  }

  // Leakage power increases with temperature (approximated via ambient)
  // +1% power per 5C over 25C
  const tempScalar = 1 + Math.max(0, (ambientTemp - 25) / 500);
  const adjustedPower = basePower * tempScalar;

  // Transient spikes
  const transientPeak = loadType !== 'idle' ? adjustedPower * gpu.transientMultiplier : adjustedPower;

  return {
    sustained: Math.max(gpu.idleDraw, adjustedPower),
    transient: transientPeak
  };
}

/**
 * Calculate memory power based on configuration and activity
 */
export function calculateMemoryPower(memory, workload) {
  if (!memory) return { power: 5, heat: 0.02 };

  const profile = WORKLOAD_PROFILES[workload];
  const activity = profile.memoryActivity;

  // DDR3 draws more power at idle than DDR4/5
  const isOldGen = memory.type === 'DDR3';
  const genPenalty = isOldGen ? 1.5 : 1.0;

  const power = (memory.idlePower + (memory.loadPower - memory.idlePower) * activity) * genPenalty;
  const heat = memory.heatContribution * activity * genPenalty;

  return { power, heat };
}

/**
 * Calculate fixed component power draws
 */
export function calculateFixedPower(config, workload) {
  const profile = WORKLOAD_PROFILES[workload];
  const fanCount = config.fanCount || 3;
  const fanSpeed = config.fanSpeed || 50;

  // Motherboard power scales with activity
  const moboActivity = (profile.cpuLoadType === 'idle') ? 0 : 0.8;
  const motherboard = FIXED_POWER.motherboard.idle +
    (FIXED_POWER.motherboard.load - FIXED_POWER.motherboard.idle) * moboActivity;

  // Storage power based on specific types
  // Default to 1 NVMe if no specific config
  const storageConfig = config.storageConfig || { nvme: 1, sata: 0, hdd: 0 };
  const storageActivity = profile.storageActivity;

  const calcDrivePower = (count, spec) => {
    return count * (spec.idle + (spec.load - spec.idle) * storageActivity);
  };

  const storagePower =
    calcDrivePower(storageConfig.nvme, STORAGE_POWER.nvme) +
    calcDrivePower(storageConfig.sata, STORAGE_POWER.sata) +
    calcDrivePower(storageConfig.hdd, STORAGE_POWER.hdd);

  // Fans
  const fanSpeedRatio = fanSpeed / 100;
  const fanPowerEach = FIXED_POWER.fanPerUnit.min +
    (FIXED_POWER.fanPerUnit.max - FIXED_POWER.fanPerUnit.min) * Math.pow(fanSpeedRatio, 1.5); // Fan power is cubic/quadratic
  const fans = fanPowerEach * fanCount;

  return {
    motherboard,
    storage: storagePower,
    fans,
    peripherals: FIXED_POWER.peripherals,
    rgb: FIXED_POWER.rgb
  };
}

/**
 * Calculate total system power draw
 */
export function calculateTotalPower(config, boostState = {}) {
  const { cpu, gpu, memory, workload, ambientTemp } = config;

  const cpuPower = calculateCpuPower(cpu, workload, boostState);
  const gpuPower = calculateGpuPower(gpu, workload, ambientTemp);
  const memPower = calculateMemoryPower(memory, workload);
  const fixed = calculateFixedPower(config, workload);

  const sustainedTotal = cpuPower.current + gpuPower.sustained + memPower.power +
    fixed.motherboard + fixed.storage + fixed.fans + fixed.peripherals + fixed.rgb;

  // Transient peak includes GPU spike + CPU boost + everything else maxed
  const transientPeak = sustainedTotal - gpuPower.sustained + gpuPower.transient;

  return {
    cpu: cpuPower.current,
    cpuTarget: cpuPower.target,
    cpuIsBoost: cpuPower.isBoost,
    gpu: gpuPower.sustained,
    gpuTransient: gpuPower.transient,
    memory: memPower.power,
    memoryHeat: memPower.heat,
    ...fixed,
    sustainedTotal,
    transientPeak
  };
}

/**
 * Calculate PSU load percentage
 */
export function calculatePsuLoad(power, psu) {
  if (!psu) return 0;
  return (power / psu.wattage) * 100;
}

/**
 * Get PSU efficiency at current load
 */
export function getPsuEfficiency(loadPercent, psu) {
  if (!psu) return 0.85;

  const curve = psu.efficiency;
  const points = Object.keys(curve).map(Number).sort((a, b) => a - b);

  if (loadPercent <= points[0]) return curve[points[0]];
  if (loadPercent >= points[points.length - 1]) return curve[points[points.length - 1]];

  for (let i = 0; i < points.length - 1; i++) {
    if (loadPercent >= points[i] && loadPercent <= points[i + 1]) {
      const range = points[i + 1] - points[i];
      const position = (loadPercent - points[i]) / range;
      // Linear interpolation
      return curve[points[i]] + (curve[points[i + 1]] - curve[points[i]]) * position;
    }
  }
  return 0.85;
}

/**
 * Calculate wall power draw and PSU stats
 */
export function calculateWallPower(systemPower, transientPower, psu) {
  if (!psu) return { wallPower: systemPower, efficiency: 0.85, heatWaste: 0, loadPercent: 0, transientLoad: 0, transientStable: true };

  const loadPercent = calculatePsuLoad(systemPower, psu);
  const transientLoad = calculatePsuLoad(transientPower, psu);
  const efficiency = getPsuEfficiency(loadPercent, psu);
  const wallPower = systemPower / efficiency;
  const heatWaste = wallPower - systemPower;

  // Transient stability
  const transientResponse = psu.transientResponse || 0.8;
  // If transient load exceeds capacity * (1 + transient response headroom), it's unstable
  const transientLimit = 100 * (1 + (transientResponse - 0.7) * 0.5);
  const transientStable = transientLoad < transientLimit;

  return {
    wallPower,
    efficiency,
    heatWaste,
    loadPercent,
    transientLoad,
    transientStable
  };
}

export function applyThrottling(power, throttlePercent) {
  return power * (1 - throttlePercent / 100);
}

export function getWorkloadExplanation(workload) {
  return WORKLOAD_PROFILES[workload]?.explanation || '';
}
