import React, { useState, useEffect, useContext, useRef } from 'react';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { Camera, Download, RotateCcw } from 'lucide-react';

export default function BettingCaptureScreen() {
  const { settings, user } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const streamRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [captureImage, setCaptureImage] = useState(null);
  
  // Betting controls
  const [selectedBet, setSelectedBet] = useState(null);
  
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

  // Ensure video plays when stream is set
  useEffect(() => {
    if (!videoRef.current || !stream) return;

    console.log('🎬 Setting stream to video element...');
    videoRef.current.srcObject = stream;
    
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('✅ Video playing successfully');
        })
        .catch(err => {
          console.error('❌ Auto-play failed:', err);
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
          width: { ideal: 1920 },
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Media stream acquired');
      
      streamRef.current = mediaStream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
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
    setCaptureImage(null);
    showToast({ type: 'info', message: '📷 Camera stopped' });
  };

  // Capture screenshot with bet label
  const captureScreenshot = () => {
    if (!videoRef.current) {
      showToast({ type: 'error', message: 'Camera not active' });
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame
    ctx.drawImage(video, 0, 0);

    // Add semi-transparent overlay with bet label
    if (selectedBet) {
      // Large background for label
      ctx.fillStyle = selectedBet === 'meron' 
        ? 'rgba(220, 38, 38, 0.85)'  // Red for Meron
        : 'rgba(37, 99, 235, 0.85)';  // Blue for Wala
      
      const labelY = canvas.height * 0.05;
      const labelHeight = canvas.height * 0.15;
      ctx.fillRect(0, labelY, canvas.width, labelHeight);

      // Draw label text
      ctx.font = `bold ${canvas.height * 0.12}px Arial`;
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const labelText = selectedBet === 'meron' ? 'MERON' : 'WALA';
      ctx.fillText(labelText, canvas.width / 2, labelY + labelHeight / 2);

      // Add timestamp
      ctx.font = `${canvas.height * 0.04}px Arial`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.textAlign = 'right';
      const timestamp = new Date().toLocaleTimeString();
      ctx.fillText(timestamp, canvas.width - 20, canvas.height - 20);
    }

    const imageData = canvas.toDataURL('image/png');
    setCaptureImage(imageData);
    showToast({ type: 'success', message: '📸 Screenshot captured' });
  };

  // Download captured image
  const downloadCapture = () => {
    if (!captureImage) {
      showToast({ type: 'error', message: 'No capture available' });
      return;
    }

    const link = document.createElement('a');
    link.href = captureImage;
    link.download = `cockfight-${selectedBet}-${new Date().getTime()}.png`;
    link.click();
    showToast({ type: 'success', message: '✅ Image saved' });
  };

  // Reset capture
  const resetCapture = () => {
    setCaptureImage(null);
    setSelectedBet(null);
  };

  return (
    <div className={`min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-50'} p-4 md:p-6`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Camera size={32} className="text-red-600" />
            <div>
              <h1 className={`text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                🐓 Betting Capture Screen
              </h1>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                Full screen capture with Meron/Wala labels - Deployed by: {user?.name || user?.username}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main View */}
          <div className="lg:col-span-2">
            <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg overflow-hidden`}>
              {/* Camera Feed or Capture Preview */}
              <div className="relative bg-black w-full aspect-video flex items-center justify-center">
                {captureImage ? (
                  <img
                    src={captureImage}
                    alt="Capture"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : !isStreaming ? (
                  <div className="text-center">
                    <Camera size={64} className="text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">Camera not active</p>
                    <p className="text-gray-600 text-sm mt-2">Click "Start Camera" to begin</p>
                  </div>
                ) : (
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
                      backgroundColor: '#000'
                    }}
                  />
                )}
              </div>

              {/* Preview Info */}
              {captureImage && selectedBet && (
                <div className={`p-4 ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`px-4 py-2 rounded-lg font-bold text-white ${
                      selectedBet === 'meron' ? 'bg-red-600' : 'bg-blue-600'
                    }`}>
                      {selectedBet === 'meron' ? '🐓 MERON' : '❌ WALA'}
                    </span>
                    <span className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {new Date().toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Control Panel */}
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h2 className={`text-xl font-bold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
              Controls
            </h2>

            {cameraError && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
                {cameraError}
              </div>
            )}

            {/* Camera Selection */}
            <div className="mb-4">
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
                } disabled:opacity-50 text-sm`}
              >
                {cameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Start/Stop Camera */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={startCamera}
                disabled={isStreaming}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition text-white ${
                  isStreaming
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                Start
              </button>
              <button
                onClick={stopCamera}
                disabled={!isStreaming}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition text-white ${
                  !isStreaming
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Stop
              </button>
            </div>

            {/* Bet Selection */}
            {isStreaming && !captureImage && (
              <div className="mb-4">
                <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select Bet
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setSelectedBet('meron')}
                    className={`flex-1 px-4 py-3 rounded-lg font-bold transition text-white ${
                      selectedBet === 'meron'
                        ? 'bg-red-600 ring-2 ring-red-400'
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    🐓 MERON
                  </button>
                  <button
                    onClick={() => setSelectedBet('wala')}
                    className={`flex-1 px-4 py-3 rounded-lg font-bold transition text-white ${
                      selectedBet === 'wala'
                        ? 'bg-blue-600 ring-2 ring-blue-400'
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    ❌ WALA
                  </button>
                </div>

                {/* Capture Button */}
                <button
                  onClick={captureScreenshot}
                  disabled={!selectedBet || captureImage}
                  className={`w-full px-4 py-3 rounded-lg font-bold transition text-white flex items-center justify-center gap-2 ${
                    !selectedBet || captureImage
                      ? 'bg-gray-500 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  <Camera size={20} />
                  Capture
                </button>
              </div>
            )}

            {/* Capture Actions */}
            {captureImage && (
              <div className="flex gap-2">
                <button
                  onClick={downloadCapture}
                  className="flex-1 px-4 py-3 rounded-lg font-bold transition text-white bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  Download
                </button>
                <button
                  onClick={resetCapture}
                  className="flex-1 px-4 py-3 rounded-lg font-bold transition text-white bg-gray-600 hover:bg-gray-700 flex items-center justify-center gap-2"
                >
                  <RotateCcw size={20} />
                  Reset
                </button>
              </div>
            )}

            {/* Info Box */}
            <div className={`mt-4 p-4 rounded-lg text-sm ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <p className={`${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                <strong>MERON:</strong> The favorite side - typically gets smaller payout
              </p>
              <p className={`${dark ? 'text-gray-300' : 'text-gray-600'} mt-2`}>
                <strong>WALA:</strong> The underdog side - typically gets larger payout
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
