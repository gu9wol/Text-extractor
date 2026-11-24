/* =========================================================
   PADDOCK CLIPPER — app.js
   본문 → 블록 파싱 → 칸(slot) 단위 자동 페이지 넘김 → 카드 렌더 → PNG/ZIP 저장
   ========================================================= */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- 데이터 ---------- */
// 모토원 팀 컬러 팔레트 (말풍선색 프리셋). 색을 바꾸려면 여기만 고치면 됩니다.
const TEAMS = {
  FACTORY: [
    ['RAVEN', '#1f1d2e'], ['ZENITH', '#f0c419'], ['SEIKA', '#d72638'],
    ['ARDOR', '#ff6a13'], ['NOVARA', '#14a37f'], ['ATLAS', '#1d4ed8'],
  ],
  SATELLITE: [
    ['ORIGIN', '#8b7fe0'], ['LIBERTY', '#00a3c4'], ['VECTOR', '#b8e300'],
    ['TITAN', '#5f6675'], ['FALCON', '#ec5f9c'],
  ],
};

const THEMES = [
  { id: 'messenger', name: '메신저', en: 'BASIC' },
  { id: 'timeline', name: '타임라인', en: 'BASIC' },
  { id: 'terminal', name: '단말기', en: 'BASIC' },
  { id: 'game', name: '게임 대화창', en: 'BASIC' },
  { id: 'script', name: '대본', en: 'BASIC' },
  { id: 'radio', name: 'TEAM RADIO', en: 'MOTIVO 1', m1: true },
  { id: 'pass', name: 'PADDOCK PASS', en: 'MOTIVO 1', m1: true },
  { id: 'live', name: 'LIVE 중계 자막', en: 'MOTIVO 1', m1: true },
  { id: 'pit', name: 'PIT BOARD', en: 'MOTIVO 1', m1: true },
];

const FONTS = [
  { id: 'pretendard', name: '프리텐다드', css: '"Pretendard Variable",Pretendard,sans-serif' },
  { id: 'noto-sans', name: '노토 산스', css: '"Noto Sans KR",sans-serif' },
  { id: 'noto-serif', name: '노토 세리프', css: '"Noto Serif KR",serif' },
  { id: 'nanum-myeongjo', name: '나눔명조', css: '"Nanum Myeongjo",serif' },
  { id: 'gowun-batang', name: '고운바탕', css: '"Gowun Batang",serif' },
  { id: 'hahmlet', name: '함렛', css: '"Hahmlet",serif' },
  { id: 'gowun-dodum', name: '고운돋움', css: '"Gowun Dodum",sans-serif' },
  { id: 'ibm-plex', name: 'IBM Plex Sans KR', css: '"IBM Plex Sans KR",sans-serif' },
  { id: 'coding', name: '나눔고딕코딩', css: '"Nanum Gothic Coding",monospace' },
  { id: 'black-han', name: '검은고딕', css: '"Black Han Sans",sans-serif' },
  { id: 'do-hyeon', name: '도현', css: '"Do Hyeon",sans-serif' },
];

const RATIOS = {
  '1:1': [540, 540], '4:5': [540, 675], '3:4': [540, 720], '9:16': [540, 960],
  '16:9': [800, 450], '3:1': [960, 320], 'fit': [540, 0],
};

const INK = { black: '#121420', white: '#ffffff' };

const defProfile = i => ({
  name: '', tag: '', side: i === 1 ? 'R' : 'L', avatar: '',
  color: i === 1 ? '#26316b' : '#eeedf6', text: i === 1 ? '#ffffff' : '#14162a',
});

const DEFAULTS = {
  mode: 'normal', theme: 'messenger', photoOn: true,
  title: '', credit: '', creditAlign: 'left', creditSize: 12, titleSize: 30,
  font: 'pretendard', valign: 'top', justify: false,
  fontSize: 17, tracking: -0.01, widthScale: 100, leading: 1.7,
  ratio: '4:5', columns: '1', pageNum: false, padding: 44,
  inkMode: 'black', inkCustom: '#16204a',
  frame: 'livery', frameEmoji: '🏁', frameColor: '#16204a', frameColor2: '#b7aef0',
  bgType: 'solid', bg1: '#ffffff', bg2: '#e9e6fc', bgAngle: 160,
  bgPattern: 'dots', bgPatternSize: 18, bgImage: '', bgDim: 0.3, bgBlur: 0, bgHtml: '',
  profiles: [0, 1, 2, 3, 4, 5].map(defProfile),
};

const SAMPLE = `# 패독 클리퍼
## 모토원 발췌기

본문을 붙여 넣으면 카드 이미지로 만들어 줍니다. 카드 비율을 고정하면 넘치는 글은 **자동으로 다음 장**에 이어져요.

-- LAP 01 --

[1] 이번 랩에 피트 들어와. 타이어 다 됐어. <[오후 3:12]>
[-] Box this lap. Tyres are gone.
[2] ==한 바퀴만 더== 버틸게. <[오후 3:12]>

---

> 인용은 줄 앞에 > 를 붙이면 됩니다.

글자를 고르고 툴바를 눌러 {#6a5ad8}색{/}을 바꾸거나 ||검열||할 수 있어요. 프로필 이름과 색은 SECTOR 03에서 정합니다.`;

/* ---------- 상태 ---------- */
let S = clone(DEFAULTS);
let TEXT = SAMPLE;
const photos = [];      // {src,w,h}
const stickerImgs = []; // {src,w,h}
let stickers = [];      // {id,img,page,x,y,w}  (x,y,w = 카드 너비/높이 대비 비율)
let selSticker = null;
let pages = [];         // 렌더된 카드 [{card,w,h}]
let zoom = 0.55;
let userFonts = [];     // {id,name,css}

const LS_STATE = 'paddockClipper.state.v1';
const LS_PRESETS = 'paddockClipper.presets.v1';
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

function mergeSettings(src) {
  const out = clone(DEFAULTS);
  if (!src || typeof src !== 'object') return out;
  for (const k of Object.keys(DEFAULTS)) {
    if (k === 'profiles') continue;
    if (k in src && typeof src[k] === typeof DEFAULTS[k]) out[k] = src[k];
  }
  if (Array.isArray(src.profiles)) {
    out.profiles = out.profiles.map((d, i) => {
      const p = src.profiles[i] || {};
      const o = { ...d };
      for (const k of Object.keys(d)) if (typeof p[k] === 'string') o[k] = p[k];
      if (o.side !== 'L' && o.side !== 'R') o.side = d.side;
      return o;
    });
  }
  return out;
}

/* ---------- 색 도우미 ---------- */
function hexRgb(h) {
  h = (h || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(h) {
  const [r, g, b] = hexRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const autoText = c => (lum(c) > 0.42 ? '#14162a' : '#ffffff');

/* =========================================================
   인라인 서식 파서
   **굵게** *기울임* __밑줄__ ~~취소~~ ==형광== =={#hex}형광== {#hex}색{/} ||검열||
   ========================================================= */
const OPENERS = [
  { re: /^\*\*/, close: '**', tag: 'b' },
  { re: /^__/, close: '__', tag: 'u' },
  { re: /^~~/, close: '~~', tag: 's' },
  { re: /^\|\|/, close: '||', tag: 'cen' },
  { re: /^==\{(#[0-9a-fA-F]{3,8})\}/, close: '==', tag: 'mark' },
  { re: /^==/, close: '==', tag: 'mark' },
  { re: /^\{(#[0-9a-fA-F]{3,8})\}/, close: '{/}', tag: 'color' },
  { re: /^\*/, close: '*', tag: 'i' },
];
function wrapTag(op, arg, inner) {
  switch (op.tag) {
    case 'b': return `<b>${inner}</b>`;
    case 'i': return `<i>${inner}</i>`;
    case 'u': return `<u>${inner}</u>`;
    case 's': return `<s>${inner}</s>`;
    case 'cen': return `<span class="cen">${inner}</span>`;
    case 'mark': return `<mark${arg ? ` style="--hl:${arg}"` : ''}>${inner}</mark>`;
    case 'color': return `<span style="color:${arg}">${inner}</span>`;
  }
  return inner;
}
function inline(src) {
  const failed = new Set();
  function pi(s, i, close) {
    let out = '', buf = '';
    while (i < s.length) {
      if (close && s.startsWith(close, i) && !(close === '*' && s.startsWith('**', i))) {
        return [out + esc(buf), i + close.length, true];
      }
      if (s[i] === '\\' && i + 1 < s.length) { buf += s[i + 1]; i += 2; continue; }
      let matched = false;
      for (const op of OPENERS) {
        const m = op.re.exec(s.slice(i, i + 12));
        if (!m) continue;
        const start = i + m[0].length, key = start + '|' + op.close;
        if (failed.has(key)) continue;
        const [inner, j, ok] = pi(s, start, op.close);
        if (ok && inner !== '') {
          out += esc(buf) + wrapTag(op, m[1], inner); buf = ''; i = j; matched = true; break;
        }
        failed.add(key);
      }
      if (!matched) { buf += s[i]; i++; }
    }
    return [out + esc(buf), i, !close];
  }
  return pi(src, 0, null)[0];
}

/* =========================================================
   본문 파서 → 블록 설명 배열
   ========================================================= */
const RE_TIME = /\s*<\[([^\]]*)\]>\s*$/;
const RE_PHOTO = /^\[사진\s*(\d+)\]$/;

function parse(text) {
  const chat = S.mode === 'chat';
  const out = [];
  let lastSpeaker = null;
  const last = () => out[out.length - 1];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  for (let raw of lines) {
    let line = raw.replace(/\s+$/, '');
    let time = '';
    const tm = line.match(RE_TIME);
    if (tm) { time = tm[1].trim(); line = line.slice(0, tm.index); }
    const t = line.trim();

    if (t === '') {
      if (!chat) out.push({ type: 'gap' });
      continue;
    }
    if (/^={3,}$/.test(t)) { out.push({ type: 'break' }); lastSpeaker = null; continue; }

    let m;
    // 번역
    if ((m = t.match(/^\[-\]\s?(.*)$/))) {
      const l = last();
      const html = inline(m[1]);
      if (l && ('tr' in l)) l.tr = l.tr ? l.tr + '<br>' + html : html;
      else out.push({ type: 'p', html: '', tr: html });
      continue;
    }
    // 시스템 알림 / 날짜
    if ((m = t.match(/^\[s\]\s?(.*)$/i))) { out.push({ type: 'sys', html: inline(m[1]) }); lastSpeaker = null; continue; }
    if ((m = t.match(/^\[d\]\s?(.*)$/i))) { out.push({ type: 'date', html: inline(m[1]) }); lastSpeaker = null; continue; }
    // 말풍선
    if ((m = t.match(/^\[([1-6])\]\s?(.*)$/))) {
      const p = +m[1] - 1;
      const body = m[2].trim();
      const pm = body.match(RE_PHOTO);
      const grp = lastSpeaker === p;
      if (pm) {
        if (!S.photoOn) continue;
        const ph = photos[+pm[1] - 1];
        if (!ph) continue;
        out.push({ type: 'msg', p, html: '', tr: '', time, img: +pm[1] - 1, grp });
      } else {
        out.push({ type: 'msg', p, html: inline(body), tr: '', time, grp });
      }
      lastSpeaker = p;
      continue;
    }
    // 사진
    if ((m = t.match(RE_PHOTO))) {
      if (!S.photoOn) continue;
      if (!photos[+m[1] - 1]) continue;
      out.push({ type: 'img', img: +m[1] - 1 });
      lastSpeaker = null;
      continue;
    }

    if (chat) {
      if (lastSpeaker !== null) out.push({ type: 'msg', p: lastSpeaker, html: inline(t), tr: '', time, grp: true });
      else out.push({ type: 'p', html: inline(t), tr: '' });
      continue;
    }

    // 일반 모드 문법
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) { out.push({ type: 'h' + m[1].length, html: inline(m[2]), tr: '' }); continue; }
    if (/^-{3,}$/.test(t)) { out.push({ type: 'hr' }); continue; }
    if ((m = t.match(/^--\s+(.+?)\s+--$/))) { out.push({ type: 'hrt', html: inline(m[1]) }); continue; }
    if ((m = t.match(/^>\s?(.*)$/))) { out.push({ type: 'q', html: inline(m[1]), tr: '' }); continue; }
    out.push({ type: 'p', html: inline(line.replace(/^\s+/, '')), tr: '' });
    lastSpeaker = null;
  }
  // 앞뒤 빈 줄 정리
  while (out.length && out[0].type === 'gap') out.shift();
  while (out.length && out[out.length - 1].type === 'gap') out.pop();
  return out;
}

/* =========================================================
   블록 → DOM
   ========================================================= */
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function profileOf(i) {
  const p = S.profiles[i];
  return { ...p, name: p.name.trim() || `프로필 ${i + 1}`, idx: i };
}
function tagDigits(p) {
  const m = (p.tag || '').match(/\d+/);
  return m ? m[0].padStart(2, '0') : String(p.idx + 1).padStart(2, '0');
}
function imgEl(n, kind) {
  const ph = photos[n];
  const im = document.createElement('img');
  im.src = ph.src; im.alt = '';
  im.dataset.r = String(ph.h / ph.w);
  im.dataset.nw = String(ph.w);
  im.dataset.kind = kind;
  return im;
}
function inkIsLight() { return lum(inkColor()) > 0.5; }

function buildMsg(d) {
  const p = profileOf(d.p);
  const theme = S.theme;
  const pc = p.color, pt = p.text;
  let pcx = pc;
  if (!inkIsLight() && lum(pc) > 0.6) pcx = mix(pc, '#000000', 0.55);
  if (inkIsLight() && lum(pc) < 0.12) pcx = mix(pc, '#ffffff', 0.55);
  const pcx2 = lum(pc) < 0.12 ? mix(pc, '#ffffff', 0.6) : pc;

  const m = el('div', `blk msg ${p.side}` + (d.grp ? ' grp' : '') + (d.img != null ? ' phmsg' : ''));
  m.style.cssText = `--pc:${pc};--pt:${pt};--pcx:${pcx};--pcx2:${pcx2}`;
  m.dataset.split = d.img == null ? '1' : '';
  const av = el('div', 'av');
  if (p.avatar) av.style.backgroundImage = `url("${p.avatar}")`;
  const tagT = p.tag ? esc(p.tag) : '';
  const timeT = d.time ? esc(d.time) : '';

  // 헤더
  const hd = el('div', 'hd');
  if (theme === 'radio') {
    let seed = 0; for (const ch of (p.name + d.html)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    let bars = '';
    for (let i = 0; i < 9; i++) { seed = (seed * 1103515245 + 12345) >>> 0; bars += `<i style="height:${25 + (seed % 75)}%"></i>`; }
    hd.innerHTML = `<span class="wave">${bars}</span><span class="ch">CH ${tagDigits(p)}</span><span>·</span><span class="nm">${esc(p.name)}</span>${tagT ? `<span class="tg">${tagT}</span>` : ''}${timeT ? `<span class="tm">${timeT}</span>` : ''}`;
  } else if (theme === 'live') {
    hd.innerHTML = `<span class="num">${tagDigits(p).replace(/^0/, '')}</span><span class="nm">${esc(p.name)}</span><span class="live">LIVE</span>${timeT ? `<span class="tm">${timeT}</span>` : ''}`;
  } else if (theme === 'pass') {
    const pav = el('div', 'pav');
    if (p.avatar) pav.style.backgroundImage = `url("${p.avatar}")`;
    hd.appendChild(pav);
    hd.insertAdjacentHTML('beforeend', `<div class="who"><span class="nm">${esc(p.name)}</span>${tagT ? `<span class="tg">${tagT}</span>` : ''}</div>${timeT ? `<span class="tm">${timeT}</span>` : ''}`);
  } else {
    hd.innerHTML = `<span class="nm">${esc(p.name)}</span>${tagT ? `<span class="tg">${tagT}</span>` : ''}${timeT ? `<span class="tm">${timeT}</span>` : ''}`;
  }

  const main = el('div', 'main');
  main.appendChild(hd);
  const line = el('div', 'line');
  const bx = el('div', 'bx' + (d.img != null ? ' phbx' : ''));
  const sp = el('div', 'sp', d.html);
  bx.appendChild(sp);
  if (d.img != null) { const ph = el('div', 'ph'); ph.appendChild(imgEl(d.img, 'bubble')); bx.appendChild(ph); }
  if (d.tr) bx.appendChild(el('div', 'tr after', d.tr));
  line.appendChild(bx);
  if (timeT) line.appendChild(el('span', 'tm after', timeT));
  main.appendChild(line);

  if (theme === 'pass') {
    m.appendChild(el('div', 'strip', `<span class="lbl2">ACCREDITATION</span><span class="hole"></span><span>${esc((p.tag || 'ALL ACCESS').toUpperCase())}</span>`));
    m.appendChild(main);
    m.appendChild(el('div', 'bar', `<span>PADDOCK · P${String(p.idx + 1).padStart(2, '0')}</span><span class="code"></span>`));
  } else {
    m.appendChild(av);
    m.appendChild(main);
  }
  return m;
}

function buildBlock(d) {
  let b;
  switch (d.type) {
    case 'p': case 'q':
      b = el('div', `blk ${d.type}`);
      b.appendChild(el('div', 'sp' + (d.html ? '' : ' empty'), d.html));
      if (d.tr) b.appendChild(el('div', 'tr after', d.tr));
      b.dataset.split = '1';
      break;
    case 'h1': case 'h2': case 'h3':
      b = el('div', `blk ${d.type}`);
      b.appendChild(el('div', 'sp', d.html));
      if (d.tr) b.appendChild(el('div', 'tr after', d.tr));
      b.dataset.keep = '1';
      break;
    case 'hr': b = el('div', 'blk hr'); break;
    case 'hrt': b = el('div', 'blk hrt', `<span>${d.html}</span>`); b.dataset.keep = '1'; break;
    case 'gap': b = el('div', 'blk sp-gap'); break;
    case 'img': b = el('div', 'blk img'); b.appendChild(imgEl(d.img, 'body')); break;
    case 'sys': b = el('div', 'blk sys', `<span>${d.html}</span>`); break;
    case 'date': b = el('div', 'blk date', `<span>${d.html}</span>`); b.dataset.keep = '1'; break;
    case 'msg': b = buildMsg(d); break;
    default: b = el('div', 'blk');
  }
  b.dataset.type = d.type;
  return b;
}

/* =========================================================
   카드 뼈대
   ========================================================= */
function inkColor() { return S.inkMode === 'custom' ? S.inkCustom : INK[S.inkMode] || INK.black; }
function fontCss() {
  const f = FONTS.concat(userFonts).find(x => x.id === S.font);
  return f ? f.css : FONTS[0].css;
}
function cardSize() { return RATIOS[S.ratio] || RATIOS['4:5']; }

function bgCss() {
  const c1 = S.bg1, c2 = S.bg2, s = S.bgPatternSize;
  if (S.bgType === 'gradient') return `linear-gradient(${S.bgAngle}deg, ${c1}, ${c2})`;
  if (S.bgType === 'pattern') {
    switch (S.bgPattern) {
      case 'dots': return `radial-gradient(${c2} 17%, transparent 19%) 0 0/${s}px ${s}px, ${c1}`;
      case 'grid': return `linear-gradient(${c2} 1px, transparent 1px) 0 0/${s}px ${s}px, linear-gradient(90deg, ${c2} 1px, transparent 1px) 0 0/${s}px ${s}px, ${c1}`;
      case 'stripes': return `repeating-linear-gradient(-45deg, ${c2} 0 ${s / 2}px, ${c1} ${s / 2}px ${s}px)`;
      case 'checker': return `conic-gradient(${c2} 25%, ${c1} 0 50%, ${c2} 0 75%, ${c1} 0) 0 0/${s}px ${s}px`;
      case 'carbon': return `linear-gradient(45deg, ${c2} 25%, transparent 25%, transparent 75%, ${c2} 75%) 0 0/${s}px ${s}px, linear-gradient(45deg, ${c2} 25%, transparent 25%, transparent 75%, ${c2} 75%) ${s / 2}px ${s / 2}px/${s}px ${s}px, linear-gradient(160deg, rgba(255,255,255,.07), rgba(0,0,0,.18)), ${c1}`;
    }
  }
  return c1;
}

function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.querySelectorAll('script,style,link,iframe,frame,object,embed,meta,base,form,input,textarea,button,select,audio,video').forEach(n => n.remove());
  doc.body.querySelectorAll('*').forEach(e => {
    for (const a of Array.from(e.attributes)) {
      const n = a.name.toLowerCase();
      if (n.startsWith('on') || (/(href|src|action)$/.test(n) && /^\s*(javascript|vbscript):/i.test(a.value))) e.removeAttribute(a.name);
    }
  });
  return doc.body.innerHTML;
}

function buildCard(first) {
  const [w, h] = cardSize();
  const fit = S.ratio === 'fit';
  const card = el('div', `card t-${S.theme}` + (fit ? ' fit' : '') + (S.justify ? ' justify' : ''));
  const pad = S.padding;
  const st = card.style;
  st.width = w + 'px';
  if (!fit) st.height = h + 'px';
  st.setProperty('--c-font', fontCss());
  st.setProperty('--c-size', S.fontSize + 'px');
  st.setProperty('--c-lead', S.leading);
  st.setProperty('--c-track', S.tracking + 'em');
  st.setProperty('--c-sx', S.widthScale / 100);
  st.setProperty('--c-pad', pad + 'px');
  st.setProperty('--c-gap', Math.round(pad * 0.7) + 'px');
  st.setProperty('--c-tsize', S.titleSize + 'px');
  st.setProperty('--c-csize', S.creditSize + 'px');
  st.setProperty('--c-valign', { top: 'flex-start', center: 'safe center', bottom: 'safe flex-end' }[S.valign] || 'flex-start');
  st.setProperty('--c-para', '0.4em');
  st.setProperty('--c-msg', '0.8em');
  st.setProperty('--ink-c', inkColor());
  st.setProperty('--fr1', S.frameColor);
  st.setProperty('--fr2', S.frameColor2);

  // 배경
  const bg = el('div', 'c-bg');
  if (S.bgType === 'image') {
    bg.style.background = S.bg1;
    if (S.bgImage) {
      const im = el('div', 'c-bg-img');
      im.style.backgroundImage = `url("${S.bgImage}")`;
      if (S.bgBlur) { im.style.filter = `blur(${S.bgBlur}px)`; im.style.transform = 'scale(1.06)'; }
      bg.appendChild(im);
      const dim = el('div', 'c-bg-dim'); dim.style.opacity = S.bgDim; bg.appendChild(dim);
    }
  } else if (S.bgType === 'html') {
    bg.style.background = S.bg1;
    bg.appendChild(el('div', 'c-bg-html', sanitizeHtml(S.bgHtml)));
  } else {
    bg.style.background = bgCss();
  }
  card.appendChild(bg);

  // 장식
  const fr = el('div', 'c-frame');
  if (S.frame === 'border') fr.appendChild(el('div', 'fr-border'));
  else if (S.frame === 'emoji') {
    const e = esc(S.frameEmoji || '✦');
    const P = 'calc(var(--c-pad) / 2)';
    const spots = [[P, P], ['50%', P], [`calc(100% - ${P})`, P], [P, '50%'], [`calc(100% - ${P})`, '50%'], [P, `calc(100% - ${P})`], ['50%', `calc(100% - ${P})`], [`calc(100% - ${P})`, `calc(100% - ${P})`]];
    for (const [x, y] of spots) { const s = el('span', 'fr-emoji', e); s.style.left = x; s.style.top = y; fr.appendChild(s); }
  } else if (S.frame === 'livery' || S.frame === 'checker') {
    fr.appendChild(el('div', `fr-band t fr-${S.frame}`));
    fr.appendChild(el('div', `fr-band b fr-${S.frame}`));
  }
  card.appendChild(fr);

  const inner = el('div', 'c-inner');
  if (first && S.title.trim()) inner.appendChild(el('div', 'c-title', inline(S.title.trim())));
  const body = el('div', 'c-body');
  const cols = [], flows = [];
  const n = S.columns === '2' ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const c = el('div', 'c-col'), f = el('div', 'flow');
    c.appendChild(f); body.appendChild(c); cols.push(c); flows.push(f);
  }
  inner.appendChild(body);
  let pnum = null;
  if (S.credit.trim() || S.pageNum) {
    const foot = el('div', 'c-foot');
    const cr = el('div', `c-credit ${S.creditAlign}`);
    if (S.credit.trim()) {
      if (S.creditAlign === 'spread' && S.credit.includes('|')) {
        const i = S.credit.indexOf('|');
        cr.appendChild(el('span', '', inline(S.credit.slice(0, i).trim())));
        cr.appendChild(el('span', '', inline(S.credit.slice(i + 1).trim())));
      } else {
        cr.appendChild(el('span', '', inline(S.credit.replace('|', ' ').trim())));
      }
    }
    foot.appendChild(cr);
    if (S.pageNum) { pnum = el('span', 'c-pnum', '0/0'); foot.appendChild(pnum); }
    inner.appendChild(foot);
  }
  card.appendChild(inner);
  const stk = el('div', 'c-stk');
  card.appendChild(stk);
  return { card, cols, flows, pnum, stk };
}

/* =========================================================
   글자 단위 쪼개기 (서식 유지)
   ========================================================= */
function nodeLen(n) {
  if (n.nodeType === 3) return n.data.length;
  if (n.nodeName === 'BR') return 1;
  let s = 0; for (const c of n.childNodes) s += nodeLen(c); return s;
}
function plain(n) {
  if (n.nodeType === 3) return n.data;
  if (n.nodeName === 'BR') return '\n';
  let s = ''; for (const c of n.childNodes) s += plain(c); return s;
}
function sliceNode(n, a, b) {
  if (n.nodeType === 3) { const t = n.data.slice(a, b); return t ? document.createTextNode(t) : null; }
  if (n.nodeName === 'BR') return a <= 0 && b >= 1 ? n.cloneNode(false) : null;
  const c = n.cloneNode(false);
  let off = 0, any = false;
  for (const ch of n.childNodes) {
    const L = nodeLen(ch);
    const s = Math.max(a - off, 0), e = Math.min(b - off, L);
    if (e > s) { const r = sliceNode(ch, s, e); if (r) { c.appendChild(r); any = true; } }
    off += L;
  }
  return any ? c : null;
}
function makePart(block, a, b, head) {
  const c = block.cloneNode(true);
  const sp = c.querySelector('.sp');
  const src = block.querySelector('.sp');
  const part = sliceNode(src, a, b);
  sp.innerHTML = '';
  if (part) while (part.firstChild) sp.appendChild(part.firstChild);
  if (head) {
    c.querySelectorAll('.after').forEach(x => x.remove());
    c.classList.add('cut');
  } else {
    c.classList.add('cont');
    c.classList.remove('grp');
    if (!plain(sp).trim()) sp.classList.add('empty');
    // 이어지는 조각의 앞 공백 제거
    const tw = document.createTreeWalker(sp, NodeFilter.SHOW_TEXT);
    const first = tw.nextNode();
    if (first) first.data = first.data.replace(/^\s+/, '');
  }
  return c;
}

/* =========================================================
   페이지 나누기
   ========================================================= */
function paginate(descs) {
  const measure = $('#measure');
  measure.innerHTML = '';
  const fit = S.ratio === 'fit';
  const out = [];
  let page, slot, flow, col;

  const newPage = () => {
    page = buildCard(out.length === 0);
    measure.appendChild(page.card);
    out.push(page);
    slot = 0; flow = page.flows[0]; col = page.cols[0];
  };
  const nextSlot = () => {
    if (!fit && slot < page.flows.length - 1) { slot++; flow = page.flows[slot]; col = page.cols[slot]; }
    else newPage();
  };
  const colH = () => col.clientHeight;
  const fits = () => flow.offsetHeight <= colH() + 0.5;
  const isEmpty = () => !Array.from(flow.children).some(c => !c.dataset.carried);
  const pageEmpty = () => page.flows.every(f => f.children.length === 0);
  const advance = () => {
    const carry = [];
    const lastEl = flow.lastElementChild;
    if (lastEl && lastEl.dataset.keep && !lastEl.dataset.carried && flow.children.length > 1) { lastEl.remove(); carry.push(lastEl); }
    nextSlot();
    for (const c of carry) { c.dataset.carried = '1'; flow.appendChild(c); }
  };
  const sizeImages = blk => {
    const cw = col.clientWidth;
    for (const im of blk.querySelectorAll('img[data-r]')) {
      const r = +im.dataset.r, nw = +im.dataset.nw;
      const max = im.dataset.kind === 'bubble' ? cw * 0.62 : cw;
      const w = Math.max(16, Math.min(max, nw));
      im.style.width = w + 'px'; im.style.height = (w * r) + 'px';
    }
  };
  const shrinkImage = blk => {
    const im = blk.querySelector('img[data-r]');
    if (!im) return;
    const over = flow.offsetHeight - colH();
    const h = parseFloat(im.style.height) - over - 1;
    const nh = Math.max(24, h);
    im.style.height = nh + 'px';
    im.style.width = (nh / +im.dataset.r) + 'px';
  };
  const splitToFit = blk => {
    const sp = blk.querySelector('.sp');
    if (!sp) return null;
    const total = nodeLen(sp);
    let cur = blk;
    const test = k => {
      const h = makePart(blk, 0, k, true);
      flow.replaceChild(h, cur); cur = h;
      return fits();
    };
    let lo = 0, hi = total; // 최대 k (lo는 항상 들어가는 값)
    if (total === 0 || !test(1)) { flow.replaceChild(blk, cur); return null; }
    lo = 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (test(mid)) lo = mid; else hi = mid - 1;
    }
    let k = lo;
    const txt = plain(sp);
    if (k < total) {
      // 가능하면 띄어쓰기에서 끊기
      for (let j = k - 1; j > Math.max(0, k - 14); j--) {
        if (/\s/.test(txt[j])) { k = j + 1; break; }
      }
      const code = txt.charCodeAt(k - 1);
      if (code >= 0xd800 && code <= 0xdbff && k > 1) k--;
    }
    if (k >= total && !blk.querySelector('.after')) { flow.replaceChild(blk, cur); return null; }
    const head = makePart(blk, 0, k, true);
    flow.replaceChild(head, cur);
    return { head, tail: makePart(blk, k, total, false) };
  };

  newPage();
  for (const d of descs) {
    if (d.type === 'break') { if (!pageEmpty()) newPage(); continue; }
    let blk = buildBlock(d);
    let guard = 0;
    while (guard++ < 400) {
      const empty = isEmpty();
      if (empty && !fit && (d.type === 'gap' || d.type === 'hr')) break; // 칸 맨 위의 빈 줄은 버림
      flow.appendChild(blk);
      sizeImages(blk);
      if (fit || fits()) break;
      if (blk.querySelector('img[data-r]')) {
        if (!empty) { blk.remove(); advance(); continue; }
        shrinkImage(blk); break;
      }
      if (blk.dataset.split === '1') {
        const r = splitToFit(blk);
        if (r) { blk = r.tail; nextSlot(); continue; }
      }
      if (!empty) { blk.remove(); advance(); continue; }
      break; // 빈 칸에도 안 들어가는 블록은 그대로 둠
    }
  }

  // 맞춤 비율 + 2단: 높이 기준으로 반씩
  if (fit && page.flows.length === 2) {
    for (const pg of out) {
      const [a, b] = pg.flows;
      const half = a.offsetHeight / 2;
      const kids = Array.from(a.children);
      let moving = false;
      for (const k of kids) {
        if (!moving && k.offsetTop + k.offsetHeight / 2 > half && k !== kids[0]) moving = true;
        if (moving) b.appendChild(k);
      }
    }
  }
  // 빈 마지막 장 제거
  while (out.length > 1 && out[out.length - 1].flows.every(f => f.children.length === 0)) {
    out.pop().card.remove();
  }
  out.forEach((pg, i) => { if (pg.pnum) pg.pnum.textContent = `${i + 1}/${out.length}`; });
  return out;
}

/* =========================================================
   렌더 & 미리보기
   ========================================================= */
let renderTimer = 0;
function scheduleRender(delay = 140) { clearTimeout(renderTimer); renderTimer = setTimeout(render, delay); }

function render() {
  document.body.classList.toggle('mode-chat', S.mode === 'chat');
  const descs = parse(TEXT);
  pages = paginate(descs);
  mountPreview();
  updatePageUI();
}

function effZoom(w) {
  const grid = $('#preview');
  const avail = grid.clientWidth - 40;
  if (avail <= 50) return zoom;
  if (window.matchMedia('(max-width:860px)').matches) return Math.min(1, avail / w);
  return Math.max(0.1, Math.min(zoom, avail / w));
}

function mountPreview() {
  const grid = $('#preview');
  grid.innerHTML = '';
  const [w] = cardSize();
  const z = effZoom(w);
  grid.style.setProperty('--hz', 1 / z);
  pages.forEach((pg, i) => {
    const item = el('div', 'pv-item');
    const frame = el('div', 'pv-frame');
    pg.card.remove();
    frame.appendChild(pg.card);
    pg.card.style.transform = `scale(${z})`;
    item.appendChild(frame);
    const bar = el('div', 'pv-bar', `<span class="pg">PAGE ${String(i + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}</span>`);
    const bSave = el('button', '', '저장'); bSave.type = 'button'; bSave.onclick = () => saveOne(i);
    const bCopy = el('button', '', '복사'); bCopy.type = 'button'; bCopy.onclick = () => copyOne(i);
    bar.append(bSave, bCopy);
    item.appendChild(bar);
    grid.appendChild(item);
    pg.index = i;
    renderStickers(pg);
  });
  sizeFrames();
}
function sizeFrames() {
  const [w] = cardSize();
  const z = effZoom(w);
  $('#preview').style.setProperty('--hz', 1 / z);
  pages.forEach(pg => {
    const frame = pg.card.parentElement;
    pg.card.style.transform = `scale(${z})`;
    pg.w = pg.card.offsetWidth; pg.h = pg.card.offsetHeight; pg.z = z;
    frame.style.width = pg.w * z + 'px';
    frame.style.height = pg.h * z + 'px';
  });
}

function updatePageUI() {
  $('#pageCount').textContent = `${pages.length}장`;
  $('#mPageCount').textContent = pages.length;
  const sel = $('#stickerPage');
  const prev = sel.value;
  sel.innerHTML = pages.map((_, i) => `<option value="${i}">${i + 1}장</option>`).join('');
  if (prev && +prev < pages.length) sel.value = prev;
}

/* ---------- 스티커 ---------- */
function renderStickers(pg) {
  pg.stk.innerHTML = '';
  for (const s of stickers) {
    if (s.page !== pg.index || !stickerImgs[s.img]) continue;
    const e = el('div', 'stk' + (s.id === selSticker ? ' sel' : ''));
    e.dataset.id = s.id;
    e.style.left = s.x * 100 + '%';
    e.style.top = s.y * 100 + '%';
    e.style.width = s.w * 100 + '%';
    const im = document.createElement('img'); im.src = stickerImgs[s.img].src; im.alt = '';
    e.appendChild(im);
    const del = el('button', 'h-del', '×'); del.type = 'button'; del.title = '삭제';
    const rs = el('button', 'h-rs', '⤡'); rs.type = 'button'; rs.title = '크기';
    e.append(del, rs);
    pg.stk.appendChild(e);
  }
}
function refreshStickers() { pages.forEach(renderStickers); }

function initStickerDrag() {
  const grid = $('#preview');
  grid.addEventListener('pointerdown', ev => {
    const stkEl = ev.target.closest('.stk');
    if (!stkEl) {
      if (selSticker) { selSticker = null; refreshStickers(); }
      return;
    }
    const s = stickers.find(x => x.id === stkEl.dataset.id);
    if (!s) return;
    ev.preventDefault();
    if (ev.target.classList.contains('h-del')) {
      stickers = stickers.filter(x => x !== s); selSticker = null; refreshStickers(); return;
    }
    const pg = pages.find(p => p.index === s.page);
    if (!pg) return;
    if (selSticker !== s.id) { selSticker = s.id; refreshStickers(); }
    const node = pg.stk.querySelector(`.stk[data-id="${s.id}"]`);
    const resize = ev.target.classList.contains('h-rs');
    const sx = ev.clientX, sy = ev.clientY, ox = s.x, oy = s.y, ow = s.w;
    const W = pg.w * pg.z, H = pg.h * pg.z;
    const move = e => {
      const dx = (e.clientX - sx) / W, dy = (e.clientY - sy) / H;
      if (resize) {
        s.w = Math.max(0.04, Math.min(2, ow + dx));
        node.style.width = s.w * 100 + '%';
      } else {
        s.x = ox + dx; s.y = oy + dy;
        node.style.left = s.x * 100 + '%'; node.style.top = s.y * 100 + '%';
      }
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

/* =========================================================
   저장
   ========================================================= */
const toastEl = () => $('#toast');
let toastT = 0;
function toast(msg) {
  const t = toastEl(); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}
function libReady() {
  if (!window.modernScreenshot) { toast('이미지 저장 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'); return false; }
  return true;
}
async function cardBlob(i) {
  const pg = pages[i];
  if (selSticker) { selSticker = null; refreshStickers(); }
  await document.fonts.ready;
  return window.modernScreenshot.domToBlob(pg.card, {
    scale: 2, type: 'image/png',
    width: pg.card.offsetWidth, height: pg.card.offsetHeight,
    style: { transform: 'none' },
    filter: n => !(n.classList && (n.classList.contains('h-del') || n.classList.contains('h-rs'))),
  });
}
function fileBase() {
  const t = (S.title || 'paddock-clipper').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/[*_~=|{}#]+$/g, '').slice(0, 40);
  return t || 'paddock-clipper';
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function saveOne(i) {
  if (!libReady()) return;
  try {
    const b = await cardBlob(i);
    download(b, `${fileBase()}_${String(i + 1).padStart(2, '0')}.png`);
  } catch (e) { console.error(e); toast('저장에 실패했어요.'); }
}
async function copyOne(i) {
  if (!libReady()) return;
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no clipboard');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': cardBlob(i) })]);
    toast(`${i + 1}장을 클립보드에 복사했어요.`);
  } catch (e) { console.error(e); toast('이 브라우저에서는 이미지 복사가 안 돼요. 저장을 써 주세요.'); }
}
async function saveAll() {
  if (!libReady()) return;
  const btn = $('#saveAll');
  btn.disabled = true;
  try {
    if (pages.length === 1) { await saveOne(0); return; }
    if (!window.JSZip) { toast('ZIP 도구를 불러오지 못했어요.'); return; }
    const zip = new JSZip();
    for (let i = 0; i < pages.length; i++) {
      btn.textContent = `만드는 중 ${i + 1}/${pages.length}`;
      zip.file(`${fileBase()}_${String(i + 1).padStart(2, '0')}.png`, await cardBlob(i));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    download(blob, `${fileBase()}.zip`);
    toast(`${pages.length}장을 ZIP으로 저장했어요.`);
  } catch (e) { console.error(e); toast('저장에 실패했어요.'); }
  finally { btn.disabled = false; btn.textContent = '전체 ZIP 저장'; }
}

/* =========================================================
   파일 읽기
   ========================================================= */
function readFile(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
async function readImage(file, maxSide, square) {
  const src = await readFile(file);
  const im = await loadImg(src);
  let w = im.naturalWidth, h = im.naturalHeight;
  if (!square && Math.max(w, h) <= maxSide) return { src, w, h };
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  if (square) {
    const s = Math.min(w, h);
    cv.width = cv.height = maxSide;
    ctx.drawImage(im, (w - s) / 2, (h - s) / 2, s, s, 0, 0, maxSide, maxSide);
    return { src: cv.toDataURL('image/jpeg', 0.9), w: maxSide, h: maxSide };
  }
  const k = maxSide / Math.max(w, h);
  cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  ctx.drawImage(im, 0, 0, cv.width, cv.height);
  const png = /png|gif|webp|svg/.test(file.type);
  return { src: cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9), w: cv.width, h: cv.height };
}

/* =========================================================
   UI 바인딩
   ========================================================= */
const ta = () => $('#text');
let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!lsSet(LS_STATE, { settings: S, text: TEXT })) {
      const lite = clone(S); lite.bgImage = '';
      lsSet(LS_STATE, { settings: lite, text: TEXT });
    }
  }, 400);
}
function changed(delay) { persist(); scheduleRender(delay); }

function fmtOut(k, v) {
  switch (k) {
    case 'tracking': return (v >= 0 ? '+' : '') + Number(v).toFixed(3) + 'em';
    case 'widthScale': return v + '%';
    case 'leading': return Number(v).toFixed(2);
    case 'bgAngle': return v + '°';
    case 'bgDim': return Math.round(v * 100) + '%';
    case 'bgBlur': return v + 'px';
    default: return v + 'px';
  }
}

function syncUI() {
  $$('[data-k]').forEach(inp => {
    const k = inp.dataset.k; const v = S[k];
    if (inp.type === 'checkbox') inp.checked = !!v; else inp.value = v;
  });
  $$('[data-out]').forEach(o => { o.textContent = fmtOut(o.dataset.out, S[o.dataset.out]); });
  $$('[data-seg]').forEach(seg => {
    const k = seg.dataset.seg;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(S[k])));
  });
  $$('.seg-btn[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === S.mode));
  $('#photoOn').checked = S.photoOn;
  $$('[data-show]').forEach(e => {
    const [k, vals] = e.dataset.show.split('=');
    e.hidden = !vals.split(',').includes(String(S[k]));
  });
  $$('.theme-btn').forEach(b => b.classList.toggle('on', b.dataset.theme === S.theme));
  if (!FONTS.concat(userFonts).some(f => f.id === S.font)) S.font = 'pretendard';
  $('#fontSel').value = S.font;
  buildProfiles();
}

function bindControls() {
  $$('[data-k]').forEach(inp => {
    const k = inp.dataset.k;
    const ev = inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input';
    inp.addEventListener(ev, () => {
      let v;
      if (inp.type === 'checkbox') v = inp.checked;
      else if (inp.type === 'range') v = parseFloat(inp.value);
      else v = inp.value;
      S[k] = v;
      const o = $(`[data-out="${k}"]`); if (o) o.textContent = fmtOut(k, v);
      if (k === 'bgHtml') changed(400); else changed(inp.type === 'range' ? 60 : 160);
    });
  });
  $$('[data-seg]').forEach(seg => {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      S[seg.dataset.seg] = b.dataset.v;
      syncUI(); changed(0);
    });
  });
  $$('.seg-btn[data-mode]').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.mode; syncUI(); changed(0); }));
  $('#photoOn').addEventListener('change', e => { S.photoOn = e.target.checked; changed(0); });

  // 본문
  const t = ta();
  t.value = TEXT;
  t.addEventListener('input', () => { TEXT = t.value; updateCount(); changed(180); });
  t.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b' || k === 'i' || k === 'u') { e.preventDefault(); applyFmt(k); }
  });
  $('#toolbar').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  $('#toolbar').addEventListener('click', e => { const b = e.target.closest('button[data-fmt]'); if (b) applyFmt(b.dataset.fmt); });

  // 테마
  const tg = $('#themeGrid');
  tg.innerHTML = THEMES.map(th => `<button type="button" class="theme-btn${th.m1 ? ' m1' : ''}" data-theme="${th.id}"><small>${th.en}</small><b>${th.name}</b></button>`).join('');
  tg.addEventListener('click', e => { const b = e.target.closest('.theme-btn'); if (!b) return; S.theme = b.dataset.theme; syncUI(); changed(0); });

  // 폰트
  fillFonts();
  $('#fontInput').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const data = await readFile(f);
      const n = userFonts.length + 1;
      const fam = `PC User Font ${n}`;
      const fmt = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' }[f.name.split('.').pop().toLowerCase()] || 'truetype';
      $('#userFonts').textContent += `@font-face{font-family:"${fam}";src:url(${data}) format("${fmt}");font-display:block}\n`;
      const id = 'user-' + n;
      userFonts.push({ id, name: '내 폰트 · ' + f.name.replace(/\.[^.]+$/, '').slice(0, 24), css: `"${fam}",sans-serif` });
      fillFonts();
      S.font = id; $('#fontSel').value = id;
      await document.fonts.load(`16px "${fam}"`).catch(() => {});
      changed(0);
      toast('폰트를 추가했어요. 새로고침하면 다시 올려야 해요.');
    } catch { toast('폰트를 읽지 못했어요.'); }
  });

  // 사진
  $('#photoInput').addEventListener('change', async e => {
    const files = Array.from(e.target.files); e.target.value = '';
    for (const f of files) { try { photos.push(await readImage(f, 1800)); } catch { toast(`${f.name}을(를) 읽지 못했어요.`); } }
    renderPhotoList(); changed(0);
  });
  $('#photoList').addEventListener('click', e => {
    const th = e.target.closest('.thumb'); if (!th) return;
    const i = +th.dataset.i;
    if (e.target.classList.contains('x')) {
      photos.splice(i, 1);
      renderPhotoList(); changed(0);
      toast('사진을 지웠어요. 뒤 번호가 하나씩 당겨집니다.');
      return;
    }
    insertAtCursor(`[사진${i + 1}]`, true);
  });

  // 배경 이미지
  $('#bgImageInput').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { S.bgImage = (await readImage(f, 1600)).src; changed(0); } catch { toast('이미지를 읽지 못했어요.'); }
  });
  $('#bgImageClear').addEventListener('click', () => { S.bgImage = ''; changed(0); });

  // 스티커
  $('#stickerInput').addEventListener('change', async e => {
    const files = Array.from(e.target.files); e.target.value = '';
    for (const f of files) { try { stickerImgs.push(await readImage(f, 900)); } catch { /* skip */ } }
    renderStickerList();
  });
  $('#stickerList').addEventListener('click', e => {
    const th = e.target.closest('.thumb'); if (!th) return;
    const i = +th.dataset.i;
    if (e.target.classList.contains('x')) {
      stickerImgs[i] = null; stickers = stickers.filter(s => s.img !== i);
      renderStickerList(); refreshStickers(); return;
    }
    const page = +($('#stickerPage').value || 0);
    const pg = pages[page]; if (!pg) return;
    const im = stickerImgs[i];
    const w = 0.28, hFrac = (w * pg.w * (im.h / im.w)) / pg.h;
    const s = { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), img: i, page, x: 0.5 - w / 2, y: 0.5 - hFrac / 2, w };
    stickers.push(s); selSticker = s.id; refreshStickers();
    if (window.matchMedia('(max-width:860px)').matches) setView('preview');
  });
  initStickerDrag();

  // 프리셋
  $('#presetSave').addEventListener('click', () => {
    const name = $('#presetName').value.trim() || `프리셋 ${new Date().toLocaleString('ko-KR')}`;
    const list = lsGet(LS_PRESETS) || [];
    const idx = list.findIndex(p => p.name === name);
    const item = { name, settings: clone(S), at: Date.now() };
    if (idx >= 0) { if (!confirm(`"${name}" 프리셋을 덮어쓸까요?`)) return; list[idx] = item; } else list.push(item);
    if (!lsSet(LS_PRESETS, list)) { toast('브라우저 저장 공간이 부족해요. 배경 이미지를 빼고 다시 시도해 주세요.'); return; }
    $('#presetName').value = '';
    renderPresets(); toast('프리셋을 저장했어요.');
  });
  $('#presetList').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const list = lsGet(LS_PRESETS) || [];
    const i = +b.dataset.i; const p = list[i]; if (!p) return;
    if (b.dataset.act === 'load') { S = mergeSettings(p.settings); syncUI(); changed(0); toast(`"${p.name}"을(를) 불러왔어요.`); }
    if (b.dataset.act === 'del') { if (!confirm(`"${p.name}" 프리셋을 지울까요?`)) return; list.splice(i, 1); lsSet(LS_PRESETS, list); renderPresets(); }
  });
  $('#presetExport').addEventListener('click', () => {
    const data = { app: 'paddock-clipper', version: 1, current: S, presets: lsGet(LS_PRESETS) || [] };
    download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'paddock-clipper-presets.json');
  });
  $('#presetImport').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const incoming = Array.isArray(data.presets) ? data.presets : [];
      if (data.settings && !data.presets) incoming.push({ name: data.name || f.name.replace(/\.json$/, ''), settings: data.settings });
      const list = lsGet(LS_PRESETS) || [];
      let n = 0;
      for (const p of incoming) {
        if (!p || typeof p.name !== 'string' || typeof p.settings !== 'object') continue;
        let name = p.name.slice(0, 60), k = 2;
        while (list.some(x => x.name === name)) name = `${p.name.slice(0, 54)} (${k++})`;
        list.push({ name, settings: mergeSettings(p.settings), at: Date.now() }); n++;
      }
      if (!lsSet(LS_PRESETS, list)) { toast('브라우저 저장 공간이 부족해요.'); return; }
      renderPresets();
      if (data.current && confirm('파일에 들어 있는 "현재 설정"도 바로 적용할까요?')) { S = mergeSettings(data.current); syncUI(); changed(0); }
      toast(`프리셋 ${n}개를 가져왔어요.`);
    } catch { toast('JSON 파일을 읽지 못했어요.'); }
  });
  $('#resetAll').addEventListener('click', () => {
    if (!confirm('디자인 설정과 프로필을 처음 상태로 돌릴까요? (본문은 그대로)')) return;
    S = clone(DEFAULTS); syncUI(); changed(0);
  });

  // 미리보기
  $('#zoom').addEventListener('input', e => { zoom = +e.target.value / 100; sizeFrames(); });
  $('#saveAll').addEventListener('click', saveAll);
  $$('.mtab').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(sizeFrames, 120); });
}

function setView(v) {
  $('#layout').dataset.view = v;
  $$('.mtab').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  if (v === 'preview') requestAnimationFrame(sizeFrames);
  window.scrollTo({ top: 0 });
}

function fillFonts() {
  const sel = $('#fontSel');
  sel.innerHTML = FONTS.concat(userFonts).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
  sel.value = S.font;
}

function updateCount() { $('#charCount').textContent = `${TEXT.replace(/\s/g, '').length.toLocaleString()}자`; }

function renderPhotoList() {
  $('#photoList').innerHTML = photos.map((p, i) =>
    `<div class="thumb" data-i="${i}" role="button" tabindex="0" title="[사진${i + 1}] 넣기" style="background-image:url('${p.src}')"><span class="no">사진${i + 1}</span><button type="button" class="x" aria-label="삭제">×</button></div>`).join('');
}
function renderStickerList() {
  $('#stickerList').innerHTML = stickerImgs.map((p, i) => p ?
    `<div class="thumb" data-i="${i}" role="button" tabindex="0" title="붙이기" style="background-image:url('${p.src}')"><button type="button" class="x" aria-label="삭제">×</button></div>` : '').join('');
}
function renderPresets() {
  const list = lsGet(LS_PRESETS) || [];
  $('#presetList').innerHTML = list.map((p, i) =>
    `<li><b title="${esc(p.name)}">${esc(p.name)}</b><button type="button" class="btn sm ghost" data-act="load" data-i="${i}">불러오기</button><button type="button" class="btn sm ghost danger" data-act="del" data-i="${i}">삭제</button></li>`).join('');
}

/* ---------- 프로필 ---------- */
let openProfiles = new Set([0]);
function buildProfiles() {
  const wrap = $('#profiles');
  const chips = Object.entries(TEAMS).map(([grp, list]) =>
    `<div class="pal-row"><span>${grp}</span>${list.map(([n, c]) => `<button type="button" class="chip" data-c="${c}" style="background:${c};color:${autoText(c)}">${n}</button>`).join('')}</div>`).join('');
  wrap.innerHTML = S.profiles.map((p, i) => `
    <details class="prof" data-i="${i}"${openProfiles.has(i) ? ' open' : ''}>
      <summary>
        <span class="prof-no" style="background:${p.color};color:${p.text}">${i + 1}</span>
        <span class="prof-av" style="${p.avatar ? `background-image:url('${p.avatar}')` : ''}"></span>
        <span class="prof-name">${p.name ? esc(p.name) : `<em>프로필 ${i + 1} · 비어 있음</em>`}</span>
        <span class="prof-side">${p.side === 'L' ? 'LEFT' : 'RIGHT'}</span>
      </summary>
      <div class="prof-body">
        <div class="row">
          <label class="fld"><span class="lbl">NAME</span><input type="text" data-p="name" value="${esc(p.name)}" placeholder="이름"></label>
          <label class="fld"><span class="lbl">TAG</span><input type="text" data-p="tag" value="${esc(p.tag)}" placeholder="#9 · RAVEN"></label>
        </div>
        <div class="row">
          <div class="seg sm" style="flex:1"><button type="button" data-side="L" class="${p.side === 'L' ? 'on' : ''}">왼쪽</button><button type="button" data-side="R" class="${p.side === 'R' ? 'on' : ''}">오른쪽</button></div>
          <label class="btn sm ghost file">프로필 사진<input type="file" accept="image/*" data-av hidden></label>
          ${p.avatar ? '<button type="button" class="btn sm ghost" data-avclear>사진 빼기</button>' : ''}
        </div>
        <div class="row">
          <label class="fld mini"><span class="lbl">BUBBLE</span><input type="color" class="swatch-in" data-p="color" value="${p.color}"></label>
          <label class="fld mini"><span class="lbl">TEXT</span><input type="color" class="swatch-in" data-p="text" value="${p.text}"></label>
        </div>
        <div class="palette"><span class="lbl">TEAM COLORS</span>${chips}</div>
      </div>
    </details>`).join('');
}
function bindProfiles() {
  const wrap = $('#profiles');
  const refreshSummary = (det, p, i) => {
    const s = det.querySelector('summary');
    s.querySelector('.prof-no').style.cssText = `background:${p.color};color:${p.text}`;
    s.querySelector('.prof-name').innerHTML = p.name ? esc(p.name) : `<em>프로필 ${i + 1} · 비어 있음</em>`;
    s.querySelector('.prof-side').textContent = p.side === 'L' ? 'LEFT' : 'RIGHT';
  };
  wrap.addEventListener('toggle', e => {
    const d = e.target.closest('.prof'); if (!d) return;
    const i = +d.dataset.i; d.open ? openProfiles.add(i) : openProfiles.delete(i);
  }, true);
  wrap.addEventListener('input', e => {
    const det = e.target.closest('.prof'); if (!det) return;
    const i = +det.dataset.i, p = S.profiles[i];
    const k = e.target.dataset.p; if (!k) return;
    p[k] = e.target.value;
    if (k === 'color') { p.text = autoText(p.color); det.querySelector('[data-p="text"]').value = p.text; }
    refreshSummary(det, p, i); changed(120);
  });
  wrap.addEventListener('click', e => {
    const det = e.target.closest('.prof'); if (!det) return;
    const i = +det.dataset.i, p = S.profiles[i];
    const side = e.target.closest('[data-side]');
    if (side) {
      p.side = side.dataset.side;
      det.querySelectorAll('[data-side]').forEach(b => b.classList.toggle('on', b === side));
      refreshSummary(det, p, i); changed(0); return;
    }
    const chip = e.target.closest('.chip');
    if (chip) {
      p.color = chip.dataset.c; p.text = autoText(p.color);
      det.querySelector('[data-p="color"]').value = p.color;
      det.querySelector('[data-p="text"]').value = p.text;
      refreshSummary(det, p, i); changed(0); return;
    }
    if (e.target.closest('[data-avclear]')) { p.avatar = ''; buildProfiles(); changed(0); }
  });
  wrap.addEventListener('change', async e => {
    if (!e.target.matches('[data-av]')) return;
    const det = e.target.closest('.prof'); const i = +det.dataset.i;
    const f = e.target.files[0]; if (!f) return;
    try { S.profiles[i].avatar = (await readImage(f, 192, true)).src; buildProfiles(); changed(0); }
    catch { toast('사진을 읽지 못했어요.'); }
  });
}

/* ---------- 툴바 ---------- */
function replaceSel(str, selectInner) {
  const t = ta();
  const s = t.selectionStart, e = t.selectionEnd;
  t.focus();
  t.setSelectionRange(s, e);
  let ok = false;
  try { ok = document.execCommand('insertText', false, str); } catch { ok = false; }
  if (!ok || t.value.slice(s, s + str.length) !== str) t.setRangeText(str, s, e, 'end');
  if (selectInner) t.setSelectionRange(s + selectInner[0], s + selectInner[1]);
  TEXT = t.value; updateCount(); changed(60);
}
function insertAtCursor(str, ownLine) {
  const t = ta();
  const s = t.selectionStart, v = t.value;
  let ins = str;
  if (ownLine) {
    if (s > 0 && v[s - 1] !== '\n') ins = '\n' + ins;
    if (v[t.selectionEnd] !== undefined && v[t.selectionEnd] !== '\n') ins += '\n';
  }
  replaceSel(ins);
  if (window.matchMedia('(max-width:860px)').matches) toast(`${str.trim()} 넣었어요.`);
}
function wrapSel(open, close) {
  const t = ta();
  const sel = t.value.slice(t.selectionStart, t.selectionEnd);
  if (!sel) { replaceSel(open + close, [open.length, open.length]); return; }
  // 줄마다 따로 감싸기 (줄 문법 유지)
  const lines = sel.split('\n');
  const out = lines.map(l => {
    if (!l.trim()) return l;
    const m = l.match(/^(\s*(?:\[[1-6sd-]\]\s?|#{1,3}\s|>\s?)?)(.*?)(\s*(?:<\[[^\]]*\]>)?\s*)$/i);
    return m ? m[1] + open + m[2] + close + m[3] : open + l + close;
  }).join('\n');
  replaceSel(out, [0, out.length]);
}
function applyFmt(f) {
  const t = ta();
  switch (f) {
    case 'b': return wrapSel('**', '**');
    case 'i': return wrapSel('*', '*');
    case 'u': return wrapSel('__', '__');
    case 's': return wrapSel('~~', '~~');
    case 'censor': return wrapSel('||', '||');
    case 'hl': { const c = $('#hlColor').value; return wrapSel(c.toLowerCase() === '#fff176' ? '==' : `=={${c}}`, '=='); }
    case 'color': return wrapSel(`{${$('#fcColor').value}}`, '{/}');
    case 'clear': {
      const sel = t.value.slice(t.selectionStart, t.selectionEnd);
      if (!sel) { toast('서식을 지울 글자를 먼저 선택하세요.'); return; }
      const out = sel.replace(/==\{#[0-9a-fA-F]{3,8}\}|\{#[0-9a-fA-F]{3,8}\}|\{\/\}|\*\*|__|~~|\|\||==/g, '').replace(/(^|[^*])\*(?!\*)/g, '$1');
      return replaceSel(out, [0, out.length]);
    }
    case 'quote': {
      const v = t.value;
      const a = v.lastIndexOf('\n', t.selectionStart - 1) + 1;
      let b = v.indexOf('\n', Math.max(t.selectionEnd - (t.selectionEnd > t.selectionStart ? 1 : 0), t.selectionStart));
      if (b < 0) b = v.length;
      t.setSelectionRange(a, b);
      const lines = v.slice(a, b).split('\n');
      const all = lines.every(l => !l.trim() || /^>\s?/.test(l));
      const out = lines.map(l => !l.trim() ? l : all ? l.replace(/^>\s?/, '') : '> ' + l).join('\n');
      return replaceSel(out, [0, out.length]);
    }
    case 'pagebreak': return insertAtCursor('===', true);
    case 'date': {
      const d = new Date();
      const days = '일월화수목금토';
      return insertAtCursor(`[d] ${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`, true);
    }
    case 'notice': return insertAtCursor('[s] 알림 내용', true);
  }
}

/* =========================================================
   시작
   ========================================================= */
function init() {
  const saved = lsGet(LS_STATE);
  if (saved) {
    S = mergeSettings(saved.settings);
    if (typeof saved.text === 'string') TEXT = saved.text;
  }
  bindControls();
  bindProfiles();
  syncUI();
  renderPresets();
  updateCount();
  zoom = +$('#zoom').value / 100;
  render();
  // 웹폰트가 늦게 도착하면 다시 나눔
  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', () => scheduleRender(80));
    document.fonts.ready.then(() => scheduleRender(0));
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
