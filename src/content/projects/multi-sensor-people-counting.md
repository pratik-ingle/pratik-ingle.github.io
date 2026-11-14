---
order: 6
title: "Multi-sensor people counting"
type: Build
tracks: [Robotics, Tools]
blurb: "A simulator and tracking pipelines that count and locate people in a showroom with 24 ceiling-mounted mmWave radars and 36 thermal cameras. Fusing the two keeps the count within about 6 of roughly 98 people, where radar alone misses more than a quarter."
meta: "mmWave radar · thermal · fusion"
media: "[Clip: replay of the simulated showroom, with the thermal floor image, radar points, true people and fused tracks]"
image: "/media/people-counting-replay.mp4"
links:
  - label: "Live replay"
    href: "https://pratik-ingle.github.io/Multi-sensor-people-counting/"
  - label: "Code"
    href: "https://github.com/pratik-ingle/Multi-sensor-people-counting"
---

## Overview

How many people are in a large space, where are they, and how long do they stay in each area? This project simulates a 30 × 20 m furniture showroom watched by ceiling-mounted TI IWR6843AOP radars and FLIR Lepton thermal cameras. It then counts and tracks the visitors three ways: with radar only, with thermal only, and with both fused. The outputs are engagement analytics, such as people per zone over time and dwell heatmaps.

The [live page](https://pratik-ingle.github.io/Multi-sensor-people-counting/) replays a recorded 90 s run in the browser. It shows the thermal image of the floor, radar points, true people and the tracks of each pipeline, with running accuracy, and you can click any thermal camera to see its raw output. A local server runs the same view live, where you can change the crowd size while it runs.

## How it works

- **Showroom and crowd.** A floor plan with zones (lighting, sofas, beds, kitchens, storage, checkout), furniture and walking routes. Groups of visitors arrive, browse two to four zones, stand, reach and sit, then leave. Each person has their own clothing, hair and skin temperature.
- **Radar.** Each body is about 40 scatterers with gait micro-Doppler. The radar model produces TI's compressed point cloud with field of view, SNR, static clutter removal, occlusion, resolution merging, multipath ghosts and false alarms.
- **Thermal cameras.** Articulated 3D people and a furnished scene (shelving, sofas, steel appliances, lamps, sunlit floor, warm imprints left on seats) are rendered on the GPU in the 8–14 µm band. Each pixel is integrated over the real distorted lens, and a sensor model adds the Lepton's noise, fixed-pattern noise and drift, vignetting, shutter freezes and 0.01 K quantisation.
- **Detection and tracking.** Thermal detections come from a per-camera background model and warm-blob peaks projected to the floor, merged across overlapping cameras. One gtrack-style tracker, tuned per pipeline, follows people from radar points, thermal detections or both.
- **Ready for real sensors.** The pipelines read the same file formats a logger for the real radars and cameras would write, so they run unchanged on recorded data.

## Results

Five minutes in the simulated showroom, with about 98 people present on average:

| | radar | thermal | fused |
| --- | --- | --- | --- |
| Average count (true 97.6) | 70.6 | 93.8 | 95.0 |
| Count error, mean absolute | 27.0 | 5.7 | 6.0 |
| Precision / recall | 0.97 / 0.70 | 0.80 / 0.77 | 0.85 / 0.83 |
| Position error | 0.14 m | 0.26 m | 0.17 m |
| Found: walking / standing / seated | 0.88 / 0.62 / 0.34 | 0.77 / 0.77 / 0.74 | 0.91 / 0.79 / 0.67 |

Radar places people precisely but loses those who stand or sit still, because static clutter removal hides them. Thermal finds still people but is less precise about where they are. Fusing the two gives the best recall and keeps most of radar's position accuracy.

The radar and thermal parameters are approximations. The next step is to record a real radar and a real Lepton for a few minutes and tune the simulator until points per person, SNR, blob temperatures and noise match, before trusting it for training data.
