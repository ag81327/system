import { TestItem, ProcessProfile, Project, User, UserPermission, FormulationProfile, Experiment, Sample, Attachment, Todo, Announcement, CalendarEvent } from '../types';
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

export const getPersistentTestItems = async (): Promise<TestItem[]> => {
  return firebaseService.getTestItems();
};

export const savePersistentTestItems = async (items: TestItem[]) => {
  for (const item of items) {
    await firebaseService.saveTestItem(item);
  }
};

export const deletePersistentTestItem = async (id: string) => {
  await firebaseService.deleteTestItem(id);
};

export const getPersistentProfiles = async (): Promise<ProcessProfile[]> => {
  return firebaseService.getProcessProfiles();
};

export const savePersistentProfiles = async (profiles: ProcessProfile[]) => {
  for (const profile of profiles) {
    await firebaseService.saveProcessProfile(profile);
  }
};

export const getPersistentFormulationProfiles = async (): Promise<FormulationProfile[]> => {
  return firebaseService.getFormulationProfiles();
};

export const savePersistentFormulationProfiles = async (profiles: FormulationProfile[]) => {
  for (const profile of profiles) {
    await firebaseService.saveFormulationProfile(profile);
  }
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
