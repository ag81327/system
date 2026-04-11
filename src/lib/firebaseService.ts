import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from './firestoreUtils';
import { Project, Experiment, Sample, User, UserPermission, TestItem, ProcessProfile, FormulationProfile, Attachment, Todo, Announcement, CalendarEvent, MaterialMaster, ProcessParameterMaster, DefectMaster, Recipe, RecipeVersion, DOESession, Comment, AuditLog, ResearchReport } from '../types';

// Generic CRUD operations
export const getDocument = async <T>(path: string, id: string): Promise<T | null> => {
  try {
    const docRef = doc(db, path, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
    return null;
  }
};

export const getCollection = async <T>(path: string): Promise<T[]> => {
  try {
    const colRef = collection(db, path);
    const querySnapshot = await getDocs(colRef);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

// Helper to strip undefined values recursively
const deepClean = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => deepClean(v)).filter(v => v !== undefined);
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Timestamp)) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const cleanedValue = deepClean(value);
      if (cleanedValue !== undefined) {
        acc[key] = cleanedValue;
      }
      return acc;
    }, {} as any);
  }
  return obj;
};

export const saveDocument = async <T extends { id?: string }>(path: string, data: T): Promise<void> => {
  try {
    const id = data.id || doc(collection(db, path)).id;
    const docRef = doc(db, path, id);
    
    const cleanData = deepClean(data);

    await setDoc(docRef, { ...cleanData, id }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const removeDocument = async (path: string, id: string): Promise<void> => {
  try {
    const docRef = doc(db, path, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
  }
};

// Specific Services
export const firebaseService = {
  // Projects
  getProjects: () => getCollection<Project>('projects'),
  saveProject: (project: Project) => saveDocument('projects', project),
  deleteProject: (id: string) => removeDocument('projects', id),

  // Experiments
  getExperiments: () => getCollection<Experiment>('experiments'),
  getExperiment: (id: string) => getDocument<Experiment>('experiments', id),
  getExperimentsByProject: async (projectId: string) => {
    try {
      const q = query(collection(db, 'experiments'), where('projectId', '==', projectId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Experiment));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'experiments');
      return [];
    }
  },
  saveExperiment: (experiment: Experiment) => saveDocument('experiments', experiment),
  deleteExperiment: (id: string) => removeDocument('experiments', id),

  // Samples
  getSamples: (experimentId: string) => getCollection<Sample>(`experiments/${experimentId}/samples`),
  saveSample: (experimentId: string, sample: Sample) => saveDocument(`experiments/${experimentId}/samples`, sample),
  deleteSample: (experimentId: string, id: string) => removeDocument(`experiments/${experimentId}/samples`, id),

  // Users & Permissions
  getUsers: () => getCollection<User>('users'),
  saveUser: (user: User) => saveDocument('users', user),
  deleteUser: async (id: string) => {
    try {
      await removeDocument('users', id);
      await removeDocument('permissions', id);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  },
  getPermissions: () => getCollection<UserPermission>('permissions'),
  savePermission: async (permission: UserPermission) => {
    try {
      const docRef = doc(db, 'permissions', permission.userId);
      const cleanData = deepClean(permission);
      await setDoc(docRef, cleanData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'permissions');
    }
  },

  // Profiles & Test Items
  getTestItems: () => getCollection<TestItem>('testItems'),
  saveTestItem: (item: TestItem) => saveDocument('testItems', item),
  getProcessProfiles: () => getCollection<ProcessProfile>('processProfiles'),
  saveProcessProfile: (profile: ProcessProfile) => saveDocument('processProfiles', profile),
  getFormulationProfiles: () => getCollection<FormulationProfile>('formulationProfiles'),
  saveFormulationProfile: (profile: FormulationProfile) => saveDocument('formulationProfiles', profile),
  deleteTestItem: (id: string) => removeDocument('testItems', id),

  // Master Data
  getMaterials: () => getCollection<MaterialMaster>('materials'),
  saveMaterial: (material: MaterialMaster) => saveDocument('materials', material),
  deleteMaterial: (id: string) => removeDocument('materials', id),

  getProcessParameters: () => getCollection<ProcessParameterMaster>('processParameters'),
  saveProcessParameter: (param: ProcessParameterMaster) => saveDocument('processParameters', param),
  deleteProcessParameter: (id: string) => removeDocument('processParameters', id),

  getDefectMasters: () => getCollection<DefectMaster>('defectMasters'),
  saveDefectMaster: (defect: DefectMaster) => saveDocument('defectMasters', defect),
  deleteDefectMaster: (id: string) => removeDocument('defectMasters', id),

  // Attachments
  getAttachments: (parentId: string) => {
    const q = query(collection(db, 'attachments'), where('parentId', '==', parentId));
    return getDocs(q).then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attachment)));
  },
  saveAttachment: (attachment: Attachment) => saveDocument('attachments', attachment),
  deleteAttachment: (id: string) => removeDocument('attachments', id),

  // Todos
  getTodos: () => getCollection<Todo>('todos'),
  saveTodo: (todo: Todo) => saveDocument('todos', todo),
  deleteTodo: (id: string) => removeDocument('todos', id),

  // Announcements
  getAnnouncements: () => getCollection<Announcement>('announcements'),
  saveAnnouncement: (announcement: Announcement) => saveDocument('announcements', announcement),
  deleteAnnouncement: (id: string) => removeDocument('announcements', id),

  // Calendar Events
  getCalendarEvents: () => getCollection<CalendarEvent>('calendarEvents'),
  saveCalendarEvent: (event: CalendarEvent) => saveDocument('calendarEvents', event),
  deleteCalendarEvent: (id: string) => removeDocument('calendarEvents', id),

  // Recipes
  getRecipes: (projectId?: string) => {
    if (projectId) {
      const q = query(collection(db, 'recipes'), where('projectId', '==', projectId));
      return getDocs(q).then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe)));
    }
    return getCollection<Recipe>('recipes');
  },
  saveRecipe: (recipe: Recipe) => saveDocument('recipes', recipe),
  getRecipeVersions: (recipeId: string) => getCollection<RecipeVersion>(`recipes/${recipeId}/versions`),
  saveRecipeVersion: (recipeId: string, version: RecipeVersion) => saveDocument(`recipes/${recipeId}/versions`, version),

  // DOE
  getDOESessions: (projectId?: string) => {
    if (projectId) {
      const q = query(collection(db, 'doeSessions'), where('projectId', '==', projectId));
      return getDocs(q).then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DOESession)));
    }
    return getCollection<DOESession>('doeSessions');
  },
  saveDOESession: (session: DOESession) => saveDocument('doeSessions', session),
  deleteDOESession: (id: string) => removeDocument('doeSessions', id),

  // Comments
  getComments: (parentId: string) => {
    const q = query(collection(db, 'comments'), where('parentId', '==', parentId));
    return getDocs(q).then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
  },
  saveComment: (comment: Comment) => saveDocument('comments', comment),

  // Audit Logs
  getAuditLogs: (entityId?: string) => {
    if (entityId) {
      const q = query(collection(db, 'auditLogs'), where('entityId', '==', entityId));
      return getDocs(q).then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    }
    return getCollection<AuditLog>('auditLogs');
  },
  saveAuditLog: (log: AuditLog) => saveDocument('auditLogs', log),

  // Research Reports
  getResearchReports: (projectId?: string) => {
    if (projectId) {
      const q = query(collection(db, 'researchReports'), where('projectId', '==', projectId));
      return getDocs(q).then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResearchReport)));
    }
    return getCollection<ResearchReport>('researchReports');
  },
  saveResearchReport: (report: ResearchReport) => saveDocument('researchReports', report),
};
