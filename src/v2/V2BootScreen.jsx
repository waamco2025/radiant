import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { buildRadiantGroup } from './PrimeRadiant.jsx'

const BOOT_DURATION = 2800 // ms before fade starts
const FADE_DURATION = 600  // ms fade out

export default function V2BootScreen({ onComplete }) {
  const canvasRef = useRef(null)
  const [phase, setPhase] = useState('boot') // boot | fading | done
  const [bootText, setBootText] = useState('Initializing node explorer...')

  // Boot text sequence
  useEffect(() => {
    const t1 = setTimeout(() => setBootText('Loading supply chain graph...'), 900)
    const t2 = setTimeout(() => setBootText('Establishing network connection...'), 1800)
    const t3 = setTimeout(() => setPhase('fading'), BOOT_DURATION)
    const t4 = setTimeout(() => {
      setPhase('done')
      onComplete()
    }, BOOT_DURATION + FADE_DURATION)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [onComplete])

  // Three.js scene for the large centered radiant
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const px = Math.min(window.devicePixelRatio, 2)
    const w = 280
    const h = 280

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    renderer.setSize(w, h)
    renderer.setPixelRatio(px)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.8

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = 4.5

    // Lighting — boosted for vibrant gold
    scene.add(new THREE.AmbientLight(0x332200, 1.0))

    const keyLight = new THREE.PointLight(0xffd700, 4.0, 25)
    keyLight.position.set(3, 3, 4)
    scene.add(keyLight)

    const fillLight = new THREE.PointLight(0xffd700, 2.5, 20)
    fillLight.position.set(-3, -1, 3)
    scene.add(fillLight)

    const rimLight = new THREE.PointLight(0xffe08a, 3.0, 20)
    rimLight.position.set(0, -3, -3)
    scene.add(rimLight)

    const topLight = new THREE.PointLight(0xfff1c1, 2.0, 15)
    topLight.position.set(0, 4, 0)
    scene.add(topLight)

    const { group, goldMat, innerGoldMat, particleMat } = buildRadiantGroup({ particles: true })
    scene.add(group)

    let animId = null
    function animate(time) {
      animId = requestAnimationFrame(animate)
      const t = time * 0.001

      group.rotation.x += 0.003
      group.rotation.y += 0.005

      keyLight.position.x = Math.sin(t * 0.5) * 4
      keyLight.position.z = Math.cos(t * 0.5) * 5
      fillLight.position.y = Math.sin(t * 0.3) * 3
      rimLight.position.x = Math.cos(t * 0.4) * 4

      const pulse = 0.45 + Math.sin(t * 2) * 0.15
      goldMat.emissiveIntensity = pulse
      innerGoldMat.emissiveIntensity = pulse + 0.15

      if (particleMat) {
        particleMat.opacity = 0.3 + Math.sin(t * 1.5) * 0.2
      }

      renderer.render(scene, camera)
    }
    animId = requestAnimationFrame(animate)

    return () => {
      if (animId) cancelAnimationFrame(animId)
      renderer.dispose()
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else obj.material.dispose()
        }
      })
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0c10',
      opacity: phase === 'fading' ? 0 : 1,
      transition: `opacity ${FADE_DURATION}ms ease`,
      pointerEvents: phase === 'fading' ? 'none' : 'auto',
    }}>
      {/* Glow behind the radiant */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <canvas
        ref={canvasRef}
        width={280}
        height={280}
        style={{
          width: 280,
          height: 280,
          display: 'block',
        }}
      />

      {/* RADIANT logotype */}
      <div style={{
        marginTop: 24,
        fontFamily: 'var(--font-display, Georgia, serif)',
        fontWeight: 700,
        fontSize: 18,
        letterSpacing: '0.18em',
        color: 'rgba(212, 175, 55, 0.7)',
        textTransform: 'uppercase',
      }}>
        RADIANT
      </div>

      {/* Boot text */}
      <div style={{
        marginTop: 16,
        fontFamily: 'var(--font-mono, "Courier New", monospace)',
        fontSize: 11,
        letterSpacing: '0.04em',
        color: 'rgba(255, 255, 255, 0.3)',
      }}>
        {bootText}
      </div>

      {/* Subtle progress indicator */}
      <div style={{
        marginTop: 20,
        width: 120,
        height: 1,
        background: 'rgba(212, 175, 55, 0.15)',
        borderRadius: 1,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          background: 'rgba(212, 175, 55, 0.5)',
          borderRadius: 1,
          animation: 'boot-progress 2.8s ease forwards',
        }} />
      </div>

      <style>{`
        @keyframes boot-progress {
          0% { width: 0%; }
          30% { width: 25%; }
          60% { width: 60%; }
          85% { width: 85%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}
