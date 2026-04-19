import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Bell, 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  User as UserIcon,
  X,
  AlertCircle,
  Info,
  CheckCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from './AuthContext';
import { 
  getPersistentTodos, 
  savePersistentTodo, 
  deletePersistentTodo,
  getPersistentAnnouncements,
  savePersistentAnnouncement,
  deletePersistentAnnouncement,
  getPersistentCalendarEvents,
  savePersistentCalendarEvent,
  deletePersistentCalendarEvent,
  getPersistentUsers
} from '../lib/persistence';
import { Todo, Announcement, CalendarEvent, User } from '../types';
import { toast } from 'sonner';

// --- Helper: User Selector ---
const UserSelector = ({ selectedIds, onToggle, users }: { selectedIds: string[], onToggle: (id: string) => void, users: User[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative mt-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:border-slate-300 transition-all"
      >
        <span className="truncate">
          {selectedIds.length === 0 
            ? "選擇人員..." 
            : `已選擇 ${selectedIds.length} 位人員`}
        </span>
        <ChevronRight className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-90")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="p-1">
              {users.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onToggle(user.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    selectedIds.includes(user.id) 
                      ? "bg-brand-50 text-brand-600 font-bold" 
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <div className="shrink-0">
                    {selectedIds.includes(user.id) ? (
                      <CheckCircle className="w-4 h-4 text-brand-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="w-5 h-5 text-slate-400" />
                  )}
                  <span className="truncate">{user.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedIds.map(id => {
            const user = users.find(u => u.id === id);
            if (!user) return null;
            return (
              <div key={id} className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-full text-[10px] text-slate-600">
                <span>{user.name}</span>
                <button type="button" onClick={() => onToggle(id)} className="hover:text-rose-500">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- To-do List Widget ---
export const TodoList = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      const [todosData, usersData] = await Promise.all([
        getPersistentTodos(),
        getPersistentUsers()
      ]);
      
      // Filter todos: Admin sees all, others see only assigned or created by them
      const filteredTodos = todosData.filter(t => 
        user?.role === 'Admin' || 
        t.assignees.includes(user?.id || '') || 
        t.id.startsWith('t') // Assuming local creation for now, but better to check authorId if added
      );

      setTodos(filteredTodos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setUsers(usersData);
    };
    fetchData();
  }, [user?.id, user?.role]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    
    const todo: Todo = {
      id: `t${Date.now()}`,
      text: newTodo,
      completed: false,
      assignees: selectedAssignees,
      createdAt: new Date().toISOString()
    };

    try {
      await savePersistentTodo(todo);
      setTodos([todo, ...todos]);
      
      // Notify assignees
      if (selectedAssignees.length > 0) {
        const { createNotification } = await import('../services/notificationService');
        const promises = selectedAssignees.map(uid => 
          createNotification({
            userId: uid,
            title: '新任務指派',
            message: `您有一個新任務: ${newTodo}`,
            type: 'info',
            link: '/'
          })
        );
        await Promise.all(promises);
      }

      setNewTodo('');
      setSelectedAssignees([]);
      setIsAdding(false);
      toast.success('任務已新增');
    } catch (error) {
      toast.error('新增失敗');
    }
  };

  const toggleTodo = async (todo: Todo) => {
    const updated = { ...todo, completed: !todo.completed };
    try {
      await savePersistentTodo(updated);
      setTodos(todos.map(t => t.id === todo.id ? updated : t));
    } catch (error) {
      toast.error('更新失敗');
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await deletePersistentTodo(id);
      setTodos(todos.filter(t => t.id !== id));
      toast.success('任務已刪除');
    } catch (error) {
      toast.error('刪除失敗');
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          代辦事項
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">{todos.filter(t => !t.completed).length} 待完成</span>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="p-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAddTodo} className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-3">
            <input 
              type="text" 
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="輸入任務內容..."
              autoFocus
              className="w-full bg-white border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">指派人員</p>
              <UserSelector 
                users={users} 
                selectedIds={selectedAssignees} 
                onToggle={(id) => setSelectedAssignees(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} 
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                type="submit"
                className="flex-1 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
              >
                新增
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {todos.map(todo => (
          <div 
            key={todo.id} 
            className={cn(
              "flex items-center justify-between p-3 rounded-xl border transition-all group",
              todo.completed ? "bg-slate-50 border-transparent opacity-60" : "bg-white border-slate-100 hover:border-brand-100"
            )}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button onClick={() => toggleTodo(todo)} className="shrink-0">
                {todo.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 hover:text-brand-500" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm truncate",
                  todo.completed ? "text-slate-400 line-through" : "text-slate-700 font-medium"
                )}>
                  {todo.text}
                </p>
                {todo.assignees.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {todo.assignees.map(uid => {
                      const user = users.find(u => u.id === uid);
                      if (!user) return null;
                      return (
                        <div key={uid} className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          <UserIcon className="w-2.5 h-2.5" />
                          {user.name}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <button 
              onClick={() => handleDeleteTodo(todo.id)}
              className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {todos.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <CheckCircle2 className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm">目前無待辦事項</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Bulletin Board Widget ---
export const BulletinBoard = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isViewAll, setIsViewAll] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', type: 'info' as Announcement['type'], targetUsers: [] as string[] });

  const { user } = useAuth();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [data, usersData] = await Promise.all([
        getPersistentAnnouncements(),
        getPersistentUsers()
      ]);
      
      // Filter announcements: Admin sees all, others see only targeted or public (targetUsers empty)
      const filtered = data.filter(a => 
        user?.role === 'Admin' || 
        a.targetUsers.length === 0 || 
        a.targetUsers.includes(user?.id || '') ||
        a.authorId === user?.id
      );

      setAnnouncements(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setUsers(usersData);
    };
    fetchData();
  }, [user?.id, user?.role]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return;

    const announcement: Announcement = {
      id: `a${Date.now()}`,
      ...newAnnouncement,
      date: new Date().toISOString().split('T')[0],
      authorId: 'system' // In a real app, this would be the current user's ID
    };

    try {
      await savePersistentAnnouncement(announcement);
      setAnnouncements([announcement, ...announcements]);

      // Notify users
      const { notifyAllUsers, createNotification } = await import('../services/notificationService');
      if (newAnnouncement.targetUsers.length > 0) {
        const promises = newAnnouncement.targetUsers.map(uid => 
          createNotification({
            userId: uid,
            title: '新公告通知',
            message: `您有一則新公告: ${newAnnouncement.title}`,
            type: 'info',
            link: '/'
          })
        );
        await Promise.all(promises);
      } else {
        await notifyAllUsers('新公告通知', `系統發佈了新公告: ${newAnnouncement.title}`, '/');
      }

      setNewAnnouncement({ title: '', content: '', type: 'info', targetUsers: [] });
      setIsAdding(false);
      toast.success('公告已發佈');
    } catch (error) {
      toast.error('發佈失敗');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePersistentAnnouncement(id);
      setAnnouncements(announcements.filter(a => a.id !== id));
      toast.success('公告已刪除');
    } catch (error) {
      toast.error('刪除失敗');
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-500" />
          公佈欄
        </h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsViewAll(true)}
            className="text-xs font-bold text-brand-600 hover:underline"
          >
            查看全部
          </button>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="p-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-3">
            <input 
              type="text" 
              value={newAnnouncement.title}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
              placeholder="公告標題..."
              className="w-full bg-white border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
            />
            <textarea 
              value={newAnnouncement.content}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
              placeholder="公告內容 (支援換行)..."
              rows={5}
              className="w-full bg-white border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex gap-2">
              {(['info', 'warning', 'success'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNewAnnouncement({ ...newAnnouncement, type })}
                  className={cn(
                    "flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all",
                    newAnnouncement.type === type 
                      ? (type === 'info' ? "bg-blue-50 border-blue-200 text-blue-600" : type === 'warning' ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-emerald-50 border-emerald-200 text-emerald-600")
                      : "bg-white border-slate-200 text-slate-500"
                  )}
                >
                  {type === 'info' ? '一般' : type === 'warning' ? '重要' : '喜訊'}
                </button>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">公告對象 (留空為所有人)</p>
              <UserSelector 
                users={users} 
                selectedIds={newAnnouncement.targetUsers} 
                onToggle={(id) => setNewAnnouncement(prev => ({ ...prev, targetUsers: prev.targetUsers.includes(id) ? prev.targetUsers.filter(i => i !== id) : [...prev.targetUsers, id] }))} 
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                type="submit"
                className="flex-1 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
              >
                發佈
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
        {announcements.slice(0, 5).map(item => (
          <div 
            key={item.id} 
            onClick={() => setSelectedAnnouncement(item)}
            className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-brand-100 transition-all cursor-pointer group relative"
          >
            <div className="flex items-center justify-between mb-2">
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                item.type === 'warning' ? "bg-amber-100 text-amber-700" :
                item.type === 'success' ? "bg-emerald-100 text-emerald-700" :
                "bg-blue-100 text-blue-700"
              )}>
                {item.type === 'warning' ? '重要' : item.type === 'success' ? '喜訊' : '通知'}
              </span>
              <span className="text-[10px] text-slate-400">{item.date}</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">{item.title}</h4>
            <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed whitespace-pre-wrap">{item.content}</p>
            {item.targetUsers && item.targetUsers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.targetUsers.map(uid => {
                  const user = users.find(u => u.id === uid);
                  return user ? (
                    <span key={uid} className="text-[8px] bg-white text-slate-400 px-1 rounded border border-slate-100">@{user.name}</span>
                  ) : null;
                })}
              </div>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
              className="absolute top-2 right-2 p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {announcements.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Bell className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm">目前無公告事項</p>
          </div>
        )}
      </div>

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                  selectedAnnouncement.type === 'warning' ? "bg-amber-100 text-amber-700" :
                  selectedAnnouncement.type === 'success' ? "bg-emerald-100 text-emerald-700" :
                  "bg-blue-100 text-blue-700"
                )}>
                  {selectedAnnouncement.type === 'warning' ? '重要' : selectedAnnouncement.type === 'success' ? '喜訊' : '通知'}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{selectedAnnouncement.title}</h3>
              </div>
              <button onClick={() => setSelectedAnnouncement(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <p className="text-sm text-slate-400 mb-4">{selectedAnnouncement.date}</p>
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedAnnouncement.content}</p>
              </div>
              {selectedAnnouncement.targetUsers && selectedAnnouncement.targetUsers.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">公告對象</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAnnouncement.targetUsers.map(uid => {
                      const user = users.find(u => u.id === uid);
                      return user ? (
                        <span key={uid} className="text-xs bg-slate-50 text-slate-600 px-2 py-1 rounded-lg border border-slate-100">@{user.name}</span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setSelectedAnnouncement(null)}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-all"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View All Modal */}
      {isViewAll && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">所有公告事項</h3>
              <button onClick={() => setIsViewAll(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {announcements.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => {
                    setIsViewAll(false);
                    setSelectedAnnouncement(item);
                  }}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-brand-100 transition-all cursor-pointer group relative"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                        item.type === 'warning' ? "bg-amber-100 text-amber-700" :
                        item.type === 'success' ? "bg-emerald-100 text-emerald-700" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {item.type === 'warning' ? '重要' : item.type === 'success' ? '喜訊' : '通知'}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{item.title}</span>
                    </div>
                    <span className="text-xs text-slate-400">{item.date}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                  {item.targetUsers && item.targetUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.targetUsers.map(uid => {
                        const user = users.find(u => u.id === uid);
                        return user ? (
                          <span key={uid} className="text-[10px] bg-white text-slate-500 px-1.5 py-0.5 rounded border border-slate-100">@{user.name}</span>
                        ) : null;
                      })}
                    </div>
                  )}
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="absolute top-4 right-4 p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Calendar Widget ---
export const DashboardCalendar = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isDetailsView, setIsDetailsView] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [newEvent, setNewEvent] = useState({ title: '', time: '09:00', description: '', participants: [] as string[] });

  useEffect(() => {
    const fetchData = async () => {
      const [eventsData, usersData] = await Promise.all([
        getPersistentCalendarEvents(),
        getPersistentUsers()
      ]);
      
      // Filter events: Admin sees all, others see only where they are participants or author
      const filtered = eventsData.filter(e => 
        user?.role === 'Admin' || 
        e.participants.includes(user?.id || '') ||
        e.authorId === user?.id
      );

      setEvents(filtered);
      setUsers(usersData);
    };
    fetchData();
  }, [user?.id, user?.role]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim() || !selectedDate) return;

    const event: CalendarEvent = {
      id: `ev${Date.now()}`,
      title: newEvent.title,
      date: selectedDate,
      time: newEvent.time,
      description: newEvent.description,
      participants: newEvent.participants,
      authorId: 'system'
    };

    try {
      await savePersistentCalendarEvent(event);
      setEvents([...events, event]);

      // Notify participants
      if (newEvent.participants.length > 0) {
        const { createNotification } = await import('../services/notificationService');
        const promises = newEvent.participants.map(uid => 
          createNotification({
            userId: uid,
            title: '新行程通知',
            message: `您被邀請參加活動: ${newEvent.title} (${selectedDate} ${newEvent.time})`,
            type: 'info',
            link: '/'
          })
        );
        await Promise.all(promises);
      }

      setNewEvent({ title: '', time: '09:00', description: '', participants: [] });
      setIsAdding(false);
      toast.success('活動已新增');
    } catch (error) {
      toast.error('新增失敗');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deletePersistentCalendarEvent(id);
      setEvents(events.filter(e => e.id !== id));
      toast.success('活動已刪除');
    } catch (error) {
      toast.error('刪除失敗');
    }
  };

  const upcomingEvents = useMemo(() => {
    return events
      .filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)))
      .sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.time.localeCompare(b.time);
      });
  }, [events]);

  return (
    <div className="glass-panel p-6 rounded-2xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-500" />
          行事曆
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[80px] text-center">
            {currentDate.getFullYear()} {monthNames[currentDate.getMonth()]}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['日', '一', '二', '三', '四', '五', '六'].map(day => (
          <div key={day} className="text-center text-[10px] font-bold text-slate-400 py-1">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 flex-1">
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square"></div>
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEvents = events.filter(e => e.date === dateStr);
          const hasEvent = dayEvents.length > 0;
          const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

          return (
            <div 
              key={day} 
              onClick={() => {
                setSelectedDate(dateStr);
                if (dayEvents.length > 0) {
                  setSelectedDayEvents(dayEvents);
                  setIsDetailsView(true);
                } else {
                  setIsAdding(true);
                }
              }}
              className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all relative cursor-pointer",
                isToday ? "bg-brand-600 text-white font-bold shadow-lg shadow-brand-200" : "hover:bg-slate-50 text-slate-700",
                hasEvent && !isToday && "font-bold text-brand-600"
              )}
            >
              {day}
              {hasEvent && (
                <div className={cn(
                  "w-1 h-1 rounded-full absolute bottom-1",
                  isToday ? "bg-white" : "bg-brand-500"
                )}></div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">近期活動</h4>
        {upcomingEvents.slice(0, 3).map((event) => (
          <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100 group relative">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{event.title}</p>
              <p className="text-[10px] text-slate-500">{event.date} {event.time}</p>
              {event.participants.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {event.participants.map(uid => {
                    const user = users.find(u => u.id === uid);
                    return user ? (
                      <div key={uid} className="text-[8px] bg-white border border-slate-100 px-1 rounded text-slate-400">
                        {user.name}
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
              className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {upcomingEvents.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4 italic">目前無近期活動</p>
        )}
      </div>

      {/* Event Details Modal */}
      {isDetailsView && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">活動詳情</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedDate}</p>
              </div>
              <button onClick={() => setIsDetailsView(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
              {selectedDayEvents.map((event) => (
                <div key={event.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 group relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                      {event.time}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{event.title}</h4>
                  </div>
                  {event.description && (
                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">{event.description}</p>
                  )}
                  {event.participants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-slate-200/50 pt-3">
                      {event.participants.map(uid => {
                        const user = users.find(u => u.id === uid);
                        return user ? (
                          <span key={uid} className="text-[10px] bg-white border border-slate-100 px-2 py-0.5 rounded-lg text-slate-600">
                            {user.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      handleDeleteEvent(event.id);
                      setSelectedDayEvents(prev => prev.filter(e => e.id !== event.id));
                      if (selectedDayEvents.length === 1) setIsDetailsView(false);
                    }}
                    className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setIsDetailsView(false)}
                className="flex-1 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                關閉
              </button>
              <button 
                onClick={() => {
                  setIsDetailsView(false);
                  setIsAdding(true);
                }}
                className="flex-1 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                新增活動
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">新增活動 - {selectedDate}</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleAddEvent} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">活動標題</label>
                <input 
                  type="text" 
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="輸入活動名稱..."
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">時間</label>
                <input 
                  type="time" 
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">參與人員</label>
                <UserSelector 
                  users={users} 
                  selectedIds={newEvent.participants} 
                  onToggle={(id) => setNewEvent(prev => ({ ...prev, participants: prev.participants.includes(id) ? prev.participants.filter(i => i !== id) : [...prev.participants, id] }))} 
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-lg shadow-brand-200"
                >
                  新增活動
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
