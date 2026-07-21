import React, { useState, useEffect, useRef } from 'react';
import { 
  Anchor, ShieldAlert, Navigation, Settings2, Wind, Eye, EyeOff, Radio, 
  Plus, Minus, RotateCcw, Maximize2, Settings, Play, Pause, Activity, 
  Layers, Map, Database, Thermometer, Sliders, Globe, AlertTriangle
} from 'lucide-react';
import { Chokepoint, Tanker, Port, Pipeline, ConflictZone } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LiveMapProps {
  chokepoints: Chokepoint[];
  tankers: Tanker[];
  ports: Port[];
  pipelines: Pipeline[];
  conflictZones: ConflictZone[];
  crisisMode: string;
  onSelectNode: (nodeName: string) => void;
  timelineValue?: number;
  onTimelineChange?: (val: number) => void;
  isDark?: boolean;
}

// Calculate geographical bearing between two lat/lng coordinates
function calculateBearing(pt1: [number, number], pt2: [number, number]): number {
  const lat1 = pt1[0] * Math.PI / 180;
  const lat2 = pt2[0] * Math.PI / 180;
  const dLon = (pt2[1] - pt1[1]) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

export default function LiveMap({
  chokepoints,
  tankers,
  ports,
  pipelines,
  conflictZones,
  crisisMode,
  onSelectNode,
  timelineValue = 0,
  onTimelineChange,
  isDark = false
}: LiveMapProps) {
  // Layer states
  const [showShips, setShowShips] = useState(true);
  const [showPipelines, setShowPipelines] = useState(true);
  const [showPorts, setShowPorts] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showGeopolitical, setShowGeopolitical] = useState(true);
  const [showSupplyChains, setShowSupplyChains] = useState(true);
  const [showRiskHeatmap, setShowRiskHeatmap] = useState(true);
  const [showSatellite, setShowSatellite] = useState(false);

  // Settings popup state
  const [showSettings, setShowSettings] = useState(false);
  const [aisFrequency, setAisFrequency] = useState('30s');
  const [labelDensity, setLabelDensity] = useState('normal');

  // Animation Play/Pause state
  const [isPlaying, setIsPlaying] = useState(false);

  // Inspection states
  const [selectedVessel, setSelectedVessel] = useState<Tanker | null>(null);
  const [selectedChoke, setSelectedChoke] = useState<Chokepoint | null>(null);
  const [selectedPort, setSelectedPort] = useState<Port | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Layout full screen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [routingFeedback, setRoutingFeedback] = useState<string | null>(null);

  // Independent Tactical Layer toggle states and handlers
  const isThreatActive = showRiskHeatmap || showGeopolitical;
  const toggleThreatLayers = () => {
    setShowRiskHeatmap(!isThreatActive);
    setShowGeopolitical(!isThreatActive);
  };

  const isTrafficActive = showShips || showSupplyChains;
  const toggleTrafficLayers = () => {
    setShowShips(!isTrafficActive);
    setShowSupplyChains(!isTrafficActive);
  };

  const isInfrastructureActive = showPorts || showPipelines;
  const toggleInfrastructureLayers = () => {
    setShowPorts(!isInfrastructureActive);
    setShowPipelines(!isInfrastructureActive);
  };

  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Group refs for dynamic clearing/updating
  const shipsGroupRef = useRef<L.LayerGroup | null>(null);
  const pipelinesGroupRef = useRef<L.LayerGroup | null>(null);
  const portsGroupRef = useRef<L.LayerGroup | null>(null);
  const weatherGroupRef = useRef<L.LayerGroup | null>(null);
  const geopoliticalGroupRef = useRef<L.LayerGroup | null>(null);
  const riskHeatmapGroupRef = useRef<L.LayerGroup | null>(null);
  const supplyChainGroupRef = useRef<L.LayerGroup | null>(null);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || !onTimelineChange) return;
    const interval = setInterval(() => {
      onTimelineChange(timelineValue >= 90 ? -30 : timelineValue + 2);
    }, 450);
    return () => clearInterval(interval);
  }, [isPlaying, timelineValue, onTimelineChange]);

  // Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create the Leaflet map with zoom controls disabled (we render customized buttons)
    const map = L.map(mapContainerRef.current, {
      center: [18, 48],
      zoom: 3,
      minZoom: 2,
      maxZoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    mapRef.current = map;

    // Initialize layer groups and add them to map
    shipsGroupRef.current = L.layerGroup().addTo(map);
    pipelinesGroupRef.current = L.layerGroup().addTo(map);
    portsGroupRef.current = L.layerGroup().addTo(map);
    weatherGroupRef.current = L.layerGroup().addTo(map);
    geopoliticalGroupRef.current = L.layerGroup().addTo(map);
    riskHeatmapGroupRef.current = L.layerGroup().addTo(map);
    supplyChainGroupRef.current = L.layerGroup().addTo(map);

    // Clean up on unmount
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update base maps dynamically
  useEffect(() => {
    if (!mapRef.current) return;

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const tileUrl = showSatellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    const layer = L.tileLayer(tileUrl, {
      maxZoom: 18,
      attribution: showSatellite 
        ? 'Tiles &copy; Esri' 
        : isDark 
          ? '&copy; CartoDB DarkMatter' 
          : '&copy; CartoDB Positron'
    }).addTo(mapRef.current);

    tileLayerRef.current = layer;
  }, [showSatellite, isDark]);

  // Helper to count ships scheduled/waiting for a port
  const getShipsWaitingForPort = (portId: string) => {
    return tankers.filter(
      t => t.destination.toLowerCase().includes(portId.toLowerCase()) && 
      (t.status === 'anchored' || t.status === 'congested')
    ).length;
  };

  // Re-build Map Layers dynamically on timeline, layers or crisis changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing overlay features
    if (shipsGroupRef.current) shipsGroupRef.current.clearLayers();
    if (pipelinesGroupRef.current) pipelinesGroupRef.current.clearLayers();
    if (portsGroupRef.current) portsGroupRef.current.clearLayers();
    if (weatherGroupRef.current) weatherGroupRef.current.clearLayers();
    if (geopoliticalGroupRef.current) geopoliticalGroupRef.current.clearLayers();
    if (riskHeatmapGroupRef.current) riskHeatmapGroupRef.current.clearLayers();
    if (supplyChainGroupRef.current) supplyChainGroupRef.current.clearLayers();

    // 1. PIPELINE LAYER
    if (showPipelines && pipelinesGroupRef.current) {
      pipelines.forEach(pipe => {
        const isOperational = pipe.status === 'operational';
        const color = isOperational ? '#00D9FF' : (pipe.status === 'reduced' ? '#FFD700' : '#DC143C');
        const dashClass = isOperational ? 'pulsing-pipeline-active' : 'pulsing-pipeline-reduced';

        const polyline = L.polyline(pipe.latlngs, {
          color,
          weight: pipe.status === 'disrupted' ? 1.5 : 3.5,
          opacity: 0.8,
          className: dashClass
        }).addTo(pipelinesGroupRef.current!);

        polyline.bindTooltip(`
          <div class="font-mono text-[10px] space-y-0.5">
            <div class="font-bold text-brand-accent">${pipe.name}</div>
            <div>Source: ${pipe.source}</div>
            <div>Destination: ${pipe.destination}</div>
            <div>Flow Capacity: ${pipe.flowVolume}</div>
            <div>Status: <span class="uppercase font-bold" style="color:${color}">${pipe.status}</span></div>
          </div>
        `, { className: 'custom-map-tooltip', direction: 'top' });

        polyline.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedPipeline(pipe);
          setSelectedVessel(null);
          setSelectedChoke(null);
          setSelectedPort(null);
          setSelectedCountry(null);
          onSelectNode(`${pipe.name} (Pipeline)`);
        });
      });
    }

    // 2. SUPPLY CHAINS TRADE LINES
    if (showSupplyChains && supplyChainGroupRef.current) {
      const drawnPaths = new Set<string>();
      tankers.forEach(tanker => {
        const key = `${tanker.source}-${tanker.destination}`;
        if (drawnPaths.has(key)) return;
        drawnPaths.add(key);

        if (tanker.routePoints && tanker.routePoints.length > 1) {
          const successRate = tanker.vulnerabilityIndex < 40 ? 'reliable' : 'risky';
          const color = successRate === 'reliable' ? '#00FF00' : '#DC143C';

          const trail = L.polyline(tanker.routePoints, {
            color,
            weight: 1.5,
            opacity: 0.22,
            className: 'supply-trail-pulse'
          }).addTo(supplyChainGroupRef.current!);

          trail.bindTooltip(`
            <div class="font-mono text-[10px] space-y-0.5">
              <div class="font-bold text-white uppercase">${tanker.source} ➔ ${tanker.destination}</div>
              <div>Estimated Daily Flow: ${(tanker.capacity * 1.5 / 1000000).toFixed(1)}M bbls/day equivalent</div>
              <div>Risk Profile: <span class="${successRate === 'reliable' ? 'text-brand-success' : 'text-brand-danger'} font-bold">${successRate.toUpperCase()}</span></div>
            </div>
          `, { className: 'custom-map-tooltip', direction: 'top' });
        }
      });
    }

    // 3. RISK HEATMAP
    if (showRiskHeatmap && riskHeatmapGroupRef.current) {
      const hotspots = [
        { coords: [26.56, 56.25] as [number, number], maxRisk: 85, radius: 500000 }, // Hormuz
        { coords: [12.58, 43.33] as [number, number], maxRisk: 80, radius: 450000 }, // Bab-el-Mandeb
        { coords: [30.60, 32.33] as [number, number], maxRisk: 60, radius: 400000 }, // Suez
        { coords: [56.50, 20.00] as [number, number], maxRisk: 50, radius: 480000 }  // Baltic
      ];

      hotspots.forEach(spot => {
        let intensity = spot.maxRisk;
        if (crisisMode === 'normal') intensity = Math.max(15, spot.maxRisk - 40);

        L.circle(spot.coords, {
          radius: spot.radius,
          color: '#DC143C',
          weight: 0,
          fillColor: '#DC143C',
          fillOpacity: (intensity / 100) * 0.14
        }).addTo(riskHeatmapGroupRef.current!);
      });
    }

    // 4. GEOPOLITICAL RISK ZONES
    if (showGeopolitical && geopoliticalGroupRef.current) {
      const regions = [
        { name: 'Bab-el-Mandeb Naval Corridor', coords: [13.0, 43.1] as [number, number], risk: 'High', color: '#ef4444', desc: 'Sovereign naval task forces deployed. High anti-ship missile threat vectors.', impact: 'Diverting 78% of dry cargo vessels around Southern Africa.' },
        { name: 'Persian Gulf Tactical Patrol Corridor', coords: [27.5, 52.0] as [number, number], risk: 'Elevated', color: '#d97706', desc: 'Vessel surveillance boarding maneuvers and electronic AIS spoofing detected.', impact: 'Premium war-risk surcharges elevated.' },
        { name: 'Baltic Sanctions Enforcement Sector', coords: [56.5, 20.0] as [number, number], risk: 'Medium', color: '#d97706', desc: 'Regulated border audits and shadow fleet tracking operational.', impact: 'Compliance and secondary certificate inspection mandatory.' },
        { name: 'Malacca Piracy Countermeasure Sector', coords: [2.5, 102.5] as [number, number], risk: 'Low Risk', color: '#10b981', desc: 'Joint regional anti-piracy maritime sweeps active. Corridor secure.', impact: 'Spot-freight transit normal.' }
      ];

      regions.forEach(region => {
        const circle = L.circle(region.coords, {
          radius: 350000,
          color: region.color,
          fillColor: region.color,
          fillOpacity: 0.05,
          weight: 1.5,
          dashArray: '3 3'
        }).addTo(geopoliticalGroupRef.current!);

        circle.bindTooltip(`
          <div class="font-mono text-[10px] space-y-1">
            <div class="font-bold border-b border-brand-border pb-1 mb-1" style="color: ${region.color}">${region.name}</div>
            <div>Security Level: <span class="font-bold" style="color: ${region.color}">${region.risk.toUpperCase()}</span></div>
            <div class="text-[#B0BEC5] leading-tight font-sans text-[9.5px]">${region.desc}</div>
            <div class="border-t border-brand-border/40 pt-1 mt-1 font-sans text-brand-accent">Strategic Impact: ${region.impact}</div>
          </div>
        `, { className: 'custom-map-tooltip', direction: 'top' });

        circle.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedCountry(region.name);
          setSelectedVessel(null);
          setSelectedChoke(null);
          setSelectedPort(null);
          setSelectedPipeline(null);
          onSelectNode(region.name);
        });
      });
    }

    // 5. WEATHER STORM ANOMALIES
    if (showWeather && weatherGroupRef.current) {
      const storms = [
        {
          id: 'storm_arabian',
          name: 'Super Cyclone KANISHK',
          startLat: 10.0, startLng: 55.0,
          endLat: 22.0, endLng: 63.0,
          windSpeed: '185 km/h',
          pressure: '945 hPa'
        },
        {
          id: 'storm_china_sea',
          name: 'Typhoon YUTU',
          startLat: 13.0, startLng: 115.0,
          endLat: 21.0, endLng: 108.0,
          windSpeed: '140 km/h',
          pressure: '965 hPa'
        }
      ];

      storms.forEach(storm => {
        // Linearly interpolate storm coordinates over slider range -30 to 90
        const t = (timelineValue + 30) / 120;
        const lat = storm.startLat + (storm.endLat - storm.startLat) * t;
        const lng = storm.startLng + (storm.endLng - storm.startLng) * t;

        // Cone of uncertainty (coneCoords)
        const coneCoords = [
          [storm.startLat, storm.startLng],
          [storm.endLat + 3, storm.endLng - 4],
          [storm.endLat + 5, storm.endLng + 6],
          [storm.startLat, storm.startLng]
        ] as [number, number][];

        L.polygon(coneCoords, {
          color: '#d97706',
          weight: 1,
          fillColor: '#d97706',
          fillOpacity: 0.05,
          dashArray: '3 3'
        }).addTo(weatherGroupRef.current!);

        // Predicted track
        L.polyline([[storm.startLat, storm.startLng], [storm.endLat, storm.endLng]], {
          color: '#d97706',
          weight: 1.2,
          dashArray: '5 5',
          opacity: 0.45
        }).addTo(weatherGroupRef.current!);

        // Cyclone Marker (spinning vortex SVG)
        const stormIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-12 h-12 bg-brand-alert/10 rounded-full border border-brand-alert/30 pulsing-halo"></div>
              <div class="hurricane-spin">
                <svg class="w-8 h-8 text-brand-alert filter drop-shadow-[0_0_8px_rgba(255,107,53,0.85)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                  <path d="M12,2 C6,4 4,10 6,14 C8,18 14,18 16,14" />
                  <path d="M12,22 C18,20 20,14 18,10 C16,6 10,6 8,10" />
                </svg>
              </div>
            </div>
          `,
          className: '',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        const stormMarker = L.marker([lat, lng], { icon: stormIcon }).addTo(weatherGroupRef.current!);

        stormMarker.bindTooltip(`
          <div class="font-mono text-[10px] space-y-1">
            <div class="font-bold text-brand-alert border-b border-brand-border pb-1 mb-1">${storm.name}</div>
            <div>Max Wind: <span class="text-white font-bold">${storm.windSpeed}</span></div>
            <div>Barometric: <span class="text-white">${storm.pressure}</span></div>
            <div>Eye Coordinates: [${lat.toFixed(2)}°, ${lng.toFixed(2)}°]</div>
            <div>Trajectory: NW Vector</div>
          </div>
        `, { className: 'custom-map-tooltip', direction: 'top' });

        stormMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectNode(`${storm.name} (Cyclone System)`);
        });
      });
    }

    // 6. PORT LOCATIONS
    if (showPorts && portsGroupRef.current) {
      ports.forEach(port => {
        const shipsWaiting = getShipsWaitingForPort(port.id);
        const congestionColorClass = port.congestionScore > 25 
          ? 'border-brand-danger bg-brand-danger/10 text-brand-danger' 
          : (port.congestionScore > 15 ? 'border-brand-alert bg-brand-alert/10 text-brand-alert' : 'border-brand-success bg-brand-success/10 text-brand-success');
        
        const portIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute rounded-full border border-dashed pulsing-halo ${
                port.congestionScore > 25 ? 'border-brand-danger' : (port.congestionScore > 15 ? 'border-brand-alert' : 'border-brand-success')
              }" style="width: ${22 + port.congestionScore * 0.25}px; height: ${22 + port.congestionScore * 0.25}px; opacity: 0.5;"></div>
              
              <div class="w-6 h-6 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center relative z-10 shadow-xl">
                <svg class="w-3.5 h-3.5 text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="5" r="3" />
                  <line x1="12" y1="5" x2="12" y2="22" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <path d="M5,12 A 7 7 0 0 0 19,12" />
                </svg>
              </div>
              
              ${shipsWaiting > 0 ? `
                <div class="absolute -top-1.5 -right-1.5 bg-brand-accent text-brand-bg text-[8px] font-extrabold px-1.5 h-4 min-w-4 flex items-center justify-center rounded-full border border-brand-bg z-20 shadow font-mono">
                  ${shipsWaiting}
                </div>
              ` : ''}
            </div>
          `,
          className: '',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const marker = L.marker([port.lat, port.lng], { icon: portIcon }).addTo(portsGroupRef.current!);

        marker.bindTooltip(`
          <div class="font-mono text-[10px] space-y-1">
            <div class="font-bold text-brand-success text-xs border-b border-brand-border pb-1 mb-1">${port.name} (${port.country})</div>
            <div>Throughput: <span class="text-white">${port.capacity}</span></div>
            <div>Queue Length: <span class="text-brand-accent font-bold">${shipsWaiting} VLCCs waiting</span></div>
            <div>Congestion: <span class="font-bold" style="color:${port.congestionScore > 25 ? '#DC143C' : '#00FF00'}">${port.congestionScore}%</span></div>
            <div>Status: <span class="uppercase font-bold">${port.status}</span></div>
          </div>
        `, { className: 'custom-map-tooltip', direction: 'top' });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedPort(port);
          setSelectedVessel(null);
          setSelectedChoke(null);
          setSelectedPipeline(null);
          setSelectedCountry(null);
          onSelectNode(port.name);
        });
      });
    }

    // 7. STRATEGIC CHOKEPOINTS
    chokepoints.forEach(choke => {
      const isCritical = choke.currentRisk > 12 || crisisMode === choke.id;
      const color = isCritical ? '#ef4444' : (choke.currentRisk > 10 ? '#d97706' : '#10b981');

      const chokeIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center">
            ${isCritical ? `<div class="absolute w-8 h-8 rounded-full border border-brand-danger pulsing-halo"></div>` : ''}
            <div class="w-4.5 h-4.5 rotate-45 border-2 flex items-center justify-center relative z-10 shadow-2xl" style="background-color: ${color}; border-color: #090d16;">
            </div>
          </div>
        `,
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker([choke.lat, choke.lng], { icon: chokeIcon }).addTo(mapRef.current!);

      marker.bindTooltip(`
        <div class="font-mono text-[10px] space-y-1">
          <div class="font-bold text-xs border-b border-brand-border pb-1 mb-1" style="color: ${color}">${choke.name}</div>
          <div>Normal Throughput: <span class="text-white">${choke.normalFlow}</span></div>
          <div>Strategic Risk Index: <span class="font-bold" style="color:${color}">${choke.currentRisk}%</span></div>
          <div>Postures: <span class="uppercase font-bold" style="color:${color}">${choke.status}</span></div>
        </div>
      `, { className: 'custom-map-tooltip', direction: 'top' });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedChoke(choke);
        setSelectedVessel(null);
        setSelectedPort(null);
        setSelectedPipeline(null);
        setSelectedCountry(null);
        onSelectNode(choke.name);
      });
    });

    // 8. TANKER VESSEL SHIPPING LANE PLOTS
    if (showShips && shipsGroupRef.current) {
      tankers.forEach(tanker => {
        const isSelected = selectedVessel?.id === tanker.id;
        const routePoints = tanker.routePoints || [];
        let lat = tanker.lat;
        let lng = tanker.lng;
        let bearing = 120; // fallback bearing

        if (routePoints.length > 1) {
          // Stable vessel distribution offset based on tanker index code
          const baseProgress = 0.05 + ((Number(tanker.id.split('_')[1] || 1) * 13) % 91) / 100;
          
          // Interpolate forward progression linked with chronological slider timeline
          const timelineOffset = ((timelineValue - (-30)) / 120) * 0.4;
          const progress = (baseProgress + timelineOffset) % 1.0;

          const totalPoints = routePoints.length;
          const currentPtIdx = Math.floor(progress * (totalPoints - 1));
          const nextPtIdx = Math.min(totalPoints - 1, currentPtIdx + 1);
          const factor = (progress * (totalPoints - 1)) - currentPtIdx;

          const pt1 = routePoints[currentPtIdx];
          const pt2 = routePoints[nextPtIdx];

          lat = pt1[0] + (pt2[0] - pt1[0]) * factor;
          lng = pt1[1] + (pt2[1] - pt1[1]) * factor;

          bearing = calculateBearing(pt1, pt2);
        }

        let color = '#3b82f6'; // nominal streaming
        if (tanker.status === 'anchored') color = '#d97706'; // minor delay
        if (tanker.status === 'congested') color = '#d97706'; // major congestion
        if (tanker.status === 'diverting') color = '#d97706'; // rerouting
        if (tanker.vulnerabilityIndex > 50) color = '#ef4444'; // at extreme risk

        const shipIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center">
              ${isSelected ? `<div class="absolute w-8 h-8 rounded-full bg-brand-accent/20 border border-brand-accent/40 pulsing-halo"></div>` : ''}
              ${tanker.vulnerabilityIndex > 52 ? `<div class="absolute w-6 h-6 rounded-full bg-brand-danger/20 border border-brand-danger/40 pulsing-halo"></div>` : ''}
              
              <div style="transform: rotate(${bearing}deg); transition: transform 0.4s ease-out;" class="relative">
                <svg class="w-5.5 h-5.5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="7.5" fill="#090d16" />
                  <polygon points="12,2 4,18 12,14 20,18" fill="${color}" stroke="#090d16" stroke-width="1.5" />
                </svg>
              </div>
            </div>
          `,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([lat, lng], { icon: shipIcon }).addTo(shipsGroupRef.current!);

        const tooltipContent = `
          <div class="font-mono text-[10px] space-y-1">
            <div class="font-bold text-brand-accent text-xs border-b border-brand-border pb-1 mb-1">${tanker.name}</div>
            <div><span class="text-[#B0BEC5]">Cargo:</span> <span class="text-white font-bold">${tanker.cargo}</span></div>
            <div><span class="text-[#B0BEC5]">Load Volume:</span> <span class="text-white font-bold">${(tanker.capacity / 1000000).toFixed(1)}M bbls</span></div>
            <div><span class="text-[#B0BEC5]">Path:</span> <span class="text-white text-[9.5px]">${tanker.source} ➔ ${tanker.destination}</span></div>
            <div><span class="text-[#B0BEC5]">Current Speed:</span> <span class="text-white font-bold">${tanker.speed.toFixed(1)} Knots</span></div>
            <div><span class="text-[#B0BEC5]">Vuln Index:</span> <span class="text-brand-danger font-bold">${tanker.vulnerabilityIndex}%</span></div>
            <div><span class="text-[#B0BEC5]">ETA Window:</span> <span class="text-[#FFD700]">${tanker.etaDays} Days</span></div>
            <div><span class="text-[#B0BEC5]">AIS Posture:</span> <span class="px-1.5 py-0.2 rounded text-[8px] bg-white/10 font-bold uppercase" style="color: ${color}">${tanker.status}</span></div>
          </div>
        `;

        marker.bindTooltip(tooltipContent, { className: 'custom-map-tooltip', direction: 'top' });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedVessel(tanker);
          setSelectedChoke(null);
          setSelectedPort(null);
          setSelectedPipeline(null);
          setSelectedCountry(null);
          onSelectNode(`${tanker.name} (${tanker.cargo})`);
        });
      });
    }

  }, [
    showShips, showPipelines, showPorts, showWeather, showGeopolitical, 
    showSupplyChains, showRiskHeatmap, timelineValue, crisisMode, selectedVessel, tankers
  ]);

  // Clean popover clickout
  const handleMapBackgroundClick = () => {
    setSelectedVessel(null);
    setSelectedChoke(null);
    setSelectedPort(null);
    setSelectedPipeline(null);
    setSelectedCountry(null);
  };

  // Map Controls functions
  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.setView([18, 48], 3);
    }
  };

  const handleReroute = (vessel: Tanker) => {
    setRoutingFeedback(`Detour route plotted. Strategic alternative course via Cape of Good Hope activated for ${vessel.name}.`);
    vessel.status = 'diverting';
    vessel.etaDays += 12; // Latency penalties
    
    // Simulate updating path points around Africa
    const routeAroundAfrica: [number, number][] = [
      [60.33, 28.61], [50.0, -5.0], [20.0, -20.0], [-34.3, 18.5], [-25.0, 45.0], [10.0, 65.0], [22.75, 69.7]
    ];
    vessel.routePoints = routeAroundAfrica;
    
    setTimeout(() => {
      setRoutingFeedback(null);
    }, 4500);
  };

  const handleRefreshData = () => {
    setIsPlaying(false);
    if (onTimelineChange) onTimelineChange(0);
    handleMapBackgroundClick();
  };

  return (
    <div 
      className={`relative w-full bg-brand-bg transition-all duration-300 select-none overflow-hidden flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 p-4 bg-brand-bg h-screen' : 'h-[520px] rounded-lg border border-brand-border'
      }`} 
      onClick={handleMapBackgroundClick} 
      id="live_map_panel"
    >
      
      {/* 1.5. INDEPENDENT TACTICAL LAYER CONTROLLER (Top-Center overlay) */}
      <div 
        className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-brand-surface/90 backdrop-blur-md border border-brand-border rounded-lg p-1 shadow-2xl max-w-[95%] shrink-0"
        onClick={(e) => e.stopPropagation()}
        id="tactical_layer_control"
      >
        <button
          onClick={toggleThreatLayers}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono font-bold transition-all border cursor-pointer select-none ${
            isThreatActive 
              ? 'bg-brand-danger/10 border-brand-danger/40 text-brand-danger' 
              : 'bg-brand-bg/60 border-brand-border/40 text-brand-muted hover:text-slate-200 hover:border-brand-border'
          }`}
          title="Toggle Geopolitical Risk Zones & Threat Heatmaps"
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isThreatActive ? 'bg-brand-danger' : 'bg-brand-muted/40'}`}></span>
          </span>
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline whitespace-nowrap">Threat Heatmaps</span>
          <span className="md:hidden whitespace-nowrap">Threats</span>
        </button>

        <button
          onClick={toggleTrafficLayers}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono font-bold transition-all border cursor-pointer select-none ${
            isTrafficActive 
              ? 'bg-brand-accent/10 border-brand-accent/40 text-brand-accent' 
              : 'bg-brand-bg/60 border-brand-border/40 text-brand-muted hover:text-slate-200 hover:border-brand-border'
          }`}
          title="Toggle Active Fleet Tracking & Logistical Sea Routes"
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isTrafficActive ? 'bg-brand-accent' : 'bg-brand-muted/40'}`}></span>
          </span>
          <Navigation className="w-3.5 h-3.5 rotate-45 shrink-0" />
          <span className="hidden md:inline whitespace-nowrap">Live Tanker Traffic</span>
          <span className="md:hidden whitespace-nowrap">Traffic</span>
        </button>

        <button
          onClick={toggleInfrastructureLayers}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono font-bold transition-all border cursor-pointer select-none ${
            isInfrastructureActive 
              ? 'bg-brand-success/10 border-brand-success/40 text-brand-success' 
              : 'bg-brand-bg/60 border-brand-border/40 text-brand-muted hover:text-slate-200 hover:border-brand-border'
          }`}
          title="Toggle Coastal Refiners, Ports, & Pipeline Grids"
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isInfrastructureActive ? 'bg-brand-success' : 'bg-brand-muted/40'}`}></span>
          </span>
          <Database className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline whitespace-nowrap">Refinery & Pipelines</span>
          <span className="md:hidden whitespace-nowrap">Infra</span>
        </button>
      </div>

      {/* 1. LAYER PANEL (Top-Left overlay) */}
      <div className="absolute top-4 left-4 z-40 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="bg-brand-surface/90 backdrop-blur-md border border-brand-border rounded-lg p-3 shadow-2xl flex flex-col gap-2 w-52">
          <div className="flex items-center justify-between border-b border-brand-border/60 pb-1.5 mb-1">
            <span className="font-mono text-[10.5px] font-bold text-brand-accent uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Map Layers
            </span>
          </div>

          <div className="space-y-1.5 text-[10.5px] font-mono">
            {/* Toggles */}
            <label className="flex items-center justify-between cursor-pointer hover:text-slate-200 text-slate-300">
              <span>Vessels Fleet</span>
              <input 
                type="checkbox" 
                checked={showShips} 
                onChange={(e) => setShowShips(e.target.checked)}
                className="rounded border-brand-border text-brand-accent focus:ring-0 bg-brand-bg w-3 h-3 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-slate-200 text-slate-300">
              <span>Pipeline Grid</span>
              <input 
                type="checkbox" 
                checked={showPipelines} 
                onChange={(e) => setShowPipelines(e.target.checked)}
                className="rounded border-brand-border text-brand-accent focus:ring-0 bg-brand-bg w-3 h-3 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-slate-200 text-slate-300">
              <span>Terminals</span>
              <input 
                type="checkbox" 
                checked={showPorts} 
                onChange={(e) => setShowPorts(e.target.checked)}
                className="rounded border-brand-border text-brand-accent focus:ring-0 bg-brand-bg w-3 h-3 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-slate-200 text-slate-300">
              <span>Weather Storms</span>
              <input 
                type="checkbox" 
                checked={showWeather} 
                onChange={(e) => setShowWeather(e.target.checked)}
                className="rounded border-brand-border text-brand-accent focus:ring-0 bg-brand-bg w-3 h-3 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-slate-200 text-slate-300">
              <span>Naval Corridors</span>
              <input 
                type="checkbox" 
                checked={showGeopolitical} 
                onChange={(e) => setShowGeopolitical(e.target.checked)}
                className="rounded border-brand-border text-brand-accent focus:ring-0 bg-brand-bg w-3 h-3 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-slate-200 text-slate-300">
              <span>Logistical Trails</span>
              <input 
                type="checkbox" 
                checked={showSupplyChains} 
                onChange={(e) => setShowSupplyChains(e.target.checked)}
                className="rounded border-brand-border text-brand-accent focus:ring-0 bg-brand-bg w-3 h-3 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-slate-200 text-slate-300">
              <span>Risk Heatmap</span>
              <input 
                type="checkbox" 
                checked={showRiskHeatmap} 
                onChange={(e) => setShowRiskHeatmap(e.target.checked)}
                className="rounded border-brand-border text-brand-accent focus:ring-0 bg-brand-bg w-3 h-3 cursor-pointer"
              />
            </label>

            <div className="border-t border-brand-border/60 pt-1.5 mt-1.5">
              <label className="flex items-center justify-between cursor-pointer text-brand-accent font-bold hover:text-brand-accent/80">
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Satellite Mode</span>
                <input 
                  type="checkbox" 
                  checked={showSatellite} 
                  onChange={(e) => setShowSatellite(e.target.checked)}
                  className="rounded border-brand-border text-brand-accent focus:ring-0 bg-brand-bg w-3 h-3 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Status indicator under Layer panel */}
        <div className="bg-brand-surface/90 backdrop-blur-md border border-brand-border rounded-lg px-2.5 py-1.5 shadow-xl flex items-center gap-2 max-w-[208px]">
          <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse shrink-0"></span>
          <span className="font-mono text-[9px] font-bold text-slate-300 truncate uppercase">
            FEED: {aisFrequency === '30s' ? 'AIS 30s TELEMETRY' : 'REAL-TIME PULL'}
          </span>
        </div>
      </div>

      {/* 2. MAP CONTROLS PANEL (Top-Right overlay) */}
      <div className="absolute top-4 right-4 z-40 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="bg-brand-surface/95 backdrop-blur-md border border-brand-border rounded-lg p-1.5 shadow-2xl flex flex-col gap-1.5">
          <button 
            onClick={handleZoomIn} 
            title="Zoom In" 
            className="w-8 h-8 rounded bg-brand-bg hover:bg-brand-accent/20 hover:text-brand-accent border border-brand-border flex items-center justify-center transition-colors cursor-pointer text-slate-200"
          >
            <Plus className="w-4 h-4" />
          </button>
          
          <button 
            onClick={handleZoomOut} 
            title="Zoom Out" 
            className="w-8 h-8 rounded bg-brand-bg hover:bg-brand-accent/20 hover:text-brand-accent border border-brand-border flex items-center justify-center transition-colors cursor-pointer text-slate-200"
          >
            <Minus className="w-4 h-4" />
          </button>

          <button 
            onClick={handleResetView} 
            title="Reset Map Centering" 
            className="w-8 h-8 rounded bg-brand-bg hover:bg-brand-accent/20 hover:text-brand-accent border border-brand-border flex items-center justify-center transition-colors cursor-pointer text-slate-200"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button 
            onClick={() => setIsFullscreen(!isFullscreen)} 
            title="Toggle Fullscreen" 
            className={`w-8 h-8 rounded border flex items-center justify-center transition-colors cursor-pointer ${
              isFullscreen ? 'bg-brand-accent/15 border-brand-accent/40 text-brand-accent' : 'bg-brand-bg border-brand-border hover:bg-brand-accent/20 hover:text-brand-accent text-slate-200'
            }`}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button 
            onClick={handleRefreshData} 
            title="Refresh Map Coordinates" 
            className="w-8 h-8 rounded bg-brand-bg hover:bg-brand-accent/20 hover:text-brand-accent border border-brand-border flex items-center justify-center transition-colors cursor-pointer text-slate-200"
          >
            <Play className="w-4 h-4 rotate-90" />
          </button>

          <button 
            onClick={() => setShowSettings(!showSettings)} 
            title="Map Engine Settings" 
            className={`w-8 h-8 rounded border flex items-center justify-center transition-colors cursor-pointer ${
              showSettings ? 'bg-brand-accent/15 border-brand-accent/40 text-brand-accent' : 'bg-brand-bg border-brand-border hover:bg-brand-accent/20 hover:text-brand-accent text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline controller floating bottom right of map header */}
        {onTimelineChange && (
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded-lg border font-mono text-[10px] font-bold shadow-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              isPlaying ? 'bg-brand-success/20 border-brand-success/50 text-brand-success' : 'bg-brand-surface border-brand-border text-slate-200 hover:border-brand-accent/40'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-brand-success text-brand-success" /> PLAYING_SIM
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-slate-300 text-slate-300" /> PLAY_FLOW
              </>
            )}
          </button>
        )}

        {/* Popover Settings Overlay */}
        {showSettings && (
          <div className="absolute top-0 right-11 bg-brand-surface border border-brand-border p-3.5 rounded-lg shadow-2xl w-52 font-mono text-[10px] space-y-3">
            <div className="border-b border-brand-border/60 pb-1.5 flex items-center gap-1.5 text-slate-200 font-bold">
              <Sliders className="w-3.5 h-3.5 text-brand-accent" /> Engine Settings
            </div>
            
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <span className="text-brand-muted uppercase text-[8.5px]">Telemetry Frequency:</span>
                <select 
                  value={aisFrequency} 
                  onChange={(e) => setAisFrequency(e.target.value)}
                  className="bg-brand-bg border border-brand-border rounded px-1.5 py-1 text-[9.5px] text-slate-200 outline-none focus:border-brand-accent"
                >
                  <option value="30s">Continuous (30s AIS)</option>
                  <option value="realtime">Force Real-Time API Pull</option>
                  <option value="none">Paused / Freeze View</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-brand-muted uppercase text-[8.5px]">Labels Density:</span>
                <select 
                  value={labelDensity} 
                  onChange={(e) => setLabelDensity(e.target.value)}
                  className="bg-brand-bg border border-brand-border rounded px-1.5 py-1 text-[9.5px] text-slate-200 outline-none focus:border-brand-accent"
                >
                  <option value="high">High Density Plots</option>
                  <option value="normal">Standard Viewport Filters</option>
                  <option value="low">De-cluttered minimal</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-brand-muted uppercase text-[8.5px]">Graphics Layer:</span>
                <div className="p-1 bg-brand-bg/50 border border-brand-border/60 rounded text-[9px] text-brand-success flex items-center justify-between">
                  <span>Hardware Canvas:</span>
                  <span className="font-bold">WebGL active</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. CORE LEAFLET MAP ELEMENT */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full flex-1 z-0" 
      />

      {/* Grid overlay for aesthetic high-tech feel */}
      <div className="absolute inset-0 map-grid-overlay z-10" />

      {/* 4. DETAIL INSPECTOR OVERLAY PANEL (Bottom-Right overlay) */}
      {(selectedVessel || selectedChoke || selectedPort || selectedPipeline || selectedCountry) && (
        <div 
          className="absolute bottom-4 right-4 z-40 w-80 bg-brand-surface/95 border border-brand-border rounded-lg p-4 shadow-2xl backdrop-blur-md text-slate-100 max-h-[300px] overflow-y-auto" 
          id="drilldown_card"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between border-b border-brand-border pb-2 mb-2.5">
            <h4 className="font-mono text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              {selectedVessel ? (
                <>
                  <Navigation className="w-3.5 h-3.5 text-brand-accent rotate-45 animate-pulse" /> Asset Record
                </>
              ) : selectedChoke ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-brand-alert animate-bounce" /> Corridor Node
                </>
              ) : selectedPort ? (
                <>
                  <Anchor className="w-3.5 h-3.5 text-brand-success" /> assessment profile
                </>
              ) : selectedPipeline ? (
                <>
                  <Database className="w-3.5 h-3.5 text-brand-accent" /> Grid segment
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-brand-alert" /> regional posture
                </>
              )}
            </h4>
            <button
              onClick={handleMapBackgroundClick}
              className="text-brand-muted hover:text-white font-mono text-[10px] bg-brand-bg px-2 py-0.5 rounded border border-brand-border cursor-pointer transition-colors"
            >
              CLOSE
            </button>
          </div>

          {/* Popover Body Content - Vessel */}
          {selectedVessel && (
            <div className="space-y-2 text-xs font-mono" id="drilldown_vessel">
              <div className="flex justify-between"><span className="text-brand-muted">Name:</span> <span className="font-bold text-slate-100">{selectedVessel.name}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Cargo:</span> <span className="text-brand-accent font-bold">{selectedVessel.cargo}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Capacity:</span> <span className="text-white font-bold">{(selectedVessel.capacity / 1000000).toFixed(2)}M bbls</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Course:</span> <span className="text-slate-200 truncate max-w-[180px] text-right">{selectedVessel.source} ➔ {selectedVessel.destination}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">ETA Window:</span> <span className="text-slate-200 font-bold">{selectedVessel.etaDays} Days / {selectedVessel.speed.toFixed(1)} kn</span></div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Vessel Posture:</span> 
                <span className={`px-2 py-0.2 rounded text-[10px] font-bold border ${
                  selectedVessel.status === 'steaming' ? 'bg-brand-success/15 text-brand-success border-brand-success/30' : 'bg-brand-alert/15 text-brand-alert border-brand-alert/30'
                }`}>{selectedVessel.status.toUpperCase()}</span>
              </div>
              
              <div className="pt-2.5 border-t border-brand-border flex flex-col gap-1.5">
                <button 
                  onClick={() => handleReroute(selectedVessel)}
                  disabled={selectedVessel.status === 'diverting'}
                  className={`w-full text-center font-bold text-[10px] py-1.5 border rounded transition-all cursor-pointer ${
                    selectedVessel.status === 'diverting'
                      ? 'bg-brand-muted/10 border-brand-border text-brand-muted cursor-not-allowed'
                      : 'bg-brand-accent/15 text-brand-accent border-brand-accent/45 hover:bg-brand-accent/25'
                  }`}
                >
                  {selectedVessel.status === 'diverting' ? "DETOUR APPLIED" : "REROUTE VESSEL (CAPE DETOUR)"}
                </button>
                {routingFeedback && (
                  <p className="text-[9.5px] text-brand-success animate-pulse leading-tight mt-1">{routingFeedback}</p>
                )}
              </div>
            </div>
          )}

          {/* Popover Body Content - Chokepoint */}
          {selectedChoke && (
            <div className="space-y-2 text-xs font-mono" id="drilldown_choke">
              <div className="flex justify-between"><span className="text-brand-muted">Node:</span> <span className="font-bold text-slate-100">{selectedChoke.name}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Standard flow:</span> <span className="text-white font-bold">{selectedChoke.normalFlow}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Current Risk:</span> 
                <span className={`font-bold ${selectedChoke.currentRisk > 12 ? "text-brand-danger" : "text-brand-success"}`}>
                  {selectedChoke.currentRisk}%
                </span>
              </div>
              <div className="text-[10.5px] text-brand-muted leading-relaxed border-t border-brand-border pt-1.5 mt-1.5 font-sans">
                {selectedChoke.description}
              </div>
            </div>
          )}

          {/* Popover Body Content - Port */}
          {selectedPort && (
            <div className="space-y-2 text-xs font-mono" id="drilldown_port">
              <div className="flex justify-between"><span className="text-brand-muted">Terminal:</span> <span className="font-bold text-slate-100">{selectedPort.name} ({selectedPort.country})</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Throughput Capacity:</span> <span className="text-white font-bold">{selectedPort.capacity}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Congestion Rate:</span> <span className="text-slate-100 font-bold">{selectedPort.congestionScore}%</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Queue Status:</span> <span className="text-brand-accent font-bold">{getShipsWaitingForPort(selectedPort.id)} active carriers</span></div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Assessment Posture:</span> 
                <span className={`px-2 py-0.2 border rounded text-[10px] font-bold ${
                  selectedPort.status === 'nominal' ? 'bg-brand-success/15 text-brand-success border-brand-success/30' : 'bg-brand-danger/15 text-brand-danger border-brand-danger/30'
                }`}>{selectedPort.status.toUpperCase()}</span>
              </div>
              <div className="text-[10.5px] text-brand-muted leading-relaxed border-t border-brand-border pt-1.5 mt-1.5 font-sans">
                {selectedPort.details}
              </div>
            </div>
          )}

          {/* Popover Body Content - Pipeline */}
          {selectedPipeline && (
            <div className="space-y-2 text-xs font-mono" id="drilldown_pipeline">
              <div className="flex justify-between"><span className="text-brand-muted">Grid segment:</span> <span className="font-bold text-slate-100">{selectedPipeline.name}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">From:</span> <span className="text-slate-200">{selectedPipeline.source}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">To:</span> <span className="text-slate-200">{selectedPipeline.destination}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Throughput Volume:</span> <span className="text-brand-accent font-bold">{selectedPipeline.flowVolume}</span></div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Transmission Status:</span> 
                <span className={`px-2 py-0.2 rounded text-[10px] font-bold border ${
                  selectedPipeline.status === 'operational' ? 'bg-brand-success/15 text-brand-success border-brand-success/30' : 'bg-brand-danger/15 text-brand-danger border-brand-danger/30'
                }`}>{selectedPipeline.status.toUpperCase()}</span>
              </div>
            </div>
          )}

          {/* Popover Body Content - Country Geopolitical */}
          {selectedCountry && (
            <div className="space-y-2 text-xs font-mono" id="drilldown_country">
              <div className="flex justify-between"><span className="text-brand-muted">Sector Area:</span> <span className="font-bold text-brand-alert">{selectedCountry}</span></div>
              <div className="flex flex-col gap-1 border-t border-brand-border/60 pt-2 mt-2">
                <span className="text-brand-muted uppercase text-[9px]">Postures & Operations:</span>
                <p className="text-[10.5px] text-slate-200 leading-relaxed font-sans">
                  Tactical monitoring of marine transits, sovereign naval presence patrols, and drone countermeasures are fully integrated with real-time risk calculations in this sector.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
