import * as THREE from "three";
import gsap from "gsap";
import "./style.scss";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Howl, Howler } from "howler";


// SUPPRESS LOGS IN PRODUCTION
if (import.meta.env.PROD) {
  console.log = () => {};
  console.warn = () => {};
}

// Canvas
const canvas = document.querySelector("#experience-canvas");
const sizes = {
  height: window.innerHeight,
  width: window.innerWidth,
};

// Global variables
const defaultCameraPosition = new THREE.Vector3(
  23.50169202671876,
  10.700431771364817,
  -32.55024110340833,
);

const minPan = new THREE.Vector3(-5, -5, -3);
const maxPan = new THREE.Vector3(5, 5, 3);

// Default scene bounds
const defaultBounds = {
  minPolarAngle: 0.4,
  maxPolarAngle: Math.PI / 2.2,
  minAzimuthAngle: -Math.PI / -2,
  maxAzimuthAngle: Math.PI / 1,
  minDistance: 15,
  maxDistance: 50,
  minPan: minPan,
  maxPan: maxPan,
};

// Store the ORIGINAL default position (never modified)
const ORIGINAL_CAMERA_POS = new THREE.Vector3(
  23.50169202671876,
  10.700431771364817,
  -32.55024110340833,
);
const ORIGINAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

const fans = [];
const secret = [];
let world; // Add this line to declare the variable
let sceneReady = false;
let interactables = [];
let hovered = null;
let shelfGroup = null; // Declare shelfGroup in the global scope
let isZoomedIn = false;
let audioStarted = false;
// Add this to your global variables
let isAnimating = false;
let shelfAnimating = false; // Lock to prevent multiple shelf animations at once
let shelfOpened = false; // Track if the secret shelf has been moved

let isModalOpen = true;
let isMuted = false;

//secret shelf group to hold the shelf and its contents together for easier movement
const shelfParts = [];

// INTRO SETUP

const manager = new THREE.LoadingManager();

const loadingScreen = document.querySelector(".loading-screen");
const loadingScreenButton = document.querySelector(".loading-screen-button");
const noSoundButton = document.querySelector(".no-sound-button");

manager.onLoad = function () {
  loadingScreenButton.style.border = "8px solid #a1abf2";
  loadingScreenButton.style.background = "#2b2749";
  loadingScreenButton.style.color = "#e6dede";
  loadingScreenButton.style.boxShadow = "rgba(0, 0, 0, 0.24) 0px 3px 8px";
  loadingScreenButton.textContent = "~ Click to Enter ~";
  loadingScreenButton.style.cursor = "pointer";
  loadingScreenButton.style.transition =
    "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
  let isDisabled = false;

  noSoundButton.textContent = "Enter without Sound";

  function handleEnter(withSound = true) {
    if (isDisabled) return;

    noSoundButton.textContent = "Welcome";
    loadingScreenButton.style.cursor = "default";
    loadingScreenButton.style.border = "8px solid #a1abf2";
    loadingScreenButton.style.background = "#2b2749";
    loadingScreenButton.style.color = "#e6dede";
    loadingScreenButton.style.boxShadow = "rgba(0, 0, 0, 0.24) 0px 3px 8px";
    loadingScreenButton.textContent = "~ Tyrel Narciso ~";

    isDisabled = true;

    if (!withSound) {
      isMuted = true;
      Howler.mute(true); // ⭐ Use Howler.mute() instead of setting volume to 0
    } else {
      backgroundMusic.play();
    }

    playReveal();
  }

  loadingScreenButton.addEventListener("mouseenter", () => {
    loadingScreenButton.style.transform = "scale(1.3)";
  });

  loadingScreenButton.addEventListener("touchend", (e) => {
    touchHappened = true;
    e.preventDefault();
    handleEnter();
  });

  loadingScreenButton.addEventListener("click", (e) => {
    if (touchHappened) return;
    handleEnter(true);
  });

  loadingScreenButton.addEventListener("mouseleave", () => {
    loadingScreenButton.style.transform = "none";
  });

  noSoundButton.addEventListener("click", (e) => {
    if (touchHappened) return;
    handleEnter(false);
  });
};

function playReveal() {
  const page = document.querySelector(".loading-page");

  const tl = gsap.timeline({
    defaults: { ease: "power2.inOut" },
  });

  // 1️⃣ Small anticipation delay
  tl.to({}, { duration: 0.25 });

  tl.to(
    page,
    {
      y: -8,
      duration: 0.6,
    },
    0.25,
  );

  // 2️⃣ Subtle skew (paper tension)
  tl.to(
    page,
    {
      skewY: 3,
      duration: 0.6,
    },
    0.25,
  );

  // 3️⃣ Camera push forward
  tl.to(
    camera.position,
    {
      z: camera.position.z - 1.2,
      duration: 6,
      onUpdate: () => controls.update(),
    },
    0.25,
  );

  // 4️⃣ Main rotation
  tl.to(
    loadingScreen,
    {
      rotateY: -140,
      duration: 3,
    },
    0.35,
  );

  // 5️⃣ Inner page rotates further (curl illusion)
  tl.to(
    page,
    {
      rotateY: -160,
      skewY: 0, // relax skew during peel
      duration: 3,
    },
    0.35,
  );

  // 6️⃣ Fade near end
  tl.to(
    loadingScreen,
    {
      opacity: 0,
      duration: 0.9,
      onComplete: () => {
        controls.enabled = true;
        loadingScreen.remove();
      },
    },
    "-=0.4",
  );

  // Move shelf into place
  if (shelfGroup) {
    tl.to(
      shelfGroup.position,
      {
        x: "-=1.28",
        duration: 6,
        ease: "power2.inOut",
      },
      0.25,
    );
  }
}

//modal content for work planks
const PAGE_CONTENT = {
  work: `
    <div class="page-inner">
      <h1>Work</h1>
    <div class="plank-image">
    <img src="/images/nvars-logo-dark.svg" alt="picture of me" />
  </div>
    <p>
    My work sits at the intersection of design, technology, and experience. 
    Each project is an opportunity to craft environments that feel purposeful, 
    memorable, and intuitive. Here are the areas I focus on most:
  </p>

      <section class="work-pillars">
        <div class="pillar">
          <h3>Technical Art</h3>
          <p>
            Asset pipelines, shader development, and more towards charming experiences
          </p>
        </div>

        <div class="pillar">
          <h3>Software Development</h3>
          <p>
            Interactive, full-stack systems built with modern
            web technologies and care.
          </p>
        </div>

        <div class="pillar">
          <h3>User Experience</h3>
          <p>
            Interfaces designed as environments,
            storytelling through intentional design.
          </p>
        </div>
      </section>

       <p>
    I approach every project as a balance between craft and curiosity: 
    how can code, design, and narrative combine to make something 
    that not only works but feels alive?
  </p>

   <section class="work-references">
    <h2>Some Previous Projects</h2>
  <ul>
    <li>
      <a href="https://www.villasarmonia.casa/" target="_blank" rel="noopener noreferrer">
        <strong>Villas Armonia Real Estate Website</strong>
      </a>
      — A website for the documenting, marketing, and sales of a unique real estate development project in Mexico, built with interactive design elements to capture the spirit of the villas and their surroundings while ergonomically showcasing villas for users to invest in.
    </li>

    <li>
      <a href="https://www.nicolavalleyrescue.ca/" target="_blank" rel="noopener noreferrer">
        <strong>Nicola Valley Animal Rescue Web Platform</strong>
      </a>
      — A full-stack platform I built for the rescue I was involved with throughout my childhood. They use it mostly for donations and marketing, but it also has content management features and adoption application tooling.
    </li>

    <li>
      <a href="https://waterways.ok.ubc.ca/Home.html" target="_blank" rel="noopener noreferrer">
        <strong>Okanagan Waterways 3D visualization Project</strong>
      </a>
      — A collaborative project with UBC to create an interactive 3D visualization of the Okanagan watershed, combining accurate regional topology with engaging design to educate and inspire action around water conservation.
    </li>
  </ul>
</section>
    </div>
  `,

  about: `
    <div class="page-inner">
       <h1>About Me</h1>
  <div class="plank-image">
    <img src="/images/output.webp" alt="picture of me" />
  </div>
  <p>
    I’m a developer and designer who builds interactive spaces
    where code, memory, and storytelling meet.
    I’m interested less in screens, and more in places.
  </p>

  <p>
    This room is part portfolio, part mnemonic device —
    a literal piece of my mind translated into a digital space.
    Each object holds work, ideas, or moments that
    shaped how I think about building experiences and myself.
  </p>

  <h2>How I Work</h2>

  <p>
    My background in software development gives me a strong
    technical foundation, but my approach is driven by
    experience design: how something feels to explore,
    remember, and return to.
  </p>

  <p>
    I enjoy working at the intersection of structure and
    intuition — using systems like Three.js and modern web
    technologies to create environments that feel personal,
    tactile, and intentional.
  </p>

  <h2>What I’m Drawn To</h2>

  <p>
    Stylized visuals. Thoughtful interaction.
    Interfaces that reveal themselves slowly.
    Projects where narrative and utility
    aren’t separate concerns.
  </p>
    </div>
  `,

  contact: `
   <div class="page-inner contact">
  <h1>Contact</h1>

  <div class="plank-image">
    <img src="/images/penelope_logo.svg" alt="Illustration representing connection and correspondence" />
  </div>

  <p>
    I’m always interested in conversations that sit at the
    intersection of design, technology, and experience.
    I’m currently seeking opportunities where thoughtful
    interaction design and creative engineering are valued.
  </p>

  <h2>What I’m Open To</h2>

  <p>
    Collaboration on interactive or experimental projects.
    Roles that value thoughtful UX and creative engineering.
    Conversations about spatial storytelling, WebGL,
    or unconventional portfolios.
  </p>

  <h2>Best Ways to Reach Me</h2>

  <p>
    Email is the most reliable way to start a conversation:
    <br />
    <strong>tyrel.a.narciso@gmail.com</strong>
  </p>

  <p>
    You can also find my work and ongoing experiments here:
    <br />
    <a href="https://github.com/tyreln" target="_blank">GitHub</a>
    ·
    <a href="https://linkedin.com/in/tyrel-narciso" target="_blank">LinkedIn</a>
  </p>

  <h2>What Helps</h2>

  <p>
    A short note about what caught your attention,
    what you’re building, or what kind of collaboration
    you have in mind is always appreciated.
  </p>
</div>
  `,
  secret: `
    <div class="page-inner">
      <h1>Questions you might have for me, and my answers</h1>
      <p>
        This plank is intended to hold thoughts or questions I often get from people. It’s a bit of a “frequently asked questions” but also a place to address common curiosities or misconceptions about me and my work that I want to clarify for anyone who’s interested enough to find this plank.
      </p>

      <h2>Why a 3D portfolio?</h2>

      <p>
        I wanted to create a space that felt more personal and memorable than a traditional portfolio website. By building a 3D environment, I can share not just my work, but also my design sensibility, storytelling approach, and personality in a way that’s more attuned to my outlook. It’s also a way to demonstrate my skills in multiple disciplines towards interactive design.
      </p>

      <h2>Is this meant to be like a game?</h2>

      <p>
        Not exactly. While there are interactive elements and it’s designed to be explored, it’s not a game in the traditional sense. It’s more of an interactive experience or digital diorama that invites curiosity and discovery. The focus is on creating a space that feels alive and personal rather than on gameplay mechanics or challenges.
      </p>

      <h2>What was your process for building this?</h2>

      <p>
        I started by sketching out the layout and key elements of the room, thinking about how to represent different aspects of my work and personality through objects and interactions. Then I modeled the room and objects in Blender, paying attention to how they would look and feel in 3D. After that, I imported everything into Three.js, set up the camera and controls, and added interactivity and animations. It was an iterative process of building, testing, and refining until it felt right.
      </p>

      <p>
        Special mention to this fantastic tutorial by another developer who built a similar portfolio in Three.js, which was a huge inspiration and resource for me: https://www.youtube.com/watch?v=AB6sulUMRGE
      </p>


    </div>
  `,
};

const EXCLUDED_IDS = []; // Filter out excluded objects
// Loaders
const textureLoader = new THREE.TextureLoader(manager);
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");
const gltfLoader = new GLTFLoader(manager);
gltfLoader.setDRACOLoader(dracoLoader);
const environmentMap = new THREE.CubeTextureLoader(manager)
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
camera.position.set(
  defaultCameraPosition.x,
  defaultCameraPosition.y,
  defaultCameraPosition.z,
);

// AUDIO SETUP

// Create sound effects
const focusSound = new Howl({
  src: ["/sounds/focus.wav"],
  volume: 0.5,
  preload: true,
});

const defocusSound = new Howl({
  src: ["/sounds/click.wav"],
  volume: 0.5,
  preload: true,
});

// Create background music
const backgroundMusic = new Howl({
  src: ["/sounds/waltz.mp3"],
  volume: 0.1,
  loop: true,
  preload: true,
  onload: function () {
    console.log("Waltz loaded successfully");
  },
  onloaderror: function (id, error) {
    console.error("Error loading waltz:", error);
  },
  onplay: function () {
    console.log("Background music started");
  },
});

function startAudio() {
  // Check if audio context exists before trying to resume
  if (Howler.ctx && Howler.ctx.state === "suspended") {
    Howler.ctx.resume().then(() => {
      console.log("Audio context resumed");
    });
  }
  if (!backgroundMusic.playing()) {
    backgroundMusic.play();
  }
}

function initAudio() {
  if (!audioStarted) {
    startAudio();
    audioStarted = true;
  }
}

// Start audio on first interaction
canvas.addEventListener("click", initAudio, { once: true });
canvas.addEventListener("mousemove", initAudio, { once: true });
canvas.addEventListener("touchstart", initAudio, { once: true });

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

// Dialogue / modal system

function initPageModal() {
  const modal = document.createElement("div");
  modal.id = "page-modal";
  modal.innerHTML = `
    <div class="page-modal-content">
      <button class="page-close">×</button>
      <div class="page-body"></div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector(".page-close").addEventListener("click", hidePageModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) hidePageModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "flex") {
      hidePageModal();
    }
  });

  // Preload all pages at startup
  preloadAllPages(modal);
}

function preloadAllPages(modal) {
  const body = modal.querySelector(".page-body");

  Object.keys(PAGE_CONTENT).forEach((pageType) => {
    const container = document.createElement("div");
    container.className = "page-container";
    container.dataset.page = pageType;
    container.style.display = "none";
    container.innerHTML = PAGE_CONTENT[pageType];
    body.appendChild(container);
  });

  // Preload images
  ["/images/me.webp", "/images/penelope_logo.svg"].forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

function showPageModal(type) {
  const modal = document.getElementById("page-modal");
  if (!modal) return;

  // Hide all pages
  modal.querySelectorAll(".page-container").forEach((container) => {
    container.style.display = "none";
  });

  // Show requested page (instant - already rendered!)
  const targetPage = modal.querySelector(`[data-page="${type}"]`);
  if (targetPage) {
    targetPage.style.display = "block";
  }

  modal.style.display = "flex";
  controls.enabled = false;
}

function hidePageModal() {
  const modal = document.getElementById("page-modal");
  if (!modal) return;
  modal.style.display = "none";
  controls.enabled = true;
}

// Create the dialogue modal function
function showDialogue(dialogueText) {
  if (!dialogueText) {
    console.warn("No dialogue text provided");
    return;
  }
  // Create modal if it doesn't exist
  let modal = document.getElementById("dialogue-modal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "dialogue-modal";
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close-button">&times;</span>
        <p class="dialogue-text"></p>
      </div>
    `;
    document.body.appendChild(modal);

    // Add close functionality - zoom out when closing
    const closeButton = modal.querySelector(".close-button");
    closeButton.addEventListener("click", () => {
      zoomOut();
    });

    // Close on outside click - zoom out
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        zoomOut();
      }
    });

    // ESC key to close and zoom out
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isZoomedIn) {
        zoomOut();
      }
    });
  }

  // Set the dialogue text and show the modal
  const dialogueTextElement = modal.querySelector(".dialogue-text");
  dialogueTextElement.textContent = dialogueText;
  modal.style.display = "flex"; // Show the modal
}

function onClick(event) {
  // Prevent clicks during animation
  if (isAnimating) return;
  // If already zoomed in, zoom out and close dialogue
  if (isZoomedIn) {
    zoomOut();
    return;
  }

  if (!hovered) return;

  //if it's a link, redirect to that and return
  const url = hovered.userData.link ? hovered.userData.link : null;
  if (url) {
    window.open(url, "_blank");
    return;
  }

  //if it's a plank (work, about, contact), create a full screen modal and display the dialogue text with overflow scroll if needed, and return
  if (hovered.userData.modal) {
    showPageModal(hovered.userData.modal);
    return;
  }

  //if it's the secret-shelf, grab the shelf group and move it
  if (hovered.name === "secret-shelf-First_Tex") {
    if (shelfAnimating) return; // block click spam while animating

    const shelfGroup = hovered.parent; // Assuming the shelf parts are grouped under a parent
    if (!shelfGroup) return;

    shelfAnimating = true; // Start animation lock
    if (shelfOpened) {
      // Move back to original position if already opened 200 on the x axis
      gsap.to(shelfGroup.position, {
        x: shelfGroup.position.x - 1.28,
        duration: 0.5,
        ease: "power2.inOut",
        onUpdate: () => controls.update(),
        onComplete: () => {
          shelfOpened = !shelfOpened; // Toggle the shelf state
          shelfAnimating = false; // Unlock after animation completes
        },
      });
    } else {
      // Move shelf to the right by 200 on the x axis
      gsap.to(shelfGroup.position, {
        x: shelfGroup.position.x + 1.28,
        duration: 0.5,
        ease: "power2.inOut",
        onUpdate: () => controls.update(),
        onComplete: () => {
          shelfOpened = !shelfOpened; // Toggle the shelf state
          shelfAnimating = false; // Unlock after animation completes
        },
      });
    }
    return;
  }

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
  isAnimating = true; // Start animation lock

  if (hovered) {
    playHoverAnimation(hovered, false);
    canvas.style.cursor = "default";
  }

  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.minDistance = 0;
  controls.maxDistance = Infinity;

  // Play focus sound with Howler
  focusSound.play();

  const targetLookAt = new THREE.Vector3(
    hovered.position.x,
    hovered.position.y,
    hovered.position.z,
  );

  // Animate camera position
  gsap.to(camera.position, {
    x: zoomTarget.position.x,
    y: zoomTarget.position.y,
    z: zoomTarget.position.z,
    duration: 1.0,
    ease: "power2.inOut",
  });

  // Animate camera target (look-at)
  gsap.to(controls.target, {
    x: targetLookAt.x,
    y: targetLookAt.y,
    z: targetLookAt.z,
    duration: 1.0,
    ease: "power2.inOut",
    onUpdate: () => controls.update(),
    onComplete: () => {
      isAnimating = false; // Unlock after animation completes
      showDialogue(hovered.userData.dialogue);
    },
  });
}
// Zoom out to default position - instant
function zoomOut() {
  // Play defocus sound with Howler
  defocusSound.play();

  // Close the dialogue modal
  const modal = document.getElementById("dialogue-modal");
  if (modal) {
    modal.style.display = "none";
  }

  // Instantly snap camera back to original position
  camera.position.copy(ORIGINAL_CAMERA_POS);
  controls.target.copy(ORIGINAL_CAMERA_TARGET);

  // Re-enable controls and reset zoom state
  controls.minPolarAngle = defaultBounds.minPolarAngle;
  controls.maxPolarAngle = defaultBounds.maxPolarAngle;
  controls.minAzimuthAngle = defaultBounds.minAzimuthAngle;
  controls.maxAzimuthAngle = defaultBounds.maxAzimuthAngle;
  controls.minDistance = defaultBounds.minDistance;
  controls.maxDistance = defaultBounds.maxDistance;

  controls.enabled = true;
  controls.update();

  isZoomedIn = false;
}

let touchHappened = false;

// Add click event listener to canvas
canvas.addEventListener("click", onClick);

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

        // remove mipmap

        const mat = child.material;

    if (mat.map) {
      mat.map.generateMipmaps = false;
      mat.map.minFilter = THREE.LinearFilter;
      mat.map.needsUpdate = true;
    }
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
          if (child.name.includes("secret-shelf")) {
            shelfParts.push(child);
          } else if (child.name.includes("plank-secret")) secret.push(child);
          shelfParts.push(child);
        }
      }
    });
    shelfGroup = new THREE.Group();
    shelfGroup.name = "shelfGroup";
    shelfParts.forEach((part) => {
      shelfGroup.attach(part);
    });
    glb.scene.add(shelfGroup);

    scene.add(glb.scene);
    world = glb.scene; // Store reference to the loaded scene
    world.traverse((child) => {
      if (child.userData.interactable) {
        interactables.push(child);
      }
    });
    sceneReady = true;
  },
  (xhr) => console.log((xhr.loaded / xhr.total) * 100 + "% loaded"),
  (error) => console.error("Model load error:", error),
);

// After your gltfLoader.load():
window.addEventListener("DOMContentLoaded", () => {
  initPageModal();
});

const controls = new OrbitControls(camera, renderer.domElement);
// SET BOUNDS WHILE NOT ZOOMING
controls.enabled = false;

// Apply default bounds
Object.assign(controls, defaultBounds);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

//controls.screenSpacePanning = false; // Ensure panning is in world space

function clampTarget() {
  if (isZoomedIn) return;
  controls.target.x = Math.max(minPan.x, Math.min(maxPan.x, controls.target.x));
  controls.target.y = Math.max(minPan.y, Math.min(maxPan.y, controls.target.y));
  controls.target.z = Math.max(minPan.z, Math.min(maxPan.z, controls.target.z));
}
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
  // Don't animate certain objects
  const id = object.userData?.id || object.name;
  if (
    id === "computer-monitor" ||
    object.name.includes("monitor") ||
    id === "piano-keys" ||
    object.name.includes("piano") ||
    id === "secret-shelf-First_Tex" ||
    object.name.includes("secret")
  ) {
    return; // Skip animation for monitor
  }

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
      const hoveredObject = validHit.object;
      if (hovered !== hoveredObject) {
        if (hovered) playHoverAnimation(hovered, false);
        playHoverAnimation(hoveredObject, true);
        hovered = hoveredObject;
        canvas.style.cursor = "pointer"; // Change cursor
      }
    } else {
      if (hovered) {
        playHoverAnimation(hovered, false);
        canvas.style.cursor = "default"; // Reset cursor
      }
      hovered = null;
    }
  }

  controls.update();
  clampTarget();
  renderer.render(scene, camera);
  window.requestAnimationFrame(render);
};
render();
