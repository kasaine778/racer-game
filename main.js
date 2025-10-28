// Nova Racer GitHub-safe Edition (Pure JS)
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js";
import * as CANNON from "https://cdn.jsdelivr.net/npm/cannon-es@0.21.0/dist/cannon-es.js";

let scene, camera, renderer, world;
let car, carBody;
let keys = {}, nitro = 100, boost = false;

init();
animate();

function init(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
  camera.position.set(0,4,-10);

  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xffffbb,0x080820,1);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff,0.6);
  dir.position.set(10,10,5);
  scene.add(dir);

  const groundGeo = new THREE.PlaneGeometry(200,200);
  const groundMat = new THREE.MeshStandardMaterial({color:0x1b7a3a});
  const ground = new THREE.Mesh(groundGeo,groundMat);
  ground.rotation.x = -Math.PI/2;
  scene.add(ground);

  world = new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)});

  const groundBody = new CANNON.Body({mass:0});
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI/2,0,0);
  world.addBody(groundBody);

  const shape = new CANNON.Box(new CANNON.Vec3(1,0.5,2));
  carBody = new CANNON.Body({mass:150});
  carBody.addShape(shape);
  carBody.position.set(0,1,0);
  carBody.angularDamping = 0.4;
  world.addBody(carBody);

  const mat = new THREE.MeshStandardMaterial({color:0xff3333});
  car = new THREE.Mesh(new THREE.BoxGeometry(2,1,4),mat);
  scene.add(car);

  window.addEventListener('keydown',e=>keys[e.code]=true);
  window.addEventListener('keyup',e=>keys[e.code]=false);
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}

function update(dt){
  const forward = keys['KeyW']||keys['ArrowUp'];
  const back = keys['KeyS']||keys['ArrowDown'];
  const left = keys['KeyA']||keys['ArrowLeft'];
  const right = keys['KeyD']||keys['ArrowRight'];
  const shift = keys['ShiftLeft']||keys['ShiftRight'];

  let force = 0;
  if(forward) force=400;
  if(back) force=-200;

  if(shift && nitro>0 && forward){
    force*=2.5;
    nitro -= 30*dt;
    boost = true;
    car.material.emissive = new THREE.Color(0x00f6ff);
  } else {
    boost = false;
    car.material.emissive = new THREE.Color(0x000000);
    if(!forward && nitro<100) nitro += 10*dt;
  }

  const q = carBody.quaternion;
  const forwardVec = new CANNON.Vec3(0,0,1);
  q.vmult(forwardVec,forwardVec);
  carBody.applyForce(forwardVec.scale(-force), carBody.position);

  if(left) carBody.angularVelocity.y += 1.5*dt;
  if(right) carBody.angularVelocity.y -= 1.5*dt;
}

function animate(){
  requestAnimationFrame(animate);
  const dt = 1/60;
  update(dt);
  world.step(1/60,dt);
  car.position.copy(carBody.position);
  car.quaternion.copy(carBody.quaternion);
  camera.position.lerp(new THREE.Vector3(car.position.x,car.position.y+3,car.position.z-10),0.1);
  camera.lookAt(car.position);
  renderer.render(scene,camera);
}
