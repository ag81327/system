import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, limit, updateDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { AppNotification, User } from '../types';

export const createNotification = async (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
  try {
    const newNotification = {
      ...notification,
      createdAt: new Date().toISOString(),
      read: false
    };
    await addDoc(collection(db, 'notifications'), newNotification);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

export const notifyAdmins = async (title: string, message: string, link?: string) => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    const adminDocs = querySnapshot.docs.filter(userDoc => {
      const data = userDoc.data();
      const email = (data.email || '').toLowerCase();
      return data.role === 'Admin' || email === 'amos12282000@gmail.com' || email === 'tcchang1120@gmail.com';
    });

    const adminUserIds = Array.from(new Set(adminDocs.map(doc => doc.id)));
    const notifsRef = collection(db, 'notifications');
    
    const promises = adminUserIds.map(async (adminId) => {
      // Check for existing unread notification with exact same message
      const existingQuery = query(
        notifsRef,
        where('userId', '==', adminId),
        where('message', '==', message),
        where('read', '==', false)
      );
      const existingSnap = await getDocs(existingQuery);
      if (existingSnap.empty) {
        await createNotification({
          userId: adminId,
          title,
          message,
          type: 'alert',
          link
        });
      }
    });
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
};

export const notifyAllUsers = async (title: string, message: string, link?: string) => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    const promises = querySnapshot.docs.map(userDoc => 
      createNotification({
        userId: userDoc.id,
        title,
        message,
        type: 'info',
        link
      })
    );
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error notifying all users:', error);
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

export const deleteNotification = async (notificationId: string) => {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};
