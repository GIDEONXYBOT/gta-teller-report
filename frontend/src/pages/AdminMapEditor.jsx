import React, { useEffect, useState, useContext, useRef } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { getApiUrl } from '../utils/apiConfig.js';
import { Trash2, Copy, Download, Upload, ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff, Box } from 'lucide-react';
import GLBViewer from '../components/GLBViewer.jsx';

// Enhanced Map Editor / Viewer with advanced features:
// - Real-time sync via socket
// - Drag-to-move labels and regions
// - Zoom & pan capabilities
// - Region heat mapping (teller assignments)
// - Keyboard shortcuts
// - Export/import configurations
// - Multi-region management with color coding
// - Live teller position tracking (if socket data available)

export default function AdminMapEditor() {
  const { user, settings } = useContext(SettingsContext);
  const API = getApiUrl();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [tellers, setTellers] = useState([]);
  const [mode, setMode] = useState('select'); // select | add-label | add-region | drag-label | drag-region
  const [draftRegion, setDraftRegion] = useState([]); // array of {x,y}
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [livePositions, setLivePositions] = useState({}); // tellerIds with current positions
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [deploymentItems, setDeploymentItems] = useState([]);
  const [showItems, setShowItems] = useState(false);
  const [selectedRegionItems, setSelectedRegionItems] = useState([]);
  const [draggedTeller, setDraggedTeller] = useState(null); // {id, name} being dragged
  const [tellerPositions, setTellerPositions] = useState({}); // userId -> {regionId, x, y}
  const [showTellerPanel, setShowTellerPanel] = useState(false);
  const [view3D, setView3D] = useState(false); // Toggle 2D/3D
  const [model3DData, setModel3DData] = useState(null); // Base64 GLB data
  const [model3DName, setModel3DName] = useState(''); // Filename
  const [rotate3D, setRotate3D] = useState({ x: 0, y: 0, z: 0 }); // 3D rotation
  const [regionColors] = useState({
    0: 'rgba(99,102,241,0.35)',     // indigo
    1: 'rgba(16,185,129,0.35)',     // emerald
    2: 'rgba(239,68,68,0.35)',      // red
    3: 'rgba(251,146,60,0.35)',     // orange
    4: 'rgba(168,85,247,0.35)',     // purple
    5: 'rgba(59,130,246,0.35)',     // blue
  });
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const canEdit = ['admin','super_admin','declarator'].includes(user?.role);
  const isViewOnly = ['teller','supervisor','supervisor_teller'].includes(user?.role);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const authHeader = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const [cfgRes, tellerRes, deploymentsRes] = await Promise.all([
          axios.get(`${API}/api/map-config`, authHeader),
          axios.get(`${API}/api/teller-management`, authHeader),
          axios.get(`${API}/api/deployments`, authHeader) // fetch active deployments
        ]);
        setConfig(cfgRes.data);
        // Fetch tellers - include anyone with teller role or teller in their role
        const allUsers = tellerRes.data || [];
        const filteredTellers = allUsers.filter(t => 
          t.role === 'teller' || 
          t.role === 'supervisor_teller' ||
          t.role?.includes('teller')
        );
        setTellers(filteredTellers.length > 0 ? filteredTellers : allUsers);
        setDeploymentItems(deploymentsRes.data || []);
        if (cfgRes.data.tellerPositions) setTellerPositions(cfgRes.data.tellerPositions);
        if (cfgRes.data.model3DData) setModel3DData(cfgRes.data.model3DData);
        if (cfgRes.data.model3DName) setModel3DName(cfgRes.data.model3DName);
      } catch (e) {
        console.error('Failed to load map config:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto-load default 3D model if none is present.
  // Use an externally-hosted model if VITE_DEFAULT_GLB_URL is provided (recommended for large files)
  useEffect(() => {
    if (!model3DData) {
      const defaultModelUrl = import.meta.env.VITE_DEFAULT_GLB_URL || '/default-model.glb';
      fetch(defaultModelUrl)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload = ev => {
            setModel3DData(ev.target.result);
            setModel3DName('default-model.glb');
          };
          reader.readAsDataURL(blob);
        });
    }
  }, [model3DData]);

  // Socket live updates (if available)
  useEffect(() => {
    const socket = window.globalSocket || null;
    if (!socket) return;
    const handler = (cfg) => setConfig(cfg);
    socket.on('mapConfigUpdated', handler);
    return () => socket.off('mapConfigUpdated', handler);
  }, []);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const next = {
          ...(config || {}),
          imageData: ev.target.result,
          imageWidth: img.width,
          imageHeight: img.height,
        };
        setConfig(next);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handle3DFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
      alert('Please upload a GLB or GLTF file');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      setModel3DData(ev.target.result);
      setModel3DName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const relativePoint = (clientX, clientY) => {
    if (!imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) };
  };

  const onMapClick = (e) => {
    if (!canEdit) return;
    const pt = relativePoint(e.clientX, e.clientY);
    if (!pt) return;
    if (mode === 'add-label') {
      const id = `lbl_${Date.now()}`;
      const next = { ...(config || {}), markers: [...(config?.markers||[]), { id, label: 'New', position: pt }] };
      setConfig(next);
      setMode('select');
    } else if (mode === 'add-region') {
      setDraftRegion(r => [...r, pt]);
    }
  };

  const finishRegion = () => {
    if (draftRegion.length < 3) { setDraftRegion([]); return; }
    const id = `reg_${Date.now()}`;
    const next = { ...(config || {}), regions: [...(config?.regions||[]), { id, name: 'Region', points: draftRegion, tellerIds: [] }] };
    setConfig(next);
    setDraftRegion([]);
    setMode('select');
  };

  const updateMarkerLabel = (id, label) => {
    const next = { ...(config || {}), markers: (config.markers||[]).map(m => m.id === id ? { ...m, label } : m) };
    setConfig(next);
  };

  const assignTellerToRegion = (regionId, tellerId) => {
    const next = { ...(config || {}), regions: (config.regions||[]).map(r => r.id === regionId ? { ...r, tellerIds: [tellerId] } : r) };
    setConfig(next);
  };

  const deleteMarker = (id) => {
    const next = { ...(config || {}), markers: (config.markers||[]).filter(m => m.id !== id) };
    setConfig(next);
    setSelectedMarker(null);
  };

  const deleteRegion = (id) => {
    const next = { ...(config || {}), regions: (config.regions||[]).filter(r => r.id !== id) };
    setConfig(next);
    setSelectedRegion(null);
  };

  const duplicateRegion = (regionId) => {
    const region = config.regions.find(r => r.id === regionId);
    if (!region) return;
    const newId = `reg_${Date.now()}`;
    const newRegion = { ...region, id: newId, name: `${region.name} (copy)` };
    const next = { ...(config || {}), regions: [...(config.regions||[]), newRegion] };
    setConfig(next);
  };

  const handleMouseDown = (e) => {
    if (mode === 'select' && selectedMarker) {
      setDragging({ type: 'marker', id: selectedMarker, startX: e.clientX, startY: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const marker = config.markers.find(m => m.id === dragging.id);
    if (!marker) return;

    const deltaX = (e.clientX - dragging.startX) / rect.width;
    const deltaY = (e.clientY - dragging.startY) / rect.height;
    const newX = Math.max(0, Math.min(1, marker.position.x + deltaX));
    const newY = Math.max(0, Math.min(1, marker.position.y + deltaY));

    const next = { ...(config || {}), markers: (config.markers||[]).map(m => m.id === dragging.id ? { ...m, position: { x: Number(newX.toFixed(4)), y: Number(newY.toFixed(4)) } } : m) };
    setConfig(next);
    setDragging({ ...dragging, startX: e.clientX, startY: e.clientY });
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const exportConfig = () => {
    if (!config) return;
    const dataStr = JSON.stringify(config, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `map-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        setConfig(imported);
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const assignItemToRegion = (regionId, itemId) => {
    const next = { ...(config || {}), regions: (config.regions||[]).map(r => 
      r.id === regionId ? { ...r, itemIds: [...(r.itemIds || []), itemId] } : r
    ) };
    setConfig(next);
  };

  const removeItemFromRegion = (regionId, itemId) => {
    const next = { ...(config || {}), regions: (config.regions||[]).map(r => 
      r.id === regionId ? { ...r, itemIds: (r.itemIds || []).filter(id => id !== itemId) } : r
    ) };
    setConfig(next);
  };

  const handleTellerDragStart = (e, teller) => {
    setDraggedTeller(teller);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleMapDragOver = (e) => {
    if (!draggedTeller) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleMapDrop = (e) => {
    if (!draggedTeller || !containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Find which region this drop is in
    const regionAtPoint = (config.regions || []).find(r => {
      if (!r.points || r.points.length < 3) return false;
      // Simple point-in-polygon check
      const poly = r.points;
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    });

    if (!regionAtPoint) {
      alert('Please drop the teller inside a region');
      setDraggedTeller(null);
      return;
    }

    // Assign teller to the region
    const next = { ...(config || {}), regions: (config.regions||[]).map(r => 
      r.id === regionAtPoint.id ? { ...r, tellerIds: [draggedTeller._id] } : r
    ) };
    setConfig(next);
    setTellerPositions(prev => ({ ...prev, [draggedTeller._id]: { regionId: regionAtPoint.id, x, y } }));
    setDraggedTeller(null);
  };

  const saveAll = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const payload = {
        imageData: config.imageData,
        imageWidth: config.imageWidth,
        imageHeight: config.imageHeight,
        markers: config.markers || [],
        regions: config.regions || [],
        tellerPositions: tellerPositions,
        model3DData: model3DData,
        model3DName: model3DName,
      };
      const res = await axios.put(`${API}/api/map-config`, payload);
      setConfig(res.data);
      if (res.data.tellerPositions) setTellerPositions(res.data.tellerPositions);
      if (res.data.model3DData) setModel3DData(res.data.model3DData);
      if (res.data.model3DName) setModel3DName(res.data.model3DName);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const bg = settings?.theme?.mode === 'dark' ? '#0f172a' : '#f8fafc';
  const isDark = settings?.theme?.mode === 'dark';

  return (
    <div className="p-4 space-y-4" style={{ background: bg }}>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">🗺️ Live Map {isViewOnly && '(View Only)'}</h1>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setShowLabels(!showLabels)} title="Toggle labels" className={`p-2 rounded ${showLabels ? 'bg-indigo-600 text-white' : 'bg-gray-300'}`}>
              {showLabels ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button onClick={() => setShowHeatmap(!showHeatmap)} title="Heat map (assignments)" className={`p-2 rounded ${showHeatmap ? 'bg-orange-600 text-white' : 'bg-gray-300'}`}>
              🔥
            </button>
            <button onClick={() => setShowItems(!showItems)} title="Show items" className={`p-2 rounded ${showItems ? 'bg-cyan-600 text-white' : 'bg-gray-300'}`}>
              📦
            </button>
            {model3DData && (
              <button onClick={() => setView3D(!view3D)} title="Toggle 2D/3D view" className={`p-2 rounded ${view3D ? 'bg-purple-600 text-white' : 'bg-gray-300'}`}>
                <Box size={18} />
              </button>
            )}
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset zoom/pan" className="p-2 rounded bg-gray-300">
              <RotateCcw size={18} />
            </button>
          </div>
        )}
        {isViewOnly && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowLabels(!showLabels)} title="Toggle labels" className={`p-2 rounded ${showLabels ? 'bg-indigo-600 text-white' : 'bg-gray-300'}`}>
              {showLabels ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button onClick={() => setShowHeatmap(!showHeatmap)} title="View assignments" className={`p-2 rounded ${showHeatmap ? 'bg-orange-600 text-white' : 'bg-gray-300'}`}>
              🔥
            </button>
            {model3DData && (
              <button onClick={() => setView3D(!view3D)} title="Toggle 2D/3D view" className={`p-2 rounded ${view3D ? 'bg-purple-600 text-white' : 'bg-gray-300'}`}>
                <Box size={18} />
              </button>
            )}
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset zoom/pan" className="p-2 rounded bg-gray-300">
              <RotateCcw size={18} />
            </button>
          </div>
        )}
      </div>

      {loading && <div className="text-center py-8">Loading map…</div>}
      {!loading && !config?.imageData && canEdit && (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className={`flex-1 border-2 border-dashed rounded p-6 ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} shadow`}>
            <p className="mb-3 text-sm font-medium">📤 Upload your branch/region map image (PNG/JPG)</p>
            <input type="file" accept="image/*" onChange={handleFile} className="mb-2" />
            <p className="text-xs text-gray-500">Base64 encoded for offline availability</p>
          </div>

          <div className={`flex-1 border-2 border-dashed rounded p-6 ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} shadow`}>
            <p className="mb-3 text-sm font-medium">📦 Upload 3D model (GLB/GLTF)</p>
            <input type="file" accept=".glb,.gltf" onChange={handle3DFile} className="mb-2" />
            <p className="text-xs text-gray-500">Optional 3D facility layout</p>
          </div>
        </div>
      )}

      {!loading && !config?.imageData && !model3DData && canEdit && (
        <p className="text-xs text-gray-500 text-center py-4">Upload either a 2D map or 3D model (or both) to get started</p>
      )}

      {!loading && !config?.imageData && isViewOnly && (
        <div className={`border rounded p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-blue-50 border-blue-300'}`}>
          <p className="text-sm text-blue-900 dark:text-blue-100">📍 No map available yet. Contact an administrator to set up the map.</p>
        </div>
      )}

      {config?.imageData && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Main Canvas */}
          <div className="flex-1 space-y-2">
            {canEdit && (
              <div className="flex gap-2 items-center flex-wrap">
                <>
                  <button onClick={() => setMode(mode==='add-label' ? 'select':'add-label')} title="Add label / marker" className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 ${mode==='add-label'?'bg-indigo-600 text-white':'bg-gray-200 dark:bg-gray-700'}`}>
                    📍 Label
                  </button>
                  <button onClick={() => setMode(mode==='add-region' ? 'select':'add-region')} title="Draw region polygon" className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 ${mode==='add-region'?'bg-green-600 text-white':'bg-gray-200 dark:bg-gray-700'}`}>
                    🔲 Region
                  </button>
                  {mode==='add-region' && draftRegion.length>=3 && (
                    <button onClick={finishRegion} className="px-3 py-1.5 rounded text-sm bg-green-600 text-white font-medium">✓ Finish</button>
                  )}
                  {draftRegion.length>0 && (
                    <button onClick={()=>setDraftRegion([])} className="px-3 py-1.5 rounded text-sm bg-red-600 text-white font-medium flex items-center gap-1">
                      <Trash2 size={14} /> Clear
                    </button>
                  )}
                  <button disabled={saving} onClick={saveAll} className="px-3 py-1.5 rounded text-sm bg-blue-600 text-white disabled:opacity-50 font-medium">
                    {saving?'💾 Saving…':'💾 Save'}
                  </button>
                  <div className="flex gap-1 ml-auto">
                    <button onClick={exportConfig} title="Export to JSON" className="p-1.5 rounded bg-purple-600 text-white">
                      <Download size={16} />
                    </button>
                    <label title="Import from JSON" className="p-1.5 rounded bg-purple-600 text-white cursor-pointer">
                      <Upload size={16} />
                      <input type="file" accept=".json" onChange={importConfig} className="hidden" />
                    </label>
                  </div>
                </>
              </div>
            )}

            {/* Canvas with Zoom Controls - 2D or 3D */}
            {!view3D && config.imageData ? (
            <div className={`relative border rounded overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-white'}`} style={{ aspectRatio: `${config.imageWidth}/${config.imageHeight}` }}>
              <div
                ref={containerRef}
                className="relative w-full h-full overflow-auto"
                style={{ cursor: canEdit && mode !== 'select' ? 'crosshair' : 'grab' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={onMapClick}
                onDragOver={handleMapDragOver}
                onDrop={handleMapDrop}
              >
                <div
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    transition: dragging ? 'none' : 'transform 0.2s'
                  }}
                >
                  <img ref={imageRef} src={config.imageData} alt="Map" className="w-full h-full object-contain select-none" />

                  {/* Draft region preview */}
                  {draftRegion.length > 0 && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <polygon
                        points={draftRegion.map(p => `${p.x*100}%,${p.y*100}%`).join(' ')}
                        fill="rgba(99,102,241,0.3)"
                        stroke="#6366f1"
                        strokeWidth={2}
                      />
                      {draftRegion.map((p, i) => (
                        <circle key={i} cx={`${p.x*100}%`} cy={`${p.y*100}%`} r="4" fill="#6366f1" />
                      ))}
                    </svg>
                  )}

                  {/* Regions with heat map */}
                  {(config.regions||[]).map((r, idx) => (
                    <div key={r.id} className="absolute inset-0 w-full h-full pointer-events-none">
                      <svg className="absolute inset-0 w-full h-full">
                        <polygon
                          points={r.points.map(p => `${p.x*100}%,${p.y*100}%`).join(' ')}
                          fill={showHeatmap && r.tellerIds?.length ? 'rgba(34,197,94,0.4)' : regionColors[idx % 6]}
                          stroke={selectedRegion === r.id ? '#f59e0b' : '#10b981'}
                          strokeWidth={selectedRegion === r.id ? 3 : 2}
                          style={{ cursor: canEdit ? 'pointer' : 'default' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRegion(selectedRegion === r.id ? null : r.id);
                          }}
                        />
                        {r.points.map((p, i) => (
                          <circle key={i} cx={`${p.x*100}%`} cy={`${p.y*100}%`} r="3" fill="#10b981" opacity={0.6} />
                        ))}
                      </svg>
                    </div>
                  ))}

                  {/* Markers / Labels */}
                  {showLabels && (config.markers||[]).map(m => (
                    <div
                      key={m.id}
                      className={`absolute px-2 py-1 rounded text-xs font-semibold shadow cursor-move border-2 ${
                        selectedMarker === m.id
                          ? 'bg-yellow-300 border-yellow-600 text-black'
                          : 'bg-white/90 border-gray-300 text-gray-900'
                      }`}
                      style={{
                        left: `${m.position.x*100}%`,
                        top: `${m.position.y*100}%`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: selectedMarker === m.id ? 50 : 10
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMarker(selectedMarker === m.id ? null : m.id);
                      }}
                    >
                      {canEdit && selectedMarker === m.id ? (
                        <input
                          value={m.label}
                          onChange={e => updateMarkerLabel(m.id, e.target.value)}
                          className="bg-transparent outline-none text-[11px] w-16 font-bold"
                          autoFocus
                        />
                      ) : m.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Zoom Controls */}
              <div className="absolute bottom-2 right-2 flex flex-col gap-1">
                <button onClick={() => setZoom(Math.min(4, zoom + 0.2))} className="p-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">
                  <ZoomIn size={16} />
                </button>
                <button onClick={() => setZoom(Math.max(0.5, zoom - 0.2))} className="p-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">
                  <ZoomOut size={16} />
                </button>
              </div>
            </div>
            ) : view3D && model3DData ? (
              <div className="space-y-2">
                <div style={{ height: '500px', position: 'relative' }}>
                  <GLBViewer 
                    modelData={model3DData} 
                    modelName={model3DName} 
                    rotation={rotate3D}
                    isDark={isDark}
                  />
                </div>
                {/* 3D Rotation Controls */}
                <div className={`p-3 rounded border grid grid-cols-3 gap-2 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="col-span-3">
                    <p className="text-xs font-semibold mb-2">🔄 Rotation Controls</p>
                  </div>
                  
                  {/* X Axis */}
                  <div className="text-center">
                    <p className="text-[10px] font-medium mb-1">X (Pitch)</p>
                    <div className="flex gap-1">
                      <button onClick={() => setRotate3D({...rotate3D, x: rotate3D.x - 5})} className="flex-1 px-2 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-600">-</button>
                      <span className="flex-1 px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-xs text-center">{rotate3D.x.toFixed(0)}°</span>
                      <button onClick={() => setRotate3D({...rotate3D, x: rotate3D.x + 5})} className="flex-1 px-2 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-600">+</button>
                    </div>
                  </div>

                  {/* Y Axis */}
                  <div className="text-center">
                    <p className="text-[10px] font-medium mb-1">Y (Yaw)</p>
                    <div className="flex gap-1">
                      <button onClick={() => setRotate3D({...rotate3D, y: rotate3D.y - 5})} className="flex-1 px-2 py-1 rounded bg-green-500 text-white text-xs hover:bg-green-600">-</button>
                      <span className="flex-1 px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-xs text-center">{rotate3D.y.toFixed(0)}°</span>
                      <button onClick={() => setRotate3D({...rotate3D, y: rotate3D.y + 5})} className="flex-1 px-2 py-1 rounded bg-green-500 text-white text-xs hover:bg-green-600">+</button>
                    </div>
                  </div>

                  {/* Z Axis */}
                  <div className="text-center">
                    <p className="text-[10px] font-medium mb-1">Z (Roll)</p>
                    <div className="flex gap-1">
                      <button onClick={() => setRotate3D({...rotate3D, z: rotate3D.z - 5})} className="flex-1 px-2 py-1 rounded bg-blue-500 text-white text-xs hover:bg-blue-600">-</button>
                      <span className="flex-1 px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-xs text-center">{rotate3D.z.toFixed(0)}°</span>
                      <button onClick={() => setRotate3D({...rotate3D, z: rotate3D.z + 5})} className="flex-1 px-2 py-1 rounded bg-blue-500 text-white text-xs hover:bg-blue-600">+</button>
                    </div>
                  </div>

                  {/* Reset Button */}
                  <button onClick={() => setRotate3D({x: 0, y: 0, z: 0})} className="col-span-3 px-3 py-2 rounded bg-gray-600 text-white text-xs hover:bg-gray-700 font-medium">
                    🔄 Reset Rotation
                  </button>
                </div>
              </div>
            ) : (
              <div className={`relative border rounded overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-white'} p-8 text-center`}>
                <p className="text-gray-500">No 2D map uploaded. {model3DData ? 'Switch to 3D view or' : ''} upload a map image to get started.</p>
              </div>
            )}

            {canEdit && mode === 'add-region' && draftRegion.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900 p-2 rounded text-xs text-blue-900 dark:text-blue-100">
                📍 Points: {draftRegion.length} | Click 3+ points, then press "Finish Region"
              </div>
            )}
          </div>

          {/* Right Sidebar - Configuration Panel */}
          <div className={`w-full lg:w-80 space-y-4 ${isDark ? 'text-gray-100' : ''}`}>
            {/* Regions Panel */}
            <div className={`p-4 rounded border shadow ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2">🔲 Regions ({config.regions?.length || 0})</h2>
              {(config.regions||[]).length === 0 && <p className="text-xs text-gray-400">No regions yet. Draw one to get started!</p>}
              {(config.regions||[]).map((r, idx) => (
                <div key={r.id} className={`mb-3 p-2 rounded border ${selectedRegion === r.id ? 'border-yellow-500 bg-yellow-50 dark:bg-gray-700' : 'border-gray-200 dark:border-gray-600'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <input
                        value={r.name}
                        onChange={e => {
                          const next = { ...(config||{}), regions: (config.regions||[]).map(rr => rr.id===r.id ? { ...rr, name: e.target.value } : rr) };
                          setConfig(next);
                        }}
                        className={`w-full text-xs font-medium rounded px-1 py-0.5 border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                        placeholder="Region name"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">{r.points.length} points</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => duplicateRegion(r.id)} title="Duplicate" className="p-1 rounded bg-purple-500 text-white hover:bg-purple-600">
                        <Copy size={12} />
                      </button>
                      <button onClick={() => deleteRegion(r.id)} title="Delete" className="p-1 rounded bg-red-500 text-white hover:bg-red-600">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <select
                    value={r.tellerIds?.[0] || ''}
                    onChange={e => assignTellerToRegion(r.id, e.target.value)}
                    className={`w-full text-xs rounded px-1 py-1 border font-medium ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value=''>👤 Assign Teller…</option>
                    {tellers.map(t => <option key={t._id} value={t._id}>{t.name||t.username}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Markers Panel */}
            <div className={`p-4 rounded border shadow ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h2 className="font-bold text-sm mb-3">📍 Markers ({config.markers?.length || 0})</h2>
              {(config.markers||[]).length === 0 && <p className="text-xs text-gray-400">No markers yet.</p>}
              {(config.markers||[]).map(m => (
                <div key={m.id} className={`flex items-center justify-between gap-2 mb-2 p-2 rounded border ${selectedMarker === m.id ? 'bg-yellow-50 dark:bg-gray-700 border-yellow-400' : 'border-gray-200 dark:border-gray-600'}`}>
                  <div>
                    <p className="text-xs font-semibold">{m.label || 'Unnamed'}</p>
                    <p className="text-[10px] text-gray-500">({(m.position.x*100).toFixed(0)}%, {(m.position.y*100).toFixed(0)}%)</p>
                  </div>
                  <button onClick={() => deleteMarker(m.id)} className="p-1 rounded bg-red-500 text-white hover:bg-red-600">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            {showHeatmap && (
              <div className={`p-3 rounded border ${isDark ? 'bg-green-900 border-green-700' : 'bg-green-50 border-green-300'} text-sm`}>
                <p className="font-bold">📊 Coverage</p>
                <p className="text-xs mt-1">
                  Assigned: {(config.regions||[]).filter(r => r.tellerIds?.length > 0).length} / {config.regions?.length || 0}
                </p>
              </div>
            )}

            {/* Deployment Items Panel */}
            {showItems && selectedRegion && (
              <div className={`p-4 rounded border shadow ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h2 className="font-bold text-sm mb-3">📦 Items in "{(config.regions||[]).find(r => r.id === selectedRegion)?.name || 'Region'}"</h2>
                {deploymentItems.length === 0 && <p className="text-xs text-gray-400">No items available.</p>}
                {deploymentItems.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {deploymentItems.map(item => {
                      const regionItems = (config.regions||[]).find(r => r.id === selectedRegion)?.itemIds || [];
                      const isAssigned = regionItems.includes(item._id);
                      return (
                        <div key={item._id} className={`flex items-center justify-between gap-2 p-2 rounded border text-xs ${isAssigned ? 'bg-cyan-50 dark:bg-cyan-900 border-cyan-400' : 'border-gray-300 dark:border-gray-600'}`}>
                          <div>
                            <p className="font-semibold">{item.itemName || item.itemType}</p>
                            <p className="text-[10px] text-gray-500">Qty: {item.quantity}</p>
                          </div>
                          {isAssigned ? (
                            <button onClick={() => removeItemFromRegion(selectedRegion, item._id)} className="p-1 rounded bg-red-500 text-white hover:bg-red-600">
                              <Trash2 size={12} />
                            </button>
                          ) : (
                            <button onClick={() => assignItemToRegion(selectedRegion, item._id)} className="p-1 rounded bg-green-600 text-white hover:bg-green-700">
                              +
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Draggable Tellers Panel */}
            {canEdit && (
              <div className={`p-4 rounded border shadow ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <button
                  onClick={() => setShowTellerPanel(!showTellerPanel)}
                  className="w-full font-bold text-sm mb-3 p-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-between"
                >
                  <span>👥 Drag Tellers ({tellers.length})</span>
                  <span>{showTellerPanel ? '▼' : '▶'}</span>
                </button>
                
                {showTellerPanel && (
                  <div className="space-y-2">
                    {tellers.length === 0 && <p className="text-xs text-gray-400">No tellers available.</p>}
                    {tellers.map(teller => {
                      const assignedRegion = (config.regions||[]).find(r => r.tellerIds?.includes(teller._id));
                      return (
                        <div
                          key={teller._id}
                          draggable
                          onDragStart={(e) => handleTellerDragStart(e, teller)}
                          className={`p-2 rounded border text-xs cursor-move transition ${
                            draggedTeller?._id === teller._id
                              ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-400 opacity-50'
                              : assignedRegion
                              ? 'bg-green-50 dark:bg-green-900 border-green-400'
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                          }`}
                        >
                          <div className="font-semibold">{teller.name || teller.username}</div>
                          {assignedRegion && (
                            <p className="text-[10px] text-gray-600 dark:text-gray-400">
                              📍 {assignedRegion.name}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            🖱️ Drag to map to assign
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-3 italic">
                  💡 Tip: Drag a teller name and drop it inside a region on the map to assign.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !config?.imageData && !canEdit && (
        <p className="text-sm text-gray-500 text-center py-8">📍 No map configured. Contact administrator to set up regions and markers.</p>
      )}
    </div>
  );
}
