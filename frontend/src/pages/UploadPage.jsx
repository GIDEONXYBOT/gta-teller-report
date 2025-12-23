import React, { useState, useRef, useEffect, useContext } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { SettingsContext } from '../context/SettingsContext.jsx';

export default function UploadPage() {
  const { user } = useContext(SettingsContext);
  const [selected, setSelected] = useState(null);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  const onPointerDown = (e) => {
    setDragging(true);
    setStart({ x: e.clientX ?? e.touches?.[0]?.clientX, y: e.clientY ?? e.touches?.[0]?.clientY, orig: { ...pos } });
  };
  const onPointerMove = (e) => {
    if (!dragging || !start) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    setPos({ x: start.orig.x + (cx - start.x), y: start.orig.y + (cy - start.y) });
  };
  const onPointerUp = () => { setDragging(false); setStart(null); };

  useEffect(() => {
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
    return () => { window.removeEventListener('mouseup', onPointerUp); window.removeEventListener('touchend', onPointerUp); };
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSelected(reader.result);
    reader.readAsDataURL(file);
  };

  const handleChoose = (e) => handleFile(e.target.files?.[0]);

  const handleSave = async () => {
    if (!selected) return alert('Please choose an image');
    setLoading(true);

    try {
      // draw crop (center square) to canvas and upload 1024x1024
      const container = containerRef.current;
      const img = imgRef.current;
      const rect = container.getBoundingClientRect();

      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const displayedW = img.width * scale;
      const displayedH = img.height * scale;
      const cropSize = Math.min(rect.width, rect.height);
      const imgX = pos.x + (rect.width - displayedW) / 2;
      const imgY = pos.y + (rect.height - displayedH) / 2;

      const sx = Math.max(0, ((-imgX) / displayedW) * naturalW);
      const sy = Math.max(0, ((-imgY) / displayedH) * naturalH);
      const sw = Math.min(naturalW - sx, (cropSize / displayedW) * naturalW);
      const sh = Math.min(naturalH - sy, (cropSize / displayedH) * naturalH);

      const outSize = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext('2d');
      const tmp = new Image();
      tmp.crossOrigin = 'anonymous';
      tmp.src = selected;
      await new Promise((res, rej) => { tmp.onload = res; tmp.onerror = rej; });
      ctx.drawImage(tmp, sx, sy, sw, sh, 0, 0, outSize, outSize);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png', 0.93));
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve) => { reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });

      const token = localStorage.getItem('token');
      const resp = await axios.post(`${getApiUrl()}/api/media/upload`, { image: dataUrl, caption }, { headers: { Authorization: `Bearer ${token}` } });
      if (resp.data?.success) {
        alert('Upload successful');
        setSelected(null);
        setCaption('');
        setScale(1);
        setPos({ x: 0, y: 0 });
      } else {
        alert(resp.data?.message || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Upload error: ' + (err?.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Share a photo</h2>
        <p className="text-sm text-gray-500 mb-3">Upload a picture, crop like TikTok / Facebook and add a caption. All roles can post.</p>

        <div className="flex gap-3 flex-col md:flex-row">
          <div className="flex-1">
            <div className="border rounded p-3 bg-gray-50 dark:bg-gray-900">
              <div className="mb-2 flex items-center gap-2">
                <input type="file" accept="image/*" onChange={handleChoose} />
                <button className="px-2 py-1 bg-indigo-600 text-white rounded text-sm" onClick={() => document.getElementById('url-input')?.click?.()}>Choose URL</button>
              </div>

              <div ref={containerRef} className="relative h-72 w-full bg-gray-100 dark:bg-gray-700 rounded overflow-hidden" onMouseDown={onPointerDown} onMouseMove={onPointerMove} onTouchStart={onPointerDown} onTouchMove={onPointerMove}>
                {selected ? (
                  <img ref={imgRef} src={selected} alt="selected" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${scale})` }} />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-400">No image selected</div>
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 border-2 border-white/70 rounded shadow-xl backdrop-blur-sm" />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <label className="text-sm text-gray-600">Zoom</label>
                <input type="range" min={0.5} max={3} step={0.01} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="flex-1" />
              </div>

              <div className="mt-3">
                <label className="block text-sm text-gray-500 mb-1">Caption</label>
                <input value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-700" placeholder={`Say something about your photo, ${user?.name || user?.username || ''}`} />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => { setSelected(null); setCaption(''); setScale(1); setPos({ x: 0, y: 0 }); }} className="px-3 py-2 border rounded">Cancel</button>
                <button onClick={handleSave} disabled={loading} className="px-3 py-2 bg-indigo-600 text-white rounded">{loading ? 'Uploading…' : 'Post'}</button>
              </div>
            </div>
          </div>

          <div className="w-80 hidden md:block">
            <div className="p-3 rounded border bg-white dark:bg-gray-900 text-xs text-gray-600">Preview:</div>
            <div className="mt-3 border rounded overflow-hidden h-64 bg-black/5 dark:bg-white/5 flex items-center justify-center">
              {selected ? <img src={selected} className="max-h-full max-w-full" alt="preview" /> : <div className="text-sm text-gray-500">No preview</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
