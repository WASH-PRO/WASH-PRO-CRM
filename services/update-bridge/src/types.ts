export type UpdateComponentId = 'crm' | 'dynamic-api' | 'pyorchestrator';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface UpdateStep {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface UpdateJob {
  id: string;
  component: UpdateComponentId;
  targetVersion: string;
  fromVersion: string;
  status: JobStatus;
  steps: UpdateStep[];
  logs: string[];
  error?: string;
  createdAt: string;
  finishedAt?: string;
}

export interface ComponentCheck {
  id: UpdateComponentId;
  label: string;
  githubRepo: string;
  currentVersion: string;
  latestVersion: string | null;
  latestTag: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  checkedAt: string | null;
  error?: string | null;
}

export interface UpdatesStatus {
  executorAvailable: boolean;
  executorReason: string | null;
  lastCheckAt: string | null;
  components: ComponentCheck[];
  activeJob: UpdateJob | null;
  recentJobs: UpdateJob[];
  showNotification: boolean;
  dismissedFailedJobIds: Record<string, string>;
}

export interface PersistedState {
  lastCheckAt: string | null;
  lastComponents: ComponentCheck[];
  dismissedVersions: Record<string, string>;
  dismissedFailedJobIds: Record<string, string>;
  jobs: UpdateJob[];
  activeJobId: string | null;
}
