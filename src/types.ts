export type ProjectStatus = 'Planning' | 'In Progress' | 'Paused' | 'Completed' | 'Archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  kpiTarget: string;
  startDate: string;
  updatedAt: string;
  specs?: Record<string, { min?: number; max?: number; target?: number }>;
}

export interface FormulationItem {
  id: string;
  materialName: string;
  batchNumber: string;
  theoreticalWeight: number;
  actualWeight?: number;
  unit: string;
}

export interface FormulationProfile {
  id: string;
  name: string;
  items: Omit<FormulationItem, 'id' | 'actualWeight'>[];
}

export type ProcessConditionType = 'Energy' | 'Time' | 'Concentration' | 'Temperature' | 'Pressure' | 'Other';

export interface ProcessCondition {
  id: string;
  name: string;
  type: ProcessConditionType;
  value: number;
  unit: string;
}

export interface ProcessProfile {
  id: string;
  name: string;
  conditions: ProcessCondition[];
}

export interface Experiment {
  id: string;
  projectId: string;
  title: string;
  date: string;
  operator: string;
  observations: string;
  anomalies: string;
  conclusions: string;
  suggestions: string;
  recipeId?: string;
  recipeName?: string;
  status: 'Draft' | 'Completed';
  formulation?: FormulationItem[];
  processConditions?: ProcessCondition[];
  notes?: string;
  attachments?: string[]; // IDs of attachments
}

export type LensGrade = 'A' | 'B' | 'C';

export interface LensDefect {
  id: string;
  type: string; // e.g., 'Scratch', 'Bubble', 'Dust'
  count: number;
}

export interface Sample {
  id: string;
  experimentId: string;
  sampleCode: string;
  batchNumber: string;
  moldBatchNumber?: string;
  createdAt: string;
  gradeA?: number;
  gradeB?: number;
  gradeC?: number;
  defects?: LensDefect[];
  results?: TestResult[]; // Optional for UI convenience
}

export interface TestItem {
  id: string;
  name: string;
  unit: string;
  specMin?: number;
  specMax?: number;
  targetValue?: number;
}

export interface TestResult {
  id: string;
  sampleId: string;
  testItemId: string;
  rawValues: number[];
  mean: number;
  stdDev: number;
  max: number;
  min: number;
  isAnomaly: boolean;
  status: 'Pass' | 'Fail' | 'Warning' | 'Pending';
}

export interface Attachment {
  id: string;
  parentId: string; // experimentId, sampleId, or testResultId
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export type UserRole = 'Admin' | 'User';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface UserPermission {
  userId: string;
  projectIds: string[]; // List of project IDs the user can access
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  assignees: string[]; // User IDs
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'info' | 'warning' | 'success';
  authorId: string;
  targetUsers?: string[]; // User IDs
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  description?: string;
  participants: string[]; // User IDs
  authorId: string;
}
