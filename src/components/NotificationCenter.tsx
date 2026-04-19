import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, ExternalLink, X, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from './AuthContext';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export const NotificationCenter: React.FC = () => {
  const { notifications, unreadCount, markAsRead, removeNotification } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: any) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
      setIsOpen(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-2 text-slate-500 hover:bg-slate-100 rounded-full relative transition-colors",
          isOpen && "bg-slate-100 text-brand-600"
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[100] overflow-hidden flex flex-col max-h-[500px]"
          >
            <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900">通知中心</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full">
                {unreadCount} 則未讀
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {notifications.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={cn(
                        "p-4 hover:bg-slate-50 transition-colors cursor-pointer relative group",
                        !notif.read && "bg-brand-50/30"
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="shrink-0 mt-1">
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn("text-sm font-bold truncate", !notif.read ? "text-slate-900" : "text-slate-600")}>
                              {notif.title}
                            </p>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: zhTW })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                          {notif.link && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-brand-600">
                              <ExternalLink className="w-3 h-3" />
                              查看詳情
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notif.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="刪除通知"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {!notif.read && (
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-500 rounded-full"></div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 text-sm">目前沒有任何通知</p>
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  關閉
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
