import React, { useState, useMemo } from 'react';
import { Search, Filter, ShieldCheck, ShieldAlert, ArrowDown } from 'lucide-react';
import Card from '../common/Card';

export default function AuditLogs({
  activityLogs,
  showToast
}) {
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchUser, setSearchUser] = useState('');

  // Extract all unique log types for filter dropdown
  const logTypes = useMemo(() => {
    const types = new Set();
    activityLogs.forEach(log => {
      if (log.type) types.add(log.type);
    });
    return ['All', ...Array.from(types)];
  }, [activityLogs]);

  // Filter logs list
  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      const matchesType = filterType === 'All' || log.type === filterType;
      
      const isFailed = log.type.includes('error') || log.type.includes('failed');
      const matchesStatus = filterStatus === 'All' || 
                            (filterStatus === 'Success' && !isFailed) ||
                            (filterStatus === 'Failed' && isFailed);

      const matchesSearch = log.userName?.toLowerCase().includes(searchUser.toLowerCase()) ||
                            log.type?.toLowerCase().includes(searchUser.toLowerCase());

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [activityLogs, filterType, filterStatus, searchUser]);

  const handleExport = () => {
    if (filteredLogs.length === 0) return;
    const headers = "Timestamp,User,ActionType,Metadata\n";
    const rows = filteredLogs.map(log => {
      const timeStr = new Date(log.timestamp).toISOString();
      const meta = JSON.stringify(log.metadata || {}).replace(/"/g, '""');
      return `"${timeStr}","${log.userName}","${log.type}","${meta}"`;
    }).join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Audit logs exported to CSV.");
  };

  return (
    <div className="space-y-6">
      
      {/* Logs Filters */}
      <Card className="bg-card border-border-theme p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              placeholder="Search user or type..."
              className="pl-8 pr-4 py-1.5 w-48 bg-bg-secondary border border-border-theme rounded-lg text-xs font-semibold text-primary"
            />
          </div>

          {/* Type dropdown */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-muted uppercase font-bold">Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-bg-secondary border border-border-theme rounded-lg text-xs py-1 px-2 text-primary font-semibold outline-none"
            >
              {logTypes.map((type, i) => (
                <option key={i} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-muted uppercase font-bold">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-bg-secondary border border-border-theme rounded-lg text-xs py-1 px-2 text-primary font-semibold outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Success">Success Only</option>
              <option value="Failed">Failed Only</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="px-4 py-1.5 border border-border-theme hover:bg-bg-secondary text-primary text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Export Logs</span>
        </button>
      </Card>

      {/* Logs Grid Table */}
      <Card className="bg-card border-border-theme p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                <th className="p-4">Timestamp</th>
                <th className="p-4">User</th>
                <th className="p-4">Action</th>
                <th className="p-4">Type</th>
                <th className="p-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-theme font-semibold text-primary">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-muted font-bold">
                    No matching activity logs in telemetry bounds.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isFailed = log.type.includes('error') || log.type.includes('failed');
                  return (
                    <tr key={log.id} className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="p-4 font-mono text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4 font-bold text-primary">{log.userName}</td>
                      <td className="p-4 text-muted font-medium font-sans">
                        {log.type === 'new_student_registered' && `Registered student email ${log.metadata?.email}`}
                        {log.type === 'course_created' && `Created course "${log.metadata?.courseName}"`}
                        {log.type === 'mock_exam_generated' && `Generated mock exam paper: ${log.metadata?.marks} marks`}
                        {log.type === 'mock_exam_submitted' && `Submitted exam attempt scoring ${log.metadata?.score}/${log.metadata?.maxScore}`}
                        {log.type === 'ai_tutor_session_started' && `Invoked AI Tutor dialog for topic: "${log.metadata?.topicName}"`}
                        {log.type === 'subscription_upgraded' && `Upgraded user subscription level`}
                        {log.type === 'payment_completed' && `Processed credit payment transaction of $${log.metadata?.amount}`}
                        {log.type === 'system_broadcast' && `Broadcasted notification warning: "${log.metadata?.message}"`}
                        {log.type === 'admin_created' && `Configured admin profile for ${log.metadata?.name}`}
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-mono bg-bg-secondary text-slate-500 border border-border-theme/40 px-2 py-0.5 rounded-md">
                          {log.type}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {isFailed ? (
                          <span className="inline-flex items-center space-x-0.5 text-red-500">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>FAILED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-0.5 text-green-500">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>SUCCESS</span>
                          </span>
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
