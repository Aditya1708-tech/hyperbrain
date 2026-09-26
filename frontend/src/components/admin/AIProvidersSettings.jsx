import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  verifyKeyHealth, 
  getGatewayStats, 
  reloadGatewayKeys 
} from '../../services/aiService';
import { 
  Cpu, Key, Plus, Trash2, ShieldAlert, CheckCircle, 
  RefreshCw, Activity, Sliders, Database, AlertCircle 
} from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';

export default function AIProvidersSettings({ showToast }) {
  const [geminiKeys, setGeminiKeys] = useState(['']);
  const [groqKeys, setGroqKeys] = useState(['']);
  
  // Real unmasked keys loaded from server, kept locally in memory for saving/testing
  const [originalGeminiKeys, setOriginalGeminiKeys] = useState([]);
  const [originalGroqKeys, setOriginalGroqKeys] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [gatewayStats, setGatewayStats] = useState([]);

  // Connection validation results: { 'provider_index': 'loading' | 'connected' | 'invalid' }
  const [connectionStatus, setConnectionStatus] = useState({});

  const maskKey = (key) => {
    if (!key) return '';
    if (key.length <= 8) return '********';
    return `${key.slice(0, 4)}****************${key.slice(-4)}`;
  };

  const isMaskedPattern = (str) => {
    return str && str.includes('****************');
  };

  const loadKeys = async () => {
    setIsLoading(true);
    try {
      // Load Gemini
      const geminiDoc = await getDoc(doc(db, 'system_settings', 'gemini'));
      if (geminiDoc.exists()) {
        const data = geminiDoc.data();
        if (data && Array.isArray(data.keys)) {
          const loaded = data.keys.filter(Boolean);
          setOriginalGeminiKeys(loaded);
          setGeminiKeys(loaded.map(k => maskKey(k)));
        } else {
          setGeminiKeys(['']);
          setOriginalGeminiKeys([]);
        }
      } else {
        setGeminiKeys(['']);
        setOriginalGeminiKeys([]);
      }

      // Load Groq
      const groqDoc = await getDoc(doc(db, 'system_settings', 'groq'));
      if (groqDoc.exists()) {
        const data = groqDoc.data();
        if (data && Array.isArray(data.keys)) {
          const loaded = data.keys.filter(Boolean);
          setOriginalGroqKeys(loaded);
          setGroqKeys(loaded.map(k => maskKey(k)));
        } else {
          setGroqKeys(['']);
          setOriginalGroqKeys([]);
        }
      } else {
        setGroqKeys(['']);
        setOriginalGroqKeys([]);
      }

      // Load gateway live session stats
      setGatewayStats(getGatewayStats());
    } catch (e) {
      console.error("Failed to load settings keys:", e);
      showToast("Failed to fetch keys from Firestore");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleAddKey = (provider) => {
    if (provider === 'gemini') {
      if (geminiKeys.length >= 3) {
        showToast("Gemini gateway is limited to a maximum of 3 keys.");
        return;
      }
      setGeminiKeys([...geminiKeys, '']);
      setOriginalGeminiKeys([...originalGeminiKeys, '']);
    } else {
      if (groqKeys.length >= 3) {
        showToast("Groq gateway is limited to a maximum of 3 keys.");
        return;
      }
      setGroqKeys([...groqKeys, '']);
      setOriginalGroqKeys([...originalGroqKeys, '']);
    }
  };

  const handleRemoveKey = (provider, index) => {
    if (provider === 'gemini') {
      const updatedKeys = geminiKeys.filter((_, idx) => idx !== index);
      const updatedOriginals = originalGeminiKeys.filter((_, idx) => idx !== index);
      setGeminiKeys(updatedKeys.length > 0 ? updatedKeys : ['']);
      setOriginalGeminiKeys(updatedOriginals.length > 0 ? updatedOriginals : ['']);
      
      // Clear status
      const updatedStatus = { ...connectionStatus };
      delete updatedStatus[`gemini_${index}`];
      setConnectionStatus(updatedStatus);
    } else {
      const updatedKeys = groqKeys.filter((_, idx) => idx !== index);
      const updatedOriginals = originalGroqKeys.filter((_, idx) => idx !== index);
      setGroqKeys(updatedKeys.length > 0 ? updatedKeys : ['']);
      setOriginalGroqKeys(updatedOriginals.length > 0 ? updatedOriginals : ['']);

      const updatedStatus = { ...connectionStatus };
      delete updatedStatus[`groq_${index}`];
      setConnectionStatus(updatedStatus);
    }
  };

  const handleKeyChange = (provider, index, val) => {
    if (provider === 'gemini') {
      const updated = [...geminiKeys];
      updated[index] = val;
      setGeminiKeys(updated);

      if (!isMaskedPattern(val)) {
        const updatedOrig = [...originalGeminiKeys];
        updatedOrig[index] = val;
        setOriginalGeminiKeys(updatedOrig);
      }

      // Reset test connection status on edit
      if (connectionStatus[`gemini_${index}`]) {
        const copy = { ...connectionStatus };
        delete copy[`gemini_${index}`];
        setConnectionStatus(copy);
      }
    } else {
      const updated = [...groqKeys];
      updated[index] = val;
      setGroqKeys(updated);

      if (!isMaskedPattern(val)) {
        const updatedOrig = [...originalGroqKeys];
        updatedOrig[index] = val;
        setOriginalGroqKeys(updatedOrig);
      }

      if (connectionStatus[`groq_${index}`]) {
        const copy = { ...connectionStatus };
        delete copy[`groq_${index}`];
        setConnectionStatus(copy);
      }
    }
  };

  const validateLocalKey = (key, provider) => {
    if (!key) return false;
    const patterns = {
      gemini: [
        /^(AQ|AIza)[A-Za-z0-9_\-\.]{20,}$/
      ],
      groq: [
        /^gsk_[A-Za-z0-9_\-]{20,}$/
      ]
    };
    return patterns[provider]?.some(pattern => pattern.test(key));
  };

  const handleTestConnection = async (provider, index) => {
    // Determine target key
    const rawVal = provider === 'gemini' ? geminiKeys[index] : groqKeys[index];
    let actualKey = rawVal;

    if (isMaskedPattern(rawVal)) {
      actualKey = provider === 'gemini' ? originalGeminiKeys[index] : originalGroqKeys[index];
    }

    const statusId = `${provider}_${index}`;
    
    if (!actualKey) {
      setConnectionStatus(prev => ({ ...prev, [statusId]: 'invalid' }));
      showToast("Please input a key before testing.");
      return;
    }

    // 1. Format validation
    if (!validateLocalKey(actualKey, provider)) {
      setConnectionStatus(prev => ({ ...prev, [statusId]: 'invalid' }));
      showToast(`${provider.toUpperCase()} API Key format is invalid.`);
      return;
    }

    setConnectionStatus(prev => ({ ...prev, [statusId]: 'loading' }));

    // 2. Verification request (Do NOT trust regex alone, verify using a test request)
    try {
      const isHealthy = await verifyKeyHealth(actualKey, provider);
      if (isHealthy) {
        setConnectionStatus(prev => ({ ...prev, [statusId]: 'connected' }));
        showToast(`Key connected successfully: 🟢 ${provider.toUpperCase()}`);
      } else {
        setConnectionStatus(prev => ({ ...prev, [statusId]: 'invalid' }));
        showToast(`Key health check failed: 🔴 ${provider.toUpperCase()}`);
      }
    } catch (e) {
      setConnectionStatus(prev => ({ ...prev, [statusId]: 'invalid' }));
      showToast(`Key health check failed: 🔴 ${provider.toUpperCase()}`);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Map Gemini keys, replacing masked strings back to original
      const finalGemini = geminiKeys.map((k, idx) => {
        return isMaskedPattern(k) ? originalGeminiKeys[idx] : k;
      }).filter(Boolean);

      // Map Groq keys
      const finalGroq = groqKeys.map((k, idx) => {
        return isMaskedPattern(k) ? originalGroqKeys[idx] : k;
      }).filter(Boolean);

      // Save to Firestore
      await setDoc(doc(db, 'system_settings', 'gemini'), {
        provider: 'gemini',
        keys: finalGemini,
        updatedAt: new Date().toISOString()
      });

      await setDoc(doc(db, 'system_settings', 'groq'), {
        provider: 'groq',
        keys: finalGroq,
        updatedAt: new Date().toISOString()
      });

      showToast("AI Gateway key credentials saved to server.");
      
      // Reload gateway keys in active context
      await reloadGatewayKeys();
      
      // Reload states
      await loadKeys();
    } catch (e) {
      console.error(e);
      showToast("Error saving AI settings: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="bg-bg-secondary p-4 rounded-2xl border border-border-theme flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-primary block">AI Provider Gateways</span>
          <span className="text-[10px] text-muted font-semibold block mt-0.5">
            Configure round-robin key rotation, API fallbacks, and live telemetry tracking.
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadKeys}
            className="flex items-center space-x-1 py-1.5 px-3 text-[10px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="flex items-center space-x-1 py-1.5 px-3 text-[10px]"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center bg-card border-border-theme">
          <Activity className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-muted font-semibold">Loading security settings credentials...</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Gemini Panel */}
          <Card className="p-6 bg-card border-border-theme space-y-4">
            <div className="flex items-center justify-between border-b border-border-theme pb-2.5">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-teal-500/10 text-teal-600 rounded-lg">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">Gemini Provider</h3>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleAddKey('gemini')}
                className="py-1 px-2.5 text-[9px] font-black uppercase tracking-wider flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Key</span>
              </Button>
            </div>

            <div className="space-y-4.5 pt-1">
              {geminiKeys.map((keyVal, idx) => {
                const statusId = `gemini_${idx}`;
                const status = connectionStatus[statusId];
                return (
                  <div key={idx} className="space-y-1.5 bg-bg-secondary/25 p-3 rounded-2xl border border-border-theme/40">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-muted uppercase tracking-wider">
                        Gemini API Key {idx + 1}
                      </label>
                      <button 
                        onClick={() => handleRemoveKey('gemini', idx)}
                        className="text-muted hover:text-red-500 transition-colors p-0.5"
                        title="Remove Key Field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input 
                        type="password"
                        value={keyVal}
                        onChange={(e) => handleKeyChange('gemini', idx, e.target.value)}
                        placeholder="AIzaSy..."
                        className="flex-1 bg-bg-secondary text-primary text-xs px-3.5 py-2 rounded-xl border border-border-theme focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection('gemini', idx)}
                        disabled={status === 'loading'}
                        className="py-2 px-3 text-[10px]"
                      >
                        {status === 'loading' ? 'Testing...' : 'Test Connection'}
                      </Button>
                    </div>

                    {status && (
                      <div className="text-[10px] font-bold mt-1 flex items-center space-x-1">
                        {status === 'connected' ? (
                          <span className="text-green-600 flex items-center space-x-1">
                            <span>🟢</span>
                            <span>Connected</span>
                          </span>
                        ) : status === 'invalid' ? (
                          <span className="text-red-500 flex items-center space-x-1">
                            <span>🔴</span>
                            <span>Invalid or inactive API key</span>
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Groq Panel */}
          <Card className="p-6 bg-card border-border-theme space-y-4">
            <div className="flex items-center justify-between border-b border-border-theme pb-2.5">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-orange-500/10 text-orange-600 rounded-lg">
                  <Sliders className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">Groq Provider</h3>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleAddKey('groq')}
                className="py-1 px-2.5 text-[9px] font-black uppercase tracking-wider flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Key</span>
              </Button>
            </div>

            <div className="space-y-4.5 pt-1">
              {groqKeys.map((keyVal, idx) => {
                const statusId = `groq_${idx}`;
                const status = connectionStatus[statusId];
                return (
                  <div key={idx} className="space-y-1.5 bg-bg-secondary/25 p-3 rounded-2xl border border-border-theme/40">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-muted uppercase tracking-wider">
                        Groq API Key {idx + 1}
                      </label>
                      <button 
                        onClick={() => handleRemoveKey('groq', idx)}
                        className="text-muted hover:text-red-500 transition-colors p-0.5"
                        title="Remove Key Field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input 
                        type="password"
                        value={keyVal}
                        onChange={(e) => handleKeyChange('groq', idx, e.target.value)}
                        placeholder="gsk_..."
                        className="flex-1 bg-bg-secondary text-primary text-xs px-3.5 py-2 rounded-xl border border-border-theme focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection('groq', idx)}
                        disabled={status === 'loading'}
                        className="py-2 px-3 text-[10px]"
                      >
                        {status === 'loading' ? 'Testing...' : 'Test Connection'}
                      </Button>
                    </div>

                    {status && (
                      <div className="text-[10px] font-bold mt-1 flex items-center space-x-1">
                        {status === 'connected' ? (
                          <span className="text-green-600 flex items-center space-x-1">
                            <span>🟢</span>
                            <span>Connected</span>
                          </span>
                        ) : status === 'invalid' ? (
                          <span className="text-red-500 flex items-center space-x-1">
                            <span>🔴</span>
                            <span>Invalid or inactive API key</span>
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Telemetry Analytics Stats */}
          <Card className="lg:col-span-2 p-6 bg-card border-border-theme space-y-4">
            <div className="flex items-center space-x-2 border-b border-border-theme pb-2.5">
              <Activity className="w-4 h-4 text-blue-500" />
              <h3 className="text-xs font-black text-primary uppercase tracking-widest">Gateway Health Analytics</h3>
            </div>

            {/* Visual Indicators of Key Health */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-bg-secondary/20 p-3.5 rounded-2xl border border-border-theme/40">
              {gatewayStats.map((stat, i) => {
                const isHealthy = stat.status === 'healthy' || stat.status === 'Healthy';
                const providerIndex = gatewayStats.filter((s, idx) => s.provider === stat.provider && idx <= i).length;
                const keyLabel = `${stat.provider.charAt(0).toUpperCase() + stat.provider.slice(1)} Key ${providerIndex}`;
                return (
                  <div key={i} className="flex items-center space-x-2.5 p-2.5 bg-card border border-border-theme rounded-xl">
                    <span className="text-xs">{isHealthy ? '🟢' : '🔴'}</span>
                    <div>
                      <span className="text-[10px] font-black text-primary block leading-tight">
                        {keyLabel} {isHealthy ? 'Healthy' : 'Failed (Cooldown)'}
                      </span>
                      <span className="text-[9px] text-muted font-bold block mt-0.5 leading-none">
                        Reqs: {stat.requests} | Fails: {stat.failures}
                      </span>
                    </div>
                  </div>
                );
              })}
              {gatewayStats.length === 0 && (
                <div className="col-span-full py-2 text-center text-[10px] text-muted font-black uppercase tracking-wider">
                  No active keys tracked in this session.
                </div>
              )}
            </div>
            
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-theme text-muted text-[10px] uppercase font-black tracking-wider">
                    <th className="py-2.5 px-3">Masked Key</th>
                    <th className="py-2.5 px-3">Provider</th>
                    <th className="py-2.5 px-3 text-center">Requests</th>
                    <th className="py-2.5 px-3 text-center">Failures</th>
                    <th className="py-2.5 px-3">Last Used</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-theme text-primary font-semibold">
                  {gatewayStats.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-muted font-semibold">
                        No active provider requests tracked in this gateway session.
                      </td>
                    </tr>
                  ) : (
                    gatewayStats.map((stat, i) => (
                      <tr key={i} className="hover:bg-bg-secondary/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[10px] text-muted">{stat.key}</td>
                        <td className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">{stat.provider}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-600 dark:text-blue-400">{stat.requests}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-red-500">{stat.failures}</td>
                        <td className="py-2.5 px-3 text-muted text-[10px]">{stat.lastUsed}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            stat.status === 'healthy' 
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' 
                              : 'bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse'
                          }`}>
                            {stat.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          
        </div>
      )}
    </div>
  );
}
