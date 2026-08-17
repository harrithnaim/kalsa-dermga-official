/* =====================================================================
   KALSA DERMAGA — SEASCAPE (night)
   =====================================================================
   A moonlit sea under a turning sky. Two layers, no libraries.

     Layer 1 (WebGL)  sky and water in one fragment shader. The water is
                      ray-cast per pixel against a wave field, so the
                      horizon and perspective are real geometry, and it
                      REFLECTS the sky above it through a Fresnel term.
                      The sky carries a Milky Way band and two tiers of
                      stars laid out on a sphere, and the whole star
                      sphere ROTATES about a celestial pole — the sky is
                      not a still backdrop, it turns like the real one.

     Layer 2 (2D)     the container vessel and the dolphins. The ship is
                      NOT a silhouette: it is a set of solids with real
                      vertices, projected through the same camera, back-
                      face culled, depth sorted and shaded per face
                      against the moon. That is why its bow swings and
                      its sides change tone as it crosses.

   Degrades in three steps, all three rendered and checked:
     - no WebGL       -> layer 1 never draws; the ship, the dolphins and
                         the CSS gradient still do.
     - reduced motion -> one still frame of both layers, no loop.
     - offscreen/hidden tab -> the loop stops.

   TO REMOVE: delete the script tag. Nothing else depends on it.
   ===================================================================== */
(function () {
  'use strict';

  /* The daylight version of this scene had a sun, a whale and gulls.
     None of them are here: at night a gull is invisible and a whale is
     a dark lump, and the brief is a moonlit sea. That code is not
     hiding behind a flag — it is gone, and lives in the previous commit
     if it is ever wanted back. */

  /* ------------------------------------------------------------------
     CAMERA — shared by the shader and the 2D layer
     ------------------------------------------------------------------
     Eye EYE metres above the water, looking slightly down. The ray for
     pixel uv (origin centre, divided by height) is

         rd = normalize(vec3(uv.x*FX, uv.y*FY + PITCH, 1))

     so the horizon (rd.y = 0) sits at uv.y = -PITCH/FY, and a world
     point (X, Y, Z) inverts to

         uv.x = X / (Z*FX)
         uv.y = ((Y - EYE)/Z - PITCH) / FY

     project() is exactly that, which is what lets a hull sit ON the
     waterline rather than near it. The shader's ray origin must equal
     EYE or the two layers drift apart. */
  var EYE = 5.0, FX = 1.15, FY = 0.95, PITCH = -0.115;

  /* Where the moon is. The shader has the identical function in GLSL —
     the ship is lit by this, so the two must not disagree. */
  function moonDirJS(t) {
    var a = 0.85 - ((t * 0.0055) % 1.8);
    var x = a, y = 0.175 + Math.sin(t * 0.006) * 0.015, z = 0.72;
    var m = Math.sqrt(x * x + y * y + z * z);
    return [x / m, y / m, z / m];
  }

  /* ==================================================================
     SHADER
     ================================================================== */
  var VERT =
    'attribute vec2 aPos;' +
    'void main(){ gl_Position = vec4(aPos,0.0,1.0); }';

  var FRAG = [
    'precision mediump float;',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uPtr;',
    'uniform float uFY;',
    'uniform float uPitch;',

    /* ---------- noise ---------- */
    'float hash21(vec2 p){',
    '  p = fract(p*vec2(123.34,456.21));',
    '  p += dot(p,p+45.32);',
    '  return fract(p.x*p.y);',
    '}',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f*f*(3.0-2.0*f);',
    '  float a = hash21(i);',
    '  float b = hash21(i+vec2(1.0,0.0));',
    '  float c = hash21(i+vec2(0.0,1.0));',
    '  float d = hash21(i+vec2(1.0,1.0));',
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);',
    '}',
    'float fbm(vec2 p){',
    '  float s = 0.0, a = 0.5;',
    '  for(int i=0;i<3;i++){ s += a*vnoise(p); p *= 2.07; a *= 0.5; }',
    '  return s;',
    '}',

    /* Rodrigues rotation — used to turn the star sphere. */
    'vec3 rot(vec3 v, vec3 k, float a){',
    '  float c = cos(a), s = sin(a);',
    '  return v*c + cross(k,v)*s + k*dot(k,v)*(1.0-c);',
    '}',

    /* Cube-face coordinates.
       Stars need cells of roughly EQUAL SIZE across the sky. A flat
       projection like rd.xz/(rd.y+k) stretches without bound toward the
       horizon, and one unlucky cell down there inflates into an enormous
       soft ellipse hanging over the sea — a bug I chased through the
       moon and the cloud code before measuring it. Projecting onto the
       six faces of a cube bounds the distortion at about 1.7x, so a star
       stays a star wherever it is. Returns cell coords in xy, face id
       in z. */
    'vec3 faceCoord(vec3 v){',
    '  vec3 a = abs(v);',
    '  if (a.x >= a.y && a.x >= a.z) return vec3(v.y/a.x, v.z/a.x, v.x > 0.0 ? 0.0 : 1.0);',
    '  if (a.y >= a.z)               return vec3(v.x/a.y, v.z/a.y, v.y > 0.0 ? 2.0 : 3.0);',
    '  return vec3(v.x/a.z, v.y/a.z, v.z > 0.0 ? 4.0 : 5.0);',
    '}',

    'vec3 starLayer(vec3 sv, float dens, float thresh, float t){',
    '  vec3 fc = faceCoord(sv);',
    '  vec2 sp = fc.xy * dens;',
    '  vec2 gi = floor(sp);',
    '  float seed = fc.z * 71.7;',
    '  float h = hash21(gi + seed);',
    '  if (h < thresh) return vec3(0.0);',
    '  vec2 c = gi + 0.5 + (vec2(hash21(gi+seed+3.1), hash21(gi+seed+7.7)) - 0.5)*0.8;',
    '  float d = length(sp - c);',
    // most stars faint, a few bright — a uniform field reads as noise
    '  float mag = pow(hash21(gi+seed+13.3), 2.5);',
    '  float tw  = 0.72 + 0.28*sin(t*(1.8 + mag*6.0) + h*60.0);',
    '  float s   = smoothstep(0.34, 0.0, d) * tw * (0.22 + mag*1.7);',
    '  float warm = hash21(gi+seed+21.1);',
    '  vec3 tint = mix(vec3(0.74,0.83,1.00), vec3(1.00,0.87,0.72), warm*warm);',
    '  return tint * s;',
    '}',

    'float milkyWay(vec3 sv){',
    '  vec3 gp = normalize(vec3(0.76,0.44,-0.48));',   // pole of the band
    '  float d = abs(dot(sv, gp));',
    '  float band = smoothstep(0.40, 0.02, d);',
    '  vec3 fc = faceCoord(sv);',
    '  float n = fbm(fc.xy*3.6 + fc.z*17.0);',
    '  return band * (0.30 + n*1.05);',
    '}',

    'vec3 moonDir(float t){',
    /* Kept low. At y=0.55 the moon projects above the top edge of a
       hero-sized canvas: never on screen, while its glitter path still
       ran across the water from a source you could not see. Low also
       gives the longest, best path. */
    '  float a = 0.85 - mod(t*0.0055, 1.8);',
    '  return normalize(vec3(a, 0.175 + sin(t*0.006)*0.015, 0.72));',
    '}',

    /* ---------- sky ----------
       full=1 is the direct view: stars, Milky Way, two cloud octaves.
       full=0 is what the water samples for its reflection — stars are
       deliberately dropped there. Wave slopes scatter a point source
       into noise, so per-star reflections cost a lot and read as dirt. */
    'vec3 sky(vec3 rd, float t, float full){',
    '  float up = clamp(rd.y, -0.02, 1.0);',
    '  vec3 zenith = vec3(0.008,0.016,0.042);',
    '  vec3 midc   = vec3(0.018,0.040,0.082);',
    '  vec3 lowc   = vec3(0.052,0.078,0.118);',        // faint airglow
    '  vec3 col = mix(midc, zenith, clamp(up*2.2,0.0,1.0));',
    '  col = mix(col, lowc, pow(1.0 - clamp(up*6.0,0.0,1.0), 2.2));',

    '  vec3 pole = normalize(vec3(0.18,0.12,1.0));',
    '  vec3 sv = rot(rd, pole, t*0.0125);',            // the sky turns
    '  float hf = smoothstep(0.0, 0.15, rd.y);',       // thin near horizon

    '  if (full > 0.5) {',
    '    col += milkyWay(sv) * vec3(0.085,0.100,0.150) * hf;',
    '    col += starLayer(sv, 26.0, 0.900, t) * 0.95 * hf;',
    '    col += starLayer(sv, 54.0, 0.952, t) * 0.55 * hf;',
    '  }',

    /* the moon — measured in SCREEN space.
       A disc that is round in direction space is not round on screen:
       the ray scales x by 1.15 and y by 0.95, so the same angle covers
       21% more uv vertically and the moon came out an oval. Undoing both
       scales puts it back to a circle. (pow(dot) is worse still: at
       mediump there are no bits left that close to 1.0 and it bands.) */
    '  vec3 md = moonDir(t);',
    '  float moon = 0.0, halo = 0.0;',
    '  if (rd.z > 0.02 && md.z > 0.02) {',
    '    vec2 mUV = vec2((md.x/md.z)/1.15, (md.y/md.z)/0.95);',
    '    vec2 rUV = vec2((rd.x/rd.z)/1.15, (rd.y/rd.z)/0.95);',
    '    float dm = length(rUV - mUV);',
    '    moon = smoothstep(0.056, 0.047, dm);',
    '    halo = smoothstep(0.42, 0.050, dm);',
    '  }',
    '  col += vec3(0.97,0.98,1.00) * moon * 2.6;',
    '  col += vec3(0.44,0.54,0.76) * halo * halo * 0.42;',

    /* thin cloud, dark against the sky, silver where the moon is behind.
       rd.xz/rd.y is the honest flat projection but explodes at the
       horizon; clamping it froze the noise into a huge soft oval, so
       this divides by (rd.y + 0.25) instead — bounded everywhere, no
       clamp, and still compresses toward the horizon like real cloud. */
    '  float cl = 0.0;',
    '  if (rd.y > 0.004) {',
    '    vec2 cp = rd.xz/(rd.y + 0.25);',
    '    cl = fbm(cp*2.05 + vec2(t*0.009, t*0.004));',
    '    cl = smoothstep(0.52, 0.90, cl);',
    '    if (full > 0.5) {',
    '      float cl2 = fbm(cp*4.30 + vec2(-t*0.015, t*0.006) + 11.0);',
    '      cl = max(cl, smoothstep(0.62, 0.94, cl2)*0.5);',
    '    }',
    '    cl *= smoothstep(0.004, 0.10, rd.y);',
    '  }',
    '  float mdot = max(dot(rd, md), 0.0);',
    '  vec3 cloudCol = mix(vec3(0.030,0.042,0.068), vec3(0.42,0.48,0.60), pow(mdot,6.0));',
    '  col = mix(col, cloudCol, cl*0.55);',

    '  return col;',
    '}',

    /* ---------- the sea surface ----------
       Six octaves. An early pass ran these three to six times lower and
       the water read as a flat panel: the swells were effectively
       hundreds of metres across. */
    'float wave(vec2 p, float t){',
    '  float h = 0.0;',
    '  h += sin(p.x*1.70 + t*1.10)*0.34;',
    '  h += sin(p.y*1.35 - t*0.85)*0.30;',
    '  h += sin((p.x+p.y)*2.30 + t*1.45)*0.17;',
    '  h += sin((p.x*2.9 - p.y*2.1) - t*1.70)*0.11;',
    '  h += sin((p.x*5.7 + p.y*4.3) + t*2.60)*0.055;',
    '  h += sin((p.x*9.1 - p.y*7.7) - t*3.40)*0.028;',
    '  return h;',
    '}',

    'void main(){',
    '  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;',
    '  vec3 ro = vec3(0.0, 5.0, 0.0);',                // must equal EYE
    '  vec3 rd = normalize(vec3(uv.x*1.15, uv.y*uFY + uPitch + uPtr.y*0.018, 1.0));',
    '  float t = uTime;',
    '  vec3 md = moonDir(t);',
    '  vec3 horizonCol = vec3(0.045,0.062,0.092);',
    '  vec3 col;',

    '  if (rd.y > 0.0) {',                              // sky
    '    col = sky(rd, t, 1.0);',
    '    float hz = 1.0 - smoothstep(0.0, 0.055, rd.y);',
    '    col = mix(col, horizonCol, hz*0.6);',
    '    gl_FragColor = vec4(col, 1.0);',
    '    return;',
    '  }',

    '  float d = -ro.y/rd.y;',                          // water
    '  vec3 pos = ro + rd*d;',
    // 0.25 keeps the apparent wavelength right at a 5 m eye height
    '  vec2 q = vec2(pos.x, pos.z)*0.25 + vec2(uPtr.x*0.4, t*0.32);',

    '  float e = 0.045;',
    '  float h   = wave(q, t);',
    '  float hx  = wave(q + vec2(e,0.0), t);',
    '  float hz2 = wave(q + vec2(0.0,e), t);',
    // more perturbation near, less far — a flat near field turned the
    // reflected sky into big pale blobs
    '  float sl = mix(0.150, 0.010, smoothstep(30.0, 430.0, d));',
    '  vec3 n = normalize(vec3(-(hx-h)/e*sl, 1.0, -(hz2-h)/e*sl));',

    '  vec3 V = -rd;',
    '  vec3 R = reflect(rd, n);',
    '  R.y = abs(R.y);',
    '  vec3 refl = sky(R, t, 0.0);',

    '  float fres = pow(1.0 - max(dot(n,V),0.0), 4.5);',
    '  fres = clamp(0.040 + fres*0.95, 0.0, 1.0);',

    '  vec3 deep = vec3(0.006,0.017,0.034);',
    '  vec3 body = vec3(0.017,0.052,0.082);',
    '  vec3 water = mix(deep, body, clamp(0.45 + h*0.55, 0.0, 1.0));',
    '  col = mix(water, refl, fres);',

    /* the moon path — the broken ribbon of light running to the viewer.
       Narrower and harder than a sun path: moonlight is a smaller, far
       dimmer source, so it glitters rather than floods. */
    '  vec3 H = normalize(md + V);',
    '  float spec = pow(max(dot(n,H),0.0), 220.0);',
    '  float path = smoothstep(0.62, 1.0, 1.0 - abs(uv.x - md.x*0.55)*1.5);',
    '  col += vec3(0.80,0.86,1.00) * spec * (0.45 + path*3.6);',
    // a broad, weak moonlight sheen so the swell stays legible away
    // from the glitter path instead of falling into pure black
    '  col += vec3(0.10,0.14,0.21) * pow(max(dot(n,md),0.0), 5.0) * 0.30;',

    '  float crest = smoothstep(0.32, 0.54, h) * (1.0 - smoothstep(50.0, 230.0, d));',
    '  col = mix(col, vec3(0.30,0.38,0.46), crest*0.16);',

    '  float fog = smoothstep(70.0, 720.0, d);',
    '  col = mix(col, horizonCol, fog*0.88);',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ==================================================================
     ONE INSTANCE
     ================================================================== */
  function Seascape(host, opts) {
    opts = opts || {};
    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var DPR = Math.min(window.devicePixelRatio || 1, 1.6);
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var visible = true, running = false;
    var W = 0, H = 0;

    // The shader writes alpha 1.0, so it is opaque and the life layer
    // must come AFTER it in the DOM. An earlier version inserted both at
    // the front, which hid every ship behind an opaque sea and looked
    // exactly like the 2D layer was broken.
    var made = [];
    function grab(id, cls) {
      var c = id && document.getElementById(id);
      if (!c) {
        c = document.createElement('canvas');
        if (cls) c.className = cls;
        c.setAttribute('aria-hidden', 'true');
        made.push(c);
      }
      return c;
    }
    var glCanvas = grab(opts.glId, opts.canvasClass);
    var fgCanvas = grab(opts.fgId, opts.canvasClass);
    for (var mi = made.length - 1; mi >= 0; mi--) {
      host.insertBefore(made[mi], host.firstChild);
    }
    var ctx = fgCanvas.getContext ? fgCanvas.getContext('2d') : null;

    /* ---- GL ---- */
    var gl = null, uRes, uTime, uPtr, uFY, uPitch;

    function compile(g, type, src) {
      var s = g.createShader(type);
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
        if (window.KD_SEASCAPE_DEBUG) console.warn(g.getShaderInfoLog(s));
        g.deleteShader(s); return null;
      }
      return s;
    }

    function initGL() {
      try {
        gl = glCanvas.getContext('webgl', {
          alpha: true, antialias: false, depth: false,
          premultipliedAlpha: true, powerPreference: 'low-power',
          // without this a single draw is wiped on the next composite,
          // which is what made an early version render blank
          preserveDrawingBuffer: true
        }) || glCanvas.getContext('experimental-webgl');
      } catch (e) { gl = null; }
      if (!gl) return false;

      var vs = compile(gl, gl.VERTEX_SHADER, VERT);
      var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) { gl = null; return false; }

      var prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
      gl.useProgram(prog);

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      uRes   = gl.getUniformLocation(prog, 'uRes');
      uTime  = gl.getUniformLocation(prog, 'uTime');
      uPtr   = gl.getUniformLocation(prog, 'uPtr');
      uFY    = gl.getUniformLocation(prog, 'uFY');
      uPitch = gl.getUniformLocation(prog, 'uPitch');

      glCanvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault(); gl = null;
      });
      glCanvas.addEventListener('webglcontextrestored', function () {
        if (initGL()) resize();
      });
      host.classList.add('kd-has-sea');
      return true;
    }

    /* ---- projection, shared with the shader ---- */
    function project(X, Y, Z) {
      if (Z < 0.6) Z = 0.6;
      return {
        x: W * 0.5 + (X / (Z * FX)) * H,
        y: H * 0.5 - (((Y - EYE) / Z - PITCH) / FY) * H,
        z: Z
      };
    }
    function scaleAt(Z) { return H / (Z * FY); }
    function rnd(i) { var s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); }
    function wrapX(x, Z) {
      var span = Z * FX * 2.9;
      return ((x + span * 0.5) % span + span) % span - span * 0.5;
    }

    /* ==============================================================
       THE CONTAINER VESSEL — real solids, not a silhouette
       ==============================================================
       Each part is eight corner points in ship-local metres (x along
       the hull, y up from the waterline, z across the beam). They are
       moved into world space, projected through the same camera as the
       water, back-face culled, sorted far-to-near and shaded per face
       against the moon. Cheap, and it behaves like geometry: the bow
       swings as it crosses, the flank brightens as it turns into the
       moonlight, and the top surfaces catch light the sides do not.
       ============================================================== */

    // [x0,x1, y0,y1, z0,z1, r,g,b, bowTaper]
    var SHIP_PARTS = [
      // hull. bowTaper narrows the +x end to a stem instead of a slab
      [-58, 62, 0.0, 11.0, -13, 13,  16, 22, 30, 1],
      // container stacks, three ranks, slightly different tones
      [-46, -33, 11.0, 24.0, -12, 12,  32, 40, 49, 0],
      [-31, -18, 11.0, 21.5, -12, 12,  27, 34, 41, 0],
      [-14,  -1, 11.0, 26.5, -12, 12,  38, 34, 37, 0],
      [  1,  13, 11.0, 23.0, -12, 12,  25, 38, 43, 0],
      [ 16,  29, 11.0, 25.0, -11, 11,  34, 41, 45, 0],
      [ 31,  42, 11.0, 20.5, -11, 11,  28, 33, 39, 0],
      // deckhouse aft, then the funnel on top of it
      [-72, -50, 11.0, 30.0,  -11, 11,  40, 45, 52, 0],
      [-66, -57, 30.0, 38.0,   -5,  5,  30, 34, 40, 0]
    ];

    var CORNERS = [
      [0,0,0],[1,0,0],[1,0,1],[0,0,1],
      [0,1,0],[1,1,0],[1,1,1],[0,1,1]
    ];
    var QUADS = [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];

    /* Distance matters more than anything else here. At Z=96 a 120 m
        hull is 680 px long and towers over the horizon — which is
        geometrically correct and looks absurd, because you are standing
        96 m from a container ship. At 520 m she is 126 px long and 40 px
        tall, sitting just under the horizon, which is what one actually
        looks like from a shore.
        The speed is 6.2 m/s — twelve knots, a real service speed, and
        fast enough that you can see her move while you read the page. */
    var VESSEL   = { z: 300,  x0: -260, spd:  6.2, scale: 1.00 };
    var FAR_SHIP = { z: 1150, x0:  400, spd: -5.0, scale: 0.85 };

    function shipSolids(part, sx, sz, dir, bob, scale) {
      var x0 = part[0]*scale, x1 = part[1]*scale;
      var y0 = part[2]*scale, y1 = part[3]*scale;
      var z0 = part[4]*scale, z1 = part[5]*scale;
      var taper = part[9];
      var v = [], i, c, lx, ly, lz;
      for (i = 0; i < 8; i++) {
        c = CORNERS[i];
        lx = c[0] ? x1 : x0;
        ly = c[1] ? y1 : y0;
        lz = c[2] ? z1 : z0;
        // a raked stem: pull the forward corners toward the centreline,
        // more so at the waterline than at deck level
        if (taper && c[0]) {
          var k = 0.20 + 0.55 * (1 - c[1]);
          lz *= (1 - k);
          lx += (c[1] ? 0 : -6 * scale);
        }
        v.push([sx + lx * dir, ly + bob, sz + lz * dir]);
      }
      return v;
    }

    function shadeFaces(verts, base, L, out) {
      // centroid of the whole solid, used to orient each face outward
      var cx = 0, cy = 0, cz = 0, i, j;
      for (i = 0; i < 8; i++) { cx += verts[i][0]; cy += verts[i][1]; cz += verts[i][2]; }
      cx /= 8; cy /= 8; cz /= 8;

      for (i = 0; i < 6; i++) {
        var q = QUADS[i];
        var a = verts[q[0]], b = verts[q[1]], c2 = verts[q[2]];
        var ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
        var vx = c2[0]-a[0], vy = c2[1]-a[1], vz = c2[2]-a[2];
        var nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
        var nm = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
        nx /= nm; ny /= nm; nz /= nm;

        var fx = 0, fy = 0, fz = 0;
        for (j = 0; j < 4; j++) { fx += verts[q[j]][0]; fy += verts[q[j]][1]; fz += verts[q[j]][2]; }
        fx /= 4; fy /= 4; fz /= 4;
        // flip the normal outward, whatever the winding happened to be
        if (nx*(fx-cx) + ny*(fy-cy) + nz*(fz-cz) < 0) { nx = -nx; ny = -ny; nz = -nz; }

        // back-face cull against the real camera position
        var ex = -fx, ey = EYE - fy, ez = -fz;
        if (nx*ex + ny*ey + nz*ez <= 0) continue;

        var dif = Math.max(0, nx*L[0] + ny*L[1] + nz*L[2]);
        /* Low ambient, hard key. At 0.16 fill the six faces all landed
           within a few values of each other and the hull read as one
           flat grey block — the geometry was there but invisible. */
        var amb = 0.12 + 0.17 * Math.max(0, ny);
        var k = amb + dif * 1.25;
        out.push({
          d: fz,
          p: [project(verts[q[0]][0], verts[q[0]][1], verts[q[0]][2]),
              project(verts[q[1]][0], verts[q[1]][1], verts[q[1]][2]),
              project(verts[q[2]][0], verts[q[2]][1], verts[q[2]][2]),
              project(verts[q[3]][0], verts[q[3]][1], verts[q[3]][2])],
          c: [base[0]*k, base[1]*k, base[2]*k]
        });
      }
    }

    function drawVessel(cfg, t, lights) {
      var Z = cfg.z;
      var X = wrapX(cfg.x0 + cfg.spd * t, Z);
      var dir = cfg.spd >= 0 ? 1 : -1;
      var s = scaleAt(Z);
      if (120 * cfg.scale * s < 8) return;

      var bob  = Math.sin(t * 0.44 + Z) * 0.55 + Math.sin(t * 0.27 + X) * 0.32;
      var L = moonDirJS(t);

      var faces = [], i;
      for (i = 0; i < SHIP_PARTS.length; i++) {
        var p = SHIP_PARTS[i];
        shadeFaces(shipSolids(p, X, Z, dir, bob, cfg.scale), [p[6], p[7], p[8]], L, faces);
      }
      faces.sort(function (a, b) { return b.d - a.d; });   // painter's order

      /* Atmospheric perspective as HAZE, not transparency. Fading alpha
         made the ships look like ghosts with sea showing through them; a
         distant vessel is the same solid shape shifted toward the colour
         of the air. Target is the shader's own horizon colour. */
      var fogAmt = Math.max(0, Math.min(0.72, (Z - 260) / 1500));
      var HR = 11, HG = 16, HB = 23;

      ctx.save();
      ctx.globalAlpha = 1;
      for (i = 0; i < faces.length; i++) {
        var f = faces[i];
        var r = Math.round(f.c[0] + (HR - f.c[0]) * fogAmt);
        var g = Math.round(f.c[1] + (HG - f.c[1]) * fogAmt);
        var b = Math.round(f.c[2] + (HB - f.c[2]) * fogAmt);
        ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        ctx.beginPath();
        ctx.moveTo(f.p[0].x, f.p[0].y);
        ctx.lineTo(f.p[1].x, f.p[1].y);
        ctx.lineTo(f.p[2].x, f.p[2].y);
        ctx.lineTo(f.p[3].x, f.p[3].y);
        ctx.closePath();
        ctx.fill();
        // hairline seam kill: canvas leaves gaps between adjacent quads
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
      ctx.restore();

      /* Lights. At night these do more for realism than the geometry:
         warm deck and accommodation lights, a white masthead, and the
         red/green sidelights that tell you which way she is heading. */
      var lit = 1 - fogAmt;
      var waterY = project(X, 0, Z).y;
      function lamp(lx, ly, lz, col, size) {
        var p = project(X + lx * cfg.scale * dir, ly * cfg.scale + bob, Z + lz * cfg.scale * dir);
        lights.push({
          x: p.x, y: p.y, w: waterY, c: col,
          r: Math.max(0.8, size * Math.max(0.55, s * cfg.scale)), a: lit
        });
      }
      lamp(-61, 31.5,   0, '255,222,150', 0.80);   // accommodation
      lamp(-66, 39.5,   0, '255,255,240', 0.70);   // masthead
      lamp( 55, 12.5,   0, '255,255,235', 0.62);   // stem head
      lamp(-58, 24.0, -13, '255,90,90',   0.55);   // port sidelight
      lamp(-58, 24.0,  13, '110,255,140', 0.55);   // starboard sidelight
      lamp(-20, 26.5, -12, '250,236,190', 0.48);   // deck floods
      lamp( 22, 24.0, -11, '250,236,190', 0.48);
      /* Wake. A thin foam trail at the waterline that spreads and
         fades. The first version was a large pale wedge reaching above
         the horizon, which read as a lens flare, not a wake. */
      if (s * cfg.scale > 0.9) {
        var stern = project(X - 62 * cfg.scale * dir, 0, Z);
        var wl = Math.min(280, 150 * s * cfg.scale);
        ctx.save();
        for (var wi = 0; wi < 18; wi++) {
          var wf = wi / 17;
          ctx.globalAlpha = 0.14 * lit * (1 - wf) * (1 - wf) *
                            (0.6 + 0.4 * Math.sin(t * 1.6 + wi));
          ctx.fillStyle = 'rgb(178,200,224)';
          ctx.beginPath();
          ctx.ellipse(stern.x - wl * wf * dir, stern.y + wl * 0.035 * wf,
                      wl * 0.045,
                      Math.max(0.5, s * cfg.scale * (0.5 + wf * 2.0)),
                      0, 0, 6.2832);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    /* Light glows and their reflections, drawn after every hull so they
       are never buried. The vertical smear under each lamp is the single
       strongest night cue on water. */
    function drawLights(list, t) {
      var i, l;
      /* The vertical smear under a light is the strongest night cue on
         water, but it has to START at that ship's waterline and run
         DOWN toward the viewer, with a length set by how high the lamp
         sits. An earlier version measured from the middle of the canvas,
         which put streaks in mid-air above the horizon. */
      for (i = 0; i < list.length; i++) {
        l = list[i];
        var above = Math.max(2, l.w - l.y);          // lamp height on screen
        var drop = above * 1.9 + 5;
        /* Drawn as a ladder of short horizontal dashes, jittered, not as
           one solid gradient bar. A continuous bar reads as a pole
           holding the ship up; real reflected light is chopped into
           rungs by every ripple it crosses. */
        var N = 14;
        for (var k = 0; k < N; k++) {
          var f = k / (N - 1);
          var yy = l.w + drop * f * f;               // bunched near the hull
          var jit = Math.sin(t * 2.3 + k * 1.7 + l.x * 0.35) * l.r * 0.9 * f;
          var wdt = l.r * (0.7 + f * 2.6);
          var hgt = Math.max(0.6, l.r * 0.34 * (1 - f * 0.4));
          ctx.globalAlpha = 0.26 * l.a * (1 - f) * (1 - f) *
                            (0.55 + 0.45 * Math.sin(t * 3.1 + k * 2.3));
          ctx.fillStyle = 'rgb(' + l.c + ')';
          ctx.beginPath();
          ctx.ellipse(l.x + jit, yy, wdt, hgt, 0, 0, 6.2832);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      for (i = 0; i < list.length; i++) {
        l = list[i];
        var g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 3.4);
        g.addColorStop(0.00, 'rgba(' + l.c + ',' + (0.92 * l.a).toFixed(3) + ')');
        g.addColorStop(0.22, 'rgba(' + l.c + ',' + (0.22 * l.a).toFixed(3) + ')');
        g.addColorStop(1.00, 'rgba(' + l.c + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r * 3.4, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.75 * l.a).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(l.x, l.y, Math.max(0.5, l.r * 0.42), 0, 6.2832);
        ctx.fill();
      }
    }

    /* ==============================================================
       DOLPHINS
       ==============================================================
       Each runs a cycle: submerged, then one leap. The leap is a
       parabola in world space and the body is rotated to the tangent of
       it, which is what stops it looking like a sticker sliding through
       the air. At night the body is nearly black; what sells it is the
       moonlit rim down its back and a wet highlight.
       ============================================================== */
    var POD = [
      { z: 20, x0: -16, spd: 3.3, period: 7.4, off: 0.00, h: 1.55, sc: 1.00 },
      { z: 24, x0: -21, spd: 3.3, period: 7.4, off: 0.55, h: 1.30, sc: 0.88 },
      { z: 17, x0: -12, spd: 3.3, period: 7.4, off: 1.05, h: 1.15, sc: 0.80 }
    ];

    function dolphinPath(ctx2, L) {
      ctx2.beginPath();
      ctx2.moveTo(L * 0.50, 0);
      ctx2.quadraticCurveTo(L * 0.10, -L * 0.19, -L * 0.34, -L * 0.09);
      ctx2.quadraticCurveTo(-L * 0.44, -L * 0.05, -L * 0.50, -L * 0.20);
      ctx2.lineTo(-L * 0.40, L * 0.02);
      ctx2.lineTo(-L * 0.50, L * 0.16);
      ctx2.quadraticCurveTo(-L * 0.36, L * 0.10, -L * 0.20, L * 0.11);
      ctx2.quadraticCurveTo(L * 0.14, L * 0.14, L * 0.50, 0);
      ctx2.closePath();
    }

    function drawDolphin(dp, t) {
      var Z = dp.z + Math.sin(t * 0.3 + dp.off) * 1.5;
      var X = wrapX(dp.x0 + dp.spd * t, Z);
      var cyc = ((t + dp.off * dp.period) % dp.period) / dp.period;
      var AIR = 0.30;
      var s = scaleAt(Z) * dp.sc;
      var L = 2.0 * s;
      if (L < 3) return;

      if (cyc > AIR) {                                  // submerged
        var sub = (cyc - AIR) / (1 - AIR);
        var pw = project(X, 0, Z);
        ctx.save();
        ctx.globalAlpha = 0.13 * (1 - sub);
        ctx.fillStyle = 'rgba(200,224,240,1)';
        ctx.beginPath();
        ctx.ellipse(pw.x, pw.y, L * 0.55, L * 0.10, 0, 0, 6.2832);
        ctx.fill();
        ctx.restore();
        return;
      }

      var u = cyc / AIR;
      var height = dp.h * 4 * u * (1 - u);
      var p = project(X, height, Z);
      var u2 = Math.min(1, u + 0.02);
      var p2 = project(X + dp.spd * 0.02 * dp.period * AIR, dp.h * 4 * u2 * (1 - u2), Z);
      var ang = Math.atan2(p2.y - p.y, p2.x - p.x);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);

      var g = ctx.createLinearGradient(0, -L * 0.18, 0, L * 0.18);
      g.addColorStop(0.00, 'rgba(10,16,24,1)');
      g.addColorStop(0.55, 'rgba(20,30,42,1)');
      g.addColorStop(1.00, 'rgba(46,60,76,1)');
      ctx.fillStyle = g;
      dolphinPath(ctx, L);
      ctx.fill();

      // moonlit rim along the back, and a wet highlight on the flank
      ctx.save();
      dolphinPath(ctx, L);
      ctx.clip();
      var rg = ctx.createLinearGradient(0, -L * 0.22, 0, -L * 0.02);
      rg.addColorStop(0, 'rgba(196,214,242,0.85)');
      rg.addColorStop(1, 'rgba(196,214,242,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(-L * 0.55, -L * 0.24, L * 1.1, L * 0.24);
      var wg = ctx.createRadialGradient(L * 0.10, -L * 0.02, 0, L * 0.10, -L * 0.02, L * 0.30);
      wg.addColorStop(0, 'rgba(226,238,255,0.42)');
      wg.addColorStop(1, 'rgba(226,238,255,0)');
      ctx.fillStyle = wg;
      ctx.fillRect(-L * 0.55, -L * 0.30, L * 1.1, L * 0.6);
      ctx.restore();

      ctx.fillStyle = g;
      ctx.beginPath();                                   // dorsal
      ctx.moveTo(L * 0.02, -L * 0.15);
      ctx.quadraticCurveTo(-L * 0.06, -L * 0.34, -L * 0.14, -L * 0.13);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.beginPath();                                   // pectoral
      ctx.moveTo(L * 0.16, L * 0.06);
      ctx.quadraticCurveTo(L * 0.04, L * 0.24, -L * 0.04, L * 0.10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      var edge = Math.min(u, 1 - u);                     // splash
      if (edge < 0.16) {
        var pw2 = project(X, 0, Z);
        var k = 1 - edge / 0.16;
        ctx.save();
        ctx.globalAlpha = 0.34 * k;
        ctx.fillStyle = 'rgba(206,228,248,1)';
        for (var i = 0; i < 6; i++) {
          var a = -0.35 - i * 0.18 - rnd(i + dp.off) * 0.3;
          var r = L * (0.30 + rnd(i * 3.1) * 0.55) * k;
          ctx.beginPath();
          ctx.arc(pw2.x + Math.cos(a) * r * 1.4, pw2.y + Math.sin(a) * r * 0.55,
                  Math.max(0.6, L * 0.05 * (1 - i * 0.1)), 0, 6.2832);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    function drawLife(t) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      var lights = [];
      drawVessel(FAR_SHIP, t, lights);
      drawVessel(VESSEL, t, lights);
      drawLights(lights, t);
      for (var i = 0; i < POD.length; i++) drawDolphin(POD[i], t);
    }

    /* ==============================================================
       SIZE, LOOP, LIFECYCLE
       ============================================================== */
    function resize() {
      var rect = host.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      var pw = Math.round(W * DPR), ph = Math.round(H * DPR);
      // the shader is the expensive half; run it lower on small screens
      var q = window.innerWidth < 700 ? 0.66 : 1;
      var gw = Math.max(1, Math.round(pw * q)), gh = Math.max(1, Math.round(ph * q));

      glCanvas.width = gw; glCanvas.height = gh;
      glCanvas.style.width = '100%'; glCanvas.style.height = '100%';
      if (gl) {
        gl.viewport(0, 0, gw, gh);
        gl.uniform2f(uRes, gw, gh);
        gl.uniform1f(uFY, FY);
        gl.uniform1f(uPitch, PITCH);
      }
      fgCanvas.width = pw; fgCanvas.height = ph;
      fgCanvas.style.width = '100%'; fgCanvas.style.height = '100%';
      if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function drawGL(t) {
      if (!gl) return;
      gl.uniform1f(uTime, t);
      gl.uniform2f(uPtr, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var start = null;
    function frame(ts) {
      if (!running) return;
      // the app replaces its container on navigation; without this the
      // orphaned scene keeps a rAF loop running against a dead node
      if (host.isConnected === false) { running = false; return; }
      if (start === null) start = ts;
      var t = (ts - start) / 1000 + (opts.t0 || 0);
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      drawGL(t);
      drawLife(t);
      window.requestAnimationFrame(frame);
    }

    function play() {
      if (running || reduced) return;
      running = true; start = null;
      window.requestAnimationFrame(frame);
    }
    function pause() { running = false; }
    function still() { resize(); drawGL(4.2); drawLife(4.2); }

    initGL();
    resize();

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(reduced ? still : resize, 160);
    }, { passive: true });

    if (reduced) { still(); return { still: still }; }

    if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
      window.addEventListener('mousemove', function (e) {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause(); else if (visible) play();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible && !document.hidden) play(); else pause();
      }, { threshold: 0 }).observe(host);
    }
    play();
    return { play: play, pause: pause };
  }

  /* ==================================================================
     BOOT
     ==================================================================
     The website has one fixed host that exists in the HTML. The super
     app does not — it renders its landing screen from JavaScript after
     load, so a single querySelector on DOMContentLoaded finds nothing
     and the card stays a flat gradient. Scan, then rescan on DOM
     changes, and attach to anything new.
     ================================================================== */
  var LIVE = 0, MAX_LIVE = 2;

  function attach(host) {
    if (!host || host.getAttribute('data-kd-sea-on') || LIVE >= MAX_LIVE) return;
    host.setAttribute('data-kd-sea-on', '1');
    LIVE++;
    try {
      Seascape(host, {
        glId: document.getElementById('heroWaves') ? 'heroWaves' : null,
        fgId: document.getElementById('heroNodes') ? 'heroNodes' : null,
        canvasClass: 'kd-sea'
      });
    } catch (e) {
      if (window.KD_SEASCAPE_DEBUG) console.error(e);
    }
  }

  function scan() {
    var fixed = document.querySelector('[data-kd-seascape]') ||
                document.querySelector('.hero-canvas');
    if (fixed) { attach(fixed); return; }
    var els = document.querySelectorAll('.land-top .land-film, .land-film, .filmcard');
    for (var i = 0; i < els.length; i++) attach(els[i]);
  }

  function boot() {
    scan();
    if (!window.MutationObserver) return;
    var t = null;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(scan, 120);
    }).observe(document.getElementById('app') || document.body,
               { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
