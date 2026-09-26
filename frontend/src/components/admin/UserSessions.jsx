import React, { useState, useMemo } from 'react';
import { ShieldAlert, Trash2, Key, Globe, Search, RefreshCw, XCircle } from 'lucide-react';
import Card from '../common/Card';

export default function UserSessions({
  sessions,
  onRevokeSession,
  role,
  showToast
}) {
  const [searchText, setSearchText] = useState('');
  const isSuperAdmin = role === 'Super Admin';

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const q = searchText.toLowerCase();
      return (
        s.email?.toLowerCase().includes(q) ||
        s.userId?.toLowerCase().includes(q) ||
        s.userAgent?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
      );
    });
  }, [sessions, searchText]);

  const handleRevoke = async (userId, sessionId, userEmail) => {
    if (!isSuperAdmin) {
      showToast("Access Denied: Only Super Admin can revoke active session tokens.");
      return;
    }
    try {
      await onRevokeSession(userId, sessionId);
      showToast(`Active session ${sessionId} for ${userEmail} was revoked.`);
    } catch (err) {
      showToast("Failed to revoke session token.");
    }
  };

  // Helper to format date
  const formatDate = (val) => {
    if (!val) return 'N/A';
    const date = val?.toDate ? val.toDate() : new Date(val);
    return date.toLocaleString();
  };

  // Helper to parse browser from userAgent
  const getBrowserInfo = (ua) => {
    if (!ua) return 'Unknown Device';
    if (ua.includes('Firefox')) return 'Firefox (Linux/Mac/PC)';
    if (ua.includes('Chrome')) {
      if (ua.includes('Edg')) return 'Edge (Chromium Engine)';
      return 'Chrome Browser (PC/Mac/Mobile)';
    }
    if (ua.includes('Safari')) return 'Apple Safari (macOS/iOS)';
    if (ua.includes('MSIE') || ua.includes('Trident')) return 'Internet Explorer (Legacy)';
    return ua.length > 30 ? ua.substring(0, 30) + '...' : ua;
  };

  return (
    <div className="space-y-6">
      
      {/* Sessions Search and Details */}
      <Card className="bg-card border-border-theme p-6 space-y-4 text-primary">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center space-x-1.5">
              <Key className="w-4 h-4 text-emerald-500" />
              <span>Token-based session management</span>
            </h3>
            <p className="text-xs text-muted font-semibold leading-relaxed">
              Track live student authorization nodes. Revoking a session immediately signs out the user at their endpoint browser.
            </p>
          </div>
          <div className="text-[10px] text-muted font-black uppercase bg-bg-secondary border border-border-theme/60 px-3 py-1 rounded-xl">
            Active Nodes: {sessions.filter(s => s.status === 'active').length}
          </div>
        </div>

        <div className="relative w-full">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search session ID, student email, browser footprint..."
            className="w-full pl-9 pr-4 py-3 bg-bg-secondary border border-border-theme rounded-xl text-xs font-semibold focus-ring text-primary placeholder-slate-400"
          />
        </div>
      </Card>

      {/* Sessions table */}
      <Card className="bg-card border-border-theme p-0 overflow-hidden text-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                <th className="p-4">Session ID</th>
                <th className="p-4">User Email</th>
                <th className="p-4">Login Timestamp</th>
                <th className="p-4">Last Sync Active</th>
                <th className="p-4">Browser/Agent Footprint</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-theme font-semibold text-primary">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-muted font-bold">
                    No active sessions match search criteria.
                  </td>
                </tr>
              ) : (
                filteredSessions.map(session => (
                  <tr key={session.id} className="hover:bg-bg-secondary/40 transition-colors">
                    <td className="p-4 font-mono text-[10px] text-indigo-500 font-extrabold">
                      {session.id}
                    </td>
                    <td className="p-4 font-bold">{session.email}</td>
                    <td className="p-4 font-mono text-[10px] text-slate-500">
                      {formatDate(session.loginTime)}
                    </td>
                    <td className="p-4 font-mono text-[10px] text-slate-500">
                      {formatDate(session.lastActive)}
                    </td>
                    <td className="p-4 font-medium text-[10px] text-slate-500 flex items-center space-x-1.5 py-4">
                      <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate max-w-[180px]">{getBrowserInfo(session.userAgent)}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        session.status === 'active'
                          ? 'bg-green-500/10 text-green-500'
                          : session.status === 'revoked'
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-slate-550/15 text-slate-500'
                      }`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleRevoke(session.userId, session.id, session.email)}
                        disabled={!isSuperAdmin || session.status === 'revoked'}
                        className={`p-1.5 rounded-lg transition-all border ${
                          (isSuperAdmin && session.status !== 'revoked')
                            ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 cursor-pointer'
                            : 'bg-bg-secondary text-slate-300 border-border-theme/40 opacity-40 cursor-not-allowed'
                        }`}
                        title={session.status === 'revoked' ? 'Session Revoked' : 'Revoke Session'}
                      >
                        <XCircle className="w-4 h-4" />
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
  );
}
