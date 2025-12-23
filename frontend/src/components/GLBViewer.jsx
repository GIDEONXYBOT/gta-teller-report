import React, { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center, Grid, Environment } from '@react-three/drei';

function Model({ url, rotation }) {
  const { scene } = useGLTF(url);
  const meshRef = useRef();

  useEffect(() => {
    if (meshRef.current && rotation) {
      meshRef.current.rotation.x = (rotation.x * Math.PI) / 180;
      meshRef.current.rotation.y = (rotation.y * Math.PI) / 180;
      meshRef.current.rotation.z = (rotation.z * Math.PI) / 180;
    }
  }, [rotation]);

  return (
    <Center>
      <primitive ref={meshRef} object={scene} />
    </Center>
  );
}

function FallbackModel() {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.getElapsedTime() * 0.5;
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.3;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#4f46e5" wireframe />
    </mesh>
  );
}

export default function GLBViewer({ modelData, modelName, rotation = { x: 0, y: 0, z: 0 }, isDark = false }) {
  const [error, setError] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (!modelData) {
      setError(true);
      return;
    }

    try {
      // Convert base64 to blob URL
      const byteString = atob(modelData.split(',')[1]);
      const mimeString = modelData.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      setError(false);

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error('Failed to load GLB:', err);
      setError(true);
    }
  }, [modelData]);

  if (!modelData) {
    return (
      <div className={`w-full h-full flex items-center justify-center rounded border ${isDark ? 'bg-gray-900 border-gray-700 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>
        <div className="text-center">
          <p className="text-lg mb-2">📦 No 3D Model</p>
          <p className="text-sm">Upload a GLB or GLTF file</p>
        </div>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className={`w-full h-full flex items-center justify-center rounded border ${isDark ? 'bg-gray-900 border-gray-700 text-red-400' : 'bg-gray-100 border-gray-300 text-red-600'}`}>
        <div className="text-center">
          <p className="text-lg mb-2">⚠️ Failed to load model</p>
          <p className="text-sm">{modelName || 'Unknown file'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300'}`}>
      <Canvas
        camera={{ position: [5, 5, 5], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={<FallbackModel />}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} />
          <Model url={blobUrl} rotation={rotation} />
          <Grid args={[20, 20]} cellSize={0.5} cellThickness={0.5} cellColor="#6b7280" sectionSize={2} sectionThickness={1} sectionColor="#4b5563" fadeDistance={30} fadeStrength={1} infiniteGrid />
          <Environment preset="city" />
          <OrbitControls 
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            autoRotate={false}
            autoRotateSpeed={2}
          />
        </Suspense>
      </Canvas>
      {modelName && (
        <div className={`absolute top-2 left-2 px-3 py-1 rounded ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'} shadow text-sm`}>
          📦 {modelName}
        </div>
      )}
      <div className={`absolute bottom-2 left-2 px-3 py-1 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-600'} shadow text-xs`}>
        🖱️ Drag to rotate • Scroll to zoom • Right-click to pan
      </div>
    </div>
  );
}
