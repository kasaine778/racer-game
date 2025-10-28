\
/*
  Nova Racer — Nitro Edition (Third-person)
  - Raycast vehicle (cannon-es)
  - Nitro (Shift) with visual glow + sound
  - Third-person chase camera
  - Simple car model (box) + ground + ramp
*/
import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import * as CANNON from "https://unpkg.com/cannon-es@0.21.0/dist/cannon-es.js";

let scene, camera, renderer, world;
let chassisBody, chassisMesh, vehicle, wheelMeshes = [];
let keys = {};
let lastTime = 0;
let nitroEnergy = 100;
let nitroActive = false;
let speedEl, nitroEl;
let engineSound, boostSound;
let boostLight;

init();
animate();

function init(){
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // Scene & Camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);
  camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
  camera.position.set(0,5,-12);

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffee, 0x080820, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(10,20,10);
  scene.add(dir);

  // UI elements
  speedEl = document.getElementById('speed');
  nitroEl = document.getElementById('nitro');

  // Physics world
  world = new CANNON.World({ gravity: new CANNON.Vec3(0,-9.82,0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 10;

  // Ground
  const groundMat = new CANNON.Material('groundMat');
  const groundBody = new CANNON.Body({ mass:0, shape: new CANNON.Plane(), material: groundMat });
  groundBody.quaternion.setFromEuler(-Math.PI/2, 0, 0);
  world.addBody(groundBody);
  const groundGeo = new THREE.PlaneGeometry(400,400, 8,8);
  const groundMesh = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color:0x1b7a3a }));
  groundMesh.rotation.x = -Math.PI/2;
  scene.add(groundMesh);

  // Ramp
  addRamp();

  // Vehicle (car default)
  createVehicle('car');

  // Audio
  const listener = new THREE.AudioListener();
  camera.add(listener);
  engineSound = new THREE.Audio(listener);
  boostSound  = new THREE.Audio(listener);
  const loader = new THREE.AudioLoader();
  // lightweight engine loop (public sample)
  loader.load('https://cdn.jsdelivr.net/gh/mdn/webaudio-examples/audio-resources/engine.mp3', (buf) => {
    engineSound.setBuffer(buf);
    engineSound.setLoop(true);
    engineSound.setVolume(0.18);
    try{ engineSound.play(); }catch(e){/* user interaction may be required to start audio */}
  });
  // boost sound (short)
  loader.load('https://cdn.pixabay.com/download/audio/2022/03/15/audio_d628ff153d.mp3?filename=boost-110296.mp3', (buf) => {
    boostSound.setBuffer(buf);
    boostSound.setVolume(0.8);
  });

  // Boost glow light
  boostLight = new THREE.PointLight(0x00f6ff, 0, 5);
  scene.add(boostLight);

  // Input
  window.addEventListener('keydown', (e)=> { keys[e.code]=true; if(e.code==='Digit1') recreateVehicle('car'); if(e.code==='Digit2') recreateVehicle('bike'); });
  window.addEventListener('keyup',   (e)=> { keys[e.code]=false; });

  window.addEventListener('resize', ()=> {
    camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  });

  lastTime = performance.now()/1000;
}

function addRamp(){
  const box = new CANNON.Box(new CANNON.Vec3(5,0.5,2));
  const body = new CANNON.Body({ mass:0 });
  body.addShape(box);
  body.position.set(18,0.5,0);
  body.quaternion.setFromEuler(-0.22,0,0);
  world.addBody(body);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(10,1,4), new THREE.MeshStandardMaterial({ color:0x7b5f3b }));
  mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion);
  scene.add(mesh);
}

function createVehicle(type){
  // remove old
  if (vehicle){ vehicle.removeFromWorld(world); vehicle = null; wheelMeshes.forEach(m=>scene.remove(m)); wheelMeshes=[]; world.removeBody(chassisBody); scene.remove(chassisMesh); }

  const chassisWidth = (type==='car')?1.6:0.6;
  const chassisHeight = 0.5;
  const chassisLength = (type==='car')?3.6:2.2;
  const mass = (type==='car')?180:95;

  // chassis body
  const chassisShape = new CANNON.Box(new CANNON.Vec3(chassisWidth/2, chassisHeight/2, chassisLength/2));
  chassisBody = new CANNON.Body({ mass });
  chassisBody.addShape(chassisShape);
  chassisBody.position.set(0,1.2,0);
  chassisBody.angularDamping = 0.4;
  world.addBody(chassisBody);

  // three mesh
  const geo = new THREE.BoxGeometry(chassisWidth, chassisHeight, chassisLength);
  const mat = new THREE.MeshStandardMaterial({ color: type==='car'?0xff3333:0x3333ff, metalness:0.3, roughness:0.6, emissive:0x000000 });
  chassisMesh = new THREE.Mesh(geo, mat); scene.add(chassisMesh);

  // Raycast vehicle
  vehicle = new CANNON.RaycastVehicle({ chassisBody: chassisBody, indexRightAxis:0, indexUpAxis:1, indexForwardAxis:2 });

  function addWheel(x,z,isFront){
    vehicle.addWheel({
      chassisConnectionPointLocal: new CANNON.Vec3(x, 0, z),
      directionLocal: new CANNON.Vec3(0,-1,0),
      axleLocal: new CANNON.Vec3(-1,0,0),
      suspensionStiffness: isFront?50:60,
      suspensionRestLength: isFront?0.25:0.28,
      radius: (type==='car')?0.45:0.38,
      frictionSlip: (type==='car')?5:3,
      maxSuspensionTravel: 0.3
    });
  }

  if (type==='car'){
    addWheel( chassisWidth/1.05,  chassisLength*0.35, true); // FR
    addWheel(-chassisWidth/1.05,  chassisLength*0.35, true); // FL
    addWheel( chassisWidth/1.05, -chassisLength*0.35, false);// RR
    addWheel(-chassisWidth/1.05, -chassisLength*0.35, false);// RL
  } else {
    addWheel(0, chassisLength*0.45, true); // front center
    addWheel(0, -chassisLength*0.45, false); // rear center
  }

  vehicle.addToWorld(world);

  // wheel visuals
  for (let i=0;i<vehicle.wheelInfos.length;i++){
    const r = vehicle.wheelInfos[i].radius;
    const wgeo = new THREE.CylinderGeometry(r,r, Math.max(0.2,r*0.6), 16); wgeo.rotateZ(Math.PI/2);
    const wmat = new THREE.MeshStandardMaterial({ metalness:0.2, roughness:0.6 });
    const wmesh = new THREE.Mesh(wgeo, wmat); scene.add(wmesh); wheelMeshes.push(wmesh);
  }
}

function recreateVehicle(type){ createVehicle(type); }

function updateControls(dt){
  if(!vehicle) return;
  const forward = keys['KeyW']||keys['ArrowUp'];
  const back    = keys['KeyS']||keys['ArrowDown'];
  const left    = keys['KeyA']||keys['ArrowLeft'];
  const right   = keys['KeyD']||keys['ArrowRight'];
  const handbrake = keys['Space'];
  const shift = keys['ShiftLeft']||keys['ShiftRight'];

  // params
  const maxEngine = 2500;
  const maxBrake  = 120;
  const maxSteer  = (vehicle.wheelInfos.length>2)?0.35:0.9;

  // steering
  const steer = (left?1:0)-(right?1:0);
  if (vehicle.wheelInfos.length>2){
    vehicle.setSteeringValue(steer*maxSteer, 0);
    vehicle.setSteeringValue(steer*maxSteer, 1);
  } else {
    vehicle.setSteeringValue(steer*maxSteer, 0);
  }

  // engine force
  const accel = forward?1:0;
  let engineForce = accel?maxEngine:0;

  // nitro logic
  if (shift && nitroEnergy>0 && accel){
    nitroActive = true;
    engineForce *= 2.2;
    nitroEnergy -= 50*dt;
    // visual glow + sound
    chassisMesh.material.emissive.setHex(0x00f6ff);
    boostLight.intensity = 2.5;
    if(boostSound && !boostSound.isPlaying) try{ boostSound.play(); }catch(e){}
  } else {
    nitroActive = false;
    chassisMesh.material.emissive.setHex(0x000000);
    boostLight.intensity = Math.max(0, boostLight.intensity - dt*3.0);
    if(boostSound && boostSound.isPlaying && !nitroActive){ try{ boostSound.stop(); }catch(e){} }
    if(!accel && nitroEnergy<100) nitroEnergy += 12*dt;
  }

  // apply engine force to rear wheels (or single rear for bike)
  if (vehicle.wheelInfos.length>2){
    vehicle.applyEngineForce(-engineForce, 2);
    vehicle.applyEngineForce(-engineForce, 3);
  } else {
    vehicle.applyEngineForce(-engineForce, 1);
  }

  // brakes
  const brakeForce = (handbrake||back)?maxBrake:0;
  for(let i=0;i<vehicle.wheelInfos.length;i++) vehicle.setBrake(brakeForce, i);

  // small stabilization for bike
  if (vehicle.wheelInfos.length<=2){
    chassisBody.angularVelocity.x *= 0.995; chassisBody.angularVelocity.z *= 0.995;
  }
}

function syncVisuals(){
  // chassis
  chassisMesh.position.copy(chassisBody.position); chassisMesh.quaternion.copy(chassisBody.quaternion);
  // wheels
  if(vehicle){
    for(let i=0;i<vehicle.wheelInfos.length;i++){
      vehicle.updateWheelTransform(i);
      const t = vehicle.wheelInfos[i].worldTransform;
      wheelMeshes[i].position.copy(t.position);
      wheelMeshes[i].quaternion.copy(t.quaternion);
    }
  }
  // boost light follow and intensity
  boostLight.position.copy(chassisMesh.position);
  boostLight.position.z += 1.5;
  boostLight.position.y += 0.5;
}

function updateCamera(){
  if(!chassisBody) return;
  // desired offset behind and above the chassis (third-person chase)
  const offset = new THREE.Vector3(0, 3.8, -9.2);
  const q = new THREE.Quaternion(chassisBody.quaternion.x, chassisBody.quaternion.y, chassisBody.quaternion.z, chassisBody.quaternion.w);
  const worldOffset = offset.clone().applyQuaternion(q);
  const target = new THREE.Vector3().copy(chassisBody.position).add(worldOffset);
  camera.position.lerp(target, 0.12);
  camera.lookAt(new THREE.Vector3().copy(chassisBody.position).add(new THREE.Vector3(0,1.2,0)));
}

function animate(){
  requestAnimationFrame(animate);
  const now = performance.now()/1000; let dt = now-lastTime; if(!dt||dt>0.1) dt=1/60; lastTime=now;

  updateControls(dt);
  world.step(1/60, dt, 4);
  syncVisuals();
  updateCamera();

  // UI update
  const speed = chassisBody.velocity.length()*3.6;
  speedEl.innerText = `Speed: ${Math.round(speed)} km/h`;
  nitroEl.innerText = `Nitro: ${Math.max(0, Math.round(nitroEnergy))}%`;

  renderer.render(scene, camera);
}

// Create one vehicle by default
createVehicle('car');
