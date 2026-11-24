export const APP_NAME = 'NoteOps';
export const APP_TITLE = 'NoteOps — Reproducible Pipeline Studio';
export const APP_SHORT_NAME = 'NoteOps';
export const APP_LOGO = 'NO';
export const APP_TEAM = 'Team C-162';
export const APP_DOMAIN = 'Software Modelling & DevOps';

export const STORAGE_PREFIX = 'noteops';
export const WORKSPACE_FILE = 'noteops_workspace.json';
export const LEGACY_WORKSPACE_FILE = 'cloud39_workspace.json';

export const ARTIFACT_STORAGE_URI = 's3://noteops-artifacts';
export const CONTAINER_REGISTRY = 'ghcr.io/noteops/notebook-runner';
export const CONTAINER_IMAGE_PINNED = 'ghcr.io/noteops/notebook-runner:py312-pinned';
export const OPENLINEAGE_ENDPOINT = 'http://marquez.noteops.internal:5000/api/v1/lineage';
export const DATASET_URI_PREFIX = 's3://noteops-datasets/raw';
export const ARTIFACT_URI_PREFIX = 's3://noteops-artifacts';

export const ENV_VAR_PREFIX = 'NOTEOPS_';
export const LEGACY_ENV_VAR_PREFIX = 'CLOUD39_';

export function formatIntervalHuman(minutes: number): string {
  if (minutes === 10080) return 'Weekly (Mon 00:00 UTC)';
  if (minutes === 1440) return 'Daily (00:00 UTC)';
  if (minutes === 60) return 'Hourly';
  if (minutes % 1440 === 0) return `Every ${minutes / 1440} day(s)`;
  if (minutes % 60 === 0) return `Every ${minutes / 60} hour(s)`;
  return `Every ${minutes} minute(s)`;
}

export function getIntervalTooltip(minutes: number): string {
  return `${minutes}m`;
}