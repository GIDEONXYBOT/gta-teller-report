import React, { useState, useEffect, useContext, useRef } from 'react';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { getApiUrl } from '../utils/apiConfig';
import { Camera, Maximize2, Minimize2, Settings, Circle, Square, ZoomIn, ZoomOut } from 'lucide-react';
import axios from 'axios';

export default function LiveCockFightCamera() {
  const { settings, user } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [streamName, setStreamName] = useState(`Cockfight-${new Date().getTime()}`);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const recordedChunksRef = useRef([]);
  
  // Streaming settings
  const [streamSettings, setStreamSettings] = useState({
    quality: '720',
    frameRate: 30,
    bitrate: 2500,
    broadcast: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Get available cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error getting cameras:', err);
        setCameraError('Failed to access camera list');
      }
    };

    getCameras();
  }, []);

  // ✅ Ensure video plays when stream is set
  useEffect(() => {
    if (!videoRef.current || !stream) return;

    console.log('🎬 Setting stream to video element...');
    videoRef.current.srcObject = stream;
    
    // Attempt to play
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('✅ Video playing successfully');
        })
        .catch(err => {
          console.error('❌ Auto-play failed:', err);
          // Retry
          setTimeout(() => {
            if (videoRef.current?.srcObject === stream) {
              videoRef.current.play().catch(e => {
                console.error('❌ Retry failed:', e);
              });
            }
          }, 500);
        });
    }
  }, [stream]);

  // Start camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      console.log('📷 Starting camera with device:', selectedCamera);
      
      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: parseInt(streamSettings.quality) },
          frameRate: { ideal: streamSettings.frameRate }
        },
        audio: true
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Media stream acquired:', mediaStream.getTracks());
      
      streamRef.current = mediaStream;
      
      // Set on video element immediately
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        console.log('📺 Stream assigned to video element');
        
        // Try to play immediately
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => console.error('Play error:', err));
        }
      }

      setStream(mediaStream);
      setIsStreaming(true);
      showToast({ type: 'success', message: '📷 Camera started successfully' });
    } catch (err) {
      console.error('Error accessing camera:', err);
      const errorMsg = err.name === 'NotAllowedError' 
        ? 'Camera permission denied. Please allow camera access.'
        : err.name === 'NotFoundError'
        ? 'No camera found. Please check your device.'
        : 'Failed to start camera';
      setCameraError(errorMsg);
      showToast({ type: 'error', message: errorMsg });
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsStreaming(false);
    setIsRecording(false);
    setRecordingTime(0);
    showToast({ type: 'info', message: '📷 Camera stopped' });
  };

  // Zoom controls
  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 0.2, 3);
    setZoom(newZoom);
    showToast({ type: 'info', message: `🔍 Zoom: ${(newZoom * 100).toFixed(0)}%` });
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 0.2, 1);
    setZoom(newZoom);
    showToast({ type: 'info', message: `🔍 Zoom: ${(newZoom * 100).toFixed(0)}%` });
  };

  // Start recording
  const startRecording = () => {
    if (!stream) {
      showToast({ type: 'error', message: 'Camera not active' });
      return;
    }

    recordedChunksRef.current = [];
    
    try {
      const options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: streamSettings.bitrate * 1000
      };

      // Fallback mime types
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
      ];

      let selectedMimeType = null;
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }

      if (!selectedMimeType) {
        showToast({ type: 'error', message: 'Browser does not support video recording' });
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cockfight-${streamName}-${new Date().getTime()}.webm`;
        a.click();
        showToast({ type: 'success', message: '✅ Recording saved' });
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      showToast({ type: 'success', message: '🔴 Recording started' });
    } catch (err) {
      console.error('Error starting recording:', err);
      showToast({ type: 'error', message: 'Failed to start recording' });
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  // Recording timer
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  // Format time
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    const container = document.getElementById('camera-container');
    if (!document.fullscreenElement) {
      try {
        await container?.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Fullscreen error:', err);
      }
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Capture screenshot
  const captureScreenshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    const video = videoRef.current;
    canvasRef.current.width = video.videoWidth;
    canvasRef.current.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvasRef.current.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cockfight-screenshot-${new Date().getTime()}.png`;
      a.click();
      showToast({ type: 'success', message: '📸 Screenshot saved' });
    });
  };

  return (
    <div id="camera-container" className={`min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-50'} p-4 md:p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Camera size={32} className="text-red-600" />
              <div>
                <h1 className={`text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                  🐓 Live Cock Fight Camera
                </h1>
                <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Deployed by: {user?.name || user?.username}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
              title="Settings"
            >
              <Settings size={24} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Main Camera Area */}
        <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg overflow-hidden mb-6`}>
          {/* Video Feed */}
          <div className="relative bg-black aspect-video flex items-center justify-center">
            {!isStreaming ? (
              <div className="text-center">
                <Camera size={64} className="text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Camera not active</p>
                <p className="text-gray-600 text-sm mt-2">Click "Start Camera" to begin</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  disablePictureInPicture
                  style={{ 
                    display: 'block', 
                    width: '100%', 
                    height: '100%',
                    objectFit: 'cover',
                    backgroundColor: '#000',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center',
                    transition: 'transform 0.2s ease-out'
                  }}
                />
                
                {/* Recording indicator */}
                {isRecording && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full animate-pulse">
                    <Circle size={12} fill="white" />
                    <span className="font-semibold">Recording: {formatTime(recordingTime)}</span>
                  </div>
                )}

                {/* Fullscreen button */}
                <button
                  onClick={toggleFullscreen}
                  className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/75 rounded-lg transition text-white"
                >
                  {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>

                {/* Zoom controls */}
                <div className="absolute bottom-4 right-4 flex gap-2 bg-black/50 p-2 rounded-lg">
                  <button
                    onClick={handleZoomOut}
                    disabled={zoom <= 1}
                    className="p-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition text-white"
                    title="Zoom Out"
                  >
                    <ZoomOut size={20} />
                  </button>
                  <div className="flex items-center px-3 text-white text-sm font-semibold min-w-12">
                    {(zoom * 100).toFixed(0)}%
                  </div>
                  <button
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                    className="p-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition text-white"
                    title="Zoom In"
                  >
                    <ZoomIn size={20} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Control Panel */}
          <div className={`p-6 ${dark ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'}`}>
            {cameraError && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">
                {cameraError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Camera Selection */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select Camera
                </label>
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  disabled={isStreaming}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    dark
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } disabled:opacity-50`}
                >
                  {cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stream Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Stream Name
                </label>
                <input
                  type="text"
                  value={streamName}
                  onChange={(e) => setStreamName(e.target.value)}
                  disabled={isStreaming}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    dark
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } disabled:opacity-50`}
                />
              </div>
            </div>

            {/* Control Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={isStreaming ? stopCamera : startCamera}
                className={`py-2 px-4 rounded-lg font-medium transition text-white ${
                  isStreaming
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isStreaming ? '❌ Stop Camera' : '✅ Start Camera'}
              </button>

              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!isStreaming}
                className={`py-2 px-4 rounded-lg font-medium transition text-white ${
                  isRecording
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {isRecording ? '⏹ Stop Recording' : '🔴 Record'}
              </button>

              <button
                onClick={captureScreenshot}
                disabled={!isStreaming}
                className="py-2 px-4 rounded-lg font-medium bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition"
              >
                📸 Screenshot
              </button>

              <button
                onClick={toggleFullscreen}
                disabled={!isStreaming}
                className="py-2 px-4 rounded-lg font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition"
              >
                🖥 Fullscreen
              </button>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 mb-6`}>
            <h2 className={`text-xl font-bold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
              📋 Stream Settings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Video Quality */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Video Quality
                </label>
                <select
                  value={streamSettings.quality}
                  onChange={(e) => setStreamSettings({ ...streamSettings, quality: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    dark
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="480">480p</option>
                  <option value="720">720p (HD)</option>
                  <option value="1080">1080p (Full HD)</option>
                </select>
              </div>

              {/* Frame Rate */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Frame Rate (fps)
                </label>
                <input
                  type="number"
                  value={streamSettings.frameRate}
                  onChange={(e) => setStreamSettings({ ...streamSettings, frameRate: parseInt(e.target.value) })}
                  min="15"
                  max="60"
                  step="5"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    dark
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              {/* Bitrate */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Bitrate (kbps)
                </label>
                <input
                  type="number"
                  value={streamSettings.bitrate}
                  onChange={(e) => setStreamSettings({ ...streamSettings, bitrate: parseInt(e.target.value) })}
                  min="1000"
                  max="5000"
                  step="500"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    dark
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              {/* Broadcast */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={streamSettings.broadcast}
                  onChange={(e) => setStreamSettings({ ...streamSettings, broadcast: e.target.checked })}
                  id="broadcast-checkbox"
                  className="rounded"
                />
                <label
                  htmlFor="broadcast-checkbox"
                  className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Enable Public Broadcast
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Info Panel */}
        <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
          <h2 className={`text-lg font-bold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
            ℹ️ Camera Information
          </h2>
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
            <div>
              <span className="font-semibold">Status</span>
              <p className={isStreaming ? 'text-green-600 font-bold' : 'text-gray-500'}>
                {isStreaming ? '🟢 Active' : '⚫ Inactive'}
              </p>
            </div>
            <div>
              <span className="font-semibold">Recording</span>
              <p className={isRecording ? 'text-red-600 font-bold' : 'text-gray-500'}>
                {isRecording ? `🔴 ${formatTime(recordingTime)}` : '⚪ Off'}
              </p>
            </div>
            <div>
              <span className="font-semibold">Quality</span>
              <p>{streamSettings.quality}p</p>
            </div>
            <div>
              <span className="font-semibold">Frame Rate</span>
              <p>{streamSettings.frameRate} fps</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden canvas for screenshots */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
