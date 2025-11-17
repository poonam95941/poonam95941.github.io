// script.js (module)
// IMPORTANT: this file uses ES module imports from unpkg (Three.js). Ensure you open index.html via a web server (Live Server)
// because some browsers restrict module imports from local file:// in certain setups.

import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';

// ----- UI behavior -----
const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');
if (navToggle) navToggle.addEventListener('click', () => nav.classList.toggle('show'));

document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('quoteForm');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Thank you! Your quote request was submitted. We will follow up via email.');
    form.reset();
  });
  document.getElementById('resetBtn').addEventListener('click', () => form.reset());
}

// ----- 3D scene setup -----
const canvas = document.getElementById('three-canvas');
const MOBILE_BREAKPOINT = 640;
const enable3D = window.innerWidth > MOBILE_BREAKPOINT && canvas;

if (!enable3D) {
  // lightweight fallback on small screens
  const threeWrap = document.getElementById('three-wrap');
  if (threeWrap) {
    threeWrap.style.background = 'linear-gradient(180deg,#0b1220,#071428)';
    threeWrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-weight:600">3D preview disabled on small screens</div>';
  }
} else {
  initThree();
}

function initThree() {
  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  // Set initial renderer size using canvas client rect
  const resizeRendererToDisplaySize = () => {
    const width = canvas.clientWidth || canvas.parentElement.clientWidth;
    const height = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
    }
  };
  resizeRendererToDisplaySize();

  const scene = new THREE.Scene();

  // Camera
  const fov = 40;
  const camera = new THREE.PerspectiveCamera(fov, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.set(0, 6, 18);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.9;

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.85);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(10, 20, 10);
  scene.add(dir);

  // Ground plane (subtle)
  const groundGeo = new THREE.PlaneGeometry(80, 60, 2, 2);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x071025, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  scene.add(ground);

  // ---------- Globe ----------
  const globeGroup = new THREE.Group();
  globeGroup.position.set(-5, 1.5, 0);
  scene.add(globeGroup);

  const sphereGeo = new THREE.SphereGeometry(4, 64, 32);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0x0c3b66,
    metalness: 0.05,
    roughness: 0.7,
    emissive: 0x00121a,
  });
  const globe = new THREE.Mesh(sphereGeo, sphereMat);
  globeGroup.add(globe);

  // Add lat/long rings (subtle)
  const ringMat = new THREE.LineBasicMaterial({ color: 0x0f3f5f, linewidth: 1, transparent: true, opacity: 0.6 });
  for (let i = -3; i <= 3; i++) {
    const latRadius = 4 * Math.cos(i * 0.3);
    const lat = new THREE.CircleGeometry(latRadius, 128);
    // remove last vertex duplicate
    lat.vertices && lat.vertices.pop && lat.vertices.pop();
    const latLine = new THREE.Line(lat, ringMat);
    latLine.rotateX(Math.PI / 2 - i * 0.1);
    globeGroup.add(latLine);
  }

  // Port markers
  const markerGeo = new THREE.SphereGeometry(0.08, 8, 6);
  const markerMat = new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0x332000 });
  const ports = [
    { lon: 72.8, lat: 19.0 },   // Mumbai
    { lon: 121.5, lat: 31.2 },  // Shanghai
    { lon: -74.0, lat: 40.7 },  // New York
    { lon: 2.35, lat: 48.85 },  // Paris
    { lon: 31.2, lat: 30.0 },   // Cairo
  ];
  ports.forEach(p => {
    const m = new THREE.Mesh(markerGeo, markerMat);
    const pos = latLonToVector3(p.lat, p.lon, 4.02);
    m.position.copy(pos);
    globeGroup.add(m);
  });

  // ---------- Trade routes (curved tubes) ----------
  const routeMat = new THREE.MeshBasicMaterial({ color: 0xffd59e, transparent: true, opacity: 0.9 });
  const routePairs = [
    [{ lat: 19.0, lon: 72.8 }, { lat: 48.85, lon: 2.35 }],   // Mumbai -> Paris
    [{ lat: 31.2, lon: 121.5 }, { lat: 40.7, lon: -74.0 }],  // Shanghai -> New York
    [{ lat: 19.0, lon: 72.8 }, { lat: 30.0, lon: 31.2 }],    // Mumbai -> Cairo
  ];
  const routeCurves = [];
  routePairs.forEach(pair => {
    const a = latLonToVector3(pair[0].lat, pair[0].lon, 4.02);
    const b = latLonToVector3(pair[1].lat, pair[1].lon, 4.02);
    const mid = a.clone().lerp(b, 0.5).multiplyScalar(1.25); // arc outwards
    const curve = new THREE.CatmullRomCurve3([a, mid, b]);
    routeCurves.push(curve);
    const tube = new THREE.TubeGeometry(curve, 120, 0.03, 8, false);
    const mesh = new THREE.Mesh(tube, routeMat);
    globeGroup.add(mesh);
  });

  // moving shipments along routes
  const shipmentMat = new THREE.MeshStandardMaterial({ color: 0xff6b6b, emissive: 0x220000 });
  const shipments = routeCurves.map(curve => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), shipmentMat);
    s.userData = { curve, t: Math.random() * 1 };
    globeGroup.add(s);
    return s;
  });

  // ---------- Truck & Road ----------
  const truckGroup = new THREE.Group();
  truckGroup.position.set(6, 0.4, -2);
  scene.add(truckGroup);

  // truck body
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 1.3), new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.2, roughness: 0.4 }));
  body.position.y = 0.6;
  truckGroup.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: 0xff6b6b, metalness: 0.2, roughness: 0.4 }));
  cabin.position.set(1.05, 0.55, 0);
  truckGroup.add(cabin);

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.4, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, metalness: 0.1, roughness: 0.8 });
  const wheelPositions = [
    [-1.0, 0.2, 0.6],
    [-1.0, 0.2, -0.6],
    [0.3, 0.2, 0.6],
    [0.3, 0.2, -0.6],
  ];
  wheelPositions.forEach(pos => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(...pos);
    truckGroup.add(w);
  });

  // truck path
  const truckPathPoints = [
    new THREE.Vector3(8, 0.4, -10),
    new THREE.Vector3(6, 0.4, -4),
    new THREE.Vector3(4, 0.4, -1.5),
    new THREE.Vector3(2, 0.4, 1.5),
    new THREE.Vector3(-1, 0.4, 4),
    new THREE.Vector3(-4, 0.4, 6),
    new THREE.Vector3(-8, 0.4, 8),
  ];
  const truckCurve = new THREE.CatmullRomCurve3(truckPathPoints);
  const roadGeo = new THREE.TubeGeometry(truckCurve, 200, 0.12, 6, false);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x0c3150, roughness: 1 });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  scene.add(roadMesh);

  // dashed centerline for road (line)
  const roadPoints = truckCurve.getPoints(200);
  const dashGeom = new THREE.BufferGeometry().setFromPoints(roadPoints);
  const dashMat = new THREE.LineDashedMaterial({ color: 0xfff3d6, dashSize: 0.6, gapSize: 0.6, linewidth: 1 });
  const roadLine = new THREE.Line(dashGeom, dashMat);
  roadLine.computeLineDistances();
  scene.add(roadLine);

  // particles
  const particleCount = 220;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 1] = Math.random() * 6 + 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({ size: 0.06, transparent: true, opacity: 0.85 });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Raycaster for clicks
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let truckInfoShown = false;

  function onPointerDown(ev) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(truckGroup, true);
    if (intersects.length) {
      if (!truckInfoShown) {
        truckInfoShown = true;
        alert('Truck in transit — ETA: 3 days. Mode: Road transport.');
        setTimeout(() => (truckInfoShown = false), 2000);
      }
    }
  }
  canvas.addEventListener('pointerdown', onPointerDown);

  // ---------- Resize handling ----------
  function onWindowResize() {
    // Update camera and renderer sizes
    const width = canvas.clientWidth || canvas.parentElement.clientWidth;
    const height = canvas.clientHeight || canvas.parentElement.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', onWindowResize, { passive: true });

  // ensure the canvas sized correctly initially
  function setInitialCanvasSize() {
    // make sure parent (#three-wrap) has layout size
    const parent = canvas.parentElement;
    if (parent) {
      // use computed size of the wrap to set canvas client size
      const parentRect = parent.getBoundingClientRect();
      canvas.style.width = parentRect.width + 'px';
      canvas.style.height = parentRect.height + 'px';
    }
    onWindowResize();
  }
  // call once after a small delay to allow layout to settle
  setTimeout(setInitialCanvasSize, 50);

  // ---------- Animation loop ----------
  let clock = 0;
  let truckT = 0;
  function animate() {
    clock += 0.015;

    // globe rotate & bob
    globe.rotation.y += 0.003 + 0.001 * Math.sin(clock * 0.6);
    globe.rotation.x = Math.sin(clock * 0.08) * 0.02;
    globeGroup.position.y = 1.5 + Math.sin(clock * 0.6) * 0.06;

    // shipments along routes
    shipments.forEach(s => {
      s.userData.t += 0.002 + Math.random() * 0.002;
      if (s.userData.t > 1) s.userData.t = 0;
      const pos = s.userData.curve.getPointAt(s.userData.t);
      s.position.copy(pos);
      // face forward
      const next = s.userData.curve.getPointAt((s.userData.t + 0.02) % 1);
      s.lookAt(next);
    });

    // truck movement
    truckT += 0.0009 * (1 + Math.sin(clock * 0.6) * 0.5);
    if (truckT > 1) truckT = 0;
    const truckPos = truckCurve.getPointAt(truckT);
    truckGroup.position.copy(truckPos);
    // align to tangent
    const tangent = truckCurve.getTangentAt(truckT).normalize();
    const angle = Math.atan2(tangent.x, tangent.z);
    truckGroup.rotation.y = angle;

    // wheel spin
    truckGroup.children.forEach(child => {
      if (child.geometry && child.geometry.type === 'CylinderGeometry') {
        child.rotation.x -= 0.18;
      }
    });

    // particles drift
    const posAttr = particleGeo.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      let idx = i * 3;
      posAttr[idx] += 0.02;
      if (posAttr[idx] > 40) posAttr[idx] = -40;
    }
    particleGeo.attributes.position.needsUpdate = true;

    controls.update();
    resizeRendererToDisplaySize();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
}

// ---------- helper: lat/lon to vector3 ----------
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}


// ===== Track Shipment Simulation =====
document.getElementById("track-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const trackType = document.getElementById("trackType").value;
  const trackInput = document.getElementById("trackInput").value.trim();
  const resultDiv = document.getElementById("tracking-result");

  if (!trackType || !trackInput) {
    resultDiv.innerHTML = `<p style="color:red;">Please fill out all fields.</p>`;
    return;
  }

  // Simulated response (in real case, API call would go here)
  resultDiv.innerHTML = `
    <div class="tracking-card">
      <h3>Tracking Details</h3>
      <p><strong>Type:</strong> ${trackType.replace("-", " ").toUpperCase()}</p>
      <p><strong>Number:</strong> ${trackInput}</p>
      <p><strong>Status:</strong> In Transit 🚚</p>
      <p><strong>Last Update:</strong> Mumbai Hub - 2 hours ago</p>
      <p><strong>Expected Delivery:</strong> 2 Nov 2025</p>
    </div>
  `;
});


window.addEventListener("load", () => {
    const video = document.getElementById("bgVideo");
    if (video) {
      video.playbackRate = 0.5; // Slow down video to half speed
    }
  });



  const truck = document.getElementById("truck");
  const ship = document.getElementById("ship");
  const plane = document.getElementById("plane");

  function animateTransport() {
    const time = Date.now() * 0.001;

    // Truck moves left to right on bottom path
    truck.setAttribute("transform", `translate(${(time * 60) % 850 - 50}, 0)`);

    // Ship moves slowly across the middle path
    ship.setAttribute("transform", `translate(${(time * 30) % 860 - 60}, 0)`);

    // Plane flies across top path faster
    plane.setAttribute("transform", `translate(${(time * 120) % 860 - 60}, 0)`);

    requestAnimationFrame(animateTransport);
  }

  animateTransport();




import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('about-3d-bg').appendChild(renderer.domElement);

// Lights
const light = new THREE.PointLight(0xffb703, 1.2);
light.position.set(5, 5, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

// Create floating boxes to represent cargo containers
const boxGeometry = new THREE.BoxGeometry(1, 1, 2);
const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.5, roughness: 0.4 });

const boxes = [];
for (let i = 0; i < 20; i++) {
  const box = new THREE.Mesh(boxGeometry, boxMaterial);
  box.position.set((Math.random() - 0.5) * 10, Math.random() * 5, (Math.random() - 0.5) * 8);
  scene.add(box);
  boxes.push(box);
}

camera.position.z = 7;

function animate() {
  requestAnimationFrame(animate);
  boxes.forEach(box => {
    box.rotation.x += 0.005;
    box.rotation.y += 0.008;
  });
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


