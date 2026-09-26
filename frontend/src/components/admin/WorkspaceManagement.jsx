import React, { useState } from 'react';
import { BookOpen, Search, Archive, Trash2, ExternalLink, Calendar, Database } from 'lucide-react';
import Card from '../common/Card';

export default function WorkspaceManagement({
  students,
  role,
  showToast
}) {
  const [searchText, setSearchText] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

  // Generate mock workspaces list based on student subjects to keep synced
  const workspacesList = React.useMemo(() => {
    const list = [];
    students.forEach(student => {
      // Mock 2 courses per student
      list.push({
        id: `work_${student.id}_1`,
        name: "Computer Science Intro",
        ownerName: student.name,
        ownerEmail: student.email,
        createdDate: "2026-06-15",
        aiRequests: 42,
        size: "3.2 MB",
        status: "Active"
      });
      list.push({
        id: `work_${student.id}_2`,
        name: "Discrete Mathematics Core",
        ownerName: student.name,
        ownerEmail: student.email,
        createdDate: "2026-06-20",
        aiRequests: 18,
        size: "1.4 MB",
        status: "Active"
      });
    });
    return list;
  }, [students]);

  const filtered = workspacesList.filter(w => 
    (w.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
    (w.ownerName || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const [workspaces, setWorkspaces] = useState(workspacesList);
  React.useEffect(() => {
    setWorkspaces(workspacesList);
  }, [workspacesList]);

  const canPerformDestructive = role === 'Super Admin';

  const handleArchive = (id) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id === id) {
        const nextStatus = w.status === 'Archived' ? 'Active' : 'Archived';
        showToast(`Workspace status updated to ${nextStatus}`);
        return { ...w, status: nextStatus };
      }
      return w;
    }));
  };

  const handleDelete = (id) => {
    if (!canPerformDestructive) {
      showToast("Access Denied: Only Super Admin can delete workspaces.");
      return;
    }
    setWorkspaces(prev => prev.filter(w => w.id !== id));
    showToast("Workspace deleted permanently.");
  };

  return (
    <div className="space-y-6">
      
      {/* Workspace Management Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search workspace, owner..."
            className="w-full pl-9 pr-4 py-2 bg-card border border-border-theme rounded-xl text-xs font-semibold focus-ring text-primary"
          />
        </div>
        <div className="text-[10px] text-muted font-bold">
          Found {filtered.length} active nodes
        </div>
      </div>

      {/* Table view */}
      <Card className="bg-card border-border-theme p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                <th className="p-4">Workspace Name</th>
                <th className="p-4">Owner</th>
                <th className="p-4">Created Date</th>
                <th className="p-4 text-center">AI Requests</th>
                <th className="p-4 text-center">Size</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-theme font-semibold text-primary">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-muted font-bold">
                    No active workspaces found.
                  </td>
                </tr>
              ) : (
                filtered.map(w => (
                  <tr key={w.id} className="hover:bg-bg-secondary/40 transition-colors">
                    <td className="p-4 font-bold text-primary">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-indigo-500" />
                        <span>{w.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <span className="block font-bold">{w.ownerName}</span>
                        <span className="block text-[10px] text-muted font-mono">{w.ownerEmail}</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-slate-500">{w.createdDate}</td>
                    <td className="p-4 text-center">{w.aiRequests}</td>
                    <td className="p-4 text-center font-mono text-slate-500">{w.size}</td>
                    <td className="p-4">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        w.status === 'Archived' 
                          ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' 
                          : 'bg-green-500/10 text-green-500'
                      }`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-1">
                      <button
                        onClick={() => setSelectedWorkspace(w)}
                        className="p-1.5 hover:bg-bg-secondary rounded-lg text-slate-400 hover:text-primary transition-all"
                        title="Open Workspace Preview"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchive(w.id)}
                        className="p-1.5 hover:bg-bg-secondary rounded-lg text-slate-400 hover:text-yellow-500 transition-all"
                        title="Archive Workspace"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(w.id)}
                        className="p-1.5 hover:bg-bg-secondary rounded-lg text-slate-400 hover:text-red-500 transition-all"
                        title="Delete Workspace"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Workspace Preview Modal */}
      {selectedWorkspace && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-xs">
          <Card className="w-full max-w-md bg-card border border-border-theme p-6 space-y-4 text-primary">
            <div className="flex justify-between items-start border-b border-border-theme pb-2">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-500 flex items-center space-x-1.5">
                  <BookOpen className="w-4 h-4" />
                  <span>{selectedWorkspace.name}</span>
                </h3>
                <span className="text-[10px] text-muted mt-0.5 block">Owner: {selectedWorkspace.ownerName}</span>
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Preview</span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="text-[9px] uppercase text-slate-400 block leading-none">Created</span>
                    <span className="mt-0.5 block font-mono">{selectedWorkspace.createdDate}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="text-[9px] uppercase text-slate-400 block leading-none">Disk Allocation</span>
                    <span className="mt-0.5 block font-mono">{selectedWorkspace.size}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border-theme pt-4 space-y-2">
                <h4 className="text-[10px] uppercase text-slate-400 font-bold">Curriculum Topics List (Read Only)</h4>
                <div className="space-y-1.5 text-xs text-muted">
                  <div className="p-2 bg-bg-secondary rounded-lg border border-border-theme/40 flex justify-between">
                    <span>1. Syllabus Introduction</span>
                    <span className="text-green-500 font-extrabold text-[9px] uppercase font-sans">Active</span>
                  </div>
                  <div className="p-2 bg-bg-secondary rounded-lg border border-border-theme/40 flex justify-between">
                    <span>2. Core Concepts & Definitions</span>
                    <span className="text-green-500 font-extrabold text-[9px] uppercase font-sans">Active</span>
                  </div>
                  <div className="p-2 bg-bg-secondary rounded-lg border border-border-theme/40 flex justify-between">
                    <span>3. Practice Assessment Blueprint</span>
                    <span className="text-green-500 font-extrabold text-[9px] uppercase font-sans">Active</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setSelectedWorkspace(null)}
                className="px-4 py-2 border border-border-theme text-xs font-semibold rounded-xl text-muted hover:bg-bg-secondary"
              >
                Close Preview
              </button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
