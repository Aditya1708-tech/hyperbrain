import React, { useState } from 'react';
import { CreditCard, DollarSign, Users, Award, ShieldAlert } from 'lucide-react';
import Card from '../common/Card';

export default function SubscriptionManagement({
  students,
  onUpgradePlan,
  role,
  showToast
}) {
  const isSuperAdmin = role === 'Super Admin';

  const billingStats = React.useMemo(() => {
    let pro = 0;
    let free = 0;
    students.forEach(s => {
      if (s.isPro) pro++;
      else free++;
    });
    const total = students.length || 1;
    const rate = ((pro / total) * 100).toFixed(1);
    const mrr = pro * 10.00; // Mock MRR calculation
    return {
      activePro: pro,
      freeUsers: free,
      conversionRate: `${rate}%`,
      mrr: `$${mrr}`
    };
  }, [students]);

  const handlePlanToggle = (id, currentPro) => {
    if (!isSuperAdmin) {
      showToast("Access Denied: Only Super Admin can modify subscription tiers.");
      return;
    }
    onUpgradePlan(id, currentPro);
    showToast(`User subscription level updated.`);
  };

  return (
    <div className="space-y-6">
      
      {/* Metrics breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Active Pro Members", value: billingStats.activePro, icon: Award, color: "text-blue-500" },
          { label: "Monthly Recurring Revenue", value: billingStats.mrr, icon: DollarSign, color: "text-emerald-500" },
          { label: "Free Basic Tier", value: billingStats.freeUsers, icon: Users, color: "text-slate-500" },
          { label: "Conversion Rate", value: billingStats.conversionRate, icon: CreditCard, color: "text-indigo-500" }
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="p-4 flex items-center space-x-4 bg-card border border-border-theme">
              <div className={`p-2.5 rounded-xl bg-bg-secondary border border-border-theme/40 ${stat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[8px] font-black text-muted uppercase tracking-widest block">{stat.label}</span>
                <h4 className="text-xl font-black text-primary mt-0.5 leading-none">{stat.value}</h4>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Subscription lists */}
      <Card className="bg-card border-border-theme p-0 overflow-hidden">
        <div className="p-4 border-b border-border-theme">
          <h3 className="text-xs font-black text-primary uppercase tracking-widest">Subscription tier management</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                <th className="p-4">User Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Billing Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-theme font-semibold text-primary">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-bg-secondary/40 transition-colors">
                  <td className="p-4 font-bold text-primary">{s.name}</td>
                  <td className="p-4 font-mono text-slate-500">{s.email}</td>
                  <td className="p-4">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      s.isPro 
                        ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400' 
                        : 'bg-bg-secondary text-slate-400'
                    }`}>
                      {s.isPro ? 'Pro Active' : 'Basic Free'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handlePlanToggle(s.id, s.isPro)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-xl active:scale-95 transition-all shadow-xs"
                    >
                      {s.isPro ? 'Downgrade to Free' : 'Upgrade to Pro'}
                    </button>
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
