import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, AtSign, CheckCircle2, ShieldCheck, User, Clock, MoreHorizontal } from 'lucide-react';
import { Comment, Experiment, AuditLog } from '../types';
import { cn } from '../lib/utils';
import { getPersistentComments, savePersistentComment, savePersistentAuditLog } from '../lib/persistence';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface CollaborationReviewProps {
  experiment: Experiment;
  currentUser: { id: string; name: string; avatar?: string };
  onSigned: (signature: { userId: string; userName: string; signedAt: string }) => void;
}

export const CollaborationReview: React.FC<CollaborationReviewProps> = ({ experiment, currentUser, onSigned }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'comments' | 'audit'>('comments');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const fetchedComments = await getPersistentComments(experiment.id);
      setComments(fetchedComments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    };
    fetchData();
  }, [experiment.id]);

  const handleSendComment = async () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: uuidv4(),
      parentId: experiment.id,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      content: newComment,
      createdAt: new Date().toISOString()
    };

    await savePersistentComment(comment);
    setComments([...comments, comment]);
    setNewComment('');
    toast.success('評論已發送');
  };

  const handleSign = async () => {
    const signature = {
      userId: currentUser.id,
      userName: currentUser.name,
      signedAt: new Date().toISOString()
    };

    onSigned(signature);

    // Create audit log
    const auditLog: AuditLog = {
      id: uuidv4(),
      userId: currentUser.id,
      userName: currentUser.name,
      action: 'SIGN',
      entityType: 'Experiment',
      entityId: experiment.id,
      details: JSON.stringify({ message: 'Experiment signed and verified' }),
      timestamp: new Date().toISOString()
    };
    await savePersistentAuditLog(auditLog);

    toast.success('電子簽章完成，實驗已封存');
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden flex flex-col h-[500px]">
      {/* Header Tabs */}
      <div className="flex items-center border-b border-slate-100 bg-slate-50/50">
        <button 
          onClick={() => setActiveTab('comments')}
          className={cn(
            "flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
            activeTab === 'comments' ? "text-brand-600 border-brand-500 bg-white" : "text-slate-400 border-transparent hover:text-slate-600"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" />
            團隊討論 ({comments.length})
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('audit')}
          className={cn(
            "flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
            activeTab === 'audit' ? "text-brand-600 border-brand-500 bg-white" : "text-slate-400 border-transparent hover:text-slate-600"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            稽核軌跡
          </div>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {activeTab === 'comments' ? (
          <>
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0">
                  {comment.userName.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">{comment.userName}</span>
                    <span className="text-[10px] text-slate-400">{format(new Date(comment.createdAt), 'HH:mm')}</span>
                  </div>
                  <div className="bg-slate-50 rounded-2xl rounded-tl-none p-3 text-sm text-slate-700">
                    {comment.content}
                  </div>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                <MessageSquare className="w-12 h-12 mb-2" />
                <p className="text-xs">尚未有討論紀錄</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-xs font-bold text-emerald-900">符合 ELN 稽核規範</p>
                <p className="text-[10px] text-emerald-700">所有變更均已加密記錄並不可篡改。</p>
              </div>
            </div>
            {/* Audit Log Items would go here */}
            <div className="text-center py-8">
              <p className="text-xs text-slate-400 italic">稽核紀錄載入中...</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-100 bg-white">
        {activeTab === 'comments' ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input 
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendComment()}
                placeholder="輸入評論或 @提及成員..."
                className="w-full bg-slate-50 border border-slate-100 rounded-full px-4 py-2 text-sm focus:bg-white focus:border-brand-500 transition-all outline-none"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500">
                <AtSign className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={handleSendComment}
              className="p-2 bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-500" />
              <span className="text-xs font-medium text-slate-600">實驗狀態：{experiment.status}</span>
            </div>
            {!experiment.signature ? (
              <button 
                onClick={handleSign}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                電子簽章並封存
              </button>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-bold">已簽署：{experiment.signature.userName}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
