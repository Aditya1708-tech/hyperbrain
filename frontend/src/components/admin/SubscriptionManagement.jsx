import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, DollarSign, Users, Award, ShieldAlert, 
  TrendingUp, Activity, Layers, Percent, Trash2, Plus, 
  Calendar, RefreshCw, Download, Check, X, Clock, HelpCircle, 
  Search, Sliders, Play, Pause
} from 'lucide-react';
import Card from '../common/Card';

export default function SubscriptionManagement({
  students,
  onUpgradePlan,
  role,
  showToast
}) {
  const isSuperAdmin = role === 'Super Admin';
  const [activeTab, setActiveTab] = useState('analytics');
  const [loadingData, setLoadingData] = useState(true);
  const [billingData, setBillingData] = useState({
    invoices: [],
    history: [],
    coupons: [],
    subs: [],
    users: []
  });

  // Filters and action states
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateCoupon, setShowCreateCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    type: 'percentage',
    value: 20,
    maxRedemptions: 100,
    expirationDate: '',
    currency: 'USD'
  });

  // Action modals states
  const [activeActionModal, setActiveActionModal] = useState(null); // 'override' | 'extend'
  const [actionTargetUserId, setActionTargetUserId] = useState('');
  const [extendDays, setExtendDays] = useState(30);
  const [overrideForm, setOverrideForm] = useState({
    planId: 'student_pro',
    billingPeriod: 'monthly',
    durationDays: 30
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Fetch admin billing dataset
  const fetchBillingData = async () => {
    setLoadingData(true);
    try {
      const token = localStorage.getItem("hyperbrain_token") || "";
      const res = await fetch('/api/billing-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ action: 'get_billing_data' })
      });
      const data = await res.json();
      if (data.success) {
        setBillingData(data);
      }
    } catch (err) {
      console.warn("Failed to load admin billing data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  // Post Actions Handler (Override, Extend, Refund, Coupons)
  const handleAdminAction = async (payload) => {
    if (!isSuperAdmin) {
      showToast("Access Denied: Only Super Admin can override billing configurations.");
      return;
    }
    setActionLoading(true);
    try {
      const token = localStorage.getItem("hyperbrain_token") || "";
      const res = await fetch('/api/billing-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Operation completed successfully");
        setActiveActionModal(null);
        setShowCreateCoupon(false);
        fetchBillingData();
      } else {
        showToast(data.message || "Operation failed");
      }
    } catch (e) {
      showToast("Connection to admin service failed");
    } finally {
      setActionLoading(false);
    }
  };

  // Compute Billing Analytics dynamically from DB records
  const analytics = useMemo(() => {
    const subsList = billingData.subs || [];
    const usersList = billingData.users || [];
    const invoicesList = billingData.invoices || [];
    const historyList = billingData.history || [];

    const activeSubs = subsList.filter(s => s.status === 'active' || s.status === 'trialing');
    const totalUsersCount = usersList.length || 1;
    const proUsersCount = subsList.filter(s => s.planId === 'student_pro' || s.planId === 'student_pro_plus').length;
    const conversionRate = ((proUsersCount / totalUsersCount) * 100).toFixed(1);

    // Calculate MRR
    let mrr = 0;
    activeSubs.forEach(sub => {
      const isINR = sub.currency === 'INR';
      // Normalize to USD for unified analytics dashboard reporting (approx 1 USD = 85 INR)
      const multiplier = isINR ? 1 / 85 : 1;
      
      let amount = 0;
      if (sub.planId === 'student_pro') {
        if (sub.billingPeriod === 'annual') amount = 79.99 / 12;
        else if (sub.billingPeriod === 'quarterly') amount = 24.99 / 3;
        else amount = 9.99;
      } else if (sub.planId === 'student_pro_plus') {
        if (sub.billingPeriod === 'annual') amount = 149.99 / 12;
        else if (sub.billingPeriod === 'quarterly') amount = 49.99 / 3;
        else amount = 19.99;
      }
      mrr += amount * multiplier;
    });

    const arr = mrr * 12;

    // Churn Rate
    const cancelledCount = subsList.filter(s => s.status === 'cancelled').length;
    const totalSubsCount = subsList.length || 1;
    const churn = ((cancelledCount / totalSubsCount) * 100).toFixed(1);

    // Failed payments count
    const failedPayments = historyList.filter(h => h.status === 'failed').length;

    // Revenue by Plan
    let revenuePro = 0;
    let revenueProPlus = 0;

    invoicesList.forEach(inv => {
      if (inv.status === 'paid') {
        const isINR = inv.currency === 'INR';
        const usdVal = isINR ? inv.finalAmount / 85 : inv.finalAmount;
        if (inv.planId === 'student_pro') {
          revenuePro += usdVal;
        } else if (inv.planId === 'student_pro_plus') {
          revenueProPlus += usdVal;
        }
      }
    });

    return {
      activeSubsCount: activeSubs.length,
      conversionRate: `${conversionRate}%`,
      mrr: `$${mrr.toFixed(2)}`,
      arr: `$${arr.toFixed(2)}`,
      churn: `${churn}%`,
      failedPayments,
      revenuePro: `$${revenuePro.toFixed(2)}`,
      revenueProPlus: `$${revenueProPlus.toFixed(2)}`
    };
  }, [billingData]);

  // Search filtered user lists
  const filteredUsers = useMemo(() => {
    const uList = billingData.users.length > 0 ? billingData.users : students;
    return uList.filter(u => 
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [billingData, searchQuery, students]);

  return (
    <div className="space-y-6 text-xs text-slate-800 dark:text-slate-100">
      
      {/* Sub-tabs Navigation */}
      <div className="flex space-x-2 border-b border-border-theme pb-px transition-colors duration-300">
        {[
          { id: 'analytics', label: 'Revenue Analytics', icon: TrendingUp },
          { id: 'overrides', label: 'User Subscriptions', icon: Sliders },
          { id: 'history', label: 'Transaction Logs', icon: Clock },
          { id: 'coupons', label: 'Coupon Manager', icon: Percent }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 font-bold border-b-2 -mb-px transition-all ${
                activeTab === tab.id 
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loadingData && (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-muted font-bold">Synchronizing HyperBrain revenue records...</p>
        </div>
      )}

      {!loadingData && (
        <>
          {/* TAB 1: ANALYTICS DASHBOARD */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: "Active Pro Members", value: analytics.activeSubsCount, icon: Users, color: "text-blue-500" },
                  { label: "Monthly Recurring Revenue (MRR)", value: analytics.mrr, icon: DollarSign, color: "text-emerald-500" },
                  { label: "Annual Recurring Revenue (ARR)", value: analytics.arr, icon: TrendingUp, color: "text-indigo-500" },
                  { label: "Plan Conversion Rate", value: analytics.conversionRate, icon: Award, color: "text-amber-500" }
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <Card key={i} className="p-4 flex items-center space-x-4 bg-card border border-border-theme">
                      <div className={`p-2.5 rounded-xl bg-bg-secondary border border-border-theme/40 ${stat.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-muted uppercase tracking-widest block">{stat.label}</span>
                        <h4 className="text-lg font-black text-primary mt-0.5 leading-none">{stat.value}</h4>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-5 border border-border-theme bg-card space-y-4">
                  <h4 className="font-black uppercase tracking-wider text-muted">Customer Churn Rate</h4>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black text-red-500">{analytics.churn}</span>
                    <span className="text-[10px] text-muted font-bold">Cancellations ratio</span>
                  </div>
                  <p className="text-[10px] text-muted font-semibold">
                    Proportion of users who cancelled their recurring tier. Target churn limit: &lt; 5.0%.
                  </p>
                </Card>

                <Card className="p-5 border border-border-theme bg-card space-y-4">
                  <h4 className="font-black uppercase tracking-wider text-muted">Failed Billing Retries</h4>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black text-amber-500">{analytics.failedPayments}</span>
                    <span className="text-[10px] text-muted font-bold">Failed transactions</span>
                  </div>
                  <p className="text-[10px] text-muted font-semibold">
                    Unsuccessful gateway charges. Grace period settings allow users 3 days for correction.
                  </p>
                </Card>

                <Card className="p-5 border border-border-theme bg-card space-y-4">
                  <h4 className="font-black uppercase tracking-wider text-muted">Revenue Share by Plan</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold">Student Pro:</span>
                      <span className="font-black text-primary">{analytics.revenuePro}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold">Student Pro+:</span>
                      <span className="font-black text-primary">{analytics.revenueProPlus}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: USER OVERRIDES */}
          {activeTab === 'overrides' && (
            <Card className="bg-card border-border-theme p-0 overflow-hidden">
              <div className="p-4 border-b border-border-theme flex items-center justify-between bg-bg-secondary transition-all">
                <h3 className="font-black text-primary uppercase tracking-widest">User Plan Administration</h3>
                <div className="flex items-center space-x-2 w-full max-w-xs">
                  <Search className="w-4 h-4 text-muted" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-card border border-border-theme px-3 py-1.5 rounded-xl text-[10px] w-full focus:outline-none focus:border-blue-500 transition-all text-primary"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider text-[10px]">
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Active Plan</th>
                      <th className="p-4">Expiry Date</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme font-semibold text-primary">
                    {filteredUsers.map(student => {
                      const sub = billingData.subs.find(s => s.userId === student.uid || s.userId === student.id);
                      return (
                        <tr key={student.id} className="hover:bg-bg-secondary/40 transition-colors">
                          <td className="p-4 font-bold text-primary">{student.name}</td>
                          <td className="p-4 font-mono text-slate-500">{student.email}</td>
                          <td className="p-4 capitalize">{sub ? sub.planId?.replace('_', ' ') : 'Free Basic'}</td>
                          <td className="p-4 font-mono text-slate-500">
                            {sub?.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              sub?.status === 'active' || sub?.status === 'trialing' ? 'bg-green-600/10 text-green-500' :
                              sub?.status === 'paused' ? 'bg-yellow-600/10 text-yellow-500' :
                              sub?.status === 'past_due' ? 'bg-red-600/10 text-red-500' :
                              'bg-bg-secondary text-slate-400 border border-border-theme'
                            }`}>
                              {sub ? sub.status : 'Free'}
                            </span>
                          </td>
                          <td className="p-4 text-right flex items-center justify-end space-x-2 pt-3">
                            <button
                              onClick={() => {
                                setActionTargetUserId(student.id || student.uid);
                                setOverrideForm({ planId: sub?.planId || 'student_pro', billingPeriod: sub?.billingPeriod || 'monthly', durationDays: 30 });
                                setActiveActionModal('override');
                              }}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all text-[10px]"
                            >
                              Override
                            </button>
                            {sub && sub.planId !== 'free' && (
                              <button
                                onClick={() => {
                                  setActionTargetUserId(student.id || student.uid);
                                  setActiveActionModal('extend');
                                }}
                                className="px-2.5 py-1.5 bg-bg-secondary border border-border-theme hover:bg-card text-primary font-bold rounded-lg transition-all text-[10px]"
                              >
                                Extend
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 3: TRANSACTION LOGS */}
          {activeTab === 'history' && (
            <Card className="bg-card border-border-theme p-0 overflow-hidden">
              <div className="p-4 border-b border-border-theme bg-bg-secondary">
                <h3 className="font-black text-primary uppercase tracking-widest">Global Billing Invoice Records</h3>
              </div>
              <div className="overflow-x-auto">
                {billingData.invoices.length === 0 ? (
                  <div className="p-10 text-center text-muted font-bold">No transactions logged.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider text-[10px]">
                        <th className="p-4">Invoice ID</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Plan (Interval)</th>
                        <th className="p-4">Paid Amount</th>
                        <th className="p-4">Gateway</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-theme font-semibold text-primary">
                      {billingData.invoices.map(invoice => (
                        <tr key={invoice.id} className="hover:bg-bg-secondary/40 transition-colors">
                          <td className="p-4 font-mono font-bold">{invoice.id}</td>
                          <td className="p-4">
                            <div>{invoice.userName}</div>
                            <span className="text-[10px] text-slate-500 font-mono">{invoice.userEmail}</span>
                          </td>
                          <td className="p-4 capitalize">{invoice.planId?.replace('_', ' ')} ({invoice.billingPeriod})</td>
                          <td className="p-4 font-bold">{invoice.currency === 'INR' ? '₹' : '$'}{invoice.finalAmount}</td>
                          <td className="p-4 uppercase">{invoice.gateway}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              invoice.status === 'paid' ? 'bg-green-600/10 text-green-500' :
                              invoice.status === 'refunded' ? 'bg-amber-600/10 text-amber-500' :
                              'bg-red-600/10 text-red-500'
                            }`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="p-4 text-right flex items-center justify-end space-x-2 pt-3">
                            <a
                              href={`/api/billing-invoice?txn_id=${invoice.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 bg-bg-secondary border border-border-theme rounded-lg text-primary hover:bg-card transition-all flex items-center space-x-1"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>GST INVOICE</span>
                            </a>
                            {invoice.status === 'paid' && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Refund payment ${invoice.finalAmount} ${invoice.currency}? This will downgrade user subscription to Free.`)) {
                                    handleAdminAction({ action: 'refund_payment', transactionId: invoice.id });
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-red-600/10 border border-red-600/30 text-red-600 hover:bg-red-600/20 font-bold rounded-lg transition-all"
                              >
                                Refund
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          )}

          {/* TAB 4: COUPON MANAGER */}
          {activeTab === 'coupons' && (
            <div className="space-y-6">
              
              <div className="flex justify-between items-center">
                <h3 className="font-black text-primary uppercase tracking-widest">Dynamic Discounts & Promo Codes</h3>
                <button
                  onClick={() => setShowCreateCoupon(!showCreateCoupon)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center space-x-1.5 active:scale-95 transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Coupon Code</span>
                </button>
              </div>

              {showCreateCoupon && (
                <Card className="p-5 border border-border-theme bg-card space-y-4">
                  <h4 className="font-black text-primary uppercase tracking-wider">Configure New Coupon</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-muted font-bold uppercase">Promo Code</label>
                      <input
                        type="text"
                        placeholder="e.g. SUMMERSALE"
                        value={newCoupon.code}
                        onChange={(e) => setNewCoupon(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                        className="bg-bg-secondary border border-border-theme rounded-xl px-3 py-2 text-xs font-semibold text-primary uppercase focus:outline-none w-full"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-muted font-bold uppercase">Discount Type</label>
                      <select
                        value={newCoupon.type}
                        onChange={(e) => setNewCoupon(prev => ({ ...prev, type: e.target.value }))}
                        className="bg-bg-secondary border border-border-theme rounded-xl px-3 py-2 text-xs font-semibold text-primary focus:outline-none w-full"
                      >
                        <option value="percentage">Percentage Discount (%)</option>
                        <option value="fixed">Fixed Amount Discount</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-muted font-bold uppercase">Discount Value</label>
                      <input
                        type="number"
                        value={newCoupon.value}
                        onChange={(e) => setNewCoupon(prev => ({ ...prev, value: Number(e.target.value) }))}
                        className="bg-bg-secondary border border-border-theme rounded-xl px-3 py-2 text-xs font-semibold text-primary focus:outline-none w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-muted font-bold uppercase">Usage limits (max redemptions)</label>
                      <input
                        type="number"
                        value={newCoupon.maxRedemptions}
                        onChange={(e) => setNewCoupon(prev => ({ ...prev, maxRedemptions: Number(e.target.value) }))}
                        className="bg-bg-secondary border border-border-theme rounded-xl px-3 py-2 text-xs font-semibold text-primary focus:outline-none w-full"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-muted font-bold uppercase">Expiration Date</label>
                      <input
                        type="date"
                        value={newCoupon.expirationDate}
                        onChange={(e) => setNewCoupon(prev => ({ ...prev, expirationDate: e.target.value }))}
                        className="bg-bg-secondary border border-border-theme rounded-xl px-3 py-2 text-xs font-semibold text-primary focus:outline-none w-full"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-muted font-bold uppercase">Currency (for fixed type)</label>
                      <select
                        value={newCoupon.currency}
                        onChange={(e) => setNewCoupon(prev => ({ ...prev, currency: e.target.value }))}
                        className="bg-bg-secondary border border-border-theme rounded-xl px-3 py-2 text-xs font-semibold text-primary focus:outline-none w-full"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="INR">INR (₹)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <button
                      onClick={() => handleAdminAction({ action: 'create_coupon', ...newCoupon })}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl active:scale-95 transition-all shadow-xs"
                    >
                      Save Coupon
                    </button>
                    <button
                      onClick={() => setShowCreateCoupon(false)}
                      className="px-4 py-2 bg-bg-secondary border border-border-theme text-primary font-bold rounded-xl active:scale-95 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </Card>
              )}

              {/* Coupon list */}
              <Card className="bg-card border-border-theme p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  {billingData.coupons.length === 0 ? (
                    <div className="p-10 text-center text-muted font-bold">No coupons created in the system. Use WELCOME50, PROMO20, FREEPROMO.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider text-[10px]">
                          <th className="p-4">Code</th>
                          <th className="p-4">Discount Type</th>
                          <th className="p-4">Value</th>
                          <th className="p-4">Redemptions</th>
                          <th className="p-4">Expiration Date</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-theme font-semibold text-primary">
                        {billingData.coupons.map(coupon => (
                          <tr key={coupon.id} className="hover:bg-bg-secondary/40 transition-colors">
                            <td className="p-4 font-bold text-primary uppercase">{coupon.code}</td>
                            <td className="p-4 capitalize">{coupon.type}</td>
                            <td className="p-4">
                              {coupon.type === 'percentage' ? `${coupon.value}%` : `${coupon.currency === 'INR' ? '₹' : '$'}${coupon.value}`}
                            </td>
                            <td className="p-4 font-mono text-slate-500">
                              {coupon.redemptionCount || 0} / {coupon.maxRedemptions || '∞'}
                            </td>
                            <td className="p-4 font-mono text-slate-500">
                              {coupon.expirationDate ? new Date(coupon.expirationDate).toLocaleDateString() : 'Never'}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                coupon.isActive ? 'bg-green-600/10 text-green-500' : 'bg-bg-secondary text-slate-400'
                              }`}>
                                {coupon.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              {coupon.isActive && (
                                <button
                                  onClick={() => handleAdminAction({ action: 'deactivate_coupon', code: coupon.code })}
                                  className="px-2.5 py-1.5 bg-red-600/10 border border-red-600/30 text-red-600 hover:bg-red-600/20 font-bold rounded-lg transition-all"
                                >
                                  Deactivate
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* OVERRIDE PLAN DIALOG */}
          {activeActionModal === 'override' && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <Card className="bg-card border border-border-theme w-full max-w-md rounded-2xl p-6 space-y-4 text-left">
                <div className="flex justify-between items-center border-b border-border-theme pb-2">
                  <h3 className="font-black uppercase tracking-wider text-primary">Override Subscription Plan</h3>
                  <button onClick={() => setActiveActionModal(null)}>
                    <X className="w-5 h-5 text-muted hover:text-primary transition-all" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-muted font-bold uppercase">Plan ID</label>
                    <select
                      value={overrideForm.planId}
                      onChange={(e) => setOverrideForm(prev => ({ ...prev, planId: e.target.value }))}
                      className="bg-bg-secondary border border-border-theme rounded-xl px-3 py-2 text-xs font-semibold text-primary w-full focus:outline-none"
                    >
                      <option value="free">Free Basic</option>
                      <option value="student_pro">Student Pro</option>
                      <option value="student_pro_plus">Student Pro+</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-muted font-bold uppercase">Billing Cycle</label>
                    <select
                      value={overrideForm.billingPeriod}
                      onChange={(e) => setOverrideForm(prev => ({ ...prev, billingPeriod: e.target.value }))}
                      className="bg-bg-secondary border border-border-theme rounded-xl px-3 py-2 text-xs font-semibold text-primary w-full focus:outline-none"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-muted font-bold uppercase">Subscription Duration (Days)</label>
                    <input
                      type="number"
                      value={overrideForm.durationDays}
                      onChange={(e) => setOverrideForm(prev => ({ ...prev, durationDays: Number(e.target.value) }))}
                      className="bg-bg-secondary border border-border-theme rounded-xl px-3 py-2 text-xs font-semibold text-primary w-full focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={() => handleAdminAction({ action: 'grant_premium', userId: actionTargetUserId, ...overrideForm })}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl active:scale-95 transition-all text-xs"
                  >
                    Apply Override
                  </button>
                  <button
                    onClick={() => setActiveActionModal(null)}
                    className="px-4 py-2 bg-bg-secondary border border-border-theme text-primary font-bold rounded-xl active:scale-95 transition-all text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </Card>
            </div>
          )}

          {/* EXTEND SUBSCRIPTION DIALOG */}
          {activeActionModal === 'extend' && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <Card className="bg-card border border-border-theme w-full max-w-md rounded-2xl p-6 space-y-4 text-left">
                <div className="flex justify-between items-center border-b border-border-theme pb-2">
                  <h3 className="font-black uppercase tracking-wider text-primary">Extend Premium Access</h3>
                  <button onClick={() => setActiveActionModal(null)}>
                    <X className="w-5 h-5 text-muted hover:text-primary transition-all" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-muted font-bold uppercase">Extend Duration (Days)</label>
                  <input
                    type="number"
                    value={extendDays}
                    onChange={(e) => setExtendDays(Number(e.target.value))}
                    className="bg-bg-secondary border border-border-theme rounded-xl px-3 py-2 text-xs font-semibold text-primary w-full focus:outline-none"
                  />
                </div>
                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={() => handleAdminAction({ action: 'extend_subscription', userId: actionTargetUserId, days: extendDays })}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl active:scale-95 transition-all text-xs"
                  >
                    Extend Sub
                  </button>
                  <button
                    onClick={() => setActiveActionModal(null)}
                    className="px-4 py-2 bg-bg-secondary border border-border-theme text-primary font-bold rounded-xl active:scale-95 transition-all text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

    </div>
  );
}
