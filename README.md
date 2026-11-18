# LPU SmartWay — Multi-Floor Campus Accessibility & Navigation Portal (Deployment Build)

**Course:** Artificial Intelligence Foundations (Section K4P25TF — Group 16)  
**Team Members:** Danareddy Gari Kishore Kumar Reddy (12511868), Palak Chuchra (12512154), Lokeswara Reddy Medimala (12511039)

## Calibrated Simulation Parameters
- **Total Topology:** 14 Academic Blocks (Blocks 25–38), 94 total floors.
- **Vertical Floor Transitions:** Lift = `25m` shaft equivalent, `5 seconds` per floor; Stairs = `28m`, `20 seconds` per floor (blocked for Handicapped/Wheelchair users).
- **Persona Speed & Ramp Calibration:** Handicapped/Wheelchair profile applies a `1.6x` ramp detour distance (`24m` vs `15m` direct entry) and `1.4x` horizontal travel time multiplier across corridors, skybridges, and outdoor walkways.
- **Algorithm Distinction:** `A*` and `UCS` optimize the weighted multi-criteria cost function, whereas `BFS` explores an unweighted graph to minimize edge step count (producing distinct distance/time/effort metrics on multi-hop routes).
