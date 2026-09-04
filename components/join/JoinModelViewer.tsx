'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Float } from '@react-three/drei';

function Model() {
  // Load the Curiosity Rover GLB file from public/models
  const { scene } = useGLTF('/models/curiosity_v4_semantic_external.glb');
  
  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <primitive object={scene} scale={2} position={[0, -1, 0]} rotation={[0, Math.PI / 4, 0]} />
    </Float>
  );
}

export function JoinModelViewer() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 5 }}>
      <Canvas camera={{ position: [5, 2, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Environment preset="city" />
        
        <Suspense fallback={null}>
          <Model />
        </Suspense>

        <OrbitControls 
          enableZoom={true} 
          enablePan={false}
          autoRotate={true}
          autoRotateSpeed={1}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>
    </div>
  );
}

// Preload the model to prevent popping
useGLTF.preload('/models/curiosity_v4_semantic_external.glb');
