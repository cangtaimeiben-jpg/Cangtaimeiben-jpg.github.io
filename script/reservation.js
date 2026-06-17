/* ============================================
   googleサーバのURL
   ============================================ */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwAyyfN88hOHErlUuhoC_8f8V29sz9Xqd4Hhx1VQ148jJaGSvC-jT4UXiXF_R6BM_8b/exec';

/* ============================================
   座席データ
   ============================================ */

const SEATS = [
    { id: 'A', name: 'A席', cap: 3 },
    { id: 'B', name: 'B席', cap: 3 },
    { id: 'C', name: 'C席', cap: 3 },
    { id: 'D', name: 'D席', cap: 3 },
    { id: 'E', name: 'E席', cap: 6 },
    { id: 'F', name: 'F席', cap: 6 },
    { id: 'G', name: 'G席', cap: 6 },
    { id: 'H', name: 'H席', cap: 6 },
];

/* ============================================
   状態管理
   ============================================ */

let reservations = {};
let selectedId = null;

/* ============================================
   画面描画
   ============================================ */

function render() {
    const grid = document.getElementById('seatGrid');
    grid.innerHTML = '';
    let avail = 0, res = 0;

    const today = new Date();
    document.getElementById('todayDate').textContent =
        `${today.getMonth() + 1}月${today.getDate()}日現在`;

    SEATS.forEach(s => {
        const r = reservations[s.id];
        const isRes = !!r;
        if (isRes) res++; else avail++;

        const card = document.createElement('div');
        card.className = 'seat-card' + (isRes ? ' reserved' : '');
        card.innerHTML = `
            <span class="seat-badge ${isRes ? 'badge-reserved' : 'badge-available'}">
                ${isRes ? '✕ 予約済' : '○ 空席'}
            </span>
            <p class="seat-name">${s.name}</p>
            ${isRes ? '' : `<p class="seat-cap">${s.cap}名まで</p>`}
        `;
        card.addEventListener('click', () => openModal(s.id));
        grid.appendChild(card);
    });

    document.getElementById('cnt-available').textContent = avail;
    document.getElementById('cnt-reserved').textContent = res;
    document.getElementById('cnt-total').textContent = SEATS.length;
}

/* ============================================
   人数プルダウン生成
   ============================================ */

function buildPaxOptions(cap) {
    const sel = document.getElementById('inputPax');
    sel.innerHTML = '';
    for (let i = 1; i <= cap; i++) {
        const opt = document.createElement('option');
        opt.textContent = i + '名';
        sel.appendChild(opt);
    }
}

/* ============================================
   モーダル操作
   ============================================ */

function openModal(seatId) {
    selectedId = seatId;
    const seat = SEATS.find(s => s.id === seatId);
    const r = reservations[seatId];

    document.getElementById('modalOverlay').classList.add('open');

    if (r) {
        document.getElementById('modalTitle').textContent = seat.name + '　予約情報';
        document.getElementById('formArea').style.display = 'none';
        document.getElementById('infoArea').style.display = 'block';
        document.getElementById('infoText').innerHTML =
            `この席は <strong>予約済み</strong> です`;
    } else {
        document.getElementById('modalTitle').textContent = seat.name + '　予約する';
        document.getElementById('formArea').style.display = 'block';
        document.getElementById('infoArea').style.display = 'none';
        document.getElementById('inputName').value = '';
        buildPaxOptions(seat.cap);
    }
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    selectedId = null;
}

/* ============================================
   予約操作
   ============================================ */

function generateReservationNo() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
    const randPart = Math.floor(Math.random() * 9000 + 1000);
    return `R${datePart}-${randPart}`;
}

function confirmReserve() {
    const name = document.getElementById('inputName').value.trim();
    if (!name) {
        alert('氏名を入力してください');
        return;
    }

    const seatId  = selectedId;
    const pax     = document.getElementById('inputPax').value;
    const time    = document.getElementById('inputTime').value;
    const seat    = SEATS.find(s => s.id === seatId);
    const reservationNo = generateReservationNo();

    const p = new URLSearchParams({
        reservationNo: reservationNo,
        seatId:   seatId,
        seatName: seat.name,
        name:     name,
        pax:      pax,
        time:     time
    });
    location.href = 'confirm.html?' + p.toString();
}

async function releaseReservation() {
    await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
            action: 'release',
            seatId: selectedId
        })
    });
    closeModal();
    await loadReservations();
}

async function resetAll() {
    if (confirm('予約を全てキャンセルしますか？')) {
        await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'reset' })
        });
        await loadReservations();
    }
}

/* ============================================
   初期化
   ============================================ */

document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('fade-out');
    setTimeout(() => { overlay.style.display = 'none'; }, 600);
}

async function loadReservations() {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(GAS_URL + '?t=' + Date.now(), {
            redirect: 'follow',
            signal: controller.signal
        });
        clearTimeout(timer);
        const data = await res.json();
        reservations = data.reservations || {};
    } catch(e) {
        console.error('取得失敗', e);
    }
    render();
    hideLoading();
}

/* ============================================
   日付チェック＆自動リセット
   ============================================ */

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function checkDateAndReset() {
    const today = getTodayString();
    const lastDate = localStorage.getItem('reservationDate');

    if (lastDate && lastDate !== today) {
        // 日付が変わっていたらサーバー側もリセット
        try {
            await fetch(GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ action: 'reset' })
            });
        } catch(e) {
            console.error('自動リセット失敗', e);
        }
    }

    // 今日の日付を保存
    localStorage.setItem('reservationDate', today);
}

async function init() {
    await checkDateAndReset();
    await loadReservations();
}

init();
