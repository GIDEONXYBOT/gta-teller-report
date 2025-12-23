import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { MapContainer, ImageOverlay, Marker, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getApiUrl } from '../utils/apiConfig';

const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

function NormalizedClick(onClick) {
  useMapEvents({
    click(e) {
      const map = e.target;
      const bounds = map.getBounds();
      const nw = bounds.getNorthWest();
      const se = bounds.getSouthEast();
      const latRange = nw.lat - se.lat;
      const lngRange = se.lng - nw.lng;
      const nx = (e.latlng.lng - nw.lng) / lngRange;
      const ny = (nw.lat - e.latlng.lat) / latRange;
      if (onClick) onClick({ x: Math.min(Math.max(nx,0),1), y: Math.min(Math.max(ny,0),1) });
    }
  });
  return null;
}

export default function MapEditor() {
  const API = getApiUrl();
  const [cfg, setCfg] = useState(null);
  const [tellers, setTellers] = useState([]);
  const [mode, setMode] = useState('select'); // select | add-label | draw-zone
  const [draftPoints, setDraftPoints] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState(null);

  const imageBounds = useMemo(() => {
    if (!cfg?.imageWidth || !cfg?.imageHeight) return null;
    // Use Leaflet CRS.Simple conventions: image size in pixels becomes lat/lng extent
    const w = cfg.imageWidth;
    const h = cfg.imageHeight;
    return [[0,0],[h,w]]; // [y, x]
  }, [cfg?.imageWidth, cfg?.imageHeight]);

  const mapCrs = L.CRS.Simple;

  const toLatLng = (p) => {
    if (!cfg?.imageWidth || !cfg?.imageHeight) return [0,0];
    const x = p.x * cfg.imageWidth;
    const y = p.y * cfg.imageHeight;
    return [y, x];
  };

  const fromFile = async (file) => {
    const dataUrl = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(file);
    });
    const img = new Image();
    const size = await new Promise((resolve) => {
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = dataUrl;
    });
    return { dataUrl, ...size };
  };

  const load = async () => {
    const [mapRes, usersRes] = await Promise.all([
      axios.get(`${API}/api/map-config`),
      axios.get(`${API}/api/admin/users`).catch(() => ({ data: [] })),
    ]);
    setCfg(mapRes.data || {});
    const tellersOnly = (usersRes.data || []).filter(u => u.role === 'teller');
    setTellers(tellersOnly);
  };

  useEffect(() => { load(); }, []);

  const onMapClick = ({ x, y }) => {
    if (mode === 'add-label') {
      const label = window.prompt('Label text?');
      if (!label) return;
      const id = `m_${Date.now()}`;
      const markers = [...(cfg?.markers || []), { id, label, position: { x, y } }];
      setCfg({ ...cfg, markers });
    }
    if (mode === 'draw-zone') {
      setDraftPoints([...draftPoints, { x, y }]);
    }
  };

  const finishZone = () => {
    if (draftPoints.length < 3) return alert('Need at least 3 points');
    const name = window.prompt('Zone name?');
    if (!name) return;
    const id = `z_${Date.now()}`;
    const regions = [...(cfg?.regions || []), { id, name, points: draftPoints, tellerIds: [] }];
    setCfg({ ...cfg, regions });
    setDraftPoints([]);
    setMode('select');
  };

  const removeMarker = (id) => {
    const markers = (cfg?.markers || []).filter(m => m.id !== id);
    setCfg({ ...cfg, markers });
  };

  const removeRegion = (id) => {
    const regions = (cfg?.regions || []).filter(r => r.id !== id);
    setCfg({ ...cfg, regions });
    if (selectedRegionId === id) setSelectedRegionId(null);
  };

  const updateRegionAssignment = (regionId, selectedIds) => {
    const regions = (cfg?.regions || []).map(r => r.id === regionId ? { ...r, tellerIds: selectedIds } : r);
    setCfg({ ...cfg, regions });
  };

  const save = async () => {
    try {
      const body = {
        imageData: cfg?.imageData || '',
        imageWidth: cfg?.imageWidth || 0,
        imageHeight: cfg?.imageHeight || 0,
        markers: cfg?.markers || [],
        regions: cfg?.regions || [],
      };
      const res = await axios.put(`${API}/api/map-config`, body);
      setCfg(res.data);
      alert('Map saved');
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    }
  };

  const onImageSelect = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const { dataUrl, w, h } = await fromFile(f);
    setCfg({ imageData: dataUrl, imageWidth: w, imageHeight: h, markers: [], regions: [] });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="file" accept="image/*" onChange={onImageSelect} />
        <button className={`px-3 py-1 rounded ${mode==='add-label'?'bg-indigo-600 text-white':'bg-gray-200'}`} onClick={() => setMode('add-label')}>Add Label</button>
        <button className={`px-3 py-1 rounded ${mode==='draw-zone'?'bg-indigo-600 text-white':'bg-gray-200'}`} onClick={() => setMode('draw-zone')}>Draw Zone</button>
        <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={save}>Save</button>
        {mode==='draw-zone' && (
          <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={finishZone}>Finish Zone</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 border rounded overflow-hidden">
          {cfg?.imageData && imageBounds ? (
            <MapContainer
              crs={mapCrs}
              bounds={imageBounds}
              style={{ height: '70vh', width: '100%' }}
              zoom={-1}
              minZoom={-5}
              maxZoom={2}
              attributionControl={false}
            >
              <ImageOverlay url={cfg.imageData} bounds={imageBounds} />
              <NormalizedClick onClick={onMapClick} />
              {(cfg.markers || []).map(m => (
                <Marker key={m.id} position={toLatLng(m.position)} icon={defaultIcon}>
                </Marker>
              ))}
              {(cfg.regions || []).map(r => (
                <Polygon key={r.id} positions={r.points.map(toLatLng)} pathOptions={{ color: selectedRegionId===r.id? '#4f46e5':'#10b981' }} />
              ))}
              {draftPoints.length>0 && (
                <Polygon positions={draftPoints.map(toLatLng)} pathOptions={{ dashArray: '4 4', color: '#f59e0b' }} />
              )}
            </MapContainer>
          ) : (
            <div className="p-6 text-gray-500">Upload a map image to start</div>
          )}
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-white dark:bg-gray-800 rounded shadow">
            <h3 className="font-semibold mb-2">Labels</h3>
            <ul className="space-y-2">
              {(cfg?.markers || []).map(m => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span>{m.label}</span>
                  <button onClick={() => removeMarker(m.id)} className="text-red-600">Remove</button>
                </li>
              ))}
              {(!cfg?.markers || cfg.markers.length===0) && (
                <li className="text-gray-500 text-sm">No labels yet</li>
              )}
            </ul>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded shadow">
            <h3 className="font-semibold mb-2">Zones (assign tellers)</h3>
            <ul className="space-y-3">
              {(cfg?.regions || []).map(r => (
                <li key={r.id} className="border rounded p-2">
                  <div className="flex items-center justify-between mb-2">
                    <button className="font-medium text-left" onClick={() => setSelectedRegionId(r.id)}>{r.name}</button>
                    <button className="text-red-600" onClick={() => removeRegion(r.id)}>Remove</button>
                  </div>
                  {selectedRegionId===r.id && (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Assign tellers</label>
                      <select multiple className="w-full border rounded p-1"
                        value={r.tellerIds?.map(String) || []}
                        onChange={(e) => {
                          const values = Array.from(e.target.selectedOptions).map(o => o.value);
                          updateRegionAssignment(r.id, values);
                        }}
                      >
                        {tellers.map(t => (
                          <option key={t._id} value={t._id}>{t.fullName || t.username}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </li>
              ))}
              {(!cfg?.regions || cfg.regions.length===0) && (
                <li className="text-gray-500 text-sm">No zones yet</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
