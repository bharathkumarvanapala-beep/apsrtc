// frontend/js/three-corridor.js - APSRTC SmartTrack 3D Digital Twin (Vanilla JS + Three.js)

(function () {
  let scene, camera, renderer, controls;
  let terrainMesh, roadLineMesh, roadSurfaceMesh;
  const busMeshes = new Map();
  const stopPillars = [];
  const beaconRings = [];
  let animationFrameId;

  // Camera modes: 'orbit', 'drone', 'driver'
  let cameraMode = 'orbit';
  let focusedBusId = null;
  let isNightMode = false;
  let isFoggy = false;

  // Road Spline points (normalized X, Y, Z based on real geography: Araku -> Vizag)
  // X: West to East (-120 to +120), Y: Altitude (elevation / 10), Z: North to South (-80 to +80)
  const corridorStations3D = [
    { name: "Araku", telugu: "అరకు", x: -100, y: 35, z: -60, alt: "912m" },
    { name: "Ananthagiri", telugu: "అనంతగిరి", x: -70, y: 26, z: -35, alt: "680m" },
    { name: "Paderu", telugu: "పాడేరు", x: -35, y: 34, z: -10, alt: "900m" },
    { name: "G. Madugula", telugu: "జి. మాడుగుల", x: 0, y: 24, z: 10, alt: "650m" },
    { name: "Chintapalli", telugu: "చింతపల్లి", x: 35, y: 31, z: 25, alt: "830m" },
    { name: "Anakapalle", telugu: "అనకాపల్లి", x: 75, y: 4, z: 50, alt: "40m" },
    { name: "Visakhapatnam", telugu: "విశాఖపట్నం", x: 110, y: 1, z: 75, alt: "15m" }
  ];

  let roadCurve;

  // Lighting references
  let dirLight, ambientLight, hemiLight;

  function init3D() {
    const container = document.getElementById("corridor3dContainer");
    if (!container || typeof THREE === "undefined") return;

    // Check if already initialized
    if (renderer) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 520;

    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a192f);
    scene.fog = new THREE.FogExp2(0x0a192f, 0.0035);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 2000);
    camera.position.set(-60, 110, 150);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    if (typeof THREE.OrbitControls !== "undefined") {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
      controls.minDistance = 15;
      controls.maxDistance = 500;
      controls.target.set(0, 15, 0);
    }

    // 5. Lighting
    setupLighting();

    // 6. Build Mountain Terrain & Environment
    buildTerrain();

    // 7. Build Highway Spline Curve & Ribbon
    buildRoad();

    // 8. Build 3D Station Nodes
    buildStations();

    // 9. Window Resize
    window.addEventListener("resize", onWindowResize);

    // 10. Start Animation Loop
    animate();

    console.log("APSRTC 3D Digital Twin initialized successfully.");
  }

  function setupLighting() {
    ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x14532d, 0.5);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(0xfff7ed, 1.2);
    dirLight.position.set(120, 180, 100);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 600;
    dirLight.shadow.camera.left = -180;
    dirLight.shadow.camera.right = 180;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -180;
    scene.add(dirLight);
  }

  function buildTerrain() {
    const terrainGeo = new THREE.PlaneGeometry(360, 260, 90, 70);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      // Height gradient: High mountains in northwest (Araku/Paderu), falling to sea coast in southeast (Vizag)
      let height = (-vx * 0.22 - vz * 0.18 + 22);

      // Add mountain ridges & ghat terrain noise
      height += Math.sin(vx * 0.05) * Math.cos(vz * 0.06) * 14;
      height += Math.sin(vx * 0.12 + vz * 0.08) * 6;
      height += Math.sin(vx * 0.2) * 2;

      // Ensure coastal plain at far east
      if (vx > 90) {
        height = Math.max(0, height * 0.2);
      }

      pos.setY(i, Math.max(0, height));
    }
    terrainGeo.computeVertexNormals();

    // Material with custom mountain terrain colors
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x153e28,
      roughness: 0.88,
      metalness: 0.05,
      flatShading: true
    });

    terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Ocean Coast (Bay of Bengal at Vizag side)
    const oceanGeo = new THREE.PlaneGeometry(160, 260);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.position.set(160, 0.4, 0);
    scene.add(ocean);
  }

  function buildRoad() {
    // Generate smooth 3D Catmull-Rom curve connecting station points
    const points = corridorStations3D.map(st => new THREE.Vector3(st.x, st.y + 0.8, st.z));
    roadCurve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.15);

    // 1. Asphalt Road Tube/Extrusion
    const roadGeo = new THREE.TubeGeometry(roadCurve, 200, 2.2, 8, false);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.2
    });
    roadSurfaceMesh = new THREE.Mesh(roadGeo, roadMat);
    roadSurfaceMesh.receiveShadow = true;
    scene.add(roadSurfaceMesh);

    // 2. Glowing Road Center Line Ribbon
    const spacedPoints = roadCurve.getSpacedPoints(250);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(
      spacedPoints.map(p => new THREE.Vector3(p.x, p.y + 0.35, p.z))
    );
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 2,
      gapSize: 1.5,
      linewidth: 3
    });
    roadLineMesh = new THREE.Line(lineGeo, lineMat);
    roadLineMesh.computeLineDistances();
    scene.add(roadLineMesh);

    // 3. Glowing Route Guide Ribbon (neon corridor pulse)
    const glowMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.4,
      linewidth: 2
    });
    const glowLine = new THREE.Line(lineGeo, glowMat);
    glowLine.position.y += 0.2;
    scene.add(glowLine);
  }

  function buildStations() {
    corridorStations3D.forEach((st, idx) => {
      const group = new THREE.Group();
      group.position.set(st.x, st.y, st.z);

      // Station Base Platform
      const baseGeo = new THREE.CylinderGeometry(5.5, 6.5, 1.2, 24);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x072516,
        metalness: 0.5,
        roughness: 0.3
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.receiveShadow = true;
      group.add(base);

      // Depot Pillar Beacon
      const pillarGeo = new THREE.CylinderGeometry(0.8, 1.2, 10, 16);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x166534,
        emissive: 0x064e3b,
        roughness: 0.4
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.y = 5;
      pillar.castShadow = true;
      group.add(pillar);

      // Beacon Top Crystal (Golden Amber)
      const crystalGeo = new THREE.OctahedronGeometry(1.6);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        roughness: 0.2,
        metalness: 0.8
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.y = 11.5;
      group.add(crystal);

      // Holographic Pulsing Ground Ring
      const ringGeo = new THREE.RingGeometry(6.5, 7.8, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.7;
      group.add(ring);
      beaconRings.push(ring);

      // Floating 3D Text Billboard Sprite
      const sprite = createStationSprite(st.name, st.telugu, st.alt, `DEPOT 0${idx + 1}`);
      sprite.position.y = 17;
      group.add(sprite);

      scene.add(group);
      stopPillars.push(group);
    });
  }

  function createStationSprite(name, telugu, alt, depot) {
    const canvas = document.createElement("canvas");
    canvas.width = 380;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");

    // Rounded Box Background
    ctx.fillStyle = "rgba(7, 37, 22, 0.92)";
    roundRect(ctx, 4, 4, 372, 132, 16, true, false);

    // Border
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#f59e0b";
    roundRect(ctx, 4, 4, 372, 132, 16, false, true);

    // Top Badge
    ctx.fillStyle = "#f59e0b";
    roundRect(ctx, 16, 12, 100, 24, 6, true, false);
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#072516";
    ctx.textAlign = "center";
    ctx.fillText(depot, 66, 29);

    // Station Name
    ctx.font = "900 28px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText(name, 20, 72);

    // Telugu & Altitude
    ctx.font = "600 18px 'Noto Sans Telugu', sans-serif";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(`${telugu} • Alt: ${alt}`, 20, 108);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(24, 9, 1);
    return sprite;
  }

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // ------------------------------------------------------------
  // 3D APSRTC BUS MODEL GENERATOR
  // ------------------------------------------------------------
  function create3DBusModel(busNumber) {
    const busGroup = new THREE.Group();

    // 1. Bus Main Body (APSRTC Emerald Green)
    const bodyGeo = new THREE.BoxGeometry(3.6, 2.6, 8.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0e4429,
      metalness: 0.4,
      roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 2.1;
    body.castShadow = true;
    body.receiveShadow = true;
    busGroup.add(body);

    // 2. White & Gold RTC Side Stripe
    const stripeGeo = new THREE.BoxGeometry(3.66, 0.4, 8.42);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 1.6;
    busGroup.add(stripe);

    const goldStripeGeo = new THREE.BoxGeometry(3.68, 0.2, 8.42);
    const goldStripeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
    const goldStripe = new THREE.Mesh(goldStripeGeo, goldStripeMat);
    goldStripe.position.y = 1.3;
    busGroup.add(goldStripe);

    // 3. Dark Tinted Panoramic Windows
    const windowGeo = new THREE.BoxGeometry(3.64, 1.1, 8.0);
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x020617,
      metalness: 0.8,
      roughness: 0.1
    });
    const windows = new THREE.Mesh(windowGeo, windowMat);
    windows.position.y = 2.55;
    busGroup.add(windows);

    // 4. Roof AC Pod
    const acGeo = new THREE.BoxGeometry(2.4, 0.4, 3.8);
    const acMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
    const acPod = new THREE.Mesh(acGeo, acMat);
    acPod.position.y = 3.6;
    busGroup.add(acPod);

    // 5. LED Projector Headlights (Front is +Z)
    const headLightGeo = new THREE.BoxGeometry(0.7, 0.35, 0.1);
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const leftHeadlight = new THREE.Mesh(headLightGeo, headLightMat);
    leftHeadlight.position.set(-1.1, 1.3, 4.25);
    busGroup.add(leftHeadlight);

    const rightHeadlight = new THREE.Mesh(headLightGeo, headLightMat);
    rightHeadlight.position.set(1.1, 1.3, 4.25);
    busGroup.add(rightHeadlight);

    // Spotlight beam casting on road
    const spot = new THREE.SpotLight(0xfef08a, 2.5, 35, Math.PI / 6, 0.4, 1);
    spot.position.set(0, 1.6, 4.2);
    const targetObj = new THREE.Object3D();
    targetObj.position.set(0, 0, 25);
    busGroup.add(targetObj);
    spot.target = targetObj;
    busGroup.add(spot);

    // 6. Red Taillights (Rear is -Z)
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const leftTail = new THREE.Mesh(headLightGeo, tailMat);
    leftTail.position.set(-1.1, 1.3, -4.25);
    busGroup.add(leftTail);

    const rightTail = new THREE.Mesh(headLightGeo, tailMat);
    rightTail.position.set(1.1, 1.3, -4.25);
    busGroup.add(rightTail);

    // 7. Rubber Wheels with Silver Hubs
    const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });

    const wheelPositions = [
      [-1.85, 0.8, 2.4],
      [1.85, 0.8, 2.4],
      [-1.85, 0.8, -2.4],
      [1.85, 0.8, -2.4]
    ];

    busGroup.wheels = [];
    wheelPositions.forEach(p => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(p[0], p[1], p[2]);
      wheel.castShadow = true;

      // Silver hubcap
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.62, 12), hubMat);
      hub.rotateZ(Math.PI / 2);
      wheel.add(hub);

      busGroup.add(wheel);
      busGroup.wheels.push(wheel);
    });

    // 8. Overhead Floating 3D Bus Tag
    const tagSprite = createBusTagSprite(busNumber);
    tagSprite.position.set(0, 6.2, 0);
    busGroup.add(tagSprite);

    return busGroup;
  }

  function createBusTagSprite(busNumber) {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 90;
    const ctx = canvas.getContext("2d");

    // Pill background
    ctx.fillStyle = "#15803d";
    roundRect(ctx, 4, 4, 232, 82, 40, true, false);

    // Gold border
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#ffffff";
    roundRect(ctx, 4, 4, 232, 82, 40, false, true);

    // Text
    ctx.font = "900 36px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(`🚌 BUS ${busNumber}`, 120, 56);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(12, 4.5, 1);
    return sprite;
  }

  // ------------------------------------------------------------
  // SYNC BUSES WITH REAL BACKEND TELEMETRY
  // ------------------------------------------------------------
  function update3DFleet(fleetList) {
    if (!roadCurve || !scene) return;

    fleetList.forEach((bus, index) => {
      let busMesh = busMeshes.get(String(bus.id));

      if (!busMesh) {
        busMesh = create3DBusModel(bus.number);
        busMesh.busData = bus;
        scene.add(busMesh);
        busMeshes.set(String(bus.id), busMesh);
      }

      // Calculate position along spline [0.0 to 1.0] based on route stop order
      const stopIdx = corridorStations3D.findIndex(s =>
        bus.locationName && bus.locationName.toLowerCase().includes(s.name.toLowerCase())
      );

      let t = 0.15 + (index * 0.22); // Default staggered
      if (stopIdx !== -1) {
        t = stopIdx / (corridorStations3D.length - 1);
        // Add subtle offset so multiple buses at same stop don't clip
        t += (index % 3) * 0.035;
      }
      t = Math.max(0.01, Math.min(0.99, t));

      busMesh.targetT = t;
      if (busMesh.currentT === undefined) {
        busMesh.currentT = t;
      }

      // Update bus data reference
      busMesh.busData = bus;
    });

    // Populate Bus Selector UI if available
    populate3DBusSelector(fleetList);
  }

  function populate3DBusSelector(fleetList) {
    const sel = document.getElementById("select3dBus");
    if (!sel || sel.children.length > 1) return;

    fleetList.forEach(bus => {
      const opt = document.createElement("option");
      opt.value = bus.id;
      opt.textContent = `Bus ${bus.number} (${bus.locationName})`;
      sel.appendChild(opt);
    });
  }

  // ------------------------------------------------------------
  // ANIMATION & RENDER LOOP
  // ------------------------------------------------------------
  let clock = new THREE.Clock();

  function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // 1. Pulsing beacon rings on stations
    beaconRings.forEach((ring, i) => {
      const scale = 1 + 0.12 * Math.sin(elapsedTime * 3 + i);
      ring.scale.set(scale, scale, 1);
    });

    // 2. Smoothly advance and orient each 3D bus
    busMeshes.forEach(mesh => {
      if (mesh.targetT !== undefined && roadCurve) {
        // Smooth lerp along curve
        mesh.currentT += (mesh.targetT - mesh.currentT) * 0.04;

        const pos = roadCurve.getPointAt(mesh.currentT);
        mesh.position.copy(pos);

        // Get forward tangent to orient bus heading
        const tangent = roadCurve.getTangentAt(mesh.currentT);
        const lookTarget = pos.clone().add(tangent);
        mesh.lookAt(lookTarget);

        // Rotate wheels
        if (mesh.wheels) {
          const speedFactor = (mesh.busData ? mesh.busData.speedKph : 40) * 0.08;
          mesh.wheels.forEach(w => {
            w.rotation.x += speedFactor * delta;
          });
        }
      }
    });

    // 3. Camera modes handling
    handleCameraTracking();

    // 4. Update Controls
    if (controls && cameraMode === 'orbit') {
      controls.update();
    }

    // 5. Render
    renderer.render(scene, camera);
  }

  function handleCameraTracking() {
    if (!focusedBusId) {
      // Default to first bus if none selected
      const firstKey = busMeshes.keys().next().value;
      if (firstKey) focusedBusId = firstKey;
    }

    const busMesh = busMeshes.get(String(focusedBusId));
    if (!busMesh) return;

    // Update HUD overlay telemetry
    update3DHUD(busMesh.busData, busMesh.position);

    if (cameraMode === 'drone') {
      // Drone follow: position behind and above the bus
      const busPos = busMesh.position.clone();
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(busMesh.quaternion);

      const desiredCamPos = busPos.clone().sub(forward.clone().multiplyScalar(22)).add(new THREE.Vector3(0, 12, 0));
      camera.position.lerp(desiredCamPos, 0.06);
      camera.lookAt(busPos.clone().add(new THREE.Vector3(0, 2, 0)));
    } else if (cameraMode === 'driver') {
      // Cockpit View: inside the bus looking forward
      const busPos = busMesh.position.clone();
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(busMesh.quaternion);

      const driverEye = busPos.clone().add(forward.clone().multiplyScalar(3.2)).add(new THREE.Vector3(0, 2.4, 0));
      camera.position.copy(driverEye);

      const lookAhead = driverEye.clone().add(forward.clone().multiplyScalar(30));
      camera.lookAt(lookAhead);
    }
  }

  function update3DHUD(bus, pos) {
    if (!bus) return;
    const hudBus = document.getElementById("hud3dBusNum");
    const hudSpeed = document.getElementById("hud3dSpeed");
    const hudAlt = document.getElementById("hud3dAltitude");
    const hudLoc = document.getElementById("hud3dLocation");

    if (hudBus) hudBus.textContent = `Bus ${bus.number}`;
    if (hudSpeed) hudSpeed.textContent = `${bus.speedKph || 42} km/h`;
    if (hudAlt && pos) hudAlt.textContent = `${Math.round(pos.y * 26)}m MSL`;
    if (hudLoc) hudLoc.textContent = bus.locationName || "Corridor Ghat";
  }

  // ------------------------------------------------------------
  // INTERACTION FUNCTIONS
  // ------------------------------------------------------------
  function setCameraMode(mode) {
    cameraMode = mode;
    if (controls) {
      controls.enabled = (mode === 'orbit');
    }

    document.querySelectorAll(".btn-3d-cam").forEach(b => b.classList.remove("active"));
    const activeBtn = document.getElementById(`btnCam${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
    if (activeBtn) activeBtn.classList.add("active");

    if (mode === 'orbit') {
      camera.position.set(-60, 110, 150);
      if (controls) controls.target.set(0, 15, 0);
    }
  }

  function focus3DBus(busId) {
    focusedBusId = String(busId);
    const sel = document.getElementById("select3dBus");
    if (sel) sel.value = busId;

    const busMesh = busMeshes.get(String(busId));
    if (busMesh && controls && cameraMode === 'orbit') {
      controls.target.copy(busMesh.position);
    }
  }

  function toggle3DNight() {
    isNightMode = !isNightMode;
    const btn = document.getElementById("btnToggleNight");

    if (isNightMode) {
      scene.background.set(0x020617);
      scene.fog.color.set(0x020617);
      ambientLight.intensity = 0.15;
      dirLight.intensity = 0.2;
      hemiLight.intensity = 0.2;
      if (roadLineMesh) roadLineMesh.material.color.set(0x38bdf8);
      if (btn) btn.innerHTML = "☀️ Daylight View";
    } else {
      scene.background.set(0x0a192f);
      scene.fog.color.set(0x0a192f);
      ambientLight.intensity = 0.45;
      dirLight.intensity = 1.2;
      hemiLight.intensity = 0.5;
      if (roadLineMesh) roadLineMesh.material.color.set(0xf59e0b);
      if (btn) btn.innerHTML = "🌙 Night Radar";
    }
  }

  function toggle3DFog() {
    isFoggy = !isFoggy;
    const btn = document.getElementById("btnToggleFog");
    if (isFoggy) {
      scene.fog.density = 0.012;
      if (btn) btn.classList.add("active");
    } else {
      scene.fog.density = 0.0035;
      if (btn) btn.classList.remove("active");
    }
  }

  function onWindowResize() {
    const container = document.getElementById("corridor3dContainer");
    if (!container || !renderer || !camera) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  // Expose globally
  window.APSRTC_3D = {
    init: init3D,
    updateFleet: update3DFleet,
    setCameraMode: setCameraMode,
    focusBus: focus3DBus,
    toggleNight: toggle3DNight,
    toggleFog: toggle3DFog
  };
})();
