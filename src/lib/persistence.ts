import { TestItem, ProcessProfile, Project, User, UserPermission, FormulationProfile, Experiment, Sample, Attachment, Todo, Announcement, CalendarEvent, MaterialMaster, ProcessParameterMaster, DefectMaster, Recipe, RecipeVersion, DOESession, Comment, AuditLog, ResearchReport } from '../types';
import { firebaseService } from './firebaseService';

export const getPersistentUsers = async (): Promise<User[]> => {
  return firebaseService.getUsers();
};

export const savePersistentUsers = async (users: User[]) => {
  for (const user of users) {
    await firebaseService.saveUser(user);
  }
};

export const deletePersistentUser = async (id: string) => {
  await firebaseService.deleteUser(id);
};

export const getPersistentPermissions = async (): Promise<UserPermission[]> => {
  return firebaseService.getPermissions();
};

export const savePersistentPermissions = async (permissions: UserPermission[]) => {
  for (const permission of permissions) {
    await firebaseService.savePermission(permission);
  }
};

export const getPersistentProjects = async (): Promise<Project[]> => {
  return firebaseService.getProjects();
};

export const savePersistentProject = async (project: Project) => {
  await firebaseService.saveProject(project);
};

export const savePersistentExperiment = async (experiment: Experiment) => {
  await firebaseService.saveExperiment(experiment);
};

export const deletePersistentExperiment = async (id: string) => {
  await firebaseService.deleteExperiment(id);
};

export const savePersistentSample = async (experimentId: string, sample: Sample) => {
  await firebaseService.saveSample(experimentId, sample);
};

export const getPersistentExperiments = async (): Promise<Experiment[]> => {
  return firebaseService.getExperiments();
};

export const getPersistentExperiment = async (id: string): Promise<Experiment | undefined> => {
  return firebaseService.getExperiment(id);
};

export const savePersistentExperiments = async (experiments: Experiment[]) => {
  for (const experiment of experiments) {
    await firebaseService.saveExperiment(experiment);
  }
};

export const getPersistentSamples = async (experimentId: string): Promise<Sample[]> => {
  return firebaseService.getSamples(experimentId);
};

export const savePersistentSamples = async (experimentId: string, samples: Sample[]) => {
  for (const sample of samples) {
    await firebaseService.saveSample(experimentId, sample);
  }
};

export const deletePersistentSample = async (experimentId: string, id: string) => {
  await firebaseService.deleteSample(experimentId, id);
};

// LocalStorage Fallback Utilities
const getLocalArray = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalItem = <T extends { id: string }>(key: string, item: T) => {
  try {
    const list = getLocalArray<T>(key);
    const updated = [...list.filter(i => i.id !== item.id), item];
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.error('LocalStorage save error:', e);
  }
};

const deleteLocalItem = (key: string, id: string) => {
  try {
    const list = getLocalArray<{ id: string }>(key);
    const updated = list.filter(i => i.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.error('LocalStorage delete error:', e);
  }
};

export const getPersistentTestItems = async (): Promise<TestItem[]> => {
  let cloudItems: TestItem[] = [];
  try {
    cloudItems = await firebaseService.getTestItems();
  } catch (e) {
    console.warn('Could not fetch testItems from Cloud Firestore:', e);
  }
  const localItems = getLocalArray<TestItem>('rd_testItems');
  const map = new Map<string, TestItem>();
  cloudItems.forEach(i => map.set(i.id, i));
  localItems.forEach(i => map.set(i.id, i));
  return Array.from(map.values());
};

export const savePersistentTestItem = async (item: TestItem) => {
  saveLocalItem('rd_testItems', item);
  try {
    await firebaseService.saveTestItem(item);
  } catch (e) {
    console.warn('Could not save testItem to Cloud Firestore, saved locally:', e);
  }
};

export const savePersistentTestItems = async (items: TestItem[]) => {
  for (const item of items) {
    await savePersistentTestItem(item);
  }
};

export const deletePersistentTestItem = async (id: string) => {
  deleteLocalItem('rd_testItems', id);
  try {
    await firebaseService.deleteTestItem(id);
  } catch (e) {
    console.warn('Could not delete testItem from Cloud Firestore:', e);
  }
};

export const getPersistentProfiles = async (userId?: string): Promise<ProcessProfile[]> => {
  return firebaseService.getProcessProfiles(userId);
};

export const savePersistentProfiles = async (profiles: ProcessProfile[]) => {
  for (const profile of profiles) {
    await firebaseService.saveProcessProfile(profile);
  }
};

export const deletePersistentProfile = async (id: string) => {
  await firebaseService.deleteProcessProfile(id);
};

export const getPersistentFormulationProfiles = async (userId?: string): Promise<FormulationProfile[]> => {
  return firebaseService.getFormulationProfiles(userId);
};

export const savePersistentFormulationProfiles = async (profiles: FormulationProfile[]) => {
  for (const profile of profiles) {
    await firebaseService.saveFormulationProfile(profile);
  }
};

export const deletePersistentFormulationProfile = async (id: string) => {
  await firebaseService.deleteFormulationProfile(id);
};

export const getPersistentAttachments = async (parentId: string): Promise<Attachment[]> => {
  return firebaseService.getAttachments(parentId);
};

export const savePersistentAttachment = async (attachment: Attachment) => {
  await firebaseService.saveAttachment(attachment);
};

export const deletePersistentAttachment = async (id: string) => {
  await firebaseService.deleteAttachment(id);
};

export const getPersistentTodos = async (): Promise<Todo[]> => {
  return firebaseService.getTodos();
};

export const savePersistentTodo = async (todo: Todo) => {
  await firebaseService.saveTodo(todo);
};

export const deletePersistentTodo = async (id: string) => {
  await firebaseService.deleteTodo(id);
};

export const getPersistentAnnouncements = async (): Promise<Announcement[]> => {
  return firebaseService.getAnnouncements();
};

export const savePersistentAnnouncement = async (announcement: Announcement) => {
  await firebaseService.saveAnnouncement(announcement);
};

export const deletePersistentAnnouncement = async (id: string) => {
  await firebaseService.deleteAnnouncement(id);
};

export const getPersistentCalendarEvents = async (): Promise<CalendarEvent[]> => {
  return firebaseService.getCalendarEvents();
};

export const savePersistentCalendarEvent = async (event: CalendarEvent) => {
  await firebaseService.saveCalendarEvent(event);
};

export const deletePersistentCalendarEvent = async (id: string) => {
  await firebaseService.deleteCalendarEvent(id);
};

// Master Data Persistence
export const getPersistentMaterials = async (): Promise<MaterialMaster[]> => {
  let cloud: MaterialMaster[] = [];
  try { cloud = await firebaseService.getMaterials(); } catch (e) { console.warn(e); }
  const local = getLocalArray<MaterialMaster>('rd_materials');
  const map = new Map<string, MaterialMaster>();
  cloud.forEach(i => map.set(i.id, i));
  local.forEach(i => map.set(i.id, i));
  return Array.from(map.values());
};

export const savePersistentMaterial = async (material: MaterialMaster) => {
  saveLocalItem('rd_materials', material);
  try {
    await firebaseService.saveMaterial(material);
  } catch (e) {
    console.warn('Could not save material to Cloud Firestore, saved locally:', e);
  }
};

export const deletePersistentMaterial = async (id: string) => {
  deleteLocalItem('rd_materials', id);
  try {
    await firebaseService.deleteMaterial(id);
  } catch (e) {
    console.warn('Could not delete material from Cloud Firestore:', e);
  }
};

export const getPersistentProcessParameters = async (): Promise<ProcessParameterMaster[]> => {
  let cloud: ProcessParameterMaster[] = [];
  try { cloud = await firebaseService.getProcessParameters(); } catch (e) { console.warn(e); }
  const local = getLocalArray<ProcessParameterMaster>('rd_processParameters');
  const map = new Map<string, ProcessParameterMaster>();
  cloud.forEach(i => map.set(i.id, i));
  local.forEach(i => map.set(i.id, i));
  return Array.from(map.values());
};

export const savePersistentProcessParameter = async (param: ProcessParameterMaster) => {
  saveLocalItem('rd_processParameters', param);
  try {
    await firebaseService.saveProcessParameter(param);
  } catch (e) {
    console.warn('Could not save processParameter to Cloud Firestore, saved locally:', e);
  }
};

export const deletePersistentProcessParameter = async (id: string) => {
  deleteLocalItem('rd_processParameters', id);
  try {
    await firebaseService.deleteProcessParameter(id);
  } catch (e) {
    console.warn('Could not delete processParameter from Cloud Firestore:', e);
  }
};

export const getPersistentDefectMasters = async (): Promise<DefectMaster[]> => {
  let cloud: DefectMaster[] = [];
  try { cloud = await firebaseService.getDefectMasters(); } catch (e) { console.warn(e); }
  const local = getLocalArray<DefectMaster>('rd_defectMasters');
  const map = new Map<string, DefectMaster>();
  cloud.forEach(i => map.set(i.id, i));
  local.forEach(i => map.set(i.id, i));
  return Array.from(map.values());
};

export const savePersistentDefectMaster = async (defect: DefectMaster) => {
  saveLocalItem('rd_defectMasters', defect);
  try {
    await firebaseService.saveDefectMaster(defect);
  } catch (e) {
    console.warn('Could not save defectMaster to Cloud Firestore, saved locally:', e);
  }
};

export const deletePersistentDefectMaster = async (id: string) => {
  deleteLocalItem('rd_defectMasters', id);
  try {
    await firebaseService.deleteDefectMaster(id);
  } catch (e) {
    console.warn('Could not delete defectMaster from Cloud Firestore:', e);
  }
};

// R&D Persistence
export const getPersistentRecipes = async (projectId?: string): Promise<Recipe[]> => {
  return firebaseService.getRecipes(projectId);
};

export const savePersistentRecipe = async (recipe: Recipe) => {
  await firebaseService.saveRecipe(recipe);
};

export const getPersistentRecipeVersions = async (recipeId: string): Promise<RecipeVersion[]> => {
  return firebaseService.getRecipeVersions(recipeId);
};

export const savePersistentRecipeVersion = async (recipeId: string, version: RecipeVersion) => {
  await firebaseService.saveRecipeVersion(recipeId, version);
};

export const getPersistentDOESessions = async (projectId?: string): Promise<DOESession[]> => {
  return firebaseService.getDOESessions(projectId);
};

export const savePersistentDOESession = async (session: DOESession) => {
  await firebaseService.saveDOESession(session);
};

export const deletePersistentDOESession = async (id: string) => {
  await firebaseService.deleteDOESession(id);
};

export const getPersistentComments = async (parentId: string): Promise<Comment[]> => {
  return firebaseService.getComments(parentId);
};

export const savePersistentComment = async (comment: Comment) => {
  await firebaseService.saveComment(comment);
};

export const getPersistentAuditLogs = async (entityId?: string): Promise<AuditLog[]> => {
  return firebaseService.getAuditLogs(entityId);
};

export const savePersistentAuditLog = async (log: AuditLog) => {
  await firebaseService.saveAuditLog(log);
};

export const getPersistentResearchReports = async (projectId?: string): Promise<ResearchReport[]> => {
  return firebaseService.getResearchReports(projectId);
};

export const savePersistentResearchReport = async (report: ResearchReport) => {
  await firebaseService.saveResearchReport(report);
};
