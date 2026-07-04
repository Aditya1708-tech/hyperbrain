import React, { useState, useMemo } from 'react';
import { Shield, UserPlus, UserMinus, Search, Edit2, Check, X } from 'lucide-react';
import Card from '../common/Card';

export default function AdminsManagement({
  students,
  onUpdateRole,
  onUpdateAdminRole,
  role,
  showToast
}) {
  const [searchText, setSearchText] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('Admin');
  const [editingAdminId, setEditingAdminId] = useState(null);
  const [editingRoleValue, setEditingRoleValue] = useState('Admin');

  const isSuperAdmin = role === 'Super Admin';

  // Filter admins
  const admins = useMemo(() => {
    return students.filter(s => s.role === 'Administrator');
  }, [students]);

  // Candidates for admin (normal students)
  const studentCandidates = useMemo(() => {
    return students.filter(s => s.role !== 'Administrator');
  }, [students]);

  const filteredAdmins = useMemo(() => {
    return admins.filter(a => {
      const q = searchText.toLowerCase();
      return (
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.id?.toLowerCase().includes(q)
      );
    });
  }, [admins, searchText]);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      showToast("Access Denied: Only Super Admin can promote administrators.");
      return;
    }
    const candidate = studentCandidates.find(s => s.email?.toLowerCase() === newAdminEmail.trim().toLowerCase());
    if (!candidate) {
      showToast("User not found or is already an Admin.");
      return;
    }

    try {
      await onUpdateRole(candidate.id, 'Administrator');
      await onUpdateAdminRole(candidate.id, newAdminRole);
      showToast(`${candidate.name} promoted to Administrator (${newAdminRole})`);
      setNewAdminEmail('');
    } catch (err) {
      showToast("Failed to promote user to Administrator");
    }
  };

  const handleRemoveAdmin = async (userId, userName) => {
    if (!isSuperAdmin) {
      showToast("Access Denied: Only Super Admin can remove administrators.");
      return;
    }
    try {
      await onUpdateRole(userId, 'Student');
      showToast(`${userName} access levels demoted to Student`);
    } catch (err) {
      showToast("Failed to demote Administrator");
    }
  };

  const handleStartEdit = (admin) => {
    if (!isSuperAdmin) {
      showToast("Access Denied: Only Super Admin can modify admin permissions.");
      return;
    }
    setEditingAdminId(admin.id);
    setEditingRoleValue(admin.adminRole || 'Admin');
  };

  const handleSaveEdit = async (userId, userName) => {
    try {
      await onUpdateAdminRole(userId, editingRoleValue);
      showToast(`Admin level updated to ${editingRoleValue} for ${userName}`);
      setEditingAdminId(null);
    } catch (err) {
      showToast("Failed to update Admin level");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search and Promotion Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Promotion Form Card */}
        <Card className="bg-card border-border-theme p-6 space-y-4 lg:col-span-1">
          <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2 flex items-center space-x-1.5">
            <UserPlus className="w-4 h-4 text-blue-500" />
            <span>Promote Administrator</span>
          </h3>
          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-2">User Email Address</label>
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="search-email@campus.edu"
                className="w-full px-3 py-2 border border-border-theme rounded-xl bg-bg-secondary text-primary text-xs focus-ring placeholder-slate-400 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-2">Access Role Level</label>
              <select
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value)}
                className="w-full bg-bg-secondary border border-border-theme rounded-xl py-2 px-3 text-primary text-xs font-bold outline-none"
              >
                <option value="Super Admin">Super Admin</option>
                <option value="Admin">Admin</option>
                <option value="Support">Support</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={!isSuperAdmin}
              className={`w-full py-2.5 text-white font-bold text-xs rounded-xl shadow-md transition-all ${
                isSuperAdmin 
                  ? 'bg-blue-600 hover:bg-blue-700 active:scale-98 cursor-pointer' 
                  : 'bg-slate-400 dark:bg-slate-800 cursor-not-allowed opacity-50'
              }`}
            >
              PROMOTED SECURITY LEVEL
            </button>
          </form>
        </Card>

        {/* Search header card */}
        <Card className="bg-card border-border-theme p-6 space-y-4 lg:col-span-2 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-xs font-black text-primary uppercase tracking-widest flex items-center space-x-1.5">
              <Shield className="w-4 h-4 text-indigo-500" />
              <span>Admin Search Boundary</span>
            </h3>
            <p className="text-xs text-muted leading-relaxed font-semibold">
              Filter the administrative accounts currently holding platform maintenance tokens. Only Super Administrators can configure permission sets.
            </p>
          </div>
          <div className="relative w-full">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search admin name, email, node UID..."
              className="w-full pl-9 pr-4 py-3 bg-bg-secondary border border-border-theme rounded-xl text-xs font-semibold focus-ring text-primary placeholder-slate-400"
            />
          </div>
        </Card>

      </div>

      {/* Admins Table */}
      <Card className="bg-card border-border-theme p-0 overflow-hidden">
        <div className="p-4 border-b border-border-theme flex justify-between items-center bg-bg-secondary/20">
          <h3 className="text-xs font-black text-primary uppercase tracking-widest">Active Administrators</h3>
          <span className="text-[10px] text-muted font-bold">Found {filteredAdmins.length} active admin credentials</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                <th className="p-4">Admin Name</th>
                <th className="p-4">Email</th>
                <th className="p-4 text-center">Permissions Level</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-theme font-semibold text-primary">
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-muted font-bold">
                    No administrators matched your filters.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map(admin => {
                  const isEditing = editingAdminId === admin.id;
                  return (
                    <tr key={admin.id} className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="p-4 font-bold text-primary flex items-center space-x-2.5">
                        <div className="h-7 w-7 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-black">
                          {admin.name?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <span>{admin.name}</span>
                      </td>
                      <td className="p-4 font-mono text-slate-500">{admin.email}</td>
                      <td className="p-4 text-center">
                        {isEditing ? (
                          <select
                            value={editingRoleValue}
                            onChange={(e) => setEditingRoleValue(e.target.value)}
                            className="bg-bg-secondary border border-border-theme rounded-lg py-1 px-2 text-primary text-[10px] font-black uppercase outline-none"
                          >
                            <option value="Super Admin">Super Admin</option>
                            <option value="Admin">Admin</option>
                            <option value="Support">Support</option>
                          </select>
                        ) : (
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            (admin.adminRole || 'Admin') === 'Super Admin'
                              ? 'bg-purple-500/10 text-purple-500'
                              : (admin.adminRole || 'Admin') === 'Admin'
                                ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                                : 'bg-green-500/10 text-green-500'
                          }`}>
                            {admin.adminRole || 'Admin'}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-1.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(admin.id, admin.name)}
                              className="p-1.5 hover:bg-green-500/10 text-green-500 rounded-lg transition-all"
                              title="Save Level Changes"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingAdminId(null)}
                              className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-all"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEdit(admin)}
                              disabled={!isSuperAdmin}
                              className={`p-1.5 hover:bg-bg-secondary rounded-lg transition-all ${
                                isSuperAdmin ? 'text-slate-400 hover:text-primary' : 'text-slate-300 opacity-40 cursor-not-allowed'
                              }`}
                              title="Change Level"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveAdmin(admin.id, admin.name)}
                              disabled={!isSuperAdmin}
                              className={`p-1.5 hover:bg-bg-secondary rounded-lg transition-all ${
                                isSuperAdmin ? 'text-slate-400 hover:text-red-500' : 'text-slate-300 opacity-40 cursor-not-allowed'
                              }`}
                              title="Demote to Student"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
    </div>
  );
}
