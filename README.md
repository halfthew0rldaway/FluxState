# FluxState

**Real-time PC Power & Thermal Simulation**

**[Try FluxState →](https://fluxstate.vercel.app)**

## Overview

FluxState models the dynamic power and thermal behavior of PC hardware. Unlike static calculators, it simulates transient spikes, boost states, and thermal equilibrium in real-time.

**Status: Active Development**
> The hardware database is constantly expanding. While we aim for comprehensive coverage, some newer or niche components may be missing. We are actively working to add them.

## Core Features

- **Dynamic Power Simulation**: Models CPU boost algorithms and GPU transient spikes (up to 2x rated power).
- **Thermal Physics**: Calculates equilibrium temperatures based on cooler TDP, ambient airflow, and workload.
- **PSU Efficiency**: Real-world efficiency curves (Gold/Platinum/Titanium) to predict wall power draw.
- **Component Scoring**: Grades builds on efficiency, thermal headroom, and stability (S-Tier to F-Tier).

## How It Works

1. **Select Hardware**: Choose from 2000+ CPUs and GPUs using the fuzzy search dropdowns.
2. **Configure Environment**: Set ambient temperature, case fans, and airflow quality.
3. **Run Workloads**: Switch between Idle, Gaming, Rendering, and Stress Test to see how the system behaves.
4. **Analyze**:
   - **Power Panel**: Watch for red flags in PSU loading and transient spikes.
   - **Thermal Panel**: Check if your cooling solution can handle the heat output.
   - **Score**: Aim for an 'S' or 'A' rank for a balanced, reliable build.

## Accuracy & Limitations

- **Transient Spikes**: Modeled based on oscilloscope measurements from professional reviews.
- **Thermal Model**: A simplified resistance model. It predicts trends accurately but cannot account for specific case airflow dead zones.
- **Power Data**: Sourced from official spec sheets and verified community data.

---

FluxState is an open-source tool for the PC building community.
