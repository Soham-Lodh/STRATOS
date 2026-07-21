import React, { useState, useEffect } from 'react';
import {
  Shield, Radio, Activity, RefreshCw, Layers, Compass, HelpCircle,
  Terminal, Briefcase, Flame, Network, FileText, Printer, Check, Play, Pause,
  RotateCcw, Sliders, AlertTriangle, AlertCircle, Sparkles, Send, Download, UserCheck, ChevronRight, Zap, MapPin,
  Sun, Moon
} from 'lucide-react';

// Static assets & Helpers
import {
  CHOKEPOINTS,
  TANKERS,
  PORTS,
  PIPELINES,
  CONFLICT_ZONES,
  BASELINE_MARKET,
  getUpdatedKnowledgeGraph
} from './data/mockData';

// Sub-components
import PriceTicker from './components/PriceTicker';
import LiveMap from './components/LiveMap';
import TimelineSlider from './components/TimelineSlider';
import CrisisReplay from './components/CrisisReplay';
import ExecutiveCopilot from './components/ExecutiveCopilot';
import AgentDashboard from './components/AgentDashboard';
import LiveIntelligenceFeed from './components/LiveIntelligenceFeed';
import KnowledgeGraphView from './components/KnowledgeGraphView';
import EnterpriseOperations from './components/EnterpriseOperations';

import { AgentDebateMessage, Recommendation, GraphNode, GraphEdge, Tanker, Port, Chokepoint } from './types';

export default function App() {
  // Global States
  const [activeCrisis, setActiveCrisis] = useState<string>('normal');
  const [timelineValue, setTimelineValue] = useState<number>(0);
  const [activeNode, setActiveNode] = useState<string>('');
  const [userNote, setUserNote] = useState<string>('');

  // Dark mode states
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Tab state
  const [currentTab, setCurrentTab] = useState<'command_center' | 'executive' | 'crisis_lab' | 'digital_twin' | 'briefing'>('command_center');

  // Simulation & Reasoning states loaded from Express Backend
  const [overallRisk, setOverallRisk] = useState<number>(12);
  const [confidence, setConfidence] = useState<number>(95);
  const [debate, setDebate] = useState<AgentDebateMessage[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isDeliberating, setIsDeliberating] = useState<boolean>(false);
  const [briefingText, setBriefingText] = useState<string>('Initializing satellite telemetry feeds...');

  // Knowledge Graph State
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });

  // Strategic Lever values in Executive View
  const [navyEscorts, setNavyEscorts] = useState<boolean>(false);
  const [sprDrawdown, setSprDrawdown] = useState<number>(0); // 0 to 2.0M bpd
  const [westAfricanSwaps, setWestAfricanSwaps] = useState<number>(10); // percentage swap

  // Printable Briefing states
  const [briefingType, setBriefingType] = useState<'ceo' | 'operations' | 'analyst'>('ceo');
  const [exportProgress, setExportProgress] = useState<number | null>(null);

  // Update dynamic graph nodes immediately when crisis shifts
  useEffect(() => {
    const updated = getUpdatedKnowledgeGraph(activeCrisis);
    setGraphData(updated);
  }, [activeCrisis]);

  // Main cascade loader: Fetch reasoning matrix from Express Backend on state modifications
  const fetchDeliberation = async () => {
    setIsDeliberating(true);
    try {
      const response = await fetch('/api/agents/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crisis: activeCrisis,
          timeline: timelineValue,
          userNote: userNote
        })
      });
      const data = await response.json();

      setOverallRisk(data.overallRisk);
      setConfidence(data.confidence);
      setDebate(data.debate || []);
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error("Cascade reasoning fetch failed:", err);
    } finally {
      setIsDeliberating(false);
    }
  };

  useEffect(() => {
    fetchDeliberation();
  }, [activeCrisis, timelineValue]);

  // Fetch briefing text from Express backend
  useEffect(() => {
    const fetchBriefing = async () => {
      try {
        const response = await fetch('/api/briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crisis: activeCrisis })
        });
        const data = await response.json();
        setBriefingText(data.briefing);
      } catch (err) {
        console.error("Failed to load briefing", err);
        setBriefingText("STABLE - System connected to local datasets. No anomalous disruptions reported.");
      }
    };
    fetchBriefing();
  }, [activeCrisis]);

  // Direct trigger from the UI button (manual deliberation)
  const handleManualDeliberate = () => {
    fetchDeliberation();
  };

  // Callback to set custom crisis scenarios submitted by the user
  const handleCustomCrisisSubmit = (title: string, risk: number, note: string) => {
    setActiveCrisis('custom_simulation');
    setUserNote(note);
    setOverallRisk(risk);
    
    // Auto populate custom debate message sequence
    const customDebate: AgentDebateMessage[] = [
      {
        agent: "News Agent",
        content: `Alert: Launched custom scenario simulation for: "${title}". Initial security directives logged: ${note || "none"}.`,
        sentiment: "neutral",
        confidence: 90
      },
      {
        agent: "Risk Agent",
        content: `Evaluating localized corridor threats for ${title}. Assigning baseline disruption probability score to: ${risk}%.`,
        sentiment: "negative",
        confidence: 85
      },
      {
        agent: "Optimization Agent",
        content: `Active mitigation: Adjusting refinery pre-buffer capacities. Formulating alternative supply agreements for Bonny and UAE.`,
        sentiment: "positive",
        confidence: 88
      }
    ];
    setDebate(customDebate);
  };

  // Coordinate visual ticks for oil price adjustments on high crises
  const getDynamicMarketStats = () => {
    const base = { ...BASELINE_MARKET };
    let finalRiskMultiplier = activeCrisis !== 'normal' ? 1.05 : 1.0;
    
    // Adjust based on Strategic Levers
    if (navyEscorts) finalRiskMultiplier -= 0.08;
    if (sprDrawdown > 0) finalRiskMultiplier -= 0.04;

    if (activeCrisis === 'hormuz') {
      base.brent = Math.round((86.20 * finalRiskMultiplier) * 100) / 100;
      base.wti = Math.round((81.80 * finalRiskMultiplier) * 100) / 100;
      base.diesel = Math.round((2.65 * finalRiskMultiplier) * 100) / 100;
      base.changeBrent = 0.058 - (navyEscorts ? 0.02 : 0);
    } else if (activeCrisis === 'redsea') {
      base.brent = Math.round((81.50 * finalRiskMultiplier) * 100) / 100;
      base.wti = Math.round((77.10 * finalRiskMultiplier) * 100) / 100;
      base.diesel = Math.round((2.52 * finalRiskMultiplier) * 100) / 100;
      base.changeBrent = 0.034 - (navyEscorts ? 0.015 : 0);
    } else if (activeCrisis === 'russia') {
      base.brent = Math.round((79.10 * finalRiskMultiplier) * 100) / 100;
      base.wti = Math.round((75.30 * finalRiskMultiplier) * 100) / 100;
      base.changeBrent = -0.012;
    } else if (activeCrisis === 'covid') {
      base.brent = 22.40;
      base.wti = -12.00;
      base.diesel = 1.10;
      base.changeBrent = -0.34;
    } else if (activeCrisis === 'suez') {
      base.brent = 82.90;
      base.wti = 78.40;
      base.diesel = 2.58;
      base.changeBrent = 0.042;
    }
    return base;
  };

  const marketStats = getDynamicMarketStats();

  const handleTriggerExport = () => {
    if (exportProgress !== null) return;
    setExportProgress(10);
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev === null) return null;
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setExportProgress(null), 1000);
          window.print();
          return 100;
        }
        return prev + 15;
      });
    }, 150);
  };

  // Helpers for selected elements on maps
  const getSelectedTelemetry = () => {
    if (!activeNode) return null;
    const lowerNode = activeNode.toLowerCase();
    
    // Find matching tanker, port or chokepoint
    const matchedTanker = TANKERS.find(t => lowerNode.includes(t.name.toLowerCase()) || t.id === activeNode);
    if (matchedTanker) {
      return { type: 'vessel', name: matchedTanker.name, cargo: matchedTanker.cargo, speed: `${matchedTanker.speed} knots`, capacity: `${matchedTanker.capacity.toLocaleString()} bbls`, status: matchedTanker.status, source: matchedTanker.source, destination: matchedTanker.destination, eta: `${matchedTanker.etaDays} days`, risk: `${matchedTanker.vulnerabilityIndex}%` };
    }

    const matchedPort = PORTS.find(p => lowerNode.includes(p.name.toLowerCase()) || p.id === activeNode);
    if (matchedPort) {
      return { type: 'port', name: matchedPort.name, country: matchedPort.country, capacity: matchedPort.capacity, congestion: `${matchedPort.congestionScore}%`, status: matchedPort.status, details: matchedPort.details };
    }

    const matchedChoke = CHOKEPOINTS.find(c => lowerNode.includes(c.name.toLowerCase()) || c.id === activeNode);
    if (matchedChoke) {
      return { type: 'corridor', name: matchedChoke.name, flow: matchedChoke.normalFlow, description: matchedChoke.description, risk: `${matchedChoke.currentRisk}%`, status: matchedChoke.status };
    }

    return { type: 'asset', name: activeNode, status: 'nominal', details: 'Continuous AIS verification synced. Operating normally under central ledger parameters.' };
  };

  const selectedTelemetry = getSelectedTelemetry();

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100 flex flex-col font-sans selection:bg-brand-accent/30 selection:text-white">
      
      {/* 1. Industrial Header Area */}
      <header className="bg-brand-surface border-b border-brand-border px-6 py-3 flex flex-wrap items-center justify-between gap-4 select-none print:hidden" id="main_header_stratos">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="relative bg-brand-bg border border-brand-border px-3 py-1 rounded font-extrabold text-brand-accent tracking-widest text-sm flex items-center gap-2 font-mono">
              <Shield className="w-4 h-4 text-brand-accent" /> STRATOS.OS
            </div>
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase text-slate-200 tracking-wider">Geopolitical Energy Resilience Command Center</h1>
            <p className="text-[10px] text-brand-muted font-bold uppercase tracking-widest font-mono">Decision Intelligence & Sovereign Digital Twin Platform</p>
          </div>
        </div>

        {/* Global Security Posture Display */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded bg-brand-bg border border-brand-border">
            <Radio className="w-4 h-4 text-brand-success" />
            <span className="text-[9px] text-slate-300 uppercase font-bold">GRID FEED: ONLINE</span>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded bg-brand-bg border border-brand-border">
            <Activity className="w-4 h-4 text-brand-accent" />
            <span className="text-[9px] text-slate-300 uppercase font-bold">LEDGERS SYNCED: 30/30</span>
          </div>

          {/* Overall System Risk level badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-brand-bg/80 border border-brand-border">
            <span className="text-[8.5px] text-brand-muted">EXPOSURE:</span>
            <span className={`font-bold px-1.5 rounded text-[10px] ${
              overallRisk > 50 ? 'text-brand-danger bg-brand-danger/10 border border-brand-danger/20' : 'text-brand-accent bg-brand-accent/10 border border-brand-accent/20'
            }`}>
              {overallRisk}%
            </span>
          </div>

          {/* Light/Dark Toggle Button */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center justify-center p-2 rounded bg-brand-bg border border-brand-border hover:bg-brand-accent/10 hover:text-brand-accent hover:border-brand-accent/30 transition-all duration-200 text-brand-muted cursor-pointer"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            id="theme_toggle_btn"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-brand-alert" /> : <Moon className="w-3.5 h-3.5 text-brand-accent" />}
          </button>
        </div>
      </header>

      {/* 2. Commodity Price Ticker Feed */}
      <div className="print:hidden">
        <PriceTicker stats={marketStats} crisisMode={activeCrisis} />
      </div>

      {/* 3. Persistent Command Navigation Tab Bar */}
      <nav className="bg-brand-surface/60 border-b border-brand-border/80 px-6 py-2 flex flex-wrap items-center justify-between gap-4 font-mono text-xs select-none print:hidden">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCurrentTab('command_center')}
            className={`px-3.5 py-1.5 rounded transition-all cursor-pointer flex items-center gap-2 text-[11px] font-bold ${
              currentTab === 'command_center' 
                ? 'bg-brand-accent/15 text-brand-accent border border-brand-border' 
                : 'text-brand-muted hover:text-slate-200 border border-transparent'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> Command Center
          </button>
          
          <button
            onClick={() => setCurrentTab('executive')}
            className={`px-3.5 py-1.5 rounded transition-all cursor-pointer flex items-center gap-2 text-[11px] font-bold ${
              currentTab === 'executive' 
                ? 'bg-brand-accent/15 text-brand-accent border border-brand-border' 
                : 'text-brand-muted hover:text-slate-200 border border-transparent'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" /> Executive View
          </button>

          <button
            onClick={() => setCurrentTab('crisis_lab')}
            className={`px-3.5 py-1.5 rounded transition-all cursor-pointer flex items-center gap-2 text-[11px] font-bold ${
              currentTab === 'crisis_lab' 
                ? 'bg-brand-accent/15 text-brand-accent border border-brand-border' 
                : 'text-brand-muted hover:text-slate-200 border border-transparent'
            }`}
          >
            <Flame className="w-3.5 h-3.5" /> Crisis Lab
          </button>

          <button
            onClick={() => setCurrentTab('digital_twin')}
            className={`px-3.5 py-1.5 rounded transition-all cursor-pointer flex items-center gap-2 text-[11px] font-bold ${
              currentTab === 'digital_twin' 
                ? 'bg-brand-accent/15 text-brand-accent border border-brand-border' 
                : 'text-brand-muted hover:text-slate-200 border border-transparent'
            }`}
          >
            <Network className="w-3.5 h-3.5" /> Digital Twin
          </button>

          <button
            onClick={() => setCurrentTab('briefing')}
            className={`px-3.5 py-1.5 rounded transition-all cursor-pointer flex items-center gap-2 text-[11px] font-bold ${
              currentTab === 'briefing' 
                ? 'bg-brand-accent/15 text-brand-accent border border-brand-border' 
                : 'text-brand-muted hover:text-slate-200 border border-transparent'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Briefing Center
          </button>
        </div>

        {/* Sync information */}
        <div className="hidden lg:flex items-center gap-2 text-[9px] text-brand-muted">
          <span className="w-2 h-2 rounded-full bg-brand-success" />
          <span>SATELLITE SYNC ACTIVE: {(overallRisk * 1.2).toFixed(1)} GHz</span>
        </div>
      </nav>

      {/* 4. Active Tab Content Section */}
      <main className="flex-1 p-6 overflow-y-auto print:p-0 print:bg-white" id="stratos_viewport_wrapper">
        
        {/* ==================== TAB 1: COMMAND CENTER ==================== */}
        {currentTab === 'command_center' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-auto" id="tab_command_center">
            
            {/* Left Sidebar: Situation Brief Widget (3 Cols) */}
            <div className="xl:col-span-3 flex flex-col gap-6" id="cc_left_sidebar">
              
              {/* Situation Brief Widget Card */}
              <div className="bg-brand-surface border border-brand-border rounded-lg p-4 font-mono space-y-3.5 flex flex-col">
                <div className="flex items-center justify-between border-b border-brand-border/50 pb-2">
                  <span className="text-xs font-bold text-brand-accent uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-brand-accent animate-pulse" /> Situation Briefing
                  </span>
                  <span className="text-[8px] bg-brand-danger/10 text-brand-danger border border-brand-danger/25 px-1 rounded uppercase font-bold">
                    {activeCrisis === 'normal' ? 'nominal' : 'threat alert'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="bg-brand-bg/50 p-2.5 rounded border border-brand-border/60 text-[10.5px]">
                    <div className="flex items-center gap-1.5 text-slate-300 font-bold mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-brand-accent" /> Active Crisis Context:
                    </div>
                    <span className="text-white font-extrabold capitalize text-xs bg-brand-bg border border-brand-border px-2 py-0.5 rounded inline-block mt-0.5">
                      {activeCrisis.replace('_', ' ')}
                    </span>
                    <p className="text-brand-muted text-[9.5px] leading-relaxed font-sans mt-2 whitespace-pre-line text-slate-300">
                      {briefingText}
                    </p>
                  </div>

                  {/* High exposure Corridors status */}
                  <div className="space-y-2">
                    <span className="text-[9px] text-brand-muted uppercase font-bold block">Key Logistics Corridors:</span>
                    
                    {[
                      { name: 'Strait of Hormuz', risk: activeCrisis === 'hormuz' ? 84 : 15, status: activeCrisis === 'hormuz' ? 'text-brand-danger' : 'text-brand-success' },
                      { name: 'Bab-el-Mandeb', risk: activeCrisis === 'redsea' ? 78 : 18, status: activeCrisis === 'redsea' ? 'text-brand-danger' : 'text-brand-success' },
                      { name: 'Suez Canal Corridor', risk: activeCrisis === 'suez' ? 90 : 10, status: activeCrisis === 'suez' ? 'text-brand-danger' : 'text-brand-success' },
                      { name: 'Strait of Malacca', risk: 12, status: 'text-brand-success' }
                    ].map((corridor, i) => (
                      <div key={i} className="text-[9.5px] bg-brand-bg/30 p-1.5 rounded border border-brand-border/40">
                        <div className="flex justify-between items-center mb-1 font-bold">
                          <span className="text-slate-300">{corridor.name}</span>
                          <span className={corridor.status}>{corridor.risk}% Risk</span>
                        </div>
                        <div className="w-full bg-brand-bg h-1 rounded-full overflow-hidden">
                          <div className={`h-full ${corridor.risk > 50 ? 'bg-brand-danger' : 'bg-brand-accent'}`} style={{ width: `${corridor.risk}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Refiners Crude Feed Constrained Gauges */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[9px] text-brand-muted uppercase font-bold block">Downstream Refinery Loads:</span>
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[9px]">
                      <div className="p-1.5 bg-brand-bg/40 rounded border border-brand-border">
                        <span className="font-bold text-slate-300 block">Jamnagar</span>
                        <span className={`font-mono text-[9.5px] font-bold ${activeCrisis === 'hormuz' ? 'text-brand-alert' : 'text-brand-success'}`}>
                          {activeCrisis === 'hormuz' ? '55% Load' : '98% Load'}
                        </span>
                      </div>
                      <div className="p-1.5 bg-brand-bg/40 rounded border border-brand-border">
                        <span className="font-bold text-slate-300 block">Mundra</span>
                        <span className={`font-mono text-[9.5px] font-bold ${activeCrisis === 'hormuz' ? 'text-brand-alert' : 'text-brand-success'}`}>
                          {activeCrisis === 'hormuz' ? '62% Load' : '96% Load'}
                        </span>
                      </div>
                      <div className="p-1.5 bg-brand-bg/40 rounded border border-brand-border">
                        <span className="font-bold text-slate-300 block">Kochi</span>
                        <span className={`font-mono text-[9.5px] font-bold ${activeCrisis === 'redsea' ? 'text-brand-alert' : 'text-brand-success'}`}>
                          {activeCrisis === 'redsea' ? '68% Load' : '94% Load'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center-Left: Real-time Sovereign Intelligence Wire & Event Bus */}
              <div className="shrink-0">
                <LiveIntelligenceFeed
                  activeCrisis={activeCrisis}
                  onSelectNode={setActiveNode}
                />
              </div>

              {/* Bottom-Left: AI Brain Activity Monitor */}
              <div className="shrink-0">
                <AgentDashboard
                  debate={debate}
                  overallRisk={overallRisk}
                  confidence={confidence}
                  onRunDeliberation={handleManualDeliberate}
                  isLoading={isDeliberating}
                />
              </div>
            </div>

            {/* Center Column: Live World Map Dominant (6 Cols) */}
            <div className="xl:col-span-6 flex flex-col gap-6" id="cc_center_map">
              
              {/* Overall Risk Banner & Dynamic Stats */}
              <div className="bg-brand-surface border border-brand-border rounded-lg p-3 flex flex-wrap items-center justify-between gap-4 font-mono text-[10.5px]">
                <div className="flex items-center gap-3">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span>
                  </span>
                  <span className="text-slate-300 uppercase font-bold">LIVE TELEMETRY FEED ACTIVE</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-brand-muted">CRISIS_LEVEL:</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[9.5px] border ${
                      overallRisk > 50 ? 'bg-brand-danger/10 text-brand-danger border-brand-danger/30' : 'bg-brand-success/10 text-brand-success border-brand-success/30'
                    }`}>
                      {overallRisk > 50 ? 'CRITICAL DISRUPTION' : 'STABLE PATH'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 border-l border-brand-border/60 pl-3">
                    <span className="text-brand-muted">DECISION_CONFIDENCE:</span>
                    <span className="text-white font-bold">{confidence}%</span>
                  </div>
                </div>
              </div>

              {/* Live map viewport */}
              <div className="flex-1 min-h-[420px] bg-brand-surface border border-brand-border rounded-lg relative overflow-hidden flex flex-col">
                <LiveMap
                  chokepoints={CHOKEPOINTS}
                  tankers={TANKERS}
                  ports={PORTS}
                  pipelines={PIPELINES}
                  conflictZones={CONFLICT_ZONES}
                  crisisMode={activeCrisis}
                  onSelectNode={setActiveNode}
                  timelineValue={timelineValue}
                  onTimelineChange={setTimelineValue}
                  isDark={darkMode}
                />
              </div>

              {/* Scrubber timeline */}
              <div className="shrink-0">
                <TimelineSlider
                  value={timelineValue}
                  onChange={setTimelineValue}
                />
              </div>

              {/* Bottom: Executive Recommendation/Action Card */}
              <div className="bg-brand-surface border border-brand-border rounded-lg p-4 font-mono space-y-3 flex flex-col">
                <div className="flex items-center justify-between border-b border-brand-border/40 pb-2">
                  <span className="text-xs font-bold text-brand-accent uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-brand-accent" /> Recommended Strategic Directives
                  </span>
                  <span className="text-[9px] text-brand-muted">AUTO-GENERATED BY OPTIMIZATION ENGINE</span>
                </div>

                {recommendations.length === 0 ? (
                  <div className="py-4 text-center text-brand-muted text-[10.5px] font-sans">
                    Nominal baseline active. No corrective logistics interventions required.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {recommendations.map((rec, i) => (
                      <div key={i} className="bg-brand-bg/50 border border-brand-border/80 p-3 rounded-lg flex flex-col justify-between space-y-2">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-brand-accent text-[8.5px] font-bold border border-brand-accent/25 px-1.5 rounded uppercase font-mono">
                              DIRECTIVE_{i+1}
                            </span>
                            <span className="text-[9px] text-brand-success font-bold font-sans">Feasibility: {rec.feasibility}</span>
                          </div>
                          <h5 className="text-[10.5px] font-bold text-slate-100">{rec.action}</h5>
                          <p className="text-[9.5px] text-brand-muted leading-tight font-sans mt-1">{rec.impact}</p>
                        </div>
                        <div className="border-t border-brand-border/40 pt-1.5 flex justify-between items-center text-[8.5px] text-brand-muted">
                          <span>Confidence Score: {confidence - i * 3}%</span>
                          <span className="text-brand-accent flex items-center gap-0.5 cursor-pointer hover:text-white" onClick={() => setCurrentTab('executive')}>
                            Configure Gate <ChevronRight className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Intelligent Chat Feed (3 Cols) */}
            <div className="xl:col-span-3 flex flex-col h-auto" id="cc_right_sidebar">
              <div className="flex-1 min-h-0">
                <ExecutiveCopilot crisisMode={activeCrisis} activeNode={activeNode} />
              </div>
            </div>

          </div>
        )}

        {/* ==================== TAB 2: EXECUTIVE VIEW ==================== */}
        {currentTab === 'executive' && (
          <div className="space-y-6" id="tab_executive_view">
            
            {/* Top row: High contrast Macro Risk dials */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 font-sans">
              {[
                { title: "Geopolitical Risk score", val: `${overallRisk}%`, desc: "Disruption probability index", color: overallRisk > 50 ? 'text-brand-danger bg-brand-danger/5' : 'text-brand-success bg-brand-success/5' },
                { title: "Landed Brent Price", val: `$${marketStats.brent.toFixed(2)}/bbl`, desc: `Risk Surcharge: $${marketStats.spread.toFixed(2)}`, color: 'text-white bg-brand-surface' },
                { title: "Sovereign Surcharge", val: activeCrisis === 'normal' ? "$0.0M" : `$${(overallRisk * 12.8).toFixed(1)}M`, desc: "Incremental import premium / day", color: 'text-brand-alert bg-brand-alert/5' },
                { title: "Reserves Coverage", val: `${74 - sprDrawdown} Days`, desc: "Refinery crude backup supply", color: 'text-brand-accent bg-brand-accent/5' }
              ].map((kpi, i) => (
                <div key={i} className={`p-5 border border-brand-border rounded-lg flex flex-col justify-between h-32 ${kpi.color}`}>
                  <span className="text-[10.5px] text-brand-muted uppercase font-bold tracking-wider block">{kpi.title}</span>
                  <div className="text-3xl font-extrabold tracking-tight py-1">{kpi.val}</div>
                  <span className="text-[11px] text-brand-muted font-sans block">{kpi.desc}</span>
                </div>
              ))}
            </div>

            {/* Main Interactive Levers & Enterprise Operations Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Actionable Decision Levers Panel */}
              <div className="lg:col-span-4 bg-brand-surface border border-brand-border rounded-lg p-6 font-sans flex flex-col justify-between space-y-5">
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-brand-border/50 pb-3">
                    <span className="text-xs font-bold text-brand-accent uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-brand-accent" /> Strategic Mitigation Levers
                    </span>
                    <span className="text-[9.5px] text-brand-muted font-mono">UPDATED LIVE</span>
                  </div>

                  <p className="text-xs text-brand-muted leading-relaxed font-sans">
                    Toggle or slide sovereign response levers to deploy active defenses and test immediate impact over global market pricing.
                  </p>

                  {/* Lever 1: Indian Navy Escorts */}
                  <div className="bg-brand-bg/40 border border-brand-border p-4 rounded-lg space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">1. Deploy Naval Escorts</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[9.5px] border ${navyEscorts ? 'bg-brand-success/15 text-brand-success border-brand-success/30' : 'bg-brand-bg text-brand-muted border-brand-border'}`}>
                        {navyEscorts ? 'ACTIVE (SECURED)' : 'STANDBY'}
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-muted leading-relaxed">
                      Pre-position regional Navy combat escort vessels along exposed corridors to suppress asymmetric drone boards.
                    </p>
                    <button
                      onClick={() => setNavyEscorts(!navyEscorts)}
                      className={`w-full py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        navyEscorts 
                          ? 'bg-brand-success/10 text-brand-success border-brand-success/40' 
                          : 'bg-brand-accent/10 text-brand-accent border-brand-accent/40 hover:bg-brand-accent/20'
                      }`}
                    >
                      {navyEscorts ? 'Recall Combat Escorts' : 'Deploy Combat Escorts (-8% Risk Brent)'}
                    </button>
                  </div>

                  {/* Lever 2: SPR Release Slider */}
                  <div className="bg-brand-bg/40 border border-brand-border p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">2. Drawdown Strategic Reserves</span>
                      <span className="text-brand-accent font-bold font-mono text-xs">{sprDrawdown}M bpd</span>
                    </div>
                    <p className="text-[11px] text-brand-muted leading-relaxed">
                      Draw crude from underground reserve caverns at Mangalore, Padur, and Visakhapatnam to feed coastal refinery load deficits.
                    </p>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={sprDrawdown}
                      onChange={(e) => setSprDrawdown(parseInt(e.target.value))}
                      className="w-full accent-brand-accent cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-brand-muted font-mono">
                      <span>0.0M bpd (BASELINE)</span>
                      <span>1.5M bpd (MAX SAFE)</span>
                    </div>
                  </div>

                  {/* Lever 3: Sweet Crude Nigerian Swaps */}
                  <div className="bg-brand-bg/40 border border-brand-border p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">3. Sweet Crude Sourcing Swap</span>
                      <span className="text-brand-accent font-bold font-mono text-xs">{westAfricanSwaps}% Sweet</span>
                    </div>
                    <p className="text-[11px] text-brand-muted leading-relaxed">
                      Swap Middle Eastern sour grades with West African (Nigerian Bonny Light) sweet blends to bypass Persian Gulf transit completely.
                    </p>
                    <input
                      type="range"
                      min="10"
                      max="80"
                      step="5"
                      value={westAfricanSwaps}
                      onChange={(e) => setWestAfricanSwaps(parseInt(e.target.value))}
                      className="w-full accent-brand-accent cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-brand-muted font-mono">
                      <span>10% SWAP (NOMINAL)</span>
                      <span>80% SWAP (HIGH ARBITRAGE)</span>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-accent/5 border border-brand-accent/20 p-3 rounded-lg text-xs leading-relaxed text-brand-muted">
                  <span className="font-bold text-brand-accent block mb-1 uppercase text-[10px]">Directives Synthesis Feedback:</span>
                  Combined mitigations provide approximately <strong className="font-mono text-slate-100">${(sprDrawdown * 0.4 + (navyEscorts ? 1.5 : 0)).toFixed(2)}</strong> direct landed price recovery offsets on the baseline Brent crude indices.
                </div>
              </div>

              {/* Right Column: Complete EnterpriseOperations Board (8 Cols) */}
              <div className="lg:col-span-8">
                <EnterpriseOperations
                  crisisMode={activeCrisis}
                  overallRisk={overallRisk}
                  confidence={confidence}
                  recommendations={recommendations}
                />
              </div>

            </div>
          </div>
        )}

        {/* ==================== TAB 3: CRISIS LAB ==================== */}
        {currentTab === 'crisis_lab' && (
          <div className="space-y-6" id="tab_crisis_lab">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Preset Scenarios Selector from CrisisReplay (4 Cols) */}
              <div className="lg:col-span-4">
                <CrisisReplay
                  activeCrisis={activeCrisis}
                  onSelectCrisis={setActiveCrisis}
                  timelineValue={timelineValue}
                  setTimelineValue={setTimelineValue}
                  onCustomCrisisSubmit={handleCustomCrisisSubmit}
                />
              </div>

              {/* Right Column: Interactive Alternate Timeline Sandbox (8 Cols) */}
              <div className="lg:col-span-8 bg-brand-surface border border-brand-border rounded-lg p-5 font-mono space-y-4">
                <div className="flex items-center justify-between border-b border-brand-border/50 pb-2">
                  <span className="text-xs font-bold text-brand-accent uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-brand-accent" /> Alternate Future Timeline Sandbox (A/B Contrast)
                  </span>
                  <span className="text-[9px] bg-brand-bg px-2 py-0.5 border border-brand-border text-brand-muted">
                    ACTIVE DAYS RANGE: -15d to +90d
                  </span>
                </div>

                <p className="text-[10px] text-brand-muted font-sans leading-relaxed">
                  Compare the geopolitical exposure timelines of the baseline unmitigated crisis scenario against our active strategic interventions side-by-side.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Timeline A: Standard Unmitigated Future */}
                  <div className="bg-brand-bg/50 border border-brand-border p-4 rounded-lg space-y-3.5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-brand-danger" />
                    <div className="flex justify-between items-center text-[10px] border-b border-brand-border/30 pb-1.5">
                      <span className="text-slate-300 font-bold uppercase">TIMELINE A: UNMITIGATED CRITICAL PATH</span>
                      <span className="text-brand-danger font-bold">HIGH VOLATILITY</span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-brand-muted">Brent Peak Premium:</span>
                        <span className="text-white font-bold">
                          {activeCrisis === 'hormuz' ? '+$12.80/bbl' : (activeCrisis === 'redsea' ? '+$8.10/bbl' : '+$4.50/bbl')}
                        </span>
                      </div>

                      <div className="flex justify-between text-[10px]">
                        <span className="text-brand-muted">Refiner Delivery Delay:</span>
                        <span className="text-brand-alert font-bold">
                          {activeCrisis === 'hormuz' ? '+14 Days Cape route' : (activeCrisis === 'redsea' ? '+12 Days Cape route' : 'None')}
                        </span>
                      </div>

                      <div className="flex justify-between text-[10px]">
                        <span className="text-brand-muted">Geopolitical Exposure Score:</span>
                        <span className="text-brand-danger font-bold">{overallRisk}%</span>
                      </div>

                      <div className="pt-2">
                        <span className="text-[8.5px] text-brand-muted block mb-1">PROJECTED PRICE SHOCK PROFILE:</span>
                        <div className="h-10 bg-brand-bg border border-brand-border rounded relative flex items-center justify-center">
                          {/* Price Sparkline SVG representation */}
                          <svg className="w-full h-8" viewBox="0 0 100 20">
                            <path d="M 5,16 Q 25,18 45,5 T 85,2" fill="none" stroke="#DC143C" strokeWidth="2" />
                            <circle cx="85" cy="2" r="2.5" fill="#DC143C" />
                          </svg>
                          <span className="absolute top-1 right-1 text-[7.5px] text-brand-danger font-bold uppercase">SPIKE FORECAST</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline B: Mitigated Alternate Future */}
                  <div className="bg-brand-bg/50 border border-brand-border p-4 rounded-lg space-y-3.5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-brand-success" />
                    <div className="flex justify-between items-center text-[10px] border-b border-brand-border/30 pb-1.5">
                      <span className="text-slate-300 font-bold uppercase">TIMELINE B: STRATOS MITIGATED PATH</span>
                      <span className="text-brand-success font-bold">SECURED ROUTING</span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-brand-muted">Mitigated Brent Premium:</span>
                        <span className="text-brand-success font-bold">
                          +${Math.max(0, (activeCrisis === 'hormuz' ? 12.8 : (activeCrisis === 'redsea' ? 8.1 : 4.5)) - (navyEscorts ? 3.5 : 0) - (sprDrawdown * 0.4)).toFixed(2)}/bbl
                        </span>
                      </div>

                      <div className="flex justify-between text-[10px]">
                        <span className="text-brand-muted">Optimized Delivery Lag:</span>
                        <span className="text-brand-accent font-bold">
                          {activeCrisis === 'hormuz' ? '+4 Days (Swapped)' : (activeCrisis === 'redsea' ? '+3 Days (Swapped)' : '0 Days')}
                        </span>
                      </div>

                      <div className="flex justify-between text-[10px]">
                        <span className="text-brand-muted">Residual Exposure Score:</span>
                        <span className="text-brand-success font-bold">
                          {Math.max(10, overallRisk - (navyEscorts ? 25 : 0) - (sprDrawdown * 3))}%
                        </span>
                      </div>

                      <div className="pt-2">
                        <span className="text-[8.5px] text-brand-muted block mb-1">MITIGATED STABILIZATION WAVEFORM:</span>
                        <div className="h-10 bg-brand-bg border border-brand-border rounded relative flex items-center justify-center">
                          {/* Mitigated Sparkline representation */}
                          <svg className="w-full h-8" viewBox="0 0 100 20">
                            <path d="M 5,16 Q 25,12 45,15 T 85,14" fill="none" stroke="#00FF00" strokeWidth="2" />
                            <circle cx="85" cy="14" r="2.5" fill="#00FF00" />
                          </svg>
                          <span className="absolute top-1 right-1 text-[7.5px] text-brand-success font-bold uppercase">SECURED LEVEL</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="bg-brand-surface p-3.5 rounded-lg border border-brand-border text-[9.5px] leading-normal font-sans text-brand-muted space-y-1.5">
                  <span className="font-mono text-[10px] font-bold text-brand-accent block uppercase">SOVEREIGN TIMELINE ASSESSMENT SUMMARY:</span>
                  <p>
                    {activeCrisis === 'normal' 
                      ? 'No active anomaly triggers. Timeline metrics A and B reside at a standard, shared baseline. Energy import surcharges are at $0.0M.' 
                      : `Under ${activeCrisis.toUpperCase()} trigger events, unmitigated paths indicate a sovereign energy shock rating of EXTREME RISK. Enforcing recommended STRATOS procurement swaps and navy escorts lowers the risk quotient by ${(navyEscorts ? 25 : 0) + (sprDrawdown * 3)}%, securing downstream refiners at nominal load capacity.`
                    }
                  </p>
                </div>

                {/* Timeline Scrubber duplicated for easy inline scrubbing */}
                <div className="pt-2.5">
                  <TimelineSlider
                    value={timelineValue}
                    onChange={setTimelineValue}
                  />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================== TAB 4: DIGITAL TWIN ==================== */}
        {currentTab === 'digital_twin' && (
          <div className="space-y-6" id="tab_digital_twin">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Interactive Dependency Knowledge Graph (8 Cols) */}
              <div className="lg:col-span-8">
                <KnowledgeGraphView
                  nodes={graphData.nodes}
                  edges={graphData.edges}
                  onSelectNode={setActiveNode}
                  crisisMode={activeCrisis}
                />
              </div>

              {/* Right Column: Asset Telemetry Profile & Blockage simulation (4 Cols) */}
              <div className="lg:col-span-4 bg-brand-surface border border-brand-border rounded-lg p-5 font-mono flex flex-col justify-between space-y-4">
                
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-brand-border/50 pb-2">
                    <span className="text-xs font-bold text-brand-accent uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-brand-accent" /> Asset Telemetry Inspector
                    </span>
                    <span className="text-[9px] text-brand-muted font-sans font-bold">DIGITAL TWIN PROFILE</span>
                  </div>

                  {selectedTelemetry ? (
                    <div className="space-y-3">
                      <div className="bg-brand-bg/50 border border-brand-border p-3.5 rounded-lg space-y-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-brand-accent animate-pulse" />
                          <span className="text-white font-extrabold text-sm tracking-wide">{selectedTelemetry.name.toUpperCase()}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                          <div>
                            <span className="text-brand-muted block uppercase">Asset Class:</span>
                            <span className="font-bold text-slate-200 capitalize">{selectedTelemetry.type}</span>
                          </div>
                          <div>
                            <span className="text-brand-muted block uppercase">Operational Status:</span>
                            <span className="font-bold text-brand-success capitalize">{selectedTelemetry.status || 'Nominal'}</span>
                          </div>
                          
                          {selectedTelemetry.cargo && (
                            <div>
                              <span className="text-brand-muted block uppercase">Cargo Load:</span>
                              <span className="font-bold text-slate-200">{selectedTelemetry.cargo}</span>
                            </div>
                          )}

                          {selectedTelemetry.speed && (
                            <div>
                              <span className="text-brand-muted block uppercase">Steaming Velocity:</span>
                              <span className="font-bold text-slate-200">{selectedTelemetry.speed}</span>
                            </div>
                          )}

                          {selectedTelemetry.capacity && (
                            <div>
                              <span className="text-brand-muted block uppercase">Max Capacity:</span>
                              <span className="font-bold text-slate-200">{selectedTelemetry.capacity}</span>
                            </div>
                          )}

                          {selectedTelemetry.congestion && (
                            <div>
                              <span className="text-brand-muted block uppercase">Port Congestion:</span>
                              <span className="font-bold text-brand-alert">{selectedTelemetry.congestion}</span>
                            </div>
                          )}

                          {selectedTelemetry.flow && (
                            <div>
                              <span className="text-brand-muted block uppercase">Nominal flow:</span>
                              <span className="font-bold text-slate-200">{selectedTelemetry.flow}</span>
                            </div>
                          )}

                          {selectedTelemetry.risk && (
                            <div>
                              <span className="text-brand-muted block uppercase">Disruption Risk:</span>
                              <span className="font-bold text-brand-danger">{selectedTelemetry.risk}</span>
                            </div>
                          )}
                        </div>

                        {selectedTelemetry.source && (
                          <div className="border-t border-brand-border/40 pt-2 flex justify-between text-[9px] text-brand-muted font-sans">
                            <span>FROM: <strong className="font-mono text-slate-300">{selectedTelemetry.source}</strong></span>
                            <span>TO: <strong className="font-mono text-slate-300">{selectedTelemetry.destination}</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="bg-brand-bg/20 p-3 rounded border border-brand-border text-[9.5px] leading-normal font-sans text-brand-muted">
                        <strong className="font-mono text-slate-200 text-[10px] block mb-0.5">Cascade dependency rule:</strong>
                        Disruptions targeting this asset trigger a multi-stage routing recalculation across the knowledge graph, altering Brent spreads by about 1.5%.
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-brand-muted text-[10.5px] font-sans border border-brand-border/40 border-dashed rounded-lg">
                      <MapPin className="w-6 h-6 text-brand-muted mx-auto mb-2 animate-bounce" />
                      Click on any vessel, country, port, or chokepoint on the map/dependency graph above to inspect real-time digital twin telemetry.
                    </div>
                  )}
                </div>

                {/* Vessel fleet listing router log */}
                <div className="space-y-2 pt-2 border-t border-brand-border/50">
                  <span className="text-[9.5px] text-brand-muted uppercase font-bold block">Active Supertanker Fleet Logs:</span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-[9px]">
                    {[
                      { name: 'VLCC INDIRA', route: 'M.East ➔ Jamnagar', speed: '14.5kts', status: 'steaming' },
                      { name: 'VLCC TAGORE', route: 'W.Africa ➔ Kochi', speed: '13.2kts', status: 'diverting' },
                      { name: 'VLCC CHOLA', route: 'Russia ➔ Mundra', speed: '15.0kts', status: 'steaming' },
                      { name: 'LNG NEHRU', route: 'Qatar ➔ Dahej', speed: '18.1kts', status: 'anchored' }
                    ].map((vessel, i) => (
                      <div key={i} className="p-1.5 bg-brand-bg/50 rounded border border-brand-border/60 flex items-center justify-between">
                        <div>
                          <strong className="text-white text-[9.5px]">{vessel.name}</strong>
                          <span className="text-brand-muted block text-[8px] font-sans">{vessel.route}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-300 font-mono block">{vessel.speed}</span>
                          <span className={`text-[8px] font-bold uppercase ${vessel.status === 'diverting' ? 'text-brand-alert' : 'text-brand-success'}`}>
                            {vessel.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* ==================== TAB 5: BRIEFING CENTER ==================== */}
        {currentTab === 'briefing' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="tab_briefing_center">
            
            {/* Left Column: Tailored Stakeholder Selection Filters (4 Cols) */}
            <div className="lg:col-span-4 bg-brand-surface border border-brand-border rounded-lg p-5 font-mono flex flex-col justify-between space-y-4 print:hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-brand-border/50 pb-2">
                  <span className="text-xs font-bold text-brand-accent uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-brand-accent" /> Document Briefings Hub
                  </span>
                  <span className="text-[9px] text-brand-muted">VERIFIED BY STRATOS CO-ENGINE</span>
                </div>

                <p className="text-[10px] text-brand-muted font-sans leading-relaxed">
                  Select a targeted corporate briefing document template to render high-fidelity, printable advisory files formatted for specific stakeholders:
                </p>

                <div className="space-y-2 pt-2">
                  {[
                    { id: 'ceo', title: 'CEO STRATEGIC MEMORANDUM', desc: 'Macro geopolitical exposure indices, price shock risks, currency clearing.' },
                    { id: 'operations', title: 'OPERATIONS DISPATCH BULLETIN', desc: 'Refinery raw cargo feed capacity, ship speed configurations, storage backups.' },
                    { id: 'analyst', title: 'ANALYST METHODOLOGY FILE', desc: 'Sovereign risk factor formulas, GDELT incident triggers, confidence scores.' }
                  ].map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => setBriefingType(doc.id as any)}
                      className={`w-full p-3 rounded border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        briefingType === doc.id
                          ? 'bg-brand-accent/15 border-brand-accent ring-1 ring-brand-accent/20'
                          : 'bg-brand-bg/50 border-brand-border hover:border-brand-border/80'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={briefingType === doc.id}
                        onChange={() => {}}
                        className="mt-1 accent-brand-accent pointer-events-none"
                      />
                      <div>
                        <span className="text-[10.5px] font-bold text-slate-200 block">{doc.title}</span>
                        <span className="text-[8.5px] text-brand-muted leading-tight font-sans block mt-1">{doc.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* PDF Compiler Simulation widget */}
              <div className="border-t border-brand-border/60 pt-4">
                <button
                  onClick={handleTriggerExport}
                  disabled={exportProgress !== null}
                  className="w-full bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent border border-brand-accent/40 font-bold text-xs px-4 py-2.5 rounded flex items-center justify-center gap-2 cursor-pointer"
                >
                  {exportProgress !== null ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-brand-accent" />
                      Compiling: {exportProgress}%
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4 text-brand-accent" />
                      Compile & Print PDF Report
                    </>
                  )}
                </button>
                <span className="text-[8.5px] text-brand-muted font-sans text-center block mt-2">
                  PRINT DIALOG AUTOMATICALLY LAUNCHES UPON COMPILE SUCCESS
                </span>
              </div>
            </div>

            {/* Right Column: High Fidelity Printable Advisories Board (8 Cols) */}
            <div className="lg:col-span-8 bg-white text-slate-900 border border-slate-300 shadow-2xl p-8 rounded-lg font-serif print:border-none print:shadow-none print:p-0 flex flex-col justify-between" id="printable_paper_sheet">
              
              <div className="space-y-6">
                
                {/* Document Header block */}
                <div className="border-b-4 border-slate-900 pb-3 flex justify-between items-end font-sans">
                  <div>
                    <span className="text-[10px] font-extrabold tracking-widest text-slate-500 block">STRATOS EXECUTIVE ADVISORY BOARD</span>
                    <h2 className="text-xl font-black text-slate-950 tracking-tight leading-none mt-1">SOVEREIGN ADVISORY LOGISTICS DISPATCH</h2>
                    <span className="text-[9px] text-slate-500 block mt-0.5">DOCUMENT NO: STRATOS-EAD-2026-07 • LEVEL: SECURED</span>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold text-slate-950 block uppercase font-mono">CLASSIFIED</span>
                    <span className="text-[9px] text-slate-500 block font-mono">EXPORT CONTROLLED</span>
                  </div>
                </div>

                {/* Sub-header metadata */}
                <div className="grid grid-cols-3 gap-4 border-b border-slate-300 pb-3 font-sans text-[10.5px] text-slate-800">
                  <div>
                    <strong className="text-slate-900 block">DISPATCH TO:</strong>
                    <span>
                      {briefingType === 'ceo' && 'CHIEF EXECUTIVE OFFICER • INDIA RESILIENCE GROUP'}
                      {briefingType === 'operations' && 'COO • NATIONAL PROCUREMENT & OPERATIONS'}
                      {briefingType === 'analyst' && 'LEAD ENERGY ECONOMIST • RESILIENCE TEAM'}
                    </span>
                  </div>
                  <div>
                    <strong className="text-slate-900 block">SATELLITE SYNC:</strong>
                    <span>{(overallRisk * 1.2).toFixed(2)} GHz • OK</span>
                  </div>
                  <div>
                    <strong className="text-slate-900 block">TIMESTAMP:</strong>
                    <span>{new Date().toLocaleDateString()} • UTC 10:00 AM</span>
                  </div>
                </div>

                {/* Core report prose depending on stakeholder */}
                {briefingType === 'ceo' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-950">SUBJECT: Strategic Geopolitical Risk Exposure & Surcharge Hedges</h3>
                    
                    <p className="text-xs leading-relaxed text-slate-800">
                      We have compiled the geopolitical risk profile targeting our primary Middle Eastern raw cargo corridors under current threat postures. Overall system exposure score currently resides at <strong>{overallRisk}%</strong>. Baseline market Brent pricing is verified at <strong>${marketStats.brent.toFixed(2)}/bbl</strong>, carrying an implied localized geopolitical risk premium of <strong>${marketStats.spread.toFixed(2)}/bbl</strong>.
                    </p>

                    <h4 className="text-sm font-extrabold text-slate-950 font-sans border-b border-slate-200 pb-1">EXECUTIVE RECOMMENDATIONS SUMMARY</h4>
                    <ul className="list-disc pl-5 text-xs space-y-2 text-slate-800">
                      <li>
                        <strong>Clearing Posture Swaps:</strong> Establish localized non-dollar clearing accounts immediately inside Abu Dhabi and Nigerian financial corridors to mitigate cascading regulatory sanction risks.
                      </li>
                      <li>
                        <strong>Vessel Rerouting:</strong> Implement a mandatory Bab-el-Mandeb cape detour strategy for tankers currently steaming inside high-exposure zones. This rerouting adds approximately 12 days to standard ETAs, costing around $2.80/bbl, but reduces total vulnerability score by 75%.
                      </li>
                      <li>
                        <strong>Sovereign Spot Hedges:</strong> Acquire up to 10% spot market futures during price troughs to cover emergency coastal refiner reserves.
                      </li>
                    </ul>

                    <div className="bg-slate-50 p-3 rounded.lg border border-slate-200 text-[10px] text-slate-600 italic">
                      Disclaimer: This advice is computed through the STRATOS sovereign energy model based on leading GDELT events indices and AIS vessel telemetry coordinates.
                    </div>
                  </div>
                )}

                {briefingType === 'operations' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-950">SUBJECT: Downstream Refinery Intake Load & Shipping Pipeline Adjustments</h3>
                    
                    <p className="text-xs leading-relaxed text-slate-800">
                      Downstream refinery intakes are entering sensitive buffer thresholds under prolonged corridor congestions. Standard raw cargo backup coverage is evaluated at <strong>{74 - sprDrawdown} days</strong>. Alternate routes via the Cape of Good Hope alter standard vessel speeds, extending ETA queues.
                    </p>

                    <h4 className="text-sm font-extrabold text-slate-950 font-sans border-b border-slate-200 pb-1">TACTICAL OPERATION INTERVENTIONS</h4>
                    <ul className="list-decimal pl-5 text-xs space-y-2 text-slate-800">
                      <li>
                        <strong>Strategic Petroleum Reserves Drawdown:</strong> Release up to <strong>{sprDrawdown}M bpd</strong> of crude reserves immediately from subterranean Padur vaults to offset shortfalls.
                      </li>
                      <li>
                        <strong>Refinery Input Adjustments:</strong> Instruct Reliance Jamnagar and Nayara Mundra complex managers to adjust refinery load grades from Middle-East sweet to Nigerian Bonny Light light-sweet swaps.
                      </li>
                      <li>
                        <strong>Vessel Speed Optimization:</strong> Enforce standard 15-knot velocities for chartered VLCCs to preserve diesel fuels over extended detour timelines.
                      </li>
                    </ul>
                  </div>
                )}

                {briefingType === 'analyst' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-950">SUBJECT: Multi-Agent Model Parameter Formulas & GDELT Weightings</h3>
                    
                    <p className="text-xs leading-relaxed text-slate-800">
                      This advisory detail logs the algorithmic metrics utilized to formulate sovereign energy resilience risk scores.
                    </p>

                    <div className="bg-slate-50 p-4 rounded border border-slate-200 font-mono text-[9px] text-slate-700 space-y-2">
                      <div className="font-bold border-b border-slate-300 pb-1 text-slate-900">FORMULA_EXPOSURE_INDEX (FEI):</div>
                      <div>FEI = (CorridorRisk * 0.45) + (RefinerDepletion * 0.35) + (FreightSurcharge * 0.20)</div>
                      <div className="font-bold border-b border-slate-300 pb-1 pt-1 text-slate-900">ACTIVE CONSTANTS MATRIX:</div>
                      <div>• CorridorRisk factor: Bab-el-Mandeb ({activeCrisis === 'redsea' ? 78 : 18}%), Hormuz ({activeCrisis === 'hormuz' ? 84 : 15}%)</div>
                      <div>• System Confidence Weightings: {confidence}% (GDELT event density &gt; 85%)</div>
                    </div>

                    <p className="text-xs leading-relaxed text-slate-800">
                      The six-agent coordinator resolves debate contradictions with confidence parameters weighted against historic parallels, including the 1984 Tanker War and the 2021 Ever Given blockage events.
                    </p>
                  </div>
                )}

                {/* Verification signatures */}
                <div className="border-t border-slate-300 pt-4 grid grid-cols-3 gap-4 font-sans text-[10px] text-slate-800">
                  <div className="flex flex-col justify-end">
                    <span className="text-slate-500">AUTHORIZATION CODE:</span>
                    <span className="font-mono font-bold text-slate-900">0xSTR-{(overallRisk * 153).toString(16).toUpperCase()}</span>
                  </div>
                  <div className="flex flex-col justify-end items-center text-center">
                    <div className="flex items-center gap-1 bg-green-50 border border-green-200 px-2 py-0.5 rounded text-green-700 text-[9px] font-bold">
                      <Check className="w-3.5 h-3.5" /> SECURE BLOCK VERIFIED
                    </div>
                    <span className="text-[8.5px] text-slate-500 mt-1 font-mono">HASH: {(overallRisk * 92173).toString(16).toUpperCase()}...</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">COORDINATOR VERIFICATION:</span>
                    <strong className="text-slate-900 block font-mono text-[10.5px]">STRATOS.OS CORE API</strong>
                    <span className="text-[9px] text-slate-500 block italic">Approved Digital Signature</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* 5. Bottom Information/Footer Status panel */}
      <footer className="bg-brand-surface border-t border-brand-border px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-brand-muted text-[10.5px] select-none print:hidden" id="main_footer_status font-mono">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-brand-accent animate-pulse" />
          <span>STRATOS reduces national energy shock response times from weeks to seconds.</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono">SATELLITE SYNC: OK</span>
          <span>•</span>
          <span className="font-mono">INTELLIGENCE SYSTEM CONFIDENCE LEVEL: {confidence}%</span>
        </div>
      </footer>

    </div>
  );
}
