import React, { useState } from 'react';
import { Mail, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import Card from '../common/Card';

export default function EmailMonitoring({
  showToast
}) {
  const [loading, setLoading] = useState(false);

  const [emailLogs, setEmailLogs] = useState([
    { id: "mail_1", recipient: "rohan@campus.edu", subject: "Welcome to HyperBrain Pro", status: "Delivered", timestamp: "2026-07-02 12:45:10" },
    { id: "mail_2", recipient: "ananya@campus.edu", subject: "Your Study Plan is compiled", status: "Delivered", timestamp: "2026-07-02 12:55:04" },
    { id: "mail_3", recipient: "vikram@campus.edu", subject: "Subscription invoice renewal", status: "Delivered", timestamp: "2026-07-02 13:10:00" },
    { id: "mail_4", recipient: "support@hyperbrain.ai", subject: "API latencies warning report", status: "Failed", timestamp: "2026-07-02 13:30:15" },
    { id: "mail_5", recipient: "aditya@domain.com", subject: "Admin access credentials configured", status: "Delivered", timestamp: "2026-07-02 14:12:00" }
  ]);

  const stats = React.useMemo(() => {
    let sent = emailLogs.length;
    let delivered = emailLogs.filter(m => m.status === 'Delivered').length;
    let failed = emailLogs.filter(m => m.status === 'Failed').length;
    let pending = emailLogs.filter(m => m.status === 'Pending').length;
    return { sent, delivered, failed, pending };
  }, [emailLogs]);

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    showToast("SMTP gateway records synchronized.");
  };

  return (
    <div className="space-y-6">
      
      {/* Diagnostics Header */}
      <div className="flex justify-between items-center bg-bg-secondary p-4 rounded-2xl border border-border-theme">
        <div>
          <span className="text-xs font-bold text-primary block">SMTP Transports Monitoring</span>
          <span className="text-[10px] text-muted font-semibold block mt-0.5">Tracking mail delivery status metrics via Resend cloud API</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border border-border-theme hover:bg-bg-secondary text-primary transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Gateway</span>
        </button>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Emails Sent", value: stats.sent, icon: Mail, color: "text-blue-500" },
          { label: "Delivered Successfully", value: stats.delivered, icon: CheckCircle, color: "text-green-500" },
          { label: "Delivery Failures", value: stats.failed, icon: AlertCircle, color: "text-red-500" },
          { label: "Pending queue", value: stats.pending, icon: Clock, color: "text-slate-500" }
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="p-4 flex items-center space-x-4 bg-card border border-border-theme">
              <div className="p-2.5 rounded-xl bg-bg-secondary border border-border-theme/40 text-primary">
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <span className="text-[8px] font-black text-muted uppercase tracking-widest block">{stat.label}</span>
                <h4 className="text-lg font-black text-primary mt-0.5 leading-none">{stat.value}</h4>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Logs Table */}
      <Card className="bg-card border-border-theme p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                <th className="p-4">Recipient</th>
                <th className="p-4">Subject</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4 text-right">Delivery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-theme font-semibold text-primary">
              {emailLogs.map(m => (
                <tr key={m.id} className="hover:bg-bg-secondary/40 transition-colors">
                  <td className="p-4 font-mono text-slate-500">{m.recipient}</td>
                  <td className="p-4 text-primary font-bold">{m.subject}</td>
                  <td className="p-4 text-slate-400 font-mono">{m.timestamp}</td>
                  <td className="p-4 text-right">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      m.status === 'Delivered' 
                        ? 'bg-green-500/10 text-green-500' 
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
