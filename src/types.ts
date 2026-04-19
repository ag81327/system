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
  userId: string;
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
  userId: string;
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
  recipeVersionId?: string; // Link to specific recipe version
  doeSessionId?: string;    // Link to DOE session if part of one
  status: 'Draft' | 'Completed';
  signature?: {
    userId: string;
    userName: string;
    signedAt: string;
  };
  formulation?: FormulationItem[];
  processConditions?: ProcessCondition[];
  notes?: string;
  attachments?: string[]; // IDs of attachments
  visibleTo?: string[]; // User IDs who can view this experiment
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  currentVersionId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeVersion {
  id: string;
  recipeId: string;
  versionNumber: string; // e.g., "1.0", "1.1"
  description: string;
  formulation: Omit<FormulationItem, 'id' | 'actualWeight'>[];
  processConditions: ProcessCondition[];
  parentVersionId?: string;
  createdBy: string;
  createdAt: string;
}

export interface DOESession {
  id: string;
  projectId: string;
  name: string;
  description: string;
  factors: DOEFactor[];
  matrix: DOERun[];
  status: 'Planning' | 'In Progress' | 'Completed';
  createdAt: string;
  createdBy: string;
  designMethod?: string;
  replications?: number;
  randomized?: boolean;
  snRatioType?: 'Smaller' | 'Larger' | 'Nominal';
}

export interface DOEFactor {
  id: string;
  name: string;
  type: 'Numerical' | 'Categorical';
  levels: string[];
  unit?: string;
  isCenterPoint?: boolean;
}

export interface DOERun {
  id: string;
  experimentId?: string;
  values: Record<string, string>;
  runOrder?: number;
  isReplication?: boolean;
  originalRunId?: string;
}

export interface Comment {
  id: string;
  parentId: string; // e.g., experimentId, recipeId
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  mentions?: string[]; // User IDs
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string; // e.g., "CREATE", "UPDATE", "SIGN", "DELETE"
  entityType: string; // e.g., "Experiment", "Recipe"
  entityId: string;
  details: string; // JSON string of changes
  timestamp: string;
}

export interface ResearchReport {
  id: string;
  projectId: string;
  title: string;
  content: string; // HTML or Markdown
  authorId: string;
  createdAt: string;
  experimentIds: string[];
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
  qualityScore?: number;
  defects?: LensDefect[];
  results?: TestResult[]; // Optional for UI convenience
}

export interface MaterialMaster {
  id: string;
  name: string;
  supplier?: string;
  specModel?: string;
  unit: string;
  safetyStock?: number;
  msdsUrl?: string;
  description?: string;
}

export interface ProcessParameterMaster {
  id: string;
  name: string;
  unit: string;
  category: ProcessConditionType;
  equipment?: string;
  description?: string;
}

export interface DefectMaster {
  id: string;
  code: string;
  name: string;
  severity: 'Minor' | 'Major' | 'Critical';
  description?: string;
  standardImageUrl?: string;
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
  isApproved: boolean;
  accessStartDate?: string | null; // ISO date string
  accessEndDate?: string | null;   // ISO date string
  relativeAccessDays?: number | null; // e.g., 30, 60, 180, 365
}

export interface ProjectAccessLimit {
  startDate?: string | null;
  endDate?: string | null;
  relativeAccessDays?: number | null;
}

export interface UserPermission {
  userId: string;
  projectIds: string[]; // List of project IDs the user can access
  projectAccessLimits?: Record<string, ProjectAccessLimit>;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  link?: string;
  createdAt: string;
  read: boolean;
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
