/* ============================================
   QR Code Generator - Pure JS, No External Dependencies
   Supports: Alphanumeric mode, Version 1-4, Error Correction M
   Encodes: A-Z 0-9 SPACE $ % * + - . / :
   ============================================ */

const QRGen = (() => {

  /* ---- 英数字モード文字テーブル ---- */
  const ALPHANUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

  /* ---- Reed-Solomon GF(256) ---- */
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x = x << 1; if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gfMul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
  function rsGen(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const ng = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        ng[j] ^= g[j];
        ng[j + 1] ^= gfMul(g[j], EXP[i]);
      }
      g = ng;
    }
    return g;
  }
  function rsEncode(data, ecLen) {
    const gen = rsGen(ecLen);
    const res = new Array(ecLen).fill(0);
    for (let i = 0; i < data.length; i++) {
      const f = data[i] ^ res.shift(); res.push(0);
      for (let j = 0; j < ecLen; j++) res[j] ^= gfMul(gen[j + 1], f);
    }
    return res;
  }

  /* ---- バージョン/EC情報テーブル (Version 1-4, EC=M) ---- */
  /* [dataCodewords, ecCodewordsPerBlock, blocks] */
  const VER_INFO = [
    null,
    [16,  10, 1],  // v1  M
    [28,  16, 1],  // v2  M
    [44,  26, 1],  // v3  M
    [64,  18, 2],  // v4  M  (2 blocks × 9 data)
  ];

  /* ---- 英数字エンコード ---- */
  function encodeAlphaNum(str) {
    const bits = [];
    const push = (v, n) => { for (let i = n-1; i >= 0; i--) bits.push((v >> i) & 1); };
    push(0b0010, 4);                   // mode indicator
    push(str.length, 9);               // char count (v1-3 uses 9 bits for alpha)
    for (let i = 0; i < str.length - 1; i += 2) {
      push(ALPHANUM.indexOf(str[i]) * 45 + ALPHANUM.indexOf(str[i+1]), 11);
    }
    if (str.length % 2) push(ALPHANUM.indexOf(str[str.length-1]), 6);
    return bits;
  }

  /* ---- ビット列 → コードワード ---- */
  function bitsToCodewords(bits, totalData) {
    /* terminator */
    const rem = bits.length % 8;
    if (bits.length < totalData * 8) {
      const term = Math.min(4, totalData * 8 - bits.length);
      for (let i = 0; i < term; i++) bits.push(0);
    }
    while (bits.length % 8) bits.push(0);
    const pads = [0b11101100, 0b00010001];
    let pi = 0;
    while (bits.length < totalData * 8) { bits.push(...pads[pi++ % 2].toString(2).padStart(8,'0').split('').map(Number)); }
    const cws = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cws.push(b);
    }
    return cws;
  }

  /* ---- バージョン選択 ---- */
  function pickVersion(str) {
    /* 英数字モードのビット数: 4 + 9 + ceil(len/2)*11 + (len%2)*6 */
    for (let v = 1; v <= 4; v++) {
      const [dataCW] = VER_INFO[v];
      const bitLen = 4 + 9 + Math.floor(str.length/2)*11 + (str.length%2)*6;
      const needed = Math.ceil((bitLen + 4) / 8);
      if (needed <= dataCW) return v;
    }
    return null;
  }

  /* ---- QRマトリクス構築 ---- */
  const UNDEF = 2;
  function makeMatrix(size) {
    return Array.from({length: size}, () => new Array(size).fill(UNDEF));
  }

  function setFinder(m, r, c) {
    const pat = [[1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,1,0,1],[1,0,1,1,1,0,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1]];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) m[r+i][c+j] = pat[i][j];
  }

  function setSeparators(m, size) {
    for (let i = 0; i < 8; i++) {
      [m[7][i], m[i][7], m[size-8][i], m[i][size-8], m[7][size-1-i], m[size-1-i][7]] = [0,0,0,0,0,0];
    }
    m[7][7] = 0;
  }

  function setTiming(m, size) {
    for (let i = 8; i < size - 8; i++) { m[6][i] = m[i][6] = (i % 2 === 0) ? 1 : 0; }
  }

  function setDark(m) { m[8][13] = 1; } // dark module for version 1 QR

  function setFormatInfo(m, size, mask) {
    /* EC=M(01), mask pattern */
    const ec = 0b01;
    const data = (ec << 3) | mask;
    const gen = 0b10100110111;
    let rem = data << 10;
    for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= gen << (i - 10);
    const fmt = ((data << 10) | rem) ^ 0b101010000010010;
    const bits = [];
    for (let i = 14; i >= 0; i--) bits.push((fmt >> i) & 1);
    const pos = [0,1,2,3,4,5,7,8,8,8,8,8,8,8,8];
    const pos2 = [8,8,8,8,8,8,8,8,7,5,4,3,2,1,0];
    for (let i = 0; i < 15; i++) {
      m[pos[i]][8]         = bits[i];
      m[8][pos2[14-i]]     = bits[i];
      m[size-1-i][8]       = bits[i];
      m[8][size-1-(14-i)]  = bits[i];
    }
  }

  /* ---- マスクパターン適用 ---- */
  const MASKS = [
    (r,c)=>((r+c)%2===0),
    (r,c)=>(r%2===0),
    (r,c)=>(c%3===0),
    (r,c)=>((r+c)%3===0),
    (r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0,
    (r,c)=>((r*c)%2+(r*c)%3===0),
    (r,c)=>(((r*c)%2+(r*c)%3)%2===0),
    (r,c)=>(((r+c)%2+(r*c)%3)%2===0),
  ];

  function applyMask(m, size, mask) {
    const mfn = MASKS[mask];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (m[r][c] === UNDEF) continue;
      /* データ領域のみマスク（機能パターンは除外） */
    }
    /* データビットを配置するときにマスクを適用するので、ここでは何もしない */
  }

  /* ---- データビットを配置 ---- */
  function placeData(m, size, dataBits) {
    let idx = 0;
    let dir = -1; // up
    let row = size - 1;
    for (let col = size - 1; col >= 1; col -= 2) {
      if (col === 6) col = 5; // timing column skip
      for (let cnt = 0; cnt < size; cnt++) {
        const r = (dir === -1) ? row - cnt : row + cnt;
        if (r < 0 || r >= size) continue;
        for (let dc = 0; dc <= 1; dc++) {
          const c = col - dc;
          if (m[r][c] !== UNDEF) continue;
          const bit = idx < dataBits.length ? dataBits[idx++] : 0;
          m[r][c] = bit;
        }
      }
      row = (dir === -1) ? row - size : row + size;
      if (row < 0) { row = 0; dir = 1; }
      else if (row >= size) { row = size - 1; dir = -1; }
    }
  }

  /* ---- 正しいデータ配置（ジグザグスキャン） ---- */
  function placeDataBits(m, size, dataBits, maskFn) {
    let idx = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const cols = [right, right - 1];
      const rows = upward
        ? Array.from({length: size}, (_, i) => size - 1 - i)
        : Array.from({length: size}, (_, i) => i);
      for (const r of rows) {
        for (const c of cols) {
          if (m[r][c] !== UNDEF) continue;
          const bit = idx < dataBits.length ? dataBits[idx++] : 0;
          const masked = maskFn(r, c) ? (bit ^ 1) : bit;
          m[r][c] = masked;
        }
      }
      upward = !upward;
    }
  }

  /* ---- ペナルティ計算 ---- */
  function penalty(m, size) {
    let score = 0;
    // rule 1: 5+ consecutive same color
    for (let r = 0; r < size; r++) {
      let run = 1;
      for (let c = 1; c < size; c++) {
        if (m[r][c] === m[r][c-1]) { run++; if (run===5) score+=3; else if(run>5) score++; }
        else run = 1;
      }
    }
    for (let c = 0; c < size; c++) {
      let run = 1;
      for (let r = 1; r < size; r++) {
        if (m[r][c] === m[r-1][c]) { run++; if (run===5) score+=3; else if(run>5) score++; }
        else run = 1;
      }
    }
    // rule 2: 2x2 blocks
    for (let r = 0; r < size-1; r++) for (let c = 0; c < size-1; c++) {
      const v = m[r][c];
      if (v===m[r][c+1] && v===m[r+1][c] && v===m[r+1][c+1]) score += 3;
    }
    return score;
  }

  /* ---- メイン生成関数 ---- */
  function generate(str) {
    str = str.toUpperCase();
    for (const ch of str) if (!ALPHANUM.includes(ch)) throw new Error(`Unsupported char: ${ch}`);
    const ver = pickVersion(str);
    if (!ver) throw new Error('String too long');

    const [totalData, ecPerBlock, blocks] = VER_INFO[ver];
    const dataPerBlock = Math.floor(totalData / blocks);
    const size = ver * 4 + 17;

    /* エンコード */
    const bits = encodeAlphaNum(str);
    const cws  = bitsToCodewords(bits, totalData);

    /* RS符号化 */
    const allCW = [];
    for (let b = 0; b < blocks; b++) {
      const d = cws.slice(b * dataPerBlock, (b+1) * dataPerBlock);
      const ec = rsEncode(d, ecPerBlock);
      allCW.push({d, ec});
    }
    /* インターリーブ */
    const finalCW = [];
    for (let i = 0; i < dataPerBlock; i++) for (const blk of allCW) finalCW.push(blk.d[i]);
    for (let i = 0; i < ecPerBlock; i++) for (const blk of allCW) finalCW.push(blk.ec[i]);

    /* ビット展開 */
    const finalBits = [];
    for (const cw of finalCW) for (let i = 7; i >= 0; i--) finalBits.push((cw >> i) & 1);

    /* マスク候補でペナルティ最小を選択 */
    let bestMask = 0, bestScore = Infinity, bestMatrix = null;
    for (let mask = 0; mask < 8; mask++) {
      const m = makeMatrix(size);
      setFinder(m, 0, 0); setFinder(m, 0, size-7); setFinder(m, size-7, 0);
      setSeparators(m, size); setTiming(m, size); setDark(m);
      setFormatInfo(m, size, mask);
      placeDataBits(m, size, finalBits, MASKS[mask]);
      const s = penalty(m, size);
      if (s < bestScore) { bestScore = s; bestMask = mask; bestMatrix = m; }
    }

    return bestMatrix;
  }

  /* ---- Canvas描画 ---- */
  function draw(canvas, matrix, dark = '#3e2a0e', light = '#ffffff') {
    const size = matrix.length;
    const cell = Math.floor(canvas.width / (size + 8));
    const offset = Math.floor((canvas.width - cell * size) / 2);
    canvas.height = canvas.width;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = light; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      ctx.fillStyle = matrix[r][c] === 1 ? dark : light;
      ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell);
    }
  }

  return { generate, draw };
})();