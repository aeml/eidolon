// Shared presentation/runtime thresholds used by the extracted engine domains.
export const LOCAL_POSITION_CORRECTION_DISTANCE = 3.0;
export const POINTER_RAYCAST_INTERVAL = 0.05;
// Never advance more than two fixed simulation ticks between rendered frames.
// At the 28.8 unit/s movement cap this limits a slow-frame visual step to
// 0.96m, instead of replaying as much as 2.88m of movement in one lurch.
export const MAX_FRAME_SIMULATION_DELTA = 1 / 30;
