import React, { useState, useMemo } from 'react';
import { User, Eye, Ban, Trash2, Key, BarChart2, Shield, Search } from 'lucide-react';
import Card from '../common/Card';

export default function UsersManagement({
  students,
  onSuspend,
  onDelete,
  onUpgradePlan,
  onResetPassword,
  role,
  showToast
}) {
  const [searchText, setSearchText] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Modals confirmation state
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'suspend'|'delete', userId: string }

  // Filter students
  const filtered = useMemo(() => {
    return students.filter(s => {
      const q = searchText.toLowerCase();
      return (
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
      );
    });
  }, [students, searchText]);

  // Security authorization checks
  const canPerformWrite = role === 'Super Admin' || role === 'Admin';
  const canPerformDestructive = role === 'Super Admin';

  const handleActionClick = (type, userId) => {
    if (type === 'delete' && !canPerformDestructive) {
      showToast("Access Denied: Only Super Admin can delete users.");
      return;
    }
    if (type === 'suspend' && !canPerformWrite) {
      showToast("Access Denied: Support role cannot modify user status.");
      return;
    }
    setConfirmAction({ type, userId });
  };

  const handleConfirm = () => {
    if (!confirmAction) return;
    const { type, userId } = confirmAction;
    if (type === 'delete') {
      onDelete(userId);
      showToast("User account deleted permanently.");
    } else if (type === 'suspend') {
      onSuspend(userId);
    }
    setConfirmAction(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search name, email, user ID..."
            className="w-full pl-9 pr-4 py-2 bg-card border border-border-theme rounded-xl text-xs font-semibold focus-ring text-primary"
          />
        </div>
        <div className="text-[10px] text-muted font-bold">
          Found {filtered.length} matching students
        </div>
      </div>

      {/* Users Table */}
      <Card className="bg-card border-border-theme p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                <th className="p-4">User</th>
                <th className="p-4">Plan</th>
                <th className="p-4 text-center">AI Requests</th>
                <th className="p-4 text-center">Workspaces</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-theme font-semibold text-primary">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-muted font-bold">
                    No users matching search filters.
                  </td>
                </tr>
              ) : (
                filtered.map(u => {
                  const isOnline = u.isOnline || false;
                  return (
                    <tr key={u.id} className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <div className="h-8 w-8 bg-bg-secondary border border-border-theme rounded-full flex items-center justify-center text-slate-500">
                              <User className="w-4 h-4" />
                            </div>
                            <span className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-card ${
                              isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'
                            }`} />
                          </div>
                          <div>
                            <span className="font-bold text-primary block">{u.name}</span>
                            <span className="text-[10px] text-muted block font-mono">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          u.isPro 
                            ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                            : 'bg-bg-secondary text-slate-400 dark:text-slate-500'
                        }`}>
                          {u.isPro ? 'Premium Pro' : 'Free Basic'}
                        </span>
                      </td>
                      <td className="p-4 text-center">{u.aiUsageCount || 15}</td>
                      <td className="p-4 text-center">{u.workspaceCount || 2}</td>
                      <td className="p-4">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          u.status === 'suspended'
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-green-500/10 text-green-500'
                        }`}>
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-1">
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="p-1.5 hover:bg-bg-secondary rounded-lg text-slate-400 hover:text-primary transition-all"
                          title="View Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleActionClick('suspend', u.id)}
                          className="p-1.5 hover:bg-bg-secondary rounded-lg text-slate-400 hover:text-yellow-500 transition-all"
                          title="Suspend/Toggle Status"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleActionClick('delete', u.id)}
                          className="p-1.5 hover:bg-bg-secondary rounded-lg text-slate-400 hover:text-red-500 transition-all"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-xs">
          <Card className="w-full max-w-sm bg-card border-border-theme p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary">
              Confirm {confirmAction.type} Action
            </h3>
            <p className="text-xs text-muted leading-relaxed font-semibold">
              Are you sure you want to {confirmAction.type} this user? This action may modify active student sessions.
            </p>
            <div className="flex justify-end space-x-2.5">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 border border-border-theme text-xs font-semibold rounded-xl text-muted hover:bg-bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
              >
                Confirm
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* User Profile Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-xs">
          <Card className="w-full max-w-md bg-card border border-border-theme p-6 space-y-5 text-primary">
            <div className="flex justify-between items-start border-b border-border-theme pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">{selectedUser.name} Profile</h3>
                <span className="text-[10px] text-muted font-mono block mt-0.5">ID: {selectedUser.id}</span>
              </div>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                selectedUser.status === 'suspended' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
              }`}>
                {selectedUser.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Email Address</span>
                <span>{selectedUser.email}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Active Plan</span>
                <span className="text-blue-500">{selectedUser.isPro ? 'Premium Pro' : 'Free Basic'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block mb-1">AI Requests Count</span>
                <span>{selectedUser.aiUsageCount || 15} calls</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Created Syllabus</span>
                <span>{selectedUser.workspaceCount || 2} workspaces</span>
              </div>
            </div>

            <div className="border-t border-border-theme pt-4 space-y-2.5">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Quick Actions</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (!canPerformWrite) {
                      showToast("Access Denied: Support role cannot toggle plan.");
                      return;
                    }
                    onUpgradePlan(selectedUser.id, selectedUser.isPro);
                    setSelectedUser(prev => ({ ...prev, isPro: !prev.isPro }));
                    showToast("User subscription plan updated.");
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-xl active:scale-95 transition-all flex items-center space-x-1"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Toggle Plan Upgrade</span>
                </button>
                <button
                  onClick={() => {
                    onResetPassword(selectedUser.id);
                    showToast("A password reset email verification was simulated.");
                  }}
                  className="px-3.5 py-2 border border-border-theme hover:bg-bg-secondary text-primary text-[11px] font-bold rounded-xl active:scale-95 transition-all flex items-center space-x-1"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Reset Password</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 border border-border-theme text-xs font-semibold rounded-xl text-muted hover:bg-bg-secondary"
              >
                Close View
              </button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
