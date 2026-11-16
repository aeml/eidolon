// Shared presentation/runtime thresholds used by the extracted engine domains.
export const LOCAL_POSITION_CORRECTION_DISTANCE = 3.0;
export const POINTER_RAYCAST_INTERVAL = 0.05;
// Never advance more than two fixed simulation ticks between rendered frames.
// At the un-rested 28.8 unit/s cap this permits 0.96m; Well Rested's 31.68
// permits 1.056m. Both remain two ticks, not a catch-up burst of extra updates.
export const MAX_FRAME_SIMULATION_DELTA = 1 / 30;
