
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { User, Appliance, EnergyReading } from '../types';
import { getEnergyInsights, predictDeviceType } from '../services/geminiService';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'billing'>('monitor');
  const [espIp] = useState<string>(localStorage.getItem('ecoPulse_espIp') || '');
  const [hardwareStatus, setHardwareStatus] = useState<'idle' | 'linking' | 'connected' | 'error' | 'offline'>('idle');
  
  const [appliances, setAppliances] = useState<Appliance[]>([
    {
      id: 'bulb-01',
      name: 'Smart Light Bulb',
      type: 'lightbulb',
      isOn: true,
      basePower: 12,
      currentPower: 12.5,
      currentVoltage: 220,
      currentPowerLoss: 0.4,
      history: []
    }
  ]);

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [identifyingId, setIdentifyingId] = useState<string | null>(null);
  const [voltageLimit, setVoltageLimit] = useState(230);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Appliance['type']>('lightbulb');

  // Billing Mock Data
  const costPerKWh = 0.14; // $0.14 per kWh
  const billingHistory = [
    { month: 'Oct', cost: 42.50, consumption: 304 },
    { month: 'Nov', cost: 38.20, consumption: 272 },
    { month: 'Dec', cost: 55.90, consumption: 399 },
    { month: 'Jan', cost: 48.15, consumption: 344 },
  ];

  useEffect(() => {
    if (espIp) {
      const checkConnection = async () => {
        setHardwareStatus('linking');
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          await fetch(`http://${espIp}/`, { method: 'GET', mode: 'no-cors', signal: controller.signal });
          clearTimeout(timeoutId);
          setHardwareStatus('connected');
        } catch {
          setHardwareStatus('offline');
        }
      };
      checkConnection();
    }
  }, [espIp]);

  const sendHardwareCommand = async (state: boolean) => {
    if (!espIp) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      await fetch(`http://${espIp}/relay?state=${state ? '1' : '0'}`, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (error) {
      console.error("Relay Command Failed:", error);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setAppliances(prev => prev.map(app => {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (!app.isOn) return { ...app, currentPower: 0, currentVoltage: 0, currentPowerLoss: 0, history: [...app.history.slice(-19), { timestamp, power: 0, voltage: 0, powerLoss: 0 }] };
        const jitter = 0.95 + Math.random() * 0.1;
        const currentPower = app.basePower * jitter;
        const currentPowerLoss = currentPower * (0.03 + Math.random() * 0.03);
        const currentVoltage = Math.min(215 + Math.random() * 10, voltageLimit);
        return { ...app, currentPower, currentVoltage, currentPowerLoss, history: [...app.history.slice(-19), { timestamp, power: currentPower, voltage: currentVoltage, powerLoss: currentPowerLoss }] };
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [voltageLimit]);

  const togglePower = (id: string) => {
    setAppliances(prev => prev.map(app => {
      if (app.id === id) {
        const newState = !app.isOn;
        if (app.type === 'lightbulb') sendHardwareCommand(newState);
        return { ...app, isOn: newState };
      }
      return app;
    }));
  };

  const deleteAppliance = (id: string) => setAppliances(prev => prev.filter(app => app.id !== id));
  
  const handleIdentify = async (id: string) => {
    const app = appliances.find(a => a.id === id);
    if (!app || app.history.length < 5) return;
    setIdentifyingId(id);
    const prediction = await predictDeviceType(app.history);
    setAppliances(prev => prev.map(a => a.id === id ? { ...a, aiPrediction: prediction } : a));
    setIdentifyingId(null);
  };

  const addAppliance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const basePowers = { lightbulb: 12, fan: 55, heater: 1500, other: 100 };
    const newApp: Appliance = { id: Date.now().toString(), name: newName, type: newType, isOn: false, basePower: basePowers[newType], currentPower: 0, currentVoltage: 0, currentPowerLoss: 0, history: [] };
    setAppliances(prev => [...prev, newApp]);
    setNewName('');
    setShowAddModal(false);
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    const insight = await getEnergyInsights(appliances);
    setAiInsight(insight);
    setIsAnalyzing(false);
  };

  const totalPower = appliances.reduce((sum, app) => sum + app.currentPower, 0);
  const totalLoss = appliances.reduce((sum, app) => sum + app.currentPowerLoss, 0);
  const activeCount = appliances.filter(app => app.isOn).length;
  const aggregateHistory = appliances.length > 0 ? appliances[0].history.map((reading, index) => ({
    timestamp: reading.timestamp,
    power: appliances.reduce((sum, app) => sum + (app.history[index]?.power || 0), 0),
    loss: appliances.reduce((sum, app) => sum + (app.history[index]?.powerLoss || 0), 0)
  })) : [];

  // Billing Calculations
  const estimatedDailyConsumption = (totalPower * 24) / 1000; // kWh
  const estimatedMonthlyCost = estimatedDailyConsumption * 30 * costPerKWh;

  const renderMonitorView = () => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-5 rounded-2xl border-l-4 border-l-emerald-500 shadow-lg">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Consumption</p>
          <div className="flex items-baseline gap-1"><span className="text-3xl font-bold text-white">{totalPower.toFixed(1)}</span><span className="text-sm text-slate-500">W</span></div>
        </div>
        <div className="glass p-5 rounded-2xl border-l-4 border-l-red-500 shadow-lg">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Power Loss</p>
          <div className="flex items-baseline gap-1"><span className="text-3xl font-bold text-white">{totalLoss.toFixed(2)}</span><span className="text-sm text-slate-500">W</span></div>
        </div>
        <div className="glass p-5 rounded-2xl border-l-4 border-l-blue-500 shadow-lg">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">System Voltage</p>
          <div className="flex items-baseline gap-1"><span className="text-3xl font-bold text-white">{appliances[0]?.currentVoltage.toFixed(1) || '0.0'}</span><span className="text-sm text-slate-500">V</span></div>
        </div>
        <div className="glass p-5 rounded-2xl border-l-4 border-l-amber-500 shadow-lg">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Active Nodes</p>
          <div className="flex items-baseline gap-1"><span className="text-3xl font-bold text-white">{activeCount}</span><span className="text-sm text-slate-500">/ {appliances.length}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <i className="fas fa-microchip text-emerald-500"></i>
              Appliance Center
            </h3>
            <button onClick={() => setShowAddModal(true)} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20">
              <i className="fas fa-plus"></i> Connect New
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {appliances.map(app => (
              <div key={app.id} className="glass p-5 rounded-2xl group relative overflow-hidden flex flex-col justify-between min-h-[180px]">
                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                   <button onClick={() => handleIdentify(app.id)} className="text-indigo-400 hover:text-indigo-300 p-1 bg-slate-900/50 rounded" disabled={identifyingId === app.id}>
                     {identifyingId === app.id ? <i className="fas fa-spinner fa-spin text-xs"></i> : <i className="fas fa-brain text-xs"></i>}
                   </button>
                   <button onClick={() => deleteAppliance(app.id)} className="text-slate-500 hover:text-red-500 p-1 bg-slate-900/50 rounded">
                     <i className="fas fa-trash-alt text-xs"></i>
                   </button>
                </div>
                
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-inner ${app.isOn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      <i className={`fas ${app.type === 'lightbulb' ? 'fa-lightbulb' : app.type === 'fan' ? 'fa-wind' : app.type === 'heater' ? 'fa-fire' : 'fa-plug'} text-lg`}></i>
                    </div>
                    <div>
                      <h4 className="text-white font-medium text-sm">{app.name}</h4>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">{app.type}</p>
                    </div>
                  </div>
                  <button onClick={() => togglePower(app.id)} className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${app.isOn ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${app.isOn ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-auto">
                   <div className="space-y-0.5"><p className="text-[9px] text-slate-500 font-bold uppercase">Power</p><p className="text-lg font-bold text-white">{app.currentPower.toFixed(1)} W</p></div>
                   <div className="space-y-0.5 text-right"><p className="text-[9px] text-red-500 font-bold uppercase">Loss</p><p className="text-lg font-bold text-slate-300">{app.currentPowerLoss.toFixed(2)} W</p></div>
                </div>
              </div>
            ))}
          </div>

          <div className="glass p-6 rounded-2xl shadow-xl">
             <h3 className="text-sm font-semibold text-white mb-4">Real-time Load Analytics</h3>
             <div className="h-[200px]">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={aggregateHistory}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                   <XAxis dataKey="timestamp" hide />
                   <YAxis hide />
                   <Area type="monotone" dataKey="power" stroke="#10b981" fill="#10b98133" strokeWidth={2} isAnimationActive={false} />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <i className="fas fa-wand-magic-sparkles text-indigo-400"></i>
            Neural Analysis
          </h3>
          <div className="glass p-5 rounded-2xl space-y-4 min-h-[200px] flex flex-col shadow-xl">
            <div className="bg-slate-900/40 rounded-xl p-4 flex-grow border border-slate-800/50">
               {aiInsight ? (
                 <div className="text-slate-300 text-xs leading-relaxed animate-in fade-in duration-700">{aiInsight}</div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-center px-4 opacity-50">
                    <i className="fas fa-atom text-2xl mb-3 text-slate-800 animate-spin-slow"></i>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Awaiting telemetry</p>
                 </div>
               )}
            </div>
            <button onClick={runAnalysis} disabled={isAnalyzing || appliances.length === 0} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20">
              {isAnalyzing ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-bolt-lightning mr-2"></i>}
              {isAnalyzing ? 'Analyzing Load...' : 'Deep Scan Network'}
            </button>
          </div>

          <div className="glass p-5 rounded-2xl shadow-lg border border-slate-800/50">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">System Safety Calibration</h4>
            <div className="space-y-4">
               <div>
                 <div className="flex justify-between text-[10px] mb-2 font-bold uppercase tracking-tighter">
                    <span className="text-slate-400">Voltage Threshold</span>
                    <span className="text-amber-500">{voltageLimit}V</span>
                 </div>
                 <input type="range" min="100" max="230" value={voltageLimit} onChange={(e) => setVoltageLimit(Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
               </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderBillingView = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass p-8 rounded-3xl border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Monthly Billing Forecast</h3>
              <p className="text-xs text-slate-400">Based on current real-time consumption levels</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Standard Rate</span>
              <span className="text-lg font-bold text-emerald-400">${costPerKWh}/kWh</span>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-8 py-4">
             <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                   <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-800" />
                   <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="440" strokeDashoffset={440 - (Math.min(estimatedMonthlyCost, 100) / 100) * 440} className="text-emerald-500" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-3xl font-bold text-white">${estimatedMonthlyCost.toFixed(2)}</span>
                   <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Est. Bill</span>
                </div>
             </div>
             
             <div className="flex-grow space-y-4">
                <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                   <div className="flex justify-between mb-1">
                      <span className="text-xs text-slate-400">Current Load Cost</span>
                      <span className="text-xs text-white font-bold">${((totalPower / 1000) * costPerKWh).toFixed(4)} /hr</span>
                   </div>
                   <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.min((totalPower/1000) * 100, 100)}%` }}></div>
                   </div>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                   <div className="flex justify-between mb-1">
                      <span className="text-xs text-slate-400">Power Loss Waste</span>
                      <span className="text-xs text-red-400 font-bold">-${((totalLoss / 1000) * costPerKWh * 24 * 30).toFixed(2)} /mo</span>
                   </div>
                   <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${Math.min((totalLoss/10) * 100, 100)}%` }}></div>
                   </div>
                </div>
             </div>
          </div>
          
          <div className="mt-8 flex gap-4">
             <button className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/20">MAKE PRE-PAYMENT</button>
             <button className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs border border-slate-700 transition-all">DOWNLOAD INVOICE</button>
          </div>
        </div>
        
        <div className="glass p-6 rounded-3xl flex flex-col justify-between">
           <div>
              <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                 <i className="fas fa-history text-indigo-400"></i>
                 PAYMENT HISTORY
              </h3>
              <div className="space-y-5">
                 {billingHistory.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center group cursor-default">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-all">
                             <i className="fas fa-file-invoice-dollar text-slate-500 text-xs"></i>
                          </div>
                          <div>
                             <p className="text-xs font-bold text-white">{item.month} Statement</p>
                             <p className="text-[9px] text-slate-500 uppercase">{item.consumption} kWh consumed</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-bold text-emerald-500">${item.cost.toFixed(2)}</p>
                          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">PAID</p>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
           
           <div className="mt-8 pt-6 border-t border-slate-800">
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center gap-4">
                 <i className="fas fa-lightbulb text-indigo-400 text-xl"></i>
                 <p className="text-[10px] text-indigo-200 leading-tight">Switching to <span className="font-bold">Eco-Saver Mode</span> could save you up to $12.40 this month.</p>
              </div>
           </div>
        </div>
      </div>
      
      <div className="glass p-8 rounded-3xl">
         <h3 className="text-sm font-bold text-white mb-8 uppercase tracking-widest">Consumption Trend (Past 4 Months)</h3>
         <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={billingHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip 
                    cursor={{fill: '#1e293b55'}}
                    contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px'}}
                  />
                  <Bar dataKey="cost" radius={[8, 8, 0, 0]} barSize={40}>
                     {billingHistory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 2 ? '#ef4444' : '#10b981'} />
                     ))}
                  </Bar>
               </BarChart>
            </ResponsiveContainer>
         </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-bolt-lightning text-emerald-400"></i>
            EcoPulse <span className="text-slate-500 font-light">| IoT Node</span>
          </h2>
          <nav className="mt-4 flex gap-6">
             <button 
                onClick={() => setActiveTab('monitor')}
                className={`text-[11px] font-bold uppercase tracking-widest transition-all pb-1 border-b-2 ${activeTab === 'monitor' ? 'text-white border-emerald-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
             >
                Monitor
             </button>
             <button 
                onClick={() => setActiveTab('billing')}
                className={`text-[11px] font-bold uppercase tracking-widest transition-all pb-1 border-b-2 ${activeTab === 'billing' ? 'text-white border-emerald-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
             >
                Billing
             </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-4 py-1.5 bg-slate-800/50 border rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${hardwareStatus === 'connected' ? 'border-emerald-500/50 text-emerald-400' : 'border-slate-700 text-slate-500'}`}>
            <span className={`w-2 h-2 rounded-full ${hardwareStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
            {hardwareStatus === 'connected' ? 'Hardware Linked' : 'Virtual Mode'}
          </div>
          <button onClick={onLogout} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-slate-700 hover:border-slate-500 shadow-lg">
            <i className="fas fa-power-off"></i>
          </button>
        </div>
      </header>

      {activeTab === 'monitor' ? renderMonitorView() : renderBillingView()}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="glass w-full max-w-sm p-8 rounded-3xl border border-slate-700 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Add Node</h3>
              <i className="fas fa-network-wired text-emerald-500"></i>
            </div>
            <form onSubmit={addAppliance} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Identifier</label>
                <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Living Room LED" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Load Profile</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value as Appliance['type'])} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none cursor-pointer">
                  <option value="lightbulb">LED Bulb</option>
                  <option value="fan">Cooling Fan</option>
                  <option value="heater">Thermal Unit</option>
                  <option value="other">Generic Port</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-xs font-bold border border-slate-700">CANCEL</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20">CONNECT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
      `}</style>

      <footer className="fixed bottom-0 left-0 w-full glass border-t border-slate-800 py-3 text-center">
         <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em]">EcoPulse v2.8.0 • Real-time Monitoring Active</p>
      </footer>
    </div>
  );
};

export default Dashboard;
