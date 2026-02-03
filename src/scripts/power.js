/**
 * Power Calculation Module - Comprehensive
 * Every parameter affects calculations in a traceable way
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
    explanation: 'System at rest. CPU runs at minimum P-state with most cores in C-state sleep. GPU enters low-power mode. Memory controllers reduce refresh rate. Storage drives spin down or enter idle states. Total system power is the sum of component minimum draws plus always-on overhead (motherboard VRMs, USB devices).'
  },
  lightLoad: {
    name: 'Light Load',
    description: 'Web browsing, office tasks',
    cpuLoadType: 'light',
    gpuLoadType: 'idle',
    memoryActivity: 0.25,
    storageActivity: 0.15,
    explanation: 'Light application usage. CPU sporadically boosts single cores for short bursts. GPU may briefly accelerate for video decoding. Memory sees moderate read patterns. Power fluctuates based on burst activity.'
  },
  gaming: {
    name: 'Gaming',
    description: 'Typical gaming workload (GPU-bound)',
    cpuLoadType: 'gaming',
    gpuLoadType: 'gaming',
    memoryActivity: 0.55,
    storageActivity: 0.3,
    explanation: 'Gaming is typically GPU-bound with the CPU handling game logic, physics, and draw calls. CPU usage varies by game engine—single-threaded games stress fewer cores while modern engines scale to 6-8 threads. GPU transient spikes occur during scene transitions and shader compilation. Memory bandwidth matters for texture streaming.'
  },
  streaming: {
    name: 'Gaming + Streaming',
    description: 'Gaming while encoding stream',
    cpuLoadType: 'rendering',
    gpuLoadType: 'gaming',
    memoryActivity: 0.7,
    storageActivity: 0.4,
    explanation: 'CPU handles software encoding (x264) while GPU runs the game. If using NVENC/AMF hardware encoding, GPU load increases but CPU is freed. Memory pressure from frame buffers and encoding profiles. This is a demanding mixed workload that stresses both power and thermals.'
  },
  rendering: {
    name: 'Rendering',
    description: 'CPU rendering, video encoding',
    cpuLoadType: 'rendering',
    gpuLoadType: 'rendering',
    memoryActivity: 0.85,
    storageActivity: 0.6,
    explanation: 'CPU rendering loads all cores at sustained 100% utilization. Initial power surges from turbo boost before thermal and power limits engage. Temperature rises until equilibrium is reached. GPU assists with hardware encoding or compute acceleration in applications like Blender, DaVinci Resolve.'
  },
  compiling: {
    name: 'Compiling',
    description: 'Software compilation, build tasks',
    cpuLoadType: 'rendering',
    gpuLoadType: 'idle',
    memoryActivity: 0.75,
    storageActivity: 0.85,
    explanation: 'Parallel compilation stresses all CPU cores with frequent I/O operations. The workload is bursty—CPU-bound during compile, I/O-bound during linking. NVMe SSDs significantly reduce overall power draw versus HDDs due to faster completion. Memory pressure from large codebase caches.'
  },
  stress: {
    name: 'Stress Test',
    description: 'Maximum sustained load (synthetic)',
    cpuLoadType: 'stress',
    gpuLoadType: 'stress',
    memoryActivity: 0.95,
    storageActivity: 0.5,
    explanation: 'Synthetic stress tests like Prime95 or OCCT push components to absolute maximum sustained power draw—a scenario unrealistic in normal use. Power draw exceeds typical TDP ratings during initial boost, then settles at sustained limits. Useful for validating cooling, PSU capacity, and system stability.'
  }
};

// Power constants with detailed breakdown
export const FIXED_POWER = {
  motherboard: {
    idle: 18,      // Chipset, VRMs at idle
    lightLoad: 28, // Some VRM activity
    load: 45       // VRM losses under load
  },
  peripherals: {
    usb: 2.5,      // USB controller + devices
    audio: 1.5,    // Audio codec
    ethernet: 1.2, // Intel I225-V class
    other: 2.8     // SATA controller, misc
  },
  rgb: {
    none: 0,
    minimal: 2,
    moderate: 5,
    extensive: 12
  },
  fanPerUnit: {
    min: 1.0,      // PWM at 20%
    typ: 2.4,      // PWM at 50%
    max: 4.8       // PWM at 100%
  }
};

export const STORAGE_POWER = {
  nvme: {
    idle: 1.0,
    active: 3.5,
    burst: 7.0,
    heatFactor: 0.015
  },
  nvme_gen4: {
    idle: 1.5,
    active: 5.0,
    burst: 9.0,
    heatFactor: 0.02
  },
  nvme_gen5: {
    idle: 2.2,
    active: 7.0,
    burst: 12.0,
    heatFactor: 0.025
  },
  sata: {
    idle: 0.5,
    active: 2.8,
    burst: 4.0,
    heatFactor: 0.01
  },
  hdd: {
    idle: 4.2,
    active: 7.5,
    burst: 10.0,
    heatFactor: 0.03
  }
};

// Airflow quality multipliers - affect cooling effectiveness
export const AIRFLOW_LEVELS = {
  0.4: { name: 'Restricted', description: 'Solid panels, no intake mesh, poor cable management', penalty: 0.50 },
  0.55: { name: 'Poor', description: 'Limited ventilation, restricted intake', penalty: 0.65 },
  0.7: { name: 'Average', description: 'Standard mid-tower, some mesh', penalty: 0.80 },
  0.85: { name: 'Good', description: 'Mesh front panel, proper fan configuration', penalty: 0.92 },
  1.0: { name: 'Excellent', description: 'High-airflow mesh case or open bench', penalty: 1.0 }
};

/**
 * Calculate CPU power draw based on workload, boost state, and throttling
 */
export function calculateCpuPower(cpu, workload, boostState = {}, throttlePercent = 0) {
  if (!cpu) return { current: 0, target: 0, isBoost: false, breakdown: {} };

  const profile = WORKLOAD_PROFILES[workload];
  const loadType = profile.cpuLoadType;

  let targetPower;
  let isBoost = false;

  switch (loadType) {
    case 'idle':
      targetPower = cpu.idlePower;
      break;
    case 'light':
      targetPower = cpu.lightLoadPower || (cpu.idlePower + cpu.gamingPower) / 2;
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
      targetPower = cpu.lightLoadPower || cpu.gamingPower * 0.5;
  }

  // Apply throttling
  if (throttlePercent > 0) {
    targetPower = targetPower * (1 - throttlePercent / 100);
  }

  // Power ramping/smoothing for realistic transitions
  const current = boostState.currentPower || targetPower;
  const transitionRate = 0.15; // Smoother transitions
  const newPower = current + (targetPower - current) * transitionRate;

  // Calculate effective clock speed
  const base = cpu.baseClock || 3.0;
  const boost = cpu.boostClock || base + 0.5;
  const allCore = cpu.allCoreTurbo || (base + boost) / 2;

  let clockSpeed = base;
  let clockMode = 'Base';

  if (loadType === 'idle') {
    clockSpeed = base * 0.4;
    clockMode = 'Idle (C-states)';
  } else if (loadType === 'light') {
    clockSpeed = base * 0.7 + Math.random() * 0.3;
    clockMode = 'Light (1-2 cores)';
  } else if (loadType === 'gaming') {
    clockSpeed = allCore * 0.95 + Math.random() * (boost - allCore) * 0.3;
    clockMode = 'Gaming (mixed cores)';
  } else if (isBoost) {
    clockSpeed = boost;
    clockMode = 'Boost (all cores)';
  } else {
    // Sustained load
    clockSpeed = allCore;
    clockMode = 'Sustained (all cores)';
  }

  // Apply throttling to clock too
  if (throttlePercent > 0) {
    clockSpeed = clockSpeed * (1 - throttlePercent / 100);
    clockMode = `Throttled (-${throttlePercent.toFixed(0)}%)`;
  }

  return {
    current: Math.max(cpu.idlePower, newPower),
    target: targetPower,
    isBoost: isBoost,
    clockSpeed,
    clockMode,
    breakdown: {
      base: cpu.sustainedPower || cpu.tdp,
      boost: cpu.shortBoostPower,
      workloadType: loadType
    }
  };
}

/**
 * Calculate GPU power draw based on workload and ambient conditions
 */
export function calculateGpuPower(gpu, workload, ambientTemp = 25, throttlePercent = 0) {
  if (!gpu) return { sustained: 0, transient: 0, breakdown: {} };

  const profile = WORKLOAD_PROFILES[workload];
  const loadType = profile.gpuLoadType;

  let basePower;
  switch (loadType) {
    case 'idle': basePower = gpu.idleDraw; break;
    case 'light': basePower = gpu.lightLoadDraw || gpu.idleDraw * 3; break;
    case 'gaming': basePower = gpu.gamingDraw; break;
    case 'rendering': basePower = gpu.renderingDraw; break;
    case 'stress': basePower = gpu.stressDraw; break;
    default: basePower = gpu.idleDraw;
  }

  // Temperature affects power through leakage current
  // Higher ambient = higher GPU temps = more leakage
  const leakageScalar = 1 + Math.max(0, (ambientTemp - 25) * 0.003);
  let adjustedPower = basePower * leakageScalar;

  // Apply throttling
  if (throttlePercent > 0) {
    adjustedPower = adjustedPower * (1 - throttlePercent / 100 * 0.4); // GPU throttles less aggressively
  }

  // Transient spikes - larger for high-end GPUs
  const transientPeak = loadType !== 'idle'
    ? adjustedPower * gpu.transientMultiplier
    : adjustedPower;

  // Calculate effective clock speed
  const baseClock = gpu.baseClock || 1500;
  const boostClock = gpu.boostClock || baseClock + 300;

  let clockSpeed = baseClock;
  let clockMode = 'Base';

  if (loadType === 'idle') {
    clockSpeed = 210;
    clockMode = 'Idle (2D)';
  } else if (loadType === 'light') {
    clockSpeed = baseClock * 0.5;
    clockMode = 'Light load';
  } else if (loadType === 'gaming') {
    clockSpeed = boostClock - Math.random() * 100;
    clockMode = 'Gaming (Boost)';
  } else if (loadType === 'rendering') {
    clockSpeed = boostClock * 0.95;
    clockMode = 'Compute load';
  } else if (loadType === 'stress') {
    clockSpeed = boostClock;
    clockMode = 'Max Boost';
  }

  if (throttlePercent > 0) {
    clockSpeed = clockSpeed * (1 - throttlePercent / 100 * 0.5);
  }

  return {
    sustained: Math.max(gpu.idleDraw, adjustedPower),
    transient: transientPeak,
    clockSpeed,
    clockMode,
    breakdown: {
      base: basePower,
      leakageAdded: adjustedPower - basePower,
      transientMultiplier: gpu.transientMultiplier,
      transientDuration: gpu.transientDuration || 20
    }
  };
}

/**
 * Calculate memory power based on generation, capacity, and activity
 * DDR3 draws more power per GB than DDR4/DDR5
 */
export function calculateMemoryPower(memory, workload) {
  if (!memory) return { power: 5, heat: 0.02, breakdown: {} };

  const profile = WORKLOAD_PROFILES[workload];
  const activity = profile.memoryActivity;

  // Generation efficiency factor (older = less efficient per GB)
  const genEfficiency = {
    'DDR3': 0.65,   // Least efficient
    'DDR4': 0.85,   // More efficient
    'DDR5': 1.0     // Most efficient per GB, but PMIC adds baseline
  };

  const efficiency = genEfficiency[memory.type] || 0.85;

  // Base power interpolated between idle and load
  const basePower = memory.idlePower + (memory.loadPower - memory.idlePower) * activity;

  // DDR3 less efficient, draws more
  // DDR5 has PMIC overhead but better per-GB efficiency at high loads
  const adjustedPower = memory.type === 'DDR3'
    ? basePower * 1.3
    : memory.type === 'DDR5'
      ? basePower * 1.0  // PMIC already in spec
      : basePower;

  // Heat contribution scales with activity and stick count
  const heat = memory.heatContribution * activity * (memory.sticks / 2);

  return {
    power: adjustedPower,
    heat: heat,
    breakdown: {
      idlePower: memory.idlePower,
      loadPower: memory.loadPower,
      activityLevel: activity,
      efficiency: efficiency,
      stickCount: memory.sticks
    }
  };
}

/**
 * Calculate storage power based on specific drive configuration
 */
export function calculateStoragePower(storageConfig, workload) {
  const profile = WORKLOAD_PROFILES[workload];
  const activity = profile.storageActivity;

  // Adjust activity based on workload - compiling uses more storage
  const adjustedActivity = workload === 'compiling' ? Math.min(activity * 1.4, 1.0) : activity;

  let totalPower = 0;
  let totalHeat = 0;
  const breakdown = {};

  const calcDrivePower = (count, spec, typeName) => {
    if (count <= 0) return { power: 0, heat: 0 };

    const idlePower = spec.idle * count;
    const activePower = (spec.active - spec.idle) * adjustedActivity * count;
    const burstPower = 0; // Bursts are transient, not sustained

    const power = idlePower + activePower;
    const heat = spec.heatFactor * adjustedActivity * count;

    breakdown[typeName] = { count, power, heat };
    return { power, heat };
  };

  if (storageConfig.nvme > 0) {
    const result = calcDrivePower(storageConfig.nvme, STORAGE_POWER.nvme, 'nvme');
    totalPower += result.power;
    totalHeat += result.heat;
  }
  if (storageConfig.sata > 0) {
    const result = calcDrivePower(storageConfig.sata, STORAGE_POWER.sata, 'sata');
    totalPower += result.power;
    totalHeat += result.heat;
  }
  if (storageConfig.hdd > 0) {
    const result = calcDrivePower(storageConfig.hdd, STORAGE_POWER.hdd, 'hdd');
    totalPower += result.power;
    totalHeat += result.heat;
  }

  return { power: totalPower, heat: totalHeat, breakdown };
}

/**
 * Calculate fixed component power draws
 */
export function calculateFixedPower(config, workload) {
  const profile = WORKLOAD_PROFILES[workload];
  const fanCount = config.fanCount || 3;
  const fanSpeed = config.fanSpeed || 30;

  // Motherboard power scales with component activity
  const isHeavyLoad = ['rendering', 'stress', 'compiling'].includes(workload);
  const isModerateLoad = ['gaming', 'streaming'].includes(workload);

  let motherboard;
  if (isHeavyLoad) {
    motherboard = FIXED_POWER.motherboard.load;
  } else if (isModerateLoad) {
    motherboard = FIXED_POWER.motherboard.lightLoad + 10;
  } else if (workload === 'lightLoad') {
    motherboard = FIXED_POWER.motherboard.lightLoad;
  } else {
    motherboard = FIXED_POWER.motherboard.idle;
  }

  // Peripherals are constant
  const peripherals = Object.values(FIXED_POWER.peripherals).reduce((a, b) => a + b, 0);

  // RGB - assume moderate by default
  const rgb = config.rgbLevel ? FIXED_POWER.rgb[config.rgbLevel] : FIXED_POWER.rgb.moderate;

  // Fan power - cubic relationship with speed
  const fanSpeedRatio = fanSpeed / 100;
  const fanPowerEach = FIXED_POWER.fanPerUnit.min +
    (FIXED_POWER.fanPerUnit.max - FIXED_POWER.fanPerUnit.min) * Math.pow(fanSpeedRatio, 2.5);
  const fans = fanPowerEach * fanCount;

  return {
    motherboard,
    peripherals,
    rgb,
    fans,
    total: motherboard + peripherals + rgb + fans,
    breakdown: {
      motherboardLoad: isHeavyLoad ? 'heavy' : isModerateLoad ? 'moderate' : 'idle',
      fanCount,
      fanSpeed,
      fanPowerEach
    }
  };
}

/**
 * Calculate effective cooling capacity based on airflow quality and fan count
 */
export function calculateEffectiveCooling(cooling, fanCount, airflowQuality) {
  if (!cooling) return { capacity: 100, effectivenessMultiplier: 1 };

  // Base cooling capacity
  let capacity = cooling.heatDissipation;

  // Airflow quality affects cooler effectiveness
  // Poor airflow means hot air recirculates, reducing ΔT
  const airflowPenalty = 1 - ((1 - airflowQuality) * 0.45);

  // More case fans improve airflow, with diminishing returns
  const fanBonus = 1 + Math.log2(Math.max(1, fanCount)) * 0.08;

  const effectiveCapacity = capacity * airflowPenalty * fanBonus * cooling.airflowEffectiveness;

  return {
    capacity: effectiveCapacity,
    baseCapacity: capacity,
    effectivenessMultiplier: airflowPenalty * fanBonus,
    breakdown: {
      airflowPenalty,
      fanBonus,
      coolerEffectiveness: cooling.airflowEffectiveness
    }
  };
}

/**
 * Calculate total system power draw
 */
export function calculateTotalPower(config, boostState = {}, thermalState = null) {
  const { cpu, gpu, memory, workload, ambientTemp = 25, storageConfig = { nvme: 1, sata: 0, hdd: 0 } } = config;

  const throttlePercent = thermalState?.throttlePercent || 0;

  const cpuPower = calculateCpuPower(cpu, workload, boostState, throttlePercent);
  const gpuPower = calculateGpuPower(gpu, workload, ambientTemp, throttlePercent);
  const memPower = calculateMemoryPower(memory, workload);
  const storagePower = calculateStoragePower(storageConfig, workload);
  const fixed = calculateFixedPower(config, workload);

  const sustainedTotal = cpuPower.current + gpuPower.sustained + memPower.power +
    storagePower.power + fixed.total;

  // Transient peak includes GPU spike
  const transientPeak = sustainedTotal - gpuPower.sustained + gpuPower.transient;

  return {
    cpu: cpuPower.current,
    cpuTarget: cpuPower.target,
    cpuIsBoost: cpuPower.isBoost,
    cpuBreakdown: cpuPower.breakdown,
    cpuClock: cpuPower.clockSpeed,
    cpuMode: cpuPower.clockMode,

    gpu: gpuPower.sustained,
    gpuClock: gpuPower.clockSpeed,
    gpuMode: gpuPower.clockMode,
    gpuTransient: gpuPower.transient,
    gpuBreakdown: gpuPower.breakdown,

    memory: memPower.power,
    memoryHeat: memPower.heat,
    memoryBreakdown: memPower.breakdown,

    storage: storagePower.power,
    storageHeat: storagePower.heat,
    storageBreakdown: storagePower.breakdown,

    motherboard: fixed.motherboard,
    peripherals: fixed.peripherals,
    rgb: fixed.rgb,
    fans: fixed.fans,
    fixedBreakdown: fixed.breakdown,

    sustainedTotal,
    transientPeak,

    components: {
      cpu: cpuPower.current,
      gpu: gpuPower.sustained,
      memory: memPower.power,
      storage: storagePower.power,
      motherboard: fixed.motherboard,
      peripherals: fixed.peripherals,
      rgb: fixed.rgb,
      fans: fixed.fans
    }
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
 * Get PSU efficiency at current load using interpolation
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
      return curve[points[i]] + (curve[points[i + 1]] - curve[points[i]]) * position;
    }
  }
  return 0.85;
}

/**
 * Calculate wall power draw and PSU stats
 */
export function calculateWallPower(systemPower, transientPower, psu) {
  if (!psu) {
    return {
      wallPower: systemPower,
      efficiency: 0.85,
      heatWaste: systemPower * 0.15,
      loadPercent: 0,
      transientLoad: 0,
      transientStable: true,
      breakdown: {}
    };
  }

  const loadPercent = calculatePsuLoad(systemPower, psu);
  const transientLoad = calculatePsuLoad(transientPower, psu);
  const efficiency = getPsuEfficiency(loadPercent, psu);
  const wallPower = systemPower / efficiency;
  const heatWaste = wallPower - systemPower;

  // Transient stability check
  // Higher quality PSUs (higher transientResponse) handle spikes better
  const transientResponse = psu.transientResponse || 0.8;
  // Good PSUs can handle ~120% transients, basic ones struggle at 105%
  const transientLimit = 100 + (transientResponse - 0.7) * 80;
  const transientStable = transientLoad < transientLimit;

  // Transient warning threshold
  const transientWarning = transientLoad > transientLimit * 0.85;

  return {
    wallPower,
    efficiency,
    heatWaste,
    loadPercent,
    transientLoad,
    transientStable,
    transientWarning,
    transientLimit,
    breakdown: {
      dcPower: systemPower,
      efficiency,
      losses: heatWaste,
      psuRating: psu.rating,
      psuWattage: psu.wattage
    }
  };
}

export function applyThrottling(power, throttlePercent) {
  return power * (1 - throttlePercent / 100);
}

export function getWorkloadExplanation(workload) {
  return WORKLOAD_PROFILES[workload]?.explanation || '';
}

export function getWorkloadInfo(workload) {
  return WORKLOAD_PROFILES[workload] || WORKLOAD_PROFILES.idle;
}
