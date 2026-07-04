import React, { useState } from 'react';
import { Shield, Plus, Trash2, Edit2, Check, X, ShieldCheck } from 'lucide-react';
import Card from '../common/Card';

export default function RolesManagement({
  roles,
  onCreateRole,
  onUpdateRolePermissions,
  onDeleteRole,
  role,
  showToast
}) {
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRoleId, setEditingRoleId] = useState(null);
  
  const isSuperAdmin = role === 'Super Admin';

  const defaultMatrix = {
    dashboard: false,
    users: false,
    analytics: false,
    aiUsage: false,
    settings: false
  };
  const [newPermissions, setNewPermissions] = useState(defaultMatrix);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      showToast("Access Denied: Only Super Admin can configure security roles.");
      return;
    }
    if (!newRoleName.trim()) return;

    try {
      await onCreateRole(newRoleName.trim(), newPermissions);
      showToast(`Custom role ${newRoleName} created successfully.`);
      setNewRoleName('');
      setNewPermissions(defaultMatrix);
    } catch (err) {
      showToast("Failed to create role.");
    }
  };

  const handleTogglePermission = (roleId, permissionKey, currentValue, isNewForm = false) => {
    if (!isSuperAdmin) {
      showToast("Access Denied: Only Super Admin can adjust role scopes.");
      return;
    }

    if (isNewForm) {
      setNewPermissions(prev => ({
        ...prev,
        [permissionKey]: !prev[permissionKey]
      }));
    } else {
      onUpdateRolePermissions(roleId, permissionKey, !currentValue);
      showToast(`Permission updated for role.`);
    }
  };

  const handleDelete = async (roleId, name) => {
    if (!isSuperAdmin) {
      showToast("Access Denied: Only Super Admin can delete security roles.");
      return;
    }
    try {
      await onDeleteRole(roleId);
      showToast(`Role ${name} deleted successfully.`);
    } catch (err) {
      showToast("Failed to delete role.");
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Role Card */}
        <Card className="bg-card border-border-theme p-6 space-y-4 lg:col-span-1 text-primary">
          <h3 className="text-xs font-black uppercase tracking-widest border-b border-border-theme pb-2 flex items-center space-x-1.5">
            <Plus className="w-4 h-4 text-indigo-500" />
            <span>Create Security Role</span>
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-2">Role Identifier Name</label>
              <input
                type="text"
                required
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Compliance Admin"
                className="w-full px-3 py-2 border border-border-theme rounded-xl bg-bg-secondary text-primary text-xs focus-ring placeholder-slate-400 font-semibold"
              />
            </div>
            
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">Set Permissions Scopes</label>
              {Object.keys(defaultMatrix).map((permKey) => (
                <div key={permKey} className="flex items-center justify-between py-1 border-b border-border-theme/40 text-xs">
                  <span className="font-bold capitalize">{permKey.replace(/([A-Z])/g, ' $1')}</span>
                  <button
                    type="button"
                    onClick={() => handleTogglePermission(null, permKey, null, true)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider border transition-all ${
                      newPermissions[permKey]
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}
                  >
                    {newPermissions[permKey] ? 'Allowed' : 'Denied'}
                  </button>
                </div>
              ))}
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
              INITIALIZE ROLE SCHEME
            </button>
          </form>
        </Card>

        {/* Roles List & Matrix */}
        <Card className="bg-card border-border-theme p-0 overflow-hidden lg:col-span-2 text-primary flex flex-col justify-between">
          <div className="p-4 border-b border-border-theme bg-bg-secondary/20 flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <span>Permission Matrix Control</span>
            </h3>
            <span className="text-[10px] text-muted font-bold">Synchronized in real-time</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                  <th className="p-4">Role Key</th>
                  <th className="p-4 text-center">Dashboard</th>
                  <th className="p-4 text-center">Users</th>
                  <th className="p-4 text-center">Analytics</th>
                  <th className="p-4 text-center">AI Usage</th>
                  <th className="p-4 text-center">Settings</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-theme font-semibold text-primary">
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-muted font-bold">
                      No roles defined in the catalog.
                    </td>
                  </tr>
                ) : (
                  roles.map(r => (
                    <tr key={r.id} className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                        {r.name}
                      </td>
                      {Object.keys(defaultMatrix).map((permKey) => (
                        <td key={permKey} className="p-4 text-center">
                          <button
                            onClick={() => handleTogglePermission(r.id, permKey, r.permissions?.[permKey] || false)}
                            disabled={!isSuperAdmin || r.name === 'Super Admin'}
                            className={`w-16 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider border transition-all ${
                              r.permissions?.[permKey]
                                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                : 'bg-red-500/10 text-red-500 border-red-500/20'
                            } ${
                              (!isSuperAdmin || r.name === 'Super Admin') ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:scale-102'
                            }`}
                          >
                            {r.permissions?.[permKey] ? 'Yes' : 'No'}
                          </button>
                        </td>
                      ))}
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(r.id, r.name)}
                          disabled={!isSuperAdmin || r.name === 'Super Admin' || r.name === 'Admin' || r.name === 'Support'}
                          className={`p-1.5 hover:bg-red-500/10 rounded-lg transition-all ${
                            (isSuperAdmin && r.name !== 'Super Admin' && r.name !== 'Admin' && r.name !== 'Support') 
                              ? 'text-slate-400 hover:text-red-500 cursor-pointer' 
                              : 'text-slate-300 opacity-40 cursor-not-allowed'
                          }`}
                          title="Delete Custom Role"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

      </div>

    </div>
  );
}
