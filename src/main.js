import * as THREE from "three";
import gsap from "gsap";
import "./style.scss";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const canvas = document.querySelector("#experience-canvas");
const sizes = {
  height: window.innerHeight,
  width: window.innerWidth,
};

// Global variables
const defaultCameraPosition = new THREE.Vector3(23.50169202671876, 10.700431771364817, -32.55024110340833);
let defaultCameraTarget = new THREE.Vector3(0, 0, 0); // ADD THIS LINE

// Store the ORIGINAL default position (never modified)
const ORIGINAL_CAMERA_POS = new THREE.Vector3(23.50169202671876, 10.700431771364817, -32.55024110340833);
const ORIGINAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);


const fans = [];
const secret = [];
let world; // Add this line to declare the variable
let interactables = [];
let hovered = null;
let isZoomedIn = false;
let audioStarted = false;

const EXCLUDED_IDS = ["secret-shelf-First_Tex", "computer-monitor"]; // Filter out excluded objects
// Loaders
const textureLoader = new THREE.TextureLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
const environmentMap = new THREE.CubeTextureLoader()
  .setPath("/textures/skybox/")
  .load(["px.webp", "nx.webp", "py.webp", "ny.webp", "pz.webp", "nz.webp"]);

// MATERIALS

// Tall, narrow cone for flame
const flameGeo = new THREE.ConeGeometry(
  0.05, // base radius ~ half candle tip width
  0.3, // height
  16, // radial segments
  16, // height segments
  true, // open ended
);

const flameMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending, // makes flame glow
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0xffe07f) }, // base flame color
  },
  vertexShader: `
    uniform float uTime;
    varying float vHeight;

    void main() {
      vHeight = position.y;

      vec3 pos = position;

      // Only animate upper portion of flame (tip)
      float heightFactor = smoothstep(0.0, 1.0, vHeight); // 0 at base, 1 at tip

      // Soft flicker in X/Z based on height - stronger at tip
      pos.x += sin(uTime * 6.0 + pos.y * 10.0) * 0.08 * heightFactor;
      pos.z += cos(uTime * 7.0 + pos.y * 12.0) * 0.08 * heightFactor;

      // Subtle vertical breathing - stronger at tip
      pos.y += sin(uTime * 5.0 + pos.y * 8.0) * 0.03 * heightFactor;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying float vHeight;

    void main() {
      // Alpha fades near tip
      float alpha = smoothstep(0.0, 0.05, vHeight) * (1.0 - vHeight);

      // Color gradient: base orange -> tip yellow
      vec3 color = mix(vec3(1.0, 0.4, 0.0), uColor, vHeight);

      gl_FragColor = vec4(color, alpha);
    }
  `,
});

const marioCloudMaterial = new THREE.ShaderMaterial({
  transparent: false,
  depthWrite: true,
  uniforms: {
    uTime: { value: 0 },
    uLightDir: { value: new THREE.Vector3(0.4, 0.9, 0.2).normalize() },
    uLightColor: { value: new THREE.Color(0.5, 0.55, 0.7) }, // Cool grey-blue
    uShadowColor: { value: new THREE.Color(0.12, 0.1, 0.2) }, // Very dark cool grey
    uMidColor: { value: new THREE.Color(0.35, 0.38, 0.55) }, // Mid-tone cool grey-blue
  },
  vertexShader: `
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vLocalPos;

    float softNoise(vec3 p) {
      return sin(p.x * 0.5) * cos(p.y * 0.7) * sin(p.z * 0.6);
    }

    float layeredNoise(vec3 p) {
      float n = softNoise(p) * 0.5;
      n += softNoise(p * 2.0) * 0.25;
      n += softNoise(p * 4.0) * 0.125;
      return n;
    }

    float ripple(vec3 p, float time) {
      float wave1 = sin(p.x * 3.0 + time) * cos(p.y * 2.0 + time * 0.7) * 0.5;
      float wave2 = sin(p.z * 2.5 + time * 0.5) * sin(p.x * 1.5 + time * 0.3) * 0.3;
      return wave1 + wave2;
    }

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vLocalPos = position;

      float n = layeredNoise(position + uTime * 0.03);
      float rippleWave = ripple(position, uTime * 0.5);
      vec3 displaced = position + normal * (n * 0.08 + rippleWave * 0.30);  // Changed from 0.05 to 0.15

      vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
      vWorldPos = worldPos.xyz;

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform vec3 uLightDir;
    uniform vec3 uLightColor;
    uniform vec3 uShadowColor;
    uniform vec3 uMidColor;

    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vLocalPos;

    float softNoise(vec3 p) {
      return sin(p.x * 0.5) * cos(p.y * 0.7) * sin(p.z * 0.6);
    }

    float layeredNoise(vec3 p) {
      float n = softNoise(p) * 0.5;
      n += softNoise(p * 2.0) * 0.25;
      n += softNoise(p * 4.0) * 0.125;
      return n;
    }

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 lightDir = normalize(uLightDir);

      float ndl = dot(normal, lightDir);
      float depthNoise = layeredNoise(vLocalPos) * 0.5 + 0.5;

      // Three-step color ramp
      vec3 baseColor;
      if (ndl < 0.3) {
        baseColor = mix(uShadowColor, uMidColor, (ndl + 0.3) / 0.6);
      } else {
        baseColor = mix(uMidColor, uLightColor, (ndl - 0.3) / 0.7);
      }

      // Blend with depth noise
      baseColor = mix(baseColor, baseColor * 1.2, depthNoise * 0.3);

      // Lavender rim light
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float rim = 1.0 - max(dot(viewDir, normal), 0.0);
      rim = smoothstep(0.4, 0.9, rim);

      baseColor += rim * vec3(0.85, 0.7, 0.9) * 0.2;  // Lavender rim glow

      gl_FragColor = vec4(baseColor, 1.0);
    }
  `,
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  sizes.width / sizes.height,
  0.1,
  1000,
);
camera.position.z = 5;
camera.position.set(defaultCameraPosition.x, defaultCameraPosition.y, defaultCameraPosition.z);

function startAudio() {
  console.log('Starting audio...');
  console.log('Audio context state:', backgroundMusic.context.state);
  console.log('Background music buffer:', backgroundMusic.buffer);
  console.log('Is playing:', backgroundMusic.isPlaying);
  
  if (backgroundMusic.context.state === 'suspended') {
    backgroundMusic.context.resume().then(() => {
      console.log('Audio context resumed');
    });
  }
  
  // Add a small delay to ensure context is ready
  setTimeout(() => {
    if (backgroundMusic.buffer && !backgroundMusic.isPlaying) {
      backgroundMusic.play();
      console.log('Background music started');
    }
  }, 100);
}
// Add this near the top with your other global variables
const audioListener = new THREE.AudioListener();
camera.add(audioListener);

// Create audio sources
const focusSound = new THREE.Audio(audioListener);
const defocusSound = new THREE.Audio(audioListener);
const backgroundMusic = new THREE.Audio(audioListener);

// Audio loader
const audioLoader = new THREE.AudioLoader();

// Load sounds
audioLoader.load('/sounds/focus.wav', (buffer) => {
  focusSound.setBuffer(buffer);
  focusSound.setVolume(0.5);
});

audioLoader.load('/sounds/click.wav', (buffer) => {
  defocusSound.setBuffer(buffer);
  defocusSound.setVolume(0.5);
});

audioLoader.load('/sounds/waltz.mp3', (buffer) => {
  backgroundMusic.setBuffer(buffer);
  backgroundMusic.setLoop(true);
  backgroundMusic.setVolume(0.3);
});

function initAudio() {
  if (!audioStarted) {
    startAudio();
    audioStarted = true;
  }
}

// Start audio on first click, mousemove, or touch
canvas.addEventListener('click', initAudio, { once: true });
canvas.addEventListener('mousemove', initAudio, { once: true });
canvas.addEventListener('touchstart', initAudio, { once: true });

// Set background texture
const backgroundTexture = textureLoader.load("/textures/sky/night_paint.webp");
backgroundTexture.colorSpace = THREE.SRGBColorSpace;
scene.background = backgroundTexture;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Add lighting BEFORE loading model
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

environmentMap.encoding = THREE.sRGBEncoding;
scene.environment = environmentMap;

const videoElement = document.createElement("video");
videoElement.src = "/textures/video/ff14-compressed.mp4";
videoElement.crossOrigin = "anonymous";
videoElement.playsInline = true; // REQUIRED on mobile
videoElement.loop = true;
videoElement.muted = true;
videoElement.play();
const VideoTexture = new THREE.VideoTexture(videoElement);
VideoTexture.flipY = false;
VideoTexture.encoding = THREE.sRGBEncoding;
VideoTexture.minFilter = THREE.LinearFilter;
VideoTexture.magFilter = THREE.LinearFilter;
VideoTexture.format = THREE.RGBAFormat;

// Dialogue system

// Create the dialogue modal function
function showDialogue(dialogueText) {
  if (!dialogueText) {
    console.warn("No dialogue text provided");
    return;
  }
  // Create modal if it doesn't exist
  let modal = document.getElementById('dialogue-modal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dialogue-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close-button">&times;</span>
        <p class="dialogue-text"></p>
      </div>
    `;
    document.body.appendChild(modal);
    
   // Add close functionality - zoom out when closing
    const closeButton = modal.querySelector('.close-button');
    closeButton.addEventListener('click', () => {
      zoomOut();
    });
    
    // Close on outside click - zoom out
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        zoomOut();
      }
    });
    
    // ESC key to close and zoom out
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isZoomedIn) {
        zoomOut();
      }
    });
  }
  
  // Set the dialogue text and show the modal
  const dialogueTextElement = modal.querySelector('.dialogue-text');
  dialogueTextElement.textContent = dialogueText;
  modal.style.display = 'flex'; // Show the modal
}

function onClick(event) {
  // If already zoomed in, zoom out and close dialogue
  if (isZoomedIn) {
    zoomOut();
    return;
  }

  if (!hovered) return;
  
  // Get the zoom target empty object
  const zoomTarget = world.getObjectByName(hovered.userData.zoomTarget);
  
  if (!zoomTarget) {
    console.error(`Zoom target "${hovered.userData.zoomTarget}" not found!`);
    return;
  }
  

  zoomIn(zoomTarget);
}
function zoomIn(zoomTarget) {
  controls.enabled = false;
  isZoomedIn = true;
  
  if (hovered) {
    playHoverAnimation(hovered, false);
    canvas.style.cursor = 'default';
  }
  
   // Play focus sound
  if (focusSound.buffer) focusSound.play();

  const targetLookAt = new THREE.Vector3(
    hovered.position.x,
    hovered.position.y,
    hovered.position.z
  );
  
  // Animate camera position
  gsap.to(camera.position, {
    x: zoomTarget.position.x,
    y: zoomTarget.position.y,
    z: zoomTarget.position.z,
    duration: 1.0,
    ease: "power2.inOut"
  });
  
  // Animate camera target (look-at)
  gsap.to(controls.target, {
    x: targetLookAt.x,
    y: targetLookAt.y,
    z: targetLookAt.z,
    duration: 1.0,
    ease: "power2.inOut",
    onUpdate: () => controls.update(),
    onComplete: () => showDialogue(hovered.userData.dialogue)
  });
}
// Zoom out to default position - instant
function zoomOut() {
  // Play defocus sound
  if (defocusSound.buffer) defocusSound.play();


  // Close the dialogue modal
  const modal = document.getElementById('dialogue-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Instantly snap camera back to original position
  camera.position.copy(ORIGINAL_CAMERA_POS);
  controls.target.copy(ORIGINAL_CAMERA_TARGET);
  
  // Re-enable controls and reset zoom state
  controls.enabled = true;  // ADD THIS LINE
  controls.update();
  
  isZoomedIn = false;
}

let touchHappened = false;

// Add click event listener to canvas
canvas.addEventListener('click', onClick);


window.addEventListener("mousemove", (event) => {
  touchHappened = false;
  pointer.x = (event.clientX / sizes.width) * 2 - 1;
  pointer.y = -(event.clientY / sizes.height) * 2 + 1;
});
//with the scene loaded, traverse it to find interactable objects

gltfLoader.load(
  "/models/portfolio_room_function_complete.glb",
  (glb) => {
    glb.scene.traverse((child) => {
      if (child.isMesh) {
        if (child.name.includes("glass")) {
          child.material = new THREE.MeshPhysicalMaterial({
            transmission: 1,
            opacity: 1,
            metalness: 0,
            roughness: 0,
            ior: 1.2,
            thickness: 0.1,
            specularIntensity: 1,
            envMapIntensity: 1,
            transparent: true,
          });
        } else if (child.name.includes("monitor")) {
          child.material = new THREE.MeshBasicMaterial({
            map: VideoTexture,
          });
        } else if (child.name.includes("cloud")) {
          child.material = marioCloudMaterial;
        } else if (child.name.includes("candle")) {
          //add flame geometry and shader to origin of candle mesh
          const flame = new THREE.Mesh(flameGeo, flameMaterial);
          flame.position.set(0, 0.0, -0.01); // position above candle tip
          child.add(flame);
        } else if (child.name.includes("fan")) {
          fans.push(child);
        } else if (child.name.includes("secret")) {
          secret.push(child);
        }
      }
    });
    scene.add(glb.scene);
    world = glb.scene; // Store reference to the loaded scene
    world.traverse((child) => {
      if (child.userData.interactable) {
        interactables.push(child);
        console.log("found interactable" + child.name);
      }
    });
    console.log("Portfolio room loaded");
    console.log(interactables.length + " interactables found");
  },
  (xhr) => console.log((xhr.loaded / xhr.total) * 100 + "% loaded"),
  (error) => console.error("Model load error:", error),
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.copy(ORIGINAL_CAMERA_TARGET);
controls.update();

//Event Listener on resize
window.addEventListener("resize", () => {
  //Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  //Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  //Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function playHoverAnimation(object, isHovering) {
  if (isHovering) {
    // Example: Scale up the object slightly on hover
    gsap.to(object.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.3 });
  } else {
    // Scale back to original size when not hovering
    gsap.to(object.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
  }
}

const render = () => {
  // Update shader time uniform
  marioCloudMaterial.uniforms.uTime.value += 0.01;
  flameMaterial.uniforms.uTime.value += 0.01;
  fans.forEach((fan) => {
    fan.rotation.z -= 0.05; // Adjust speed as needed
  });

   // Only do raycasting if NOT zoomed in
  if (!isZoomedIn) {
  // raycaster
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(interactables, true);

  // find the first intersection that is NOT excluded
   const validHit = intersects.find((hit) => {
    const id = hit.object.userData?.id || hit.object.name;
    return !EXCLUDED_IDS.includes(id);
  });

  if (validHit) {
    console.log("Valid hit on:", validHit.object.name);
    const hoveredObject = validHit.object;
     if (hovered !== hoveredObject) {
      console.log("Hovering over:", hoveredObject.name, hoveredObject.userData);
      if (hovered) playHoverAnimation(hovered, false);
      playHoverAnimation(hoveredObject, true);
      hovered = hoveredObject;
      canvas.style.cursor = 'pointer'; // Change cursor
    }
  } else {
    if (hovered) {
      playHoverAnimation(hovered, false);
      canvas.style.cursor = 'default'; // Reset cursor
    }
    hovered = null;
  }
  }

  controls.update();
  renderer.render(scene, camera);
  window.requestAnimationFrame(render);
};
render();
