import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import * as THREE from 'three'

// ── Geometry helpers (ported from prime-radiant_1.html) ──

function getEdges(geometry) {
  const pos = geometry.getAttribute('position')
  const idx = geometry.getIndex()
  const edgeSet = new Set()
  const triCount = idx ? idx.count / 3 : pos.count / 3

  for (let i = 0; i < triCount; i++) {
    const a = idx ? idx.getX(i * 3) : i * 3
    const b = idx ? idx.getX(i * 3 + 1) : i * 3 + 1
    const c = idx ? idx.getX(i * 3 + 2) : i * 3 + 2
    ;[[a, b], [b, c], [a, c]].forEach(([v1, v2]) => {
      const p1 = [pos.getX(v1).toFixed(4), pos.getY(v1).toFixed(4), pos.getZ(v1).toFixed(4)].join(',')
      const p2 = [pos.getX(v2).toFixed(4), pos.getY(v2).toFixed(4), pos.getZ(v2).toFixed(4)].join(',')
      const key = p1 < p2 ? p1 + '|' + p2 : p2 + '|' + p1
      edgeSet.add(key)
    })
  }

  const edges = []
  edgeSet.forEach(key => {
    const [k1, k2] = key.split('|')
    const [x1, y1, z1] = k1.split(',').map(Number)
    const [x2, y2, z2] = k2.split(',').map(Number)
    edges.push([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)])
  })
  return edges
}

function createStruts(geometry, material, radius, parent) {
  const edges = getEdges(geometry)

  edges.forEach(([v1, v2]) => {
    const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5)
    const dir = new THREE.Vector3().subVectors(v2, v1)
    const len = dir.length()

    const cylGeo = new THREE.CylinderGeometry(radius, radius, len, 6, 1)
    const cyl = new THREE.Mesh(cylGeo, material)
    cyl.position.copy(mid)
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    parent.add(cyl)
  })
}

function createDashedEdges(geometry, material, parent) {
  const edges = getEdges(geometry)

  edges.forEach(([v1, v2]) => {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([v1, v2])
    const line = new THREE.Line(lineGeo, material.clone())
    line.computeLineDistances()
    parent.add(line)
  })
}

function createVertexNodes(geometry, material, radius, parent) {
  const pos = geometry.getAttribute('position')
  const seen = new Set()
  const sphereGeo = new THREE.SphereGeometry(radius, 8, 8)

  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)
    const node = new THREE.Mesh(sphereGeo, material)
    node.position.set(pos.getX(i), pos.getY(i), pos.getZ(i))
    parent.add(node)
  }
}

// Build the full Prime Radiant geometry group
function buildRadiantGroup(opts = {}) {
  const { particles = false, strutScale = 1 } = opts
  const group = new THREE.Group()

  // Materials — tuned for vibrant gold at small canvas sizes
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.7,
    roughness: 0.25,
    emissive: 0xd4af37,
    emissiveIntensity: 0.45,
  })

  const goldWireMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.65,
    roughness: 0.3,
    emissive: 0xffd700,
    emissiveIntensity: 0.5,
  })

  const innerGoldMat = new THREE.MeshStandardMaterial({
    color: 0xffe680,
    metalness: 0.6,
    roughness: 0.3,
    emissive: 0xffe680,
    emissiveIntensity: 0.55,
  })

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e1,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  })

  const dashedLineMat = new THREE.LineDashedMaterial({
    color: 0xffd700,
    dashSize: 0.04,
    gapSize: 0.03,
    opacity: 0.6,
    transparent: true,
  })

  const glowLineMat = new THREE.LineBasicMaterial({
    color: 0xd4af37,
    opacity: 0.35,
    transparent: true,
  })

  // Layer 1: Outer Icosahedron Shell (glass + dashed edges)
  const outerIcoGeo = new THREE.IcosahedronGeometry(1.6, 0)
  const outerShell = new THREE.Mesh(outerIcoGeo, glassMat)
  group.add(outerShell)
  createDashedEdges(outerIcoGeo, dashedLineMat, group)

  // Layer 2: Mid Icosahedron (gold struts)
  const midIcoGeo = new THREE.IcosahedronGeometry(1.35, 0)
  createStruts(midIcoGeo, goldMat, 0.018 * strutScale, group)
  createVertexNodes(midIcoGeo, goldWireMat, 0.035 * strutScale, group)

  // Layer 3: Inner Dodecahedron (gold struts)
  const innerDodGeo = new THREE.DodecahedronGeometry(1.0, 0)
  createStruts(innerDodGeo, goldWireMat, 0.014 * strutScale, group)
  createVertexNodes(innerDodGeo, innerGoldMat, 0.028 * strutScale, group)

  // Layer 4: Inner Icosahedron
  const innerIcoGeo = new THREE.IcosahedronGeometry(0.7, 0)
  createStruts(innerIcoGeo, innerGoldMat, 0.012 * strutScale, group)
  createDashedEdges(innerIcoGeo, dashedLineMat, group)

  // Layer 5: Core Octahedron
  const coreGeo = new THREE.OctahedronGeometry(0.4, 0)
  createStruts(coreGeo, goldMat, 0.016 * strutScale, group)
  createVertexNodes(coreGeo, goldWireMat, 0.032 * strutScale, group)

  // Layer 6: Innermost Cube
  const cubeGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32)
  const cubeEdges = new THREE.EdgesGeometry(cubeGeo)
  const cubeLine = new THREE.LineSegments(cubeEdges, new THREE.LineBasicMaterial({
    color: 0xffd700,
    opacity: 0.7,
    transparent: true,
  }))
  group.add(cubeLine)

  // Connecting Radial Struts (mid icosahedron vertices → core)
  const outerPos = midIcoGeo.getAttribute('position')
  const seen = new Set()
  for (let i = 0; i < outerPos.count; i++) {
    const x = parseFloat(outerPos.getX(i).toFixed(3))
    const y = parseFloat(outerPos.getY(i).toFixed(3))
    const z = parseFloat(outerPos.getZ(i).toFixed(3))
    const key = `${x},${y},${z}`
    if (seen.has(key)) continue
    seen.add(key)
    const v = new THREE.Vector3(x, y, z)
    const inner = v.clone().multiplyScalar(0.25)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([v, inner])
    const line = new THREE.Line(lineGeo, glowLineMat)
    group.add(line)
  }

  // Optional particle field (for full-size version)
  let particleMat = null
  if (particles) {
    const particleCount = 120
    const particleGeo = new THREE.BufferGeometry()
    const pPositions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 1.0 + Math.random() * 0.55
      pPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pPositions[i * 3 + 2] = r * Math.cos(phi)
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
    particleMat = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.012,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    })
    const particlePoints = new THREE.Points(particleGeo, particleMat)
    group.add(particlePoints)
  }

  return { group, goldMat, innerGoldMat, particleMat }
}

// ── Default rotation speeds ──
const BASE_ROT_X = 0.01
const BASE_ROT_Y = 0.015
const FRICTION = 0.96 // momentum decay per frame

// ── React component ──

const PrimeRadiant = forwardRef(function PrimeRadiant(
  { size = 28, fps = 30, particles = false, strutScale = 1, brightness = 1, interactive = false, onGlowChange },
  ref
) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const interactRef = useRef({
    paused: false,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    prevX: 0,
    prevY: 0,
    velX: 0, // extra velocity on top of base rotation
    velY: 0,
    didDrag: false, // distinguish drag from click
  })

  // Expose pause/resume via ref
  useImperativeHandle(ref, () => ({
    togglePause: () => {
      interactRef.current.paused = !interactRef.current.paused
    },
  }), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const px = Math.min(window.devicePixelRatio, 2)
    const w = size
    const h = size

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    renderer.setSize(w, h)
    renderer.setPixelRatio(px)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2 + 0.6 * brightness

    // Scene
    const scene = new THREE.Scene()

    // Camera
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = 4.5

    // Lighting — scaled by brightness prop
    const b = brightness
    scene.add(new THREE.AmbientLight(0x332200, 0.5 + 0.5 * b))

    const keyLight = new THREE.PointLight(0xffd700, 2.5 * b + 1.5, 25)
    keyLight.position.set(3, 3, 4)
    scene.add(keyLight)

    const fillLight = new THREE.PointLight(0xffd700, 1.5 * b + 1.0, 20)
    fillLight.position.set(-3, -1, 3)
    scene.add(fillLight)

    const rimLight = new THREE.PointLight(0xffe08a, 2.0 * b + 1.0, 20)
    rimLight.position.set(0, -3, -3)
    scene.add(rimLight)

    const topLight = new THREE.PointLight(0xfff1c1, 1.2 * b + 0.8, 15)
    topLight.position.set(0, 4, 0)
    scene.add(topLight)

    // Build geometry
    const { group, goldMat, innerGoldMat, particleMat } = buildRadiantGroup({ particles, strutScale })
    scene.add(group)

    stateRef.current = {
      renderer, scene, camera, group,
      goldMat, innerGoldMat, particleMat,
      keyLight, fillLight, rimLight,
    }

    // Render loop at target fps
    const interval = 1000 / fps
    let lastTime = 0
    let animId = null
    let lastGlowState = false

    function animate(time) {
      animId = requestAnimationFrame(animate)
      if (time - lastTime < interval) return
      lastTime = time

      const t = time * 0.001
      const ix = interactRef.current

      if (!ix.paused || ix.dragging) {
        if (!ix.dragging) {
          // Apply momentum friction — decay extra velocity toward zero
          ix.velX *= FRICTION
          ix.velY *= FRICTION
          if (Math.abs(ix.velX) < 0.0001) ix.velX = 0
          if (Math.abs(ix.velY) < 0.0001) ix.velY = 0
        }

        if (!ix.paused) {
          // Base rotation + extra velocity
          group.rotation.x += BASE_ROT_X + ix.velX
          group.rotation.y += BASE_ROT_Y + ix.velY
        } else if (ix.dragging) {
          // When paused but dragging, only apply drag velocity
          group.rotation.x += ix.velX
          group.rotation.y += ix.velY
        }
      }

      // Glow state: spinning faster than default
      const speed = Math.abs(BASE_ROT_X + ix.velX) + Math.abs(BASE_ROT_Y + ix.velY)
      const baseSpeed = BASE_ROT_X + BASE_ROT_Y
      const isGlowing = speed > baseSpeed * 1.5
      if (isGlowing !== lastGlowState) {
        lastGlowState = isGlowing
        onGlowChange?.(isGlowing, speed / baseSpeed)
      }
      // Continuously report glow intensity while glowing
      if (isGlowing) {
        onGlowChange?.(true, speed / baseSpeed)
      }

      // Animate lights subtly
      keyLight.position.x = Math.sin(t * 0.5) * 4
      keyLight.position.z = Math.cos(t * 0.5) * 5
      fillLight.position.y = Math.sin(t * 0.3) * 3
      rimLight.position.x = Math.cos(t * 0.4) * 4

      // Pulse emissive
      const pulse = 0.45 + Math.sin(t * 2) * 0.15
      goldMat.emissiveIntensity = pulse
      innerGoldMat.emissiveIntensity = pulse + 0.15

      // Particle shimmer
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
  }, [size, fps, particles, strutScale, brightness, onGlowChange])

  // Interaction handlers
  const handleMouseDown = useCallback((e) => {
    if (!interactive) return
    e.preventDefault()
    const ix = interactRef.current
    ix.dragging = true
    ix.didDrag = false
    ix.dragStartX = e.clientX
    ix.dragStartY = e.clientY
    ix.prevX = e.clientX
    ix.prevY = e.clientY
    ix.velX = 0
    ix.velY = 0
  }, [interactive])

  const handleMouseMove = useCallback((e) => {
    const ix = interactRef.current
    if (!ix.dragging) return
    const dx = e.clientX - ix.prevX
    const dy = e.clientY - ix.prevY
    if (Math.abs(e.clientX - ix.dragStartX) > 3 || Math.abs(e.clientY - ix.dragStartY) > 3) {
      ix.didDrag = true
    }
    ix.velX = dy * 0.008
    ix.velY = dx * 0.008
    const group = stateRef.current?.group
    if (group) {
      group.rotation.x += ix.velX
      group.rotation.y += ix.velY
    }
    ix.prevX = e.clientX
    ix.prevY = e.clientY
  }, [])

  const handleMouseUp = useCallback(() => {
    const ix = interactRef.current
    if (!ix.dragging) return
    ix.dragging = false
    // If it was a click (no drag), toggle pause
    if (!ix.didDrag) {
      ix.paused = !ix.paused
      if (ix.paused) {
        ix.velX = 0
        ix.velY = 0
        onGlowChange?.(false, 1)
      }
    }
    // Momentum: velX/velY retain their last values and decay in the animation loop
  }, [onGlowChange])

  useEffect(() => {
    if (!interactive) return
    const onUp = () => handleMouseUp()
    const onMove = (e) => handleMouseMove(e)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [interactive, handleMouseMove, handleMouseUp])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      onMouseDown={handleMouseDown}
      style={{
        width: size,
        height: size,
        display: 'block',
        flexShrink: 0,
        cursor: interactive ? 'grab' : 'default',
      }}
    />
  )
})

export default PrimeRadiant

// Export builder for boot screen (which manages its own canvas/lifecycle)
export { buildRadiantGroup }
