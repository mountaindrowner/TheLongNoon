import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * The HD-2D look lives here:
 *  1. Bloom — sunlit edges, lamps, the vault's glow.
 *  2. Tilt-shift — a sharp horizontal focus band through the player, blurring
 *     toward the top and bottom of the frame. Two separable Gaussian passes
 *     whose radius ramps with distance from the band. This is the diorama
 *     miniature feel; it is always on (Mark, 2026-10-23).
 *  3. Mood grade — "bleak and melancholy, overgrown by bright lush life":
 *     dull, low-saturation colors (ruins, rust, dirt) are pushed duller while
 *     already-vivid ones (greens, wildflowers) keep or gain saturation; cool
 *     shadows, warm highlights, vignette, fine grain.
 */

const TiltShift = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    dir: { value: new THREE.Vector2(1, 0) },
    focus: { value: 0.46 },
    band: { value: 0.1 },
    falloff: { value: 0.34 },
    maxBlur: { value: 7.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 dir;
    uniform float focus, band, falloff, maxBlur;
    varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - focus);
      float amt = smoothstep(band, band + falloff, d);
      float r = amt * maxBlur;
      if (r < 0.05) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec4 sum = vec4(0.0);
      float wsum = 0.0;
      for (int i = -6; i <= 6; i++) {
        float fi = float(i);
        float w = exp(-fi * fi / 14.0);
        sum += texture2D(tDiffuse, vUv + dir * fi * (r / 6.0)) * w;
        wsum += w;
      }
      gl_FragColor = sum / wsum;
    }`,
};

const Grade = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    res: { value: new THREE.Vector2(1, 1) },
    time: { value: 0 },
    dull: { value: 1.35 },      // >1 pushes low-saturation colors toward grey
    lush: { value: 1.18 },      // extra saturation on greens
    vignette: { value: 0.42 },
    grain: { value: 0.018 },
    shadowTint: { value: new THREE.Color(0.9, 0.97, 1.08) },
    highTint: { value: new THREE.Color(1.07, 1.0, 0.9) },
    lift: { value: new THREE.Color(0.012, 0.016, 0.026) },
  },
  vertexShader: TiltShift.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 res;
    uniform float time, dull, lush, vignette, grain;
    uniform vec3 shadowTint, highTint, lift;
    varying vec2 vUv;
    vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
    }
    vec3 hsv2rgb(vec3 c) {
      vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
      return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
    }
    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 col = max(src.rgb, 0.0);
      vec3 hsv = rgb2hsv(col);
      // life over ruin: dull stays dull, vivid stays vivid
      float s = pow(clamp(hsv.y, 0.0, 1.0), dull);
      float green = smoothstep(0.14, 0.2, hsv.x) * (1.0 - smoothstep(0.42, 0.5, hsv.x));
      s = clamp(s * mix(1.0, lush, green), 0.0, 1.0);
      col = hsv2rgb(vec3(hsv.x, s, hsv.z));
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col *= mix(shadowTint, highTint, smoothstep(0.04, 0.7, l));
      col += lift * (1.0 - smoothstep(0.0, 0.3, l));
      vec2 p = vUv - 0.5; p.x *= res.x / res.y;
      col *= mix(1.0 - vignette, 1.0, smoothstep(0.98, 0.32, length(p)));
      float n = fract(sin(dot(vUv * res + time * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * grain * (0.4 + l);
      gl_FragColor = vec4(col, src.a);
    }`,
};

export interface PostFX {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  tiltH: ShaderPass;
  tiltV: ShaderPass;
  resize(w: number, h: number): void;
  tick(t: number): void;
  /** Point the render pass at a new area's scene. */
  setScene(s: THREE.Scene, cam?: THREE.Camera): void;
}

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): PostFX {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.45, 0.55, 0.82);
  composer.addPass(bloom);
  const grade = new ShaderPass(Grade);
  composer.addPass(grade);
  const tiltH = new ShaderPass(TiltShift);
  const tiltV = new ShaderPass(TiltShift);
  composer.addPass(tiltH);
  composer.addPass(tiltV);
  composer.addPass(new OutputPass());

  const resize = (w: number, h: number): void => {
    composer.setSize(w, h);
    const dpr = renderer.getPixelRatio();
    const pw = w * dpr, ph = h * dpr;
    (tiltH.uniforms.dir!.value as THREE.Vector2).set(1 / pw, 0);
    (tiltV.uniforms.dir!.value as THREE.Vector2).set(0, 1 / ph);
    // blur radius in device pixels scales with resolution
    const blur = 7 * (ph / 720);
    tiltH.uniforms.maxBlur!.value = blur;
    tiltV.uniforms.maxBlur!.value = blur;
    (grade.uniforms.res!.value as THREE.Vector2).set(pw, ph);
  };
  return {
    composer, bloom, grade, tiltH, tiltV, resize,
    tick: (t) => { grade.uniforms.time!.value = t; },
    setScene: (s, cam) => { renderPass.scene = s; if (cam) renderPass.camera = cam; },
  };
}
