(function() {
  'use strict';
  var EYE = 5, FX = 1.15, FY = .95, PITCH = -.115;
  function moonDirJS(t) {
    var a = .85 - t * .0055 % 1.8;
    var x = a, y = .175 + Math.sin(t * .006) * .015, z = .72;
    var m = Math.sqrt(x * x + y * y + z * z);
    return [ x / m, y / m, z / m ];
  }
  var VERT = 'attribute vec2 aPos;' + 'void main(){ gl_Position = vec4(aPos,0.0,1.0); }';
  var FRAG = [ 'precision mediump float;', 'uniform vec2  uRes;', 'uniform float uTime;', 'uniform vec2  uPtr;', 'uniform float uFY;', 'uniform float uPitch;', 'float hash21(vec2 p){', '  p = fract(p*vec2(123.34,456.21));', '  p += dot(p,p+45.32);', '  return fract(p.x*p.y);', '}', 'float vnoise(vec2 p){', '  vec2 i = floor(p), f = fract(p);', '  f = f*f*(3.0-2.0*f);', '  float a = hash21(i);', '  float b = hash21(i+vec2(1.0,0.0));', '  float c = hash21(i+vec2(0.0,1.0));', '  float d = hash21(i+vec2(1.0,1.0));', '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);', '}', 'float fbm(vec2 p){', '  float s = 0.0, a = 0.5;', '  for(int i=0;i<3;i++){ s += a*vnoise(p); p *= 2.07; a *= 0.5; }', '  return s;', '}', 'vec3 rot(vec3 v, vec3 k, float a){', '  float c = cos(a), s = sin(a);', '  return v*c + cross(k,v)*s + k*dot(k,v)*(1.0-c);', '}', 'vec3 faceCoord(vec3 v){', '  vec3 a = abs(v);', '  if (a.x >= a.y && a.x >= a.z) return vec3(v.y/a.x, v.z/a.x, v.x > 0.0 ? 0.0 : 1.0);', '  if (a.y >= a.z)               return vec3(v.x/a.y, v.z/a.y, v.y > 0.0 ? 2.0 : 3.0);', '  return vec3(v.x/a.z, v.y/a.z, v.z > 0.0 ? 4.0 : 5.0);', '}', 'vec3 starLayer(vec3 sv, float dens, float thresh, float t){', '  vec3 fc = faceCoord(sv);', '  vec2 sp = fc.xy * dens;', '  vec2 gi = floor(sp);', '  float seed = fc.z * 71.7;', '  float h = hash21(gi + seed);', '  if (h < thresh) return vec3(0.0);', '  vec2 c = gi + 0.5 + (vec2(hash21(gi+seed+3.1), hash21(gi+seed+7.7)) - 0.5)*0.8;', '  float d = length(sp - c);', '  float mag = pow(hash21(gi+seed+13.3), 2.5);', '  float tw  = 0.72 + 0.28*sin(t*(1.8 + mag*6.0) + h*60.0);', '  float s   = smoothstep(0.34, 0.0, d) * tw * (0.22 + mag*1.7);', '  float warm = hash21(gi+seed+21.1);', '  vec3 tint = mix(vec3(0.74,0.83,1.00), vec3(1.00,0.87,0.72), warm*warm);', '  return tint * s;', '}', 'float milkyWay(vec3 sv){', '  vec3 gp = normalize(vec3(0.76,0.44,-0.48));', '  float d = abs(dot(sv, gp));', '  float band = smoothstep(0.40, 0.02, d);', '  vec3 fc = faceCoord(sv);', '  float n = fbm(fc.xy*3.6 + fc.z*17.0);', '  return band * (0.30 + n*1.05);', '}', 'vec3 moonDir(float t){', '  float a = 0.85 - mod(t*0.0055, 1.8);', '  return normalize(vec3(a, 0.175 + sin(t*0.006)*0.015, 0.72));', '}', 'vec3 sky(vec3 rd, float t, float full){', '  float up = clamp(rd.y, -0.02, 1.0);', '  vec3 zenith = vec3(0.008,0.016,0.042);', '  vec3 midc   = vec3(0.018,0.040,0.082);', '  vec3 lowc   = vec3(0.052,0.078,0.118);', '  vec3 col = mix(midc, zenith, clamp(up*2.2,0.0,1.0));', '  col = mix(col, lowc, pow(1.0 - clamp(up*6.0,0.0,1.0), 2.2));', '  vec3 pole = normalize(vec3(0.18,0.12,1.0));', '  vec3 sv = rot(rd, pole, t*0.0125);', '  float hf = smoothstep(0.0, 0.15, rd.y);', '  if (full > 0.5) {', '    col += milkyWay(sv) * vec3(0.085,0.100,0.150) * hf;', '    col += starLayer(sv, 26.0, 0.900, t) * 0.95 * hf;', '    col += starLayer(sv, 54.0, 0.952, t) * 0.55 * hf;', '  }', '  vec3 md = moonDir(t);', '  float moon = 0.0, halo = 0.0;', '  if (rd.z > 0.02 && md.z > 0.02) {', '    vec2 mUV = vec2((md.x/md.z)/1.15, (md.y/md.z)/0.95);', '    vec2 rUV = vec2((rd.x/rd.z)/1.15, (rd.y/rd.z)/0.95);', '    float dm = length(rUV - mUV);', '    moon = smoothstep(0.056, 0.047, dm);', '    halo = smoothstep(0.42, 0.050, dm);', '  }', '  col += vec3(0.97,0.98,1.00) * moon * 2.6;', '  col += vec3(0.44,0.54,0.76) * halo * halo * 0.42;', '  float cl = 0.0;', '  if (rd.y > 0.004) {', '    vec2 cp = rd.xz/(rd.y + 0.25);', '    cl = fbm(cp*2.05 + vec2(t*0.009, t*0.004));', '    cl = smoothstep(0.52, 0.90, cl);', '    if (full > 0.5) {', '      float cl2 = fbm(cp*4.30 + vec2(-t*0.015, t*0.006) + 11.0);', '      cl = max(cl, smoothstep(0.62, 0.94, cl2)*0.5);', '    }', '    cl *= smoothstep(0.004, 0.10, rd.y);', '  }', '  float mdot = max(dot(rd, md), 0.0);', '  vec3 cloudCol = mix(vec3(0.030,0.042,0.068), vec3(0.42,0.48,0.60), pow(mdot,6.0));', '  col = mix(col, cloudCol, cl*0.55);', '  return col;', '}', 'float wave(vec2 p, float t){', '  float h = 0.0;', '  h += sin(p.x*1.70 + t*1.10)*0.34;', '  h += sin(p.y*1.35 - t*0.85)*0.30;', '  h += sin((p.x+p.y)*2.30 + t*1.45)*0.17;', '  h += sin((p.x*2.9 - p.y*2.1) - t*1.70)*0.11;', '  h += sin((p.x*5.7 + p.y*4.3) + t*2.60)*0.055;', '  h += sin((p.x*9.1 - p.y*7.7) - t*3.40)*0.028;', '  return h;', '}', 'void main(){', '  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;', '  vec3 ro = vec3(0.0, 5.0, 0.0);', '  vec3 rd = normalize(vec3(uv.x*1.15, uv.y*uFY + uPitch + uPtr.y*0.018, 1.0));', '  float t = uTime;', '  vec3 md = moonDir(t);', '  vec3 horizonCol = vec3(0.045,0.062,0.092);', '  vec3 col;', '  if (rd.y > 0.0) {', '    col = sky(rd, t, 1.0);', '    float hz = 1.0 - smoothstep(0.0, 0.055, rd.y);', '    col = mix(col, horizonCol, hz*0.6);', '    gl_FragColor = vec4(col, 1.0);', '    return;', '  }', '  float d = -ro.y/rd.y;', '  vec3 pos = ro + rd*d;', '  vec2 q = vec2(pos.x, pos.z)*0.25 + vec2(uPtr.x*0.4, t*0.32);', '  float e = 0.045;', '  float h   = wave(q, t);', '  float hx  = wave(q + vec2(e,0.0), t);', '  float hz2 = wave(q + vec2(0.0,e), t);', '  float sl = mix(0.150, 0.010, smoothstep(30.0, 430.0, d));', '  vec3 n = normalize(vec3(-(hx-h)/e*sl, 1.0, -(hz2-h)/e*sl));', '  vec3 V = -rd;', '  vec3 R = reflect(rd, n);', '  R.y = abs(R.y);', '  vec3 refl = sky(R, t, 0.0);', '  float fres = pow(1.0 - max(dot(n,V),0.0), 4.5);', '  fres = clamp(0.040 + fres*0.95, 0.0, 1.0);', '  vec3 deep = vec3(0.006,0.017,0.034);', '  vec3 body = vec3(0.017,0.052,0.082);', '  vec3 water = mix(deep, body, clamp(0.45 + h*0.55, 0.0, 1.0));', '  col = mix(water, refl, fres);', '  vec3 H = normalize(md + V);', '  float spec = pow(max(dot(n,H),0.0), 220.0);', '  float path = smoothstep(0.62, 1.0, 1.0 - abs(uv.x - md.x*0.55)*1.5);', '  col += vec3(0.80,0.86,1.00) * spec * (0.45 + path*3.6);', '  col += vec3(0.10,0.14,0.21) * pow(max(dot(n,md),0.0), 5.0) * 0.30;', '  float crest = smoothstep(0.32, 0.54, h) * (1.0 - smoothstep(50.0, 230.0, d));', '  col = mix(col, vec3(0.30,0.38,0.46), crest*0.16);', '  float fog = smoothstep(70.0, 720.0, d);', '  col = mix(col, horizonCol, fog*0.88);', '  gl_FragColor = vec4(col, 1.0);', '}' ].join('\n');
  function Seascape(host, opts) {
    opts = opts || {};
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DPR = Math.min(window.devicePixelRatio || 1, 1.6);
    var pointer = {
      x: 0,
      y: 0,
      tx: 0,
      ty: 0
    };
    var visible = true, running = false;
    var W = 0, H = 0;
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
    var gl = null, uRes, uTime, uPtr, uFY, uPitch;
    function compile(g, type, src) {
      var s = g.createShader(type);
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
        if (window.KD_SEASCAPE_DEBUG) console.warn(g.getShaderInfoLog(s));
        g.deleteShader(s);
        return null;
      }
      return s;
    }
    function initGL() {
      try {
        gl = glCanvas.getContext('webgl', {
          alpha: true,
          antialias: false,
          depth: false,
          premultipliedAlpha: true,
          powerPreference: 'low-power',
          preserveDrawingBuffer: true
        }) || glCanvas.getContext('experimental-webgl');
      } catch (e) {
        gl = null;
      }
      if (!gl) return false;
      var vs = compile(gl, gl.VERTEX_SHADER, VERT);
      var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) {
        gl = null;
        return false;
      }
      var prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl = null;
        return false;
      }
      gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ -1, -1, 3, -1, -1, 3 ]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      uRes = gl.getUniformLocation(prog, 'uRes');
      uTime = gl.getUniformLocation(prog, 'uTime');
      uPtr = gl.getUniformLocation(prog, 'uPtr');
      uFY = gl.getUniformLocation(prog, 'uFY');
      uPitch = gl.getUniformLocation(prog, 'uPitch');
      glCanvas.addEventListener('webglcontextlost', function(e) {
        e.preventDefault();
        gl = null;
      });
      glCanvas.addEventListener('webglcontextrestored', function() {
        if (initGL()) resize();
      });
      host.classList.add('kd-has-sea');
      return true;
    }
    function project(X, Y, Z) {
      if (Z < .6) Z = .6;
      return {
        x: W * .5 + X / (Z * FX) * H,
        y: H * .5 - ((Y - EYE) / Z - PITCH) / FY * H,
        z: Z
      };
    }
    function scaleAt(Z) {
      return H / (Z * FY);
    }
    function rnd(i) {
      var s = Math.sin(i * 127.1) * 43758.5453;
      return s - Math.floor(s);
    }
    function wrapX(x, Z) {
      var span = Z * FX * 2.9;
      return ((x + span * .5) % span + span) % span - span * .5;
    }
    var SHIP_PARTS = [ [ -58, 62, 0, 11, -13, 13, 16, 22, 30, 1 ], [ -46, -33, 11, 24, -12, 12, 32, 40, 49, 0 ], [ -31, -18, 11, 21.5, -12, 12, 27, 34, 41, 0 ], [ -14, -1, 11, 26.5, -12, 12, 38, 34, 37, 0 ], [ 1, 13, 11, 23, -12, 12, 25, 38, 43, 0 ], [ 16, 29, 11, 25, -11, 11, 34, 41, 45, 0 ], [ 31, 42, 11, 20.5, -11, 11, 28, 33, 39, 0 ], [ -72, -50, 11, 30, -11, 11, 40, 45, 52, 0 ], [ -66, -57, 30, 38, -5, 5, 30, 34, 40, 0 ] ];
    var CORNERS = [ [ 0, 0, 0 ], [ 1, 0, 0 ], [ 1, 0, 1 ], [ 0, 0, 1 ], [ 0, 1, 0 ], [ 1, 1, 0 ], [ 1, 1, 1 ], [ 0, 1, 1 ] ];
    var QUADS = [ [ 0, 1, 2, 3 ], [ 4, 7, 6, 5 ], [ 0, 4, 5, 1 ], [ 3, 2, 6, 7 ], [ 0, 3, 7, 4 ], [ 1, 5, 6, 2 ] ];
    var VESSEL = {
      z: 300,
      x0: -260,
      spd: 6.2,
      scale: 1
    };
    var FAR_SHIP = {
      z: 1150,
      x0: 400,
      spd: -5,
      scale: .85
    };
    function shipSolids(part, sx, sz, dir, bob, scale) {
      var x0 = part[0] * scale, x1 = part[1] * scale;
      var y0 = part[2] * scale, y1 = part[3] * scale;
      var z0 = part[4] * scale, z1 = part[5] * scale;
      var taper = part[9];
      var v = [], i, c, lx, ly, lz;
      for (i = 0; i < 8; i++) {
        c = CORNERS[i];
        lx = c[0] ? x1 : x0;
        ly = c[1] ? y1 : y0;
        lz = c[2] ? z1 : z0;
        if (taper && c[0]) {
          var k = .2 + .55 * (1 - c[1]);
          lz *= 1 - k;
          lx += c[1] ? 0 : -6 * scale;
        }
        v.push([ sx + lx * dir, ly + bob, sz + lz * dir ]);
      }
      return v;
    }
    function shadeFaces(verts, base, L, out) {
      var cx = 0, cy = 0, cz = 0, i, j;
      for (i = 0; i < 8; i++) {
        cx += verts[i][0];
        cy += verts[i][1];
        cz += verts[i][2];
      }
      cx /= 8;
      cy /= 8;
      cz /= 8;
      for (i = 0; i < 6; i++) {
        var q = QUADS[i];
        var a = verts[q[0]], b = verts[q[1]], c2 = verts[q[2]];
        var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        var vx = c2[0] - a[0], vy = c2[1] - a[1], vz = c2[2] - a[2];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        var nm = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nm;
        ny /= nm;
        nz /= nm;
        var fx = 0, fy = 0, fz = 0;
        for (j = 0; j < 4; j++) {
          fx += verts[q[j]][0];
          fy += verts[q[j]][1];
          fz += verts[q[j]][2];
        }
        fx /= 4;
        fy /= 4;
        fz /= 4;
        if (nx * (fx - cx) + ny * (fy - cy) + nz * (fz - cz) < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }
        var ex = -fx, ey = EYE - fy, ez = -fz;
        if (nx * ex + ny * ey + nz * ez <= 0) continue;
        var dif = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        var amb = .12 + .17 * Math.max(0, ny);
        var k = amb + dif * 1.25;
        out.push({
          d: fz,
          p: [ project(verts[q[0]][0], verts[q[0]][1], verts[q[0]][2]), project(verts[q[1]][0], verts[q[1]][1], verts[q[1]][2]), project(verts[q[2]][0], verts[q[2]][1], verts[q[2]][2]), project(verts[q[3]][0], verts[q[3]][1], verts[q[3]][2]) ],
          c: [ base[0] * k, base[1] * k, base[2] * k ]
        });
      }
    }
    function drawVessel(cfg, t, lights) {
      var Z = cfg.z;
      var X = wrapX(cfg.x0 + cfg.spd * t, Z);
      var dir = cfg.spd >= 0 ? 1 : -1;
      var s = scaleAt(Z);
      if (120 * cfg.scale * s < 8) return;
      var bob = Math.sin(t * .44 + Z) * .55 + Math.sin(t * .27 + X) * .32;
      var L = moonDirJS(t);
      var faces = [], i;
      for (i = 0; i < SHIP_PARTS.length; i++) {
        var p = SHIP_PARTS[i];
        shadeFaces(shipSolids(p, X, Z, dir, bob, cfg.scale), [ p[6], p[7], p[8] ], L, faces);
      }
      faces.sort(function(a, b) {
        return b.d - a.d;
      });
      var fogAmt = Math.max(0, Math.min(.72, (Z - 260) / 1500));
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
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = .7;
        ctx.stroke();
      }
      ctx.restore();
      var lit = 1 - fogAmt;
      var waterY = project(X, 0, Z).y;
      function lamp(lx, ly, lz, col, size) {
        var p = project(X + lx * cfg.scale * dir, ly * cfg.scale + bob, Z + lz * cfg.scale * dir);
        lights.push({
          x: p.x,
          y: p.y,
          w: waterY,
          c: col,
          r: Math.max(.8, size * Math.max(.55, s * cfg.scale)),
          a: lit
        });
      }
      lamp(-61, 31.5, 0, '255,222,150', .8);
      lamp(-66, 39.5, 0, '255,255,240', .7);
      lamp(55, 12.5, 0, '255,255,235', .62);
      lamp(-58, 24, -13, '255,90,90', .55);
      lamp(-58, 24, 13, '110,255,140', .55);
      lamp(-20, 26.5, -12, '250,236,190', .48);
      lamp(22, 24, -11, '250,236,190', .48);
      if (s * cfg.scale > .9) {
        var stern = project(X - 62 * cfg.scale * dir, 0, Z);
        var wl = Math.min(280, 150 * s * cfg.scale);
        ctx.save();
        for (var wi = 0; wi < 18; wi++) {
          var wf = wi / 17;
          ctx.globalAlpha = .14 * lit * (1 - wf) * (1 - wf) * (.6 + .4 * Math.sin(t * 1.6 + wi));
          ctx.fillStyle = 'rgb(178,200,224)';
          ctx.beginPath();
          ctx.ellipse(stern.x - wl * wf * dir, stern.y + wl * .035 * wf, wl * .045, Math.max(.5, s * cfg.scale * (.5 + wf * 2)), 0, 0, 6.2832);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    function drawLights(list, t) {
      var i, l;
      for (i = 0; i < list.length; i++) {
        l = list[i];
        var above = Math.max(2, l.w - l.y);
        var drop = above * 1.9 + 5;
        var N = 14;
        for (var k = 0; k < N; k++) {
          var f = k / (N - 1);
          var yy = l.w + drop * f * f;
          var jit = Math.sin(t * 2.3 + k * 1.7 + l.x * .35) * l.r * .9 * f;
          var wdt = l.r * (.7 + f * 2.6);
          var hgt = Math.max(.6, l.r * .34 * (1 - f * .4));
          ctx.globalAlpha = .26 * l.a * (1 - f) * (1 - f) * (.55 + .45 * Math.sin(t * 3.1 + k * 2.3));
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
        g.addColorStop(0, 'rgba(' + l.c + ',' + (.92 * l.a).toFixed(3) + ')');
        g.addColorStop(.22, 'rgba(' + l.c + ',' + (.22 * l.a).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + l.c + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r * 3.4, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,' + (.75 * l.a).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(l.x, l.y, Math.max(.5, l.r * .42), 0, 6.2832);
        ctx.fill();
      }
    }
    var POD = [ {
      z: 20,
      x0: -16,
      spd: 3.3,
      period: 7.4,
      off: 0,
      h: 1.55,
      sc: 1
    }, {
      z: 24,
      x0: -21,
      spd: 3.3,
      period: 7.4,
      off: .55,
      h: 1.3,
      sc: .88
    }, {
      z: 17,
      x0: -12,
      spd: 3.3,
      period: 7.4,
      off: 1.05,
      h: 1.15,
      sc: .8
    } ];
    function dolphinPath(ctx2, L) {
      ctx2.beginPath();
      ctx2.moveTo(L * .5, 0);
      ctx2.quadraticCurveTo(L * .1, -L * .19, -L * .34, -L * .09);
      ctx2.quadraticCurveTo(-L * .44, -L * .05, -L * .5, -L * .2);
      ctx2.lineTo(-L * .4, L * .02);
      ctx2.lineTo(-L * .5, L * .16);
      ctx2.quadraticCurveTo(-L * .36, L * .1, -L * .2, L * .11);
      ctx2.quadraticCurveTo(L * .14, L * .14, L * .5, 0);
      ctx2.closePath();
    }
    function drawDolphin(dp, t) {
      var Z = dp.z + Math.sin(t * .3 + dp.off) * 1.5;
      var X = wrapX(dp.x0 + dp.spd * t, Z);
      var cyc = (t + dp.off * dp.period) % dp.period / dp.period;
      var AIR = .3;
      var s = scaleAt(Z) * dp.sc;
      var L = 2 * s;
      if (L < 3) return;
      if (cyc > AIR) {
        var sub = (cyc - AIR) / (1 - AIR);
        var pw = project(X, 0, Z);
        ctx.save();
        ctx.globalAlpha = .13 * (1 - sub);
        ctx.fillStyle = 'rgba(200,224,240,1)';
        ctx.beginPath();
        ctx.ellipse(pw.x, pw.y, L * .55, L * .1, 0, 0, 6.2832);
        ctx.fill();
        ctx.restore();
        return;
      }
      var u = cyc / AIR;
      var height = dp.h * 4 * u * (1 - u);
      var p = project(X, height, Z);
      var u2 = Math.min(1, u + .02);
      var p2 = project(X + dp.spd * .02 * dp.period * AIR, dp.h * 4 * u2 * (1 - u2), Z);
      var ang = Math.atan2(p2.y - p.y, p2.x - p.x);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      var g = ctx.createLinearGradient(0, -L * .18, 0, L * .18);
      g.addColorStop(0, 'rgba(10,16,24,1)');
      g.addColorStop(.55, 'rgba(20,30,42,1)');
      g.addColorStop(1, 'rgba(46,60,76,1)');
      ctx.fillStyle = g;
      dolphinPath(ctx, L);
      ctx.fill();
      ctx.save();
      dolphinPath(ctx, L);
      ctx.clip();
      var rg = ctx.createLinearGradient(0, -L * .22, 0, -L * .02);
      rg.addColorStop(0, 'rgba(196,214,242,0.85)');
      rg.addColorStop(1, 'rgba(196,214,242,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(-L * .55, -L * .24, L * 1.1, L * .24);
      var wg = ctx.createRadialGradient(L * .1, -L * .02, 0, L * .1, -L * .02, L * .3);
      wg.addColorStop(0, 'rgba(226,238,255,0.42)');
      wg.addColorStop(1, 'rgba(226,238,255,0)');
      ctx.fillStyle = wg;
      ctx.fillRect(-L * .55, -L * .3, L * 1.1, L * .6);
      ctx.restore();
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(L * .02, -L * .15);
      ctx.quadraticCurveTo(-L * .06, -L * .34, -L * .14, -L * .13);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = .8;
      ctx.beginPath();
      ctx.moveTo(L * .16, L * .06);
      ctx.quadraticCurveTo(L * .04, L * .24, -L * .04, L * .1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      var edge = Math.min(u, 1 - u);
      if (edge < .16) {
        var pw2 = project(X, 0, Z);
        var k = 1 - edge / .16;
        ctx.save();
        ctx.globalAlpha = .34 * k;
        ctx.fillStyle = 'rgba(206,228,248,1)';
        for (var i = 0; i < 6; i++) {
          var a = -.35 - i * .18 - rnd(i + dp.off) * .3;
          var r = L * (.3 + rnd(i * 3.1) * .55) * k;
          ctx.beginPath();
          ctx.arc(pw2.x + Math.cos(a) * r * 1.4, pw2.y + Math.sin(a) * r * .55, Math.max(.6, L * .05 * (1 - i * .1)), 0, 6.2832);
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
    function resize() {
      var rect = host.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      var pw = Math.round(W * DPR), ph = Math.round(H * DPR);
      var q = window.innerWidth < 700 ? .66 : 1;
      var gw = Math.max(1, Math.round(pw * q)), gh = Math.max(1, Math.round(ph * q));
      glCanvas.width = gw;
      glCanvas.height = gh;
      glCanvas.style.width = '100%';
      glCanvas.style.height = '100%';
      if (gl) {
        gl.viewport(0, 0, gw, gh);
        gl.uniform2f(uRes, gw, gh);
        gl.uniform1f(uFY, FY);
        gl.uniform1f(uPitch, PITCH);
      }
      fgCanvas.width = pw;
      fgCanvas.height = ph;
      fgCanvas.style.width = '100%';
      fgCanvas.style.height = '100%';
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
      if (host.isConnected === false) {
        running = false;
        return;
      }
      if (start === null) start = ts;
      var t = (ts - start) / 1e3 + (opts.t0 || 0);
      pointer.x += (pointer.tx - pointer.x) * .045;
      pointer.y += (pointer.ty - pointer.y) * .045;
      drawGL(t);
      drawLife(t);
      window.requestAnimationFrame(frame);
    }
    function play() {
      if (running || reduced) return;
      running = true;
      start = null;
      window.requestAnimationFrame(frame);
    }
    function pause() {
      running = false;
    }
    function still() {
      resize();
      drawGL(4.2);
      drawLife(4.2);
    }
    initGL();
    resize();
    var rt;
    window.addEventListener('resize', function() {
      clearTimeout(rt);
      rt = setTimeout(reduced ? still : resize, 160);
    }, {
      passive: true
    });
    if (reduced) {
      still();
      return {
        still: still
      };
    }
    if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
      window.addEventListener('mousemove', function(e) {
        pointer.tx = e.clientX / window.innerWidth * 2 - 1;
        pointer.ty = e.clientY / window.innerHeight * 2 - 1;
      }, {
        passive: true
      });
    }
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) pause(); else if (visible) play();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function(en) {
        visible = en[0].isIntersecting;
        if (visible && !document.hidden) play(); else pause();
      }, {
        threshold: 0
      }).observe(host);
    }
    play();
    return {
      play: play,
      pause: pause
    };
  }
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
    var fixed = document.querySelector('[data-kd-seascape]') || document.querySelector('.hero-canvas');
    if (fixed) {
      attach(fixed);
      return;
    }
    var els = document.querySelectorAll('.land-top .land-film, .land-film, .filmcard');
    for (var i = 0; i < els.length; i++) attach(els[i]);
  }
  function boot() {
    scan();
    if (!window.MutationObserver) return;
    var t = null;
    new MutationObserver(function() {
      clearTimeout(t);
      t = setTimeout(scan, 120);
    }).observe(document.getElementById('app') || document.body, {
      childList: true,
      subtree: true
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
