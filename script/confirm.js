/* ============================================
   設定
   ============================================ */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwAyyfN88hOHErlUuhoC_8f8V29sz9Xqd4Hhx1VQ148jJaGSvC-jT4UXiXF_R6BM_8b/exec';

/* ============================================
   URLパラメータから予約情報を取得
   ============================================ */

const params   = new URLSearchParams(location.search);
const seatId   = params.get('seatId')   || '';
const seatName = params.get('seatName') || '';
const name     = params.get('name')     || '';
const pax      = params.get('pax')      || '';
const time     = params.get('time')     || '';

/* 予約番号を生成（日時＋席ID） */
function generateReservationNo() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `HR${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${seatId}${pad(now.getHours())}${pad(now.getMinutes())}`;
}
const reservationNo = generateReservationNo();

/* ============================================
   画面描画ヘルパー
   ============================================ */

const card = document.getElementById('confirmCard');

function showLoading() {
    card.innerHTML = `
        <h2>予約内容の確認</h2>
        <div class="loading-wrap">
            <div class="spinner"></div>
            <p>空席状況を確認しています…</p>
        </div>
    `;
}

function showError() {
    card.innerHTML = `
        <h2>予約内容の確認</h2>
        <div class="error-box">
            <span class="error-icon">⚠️</span>
            申し訳ございません。<br>
            お客様が指定した座席は予約がすでに埋まっています。
        </div>
        <br>
        <button class="btn-back-only" onclick="history.back()">← 席を選び直す</button>
    `;
}

function showConfirm() {
    card.innerHTML = `
        <h2>予約内容の確認</h2>
        <div class="reservation-num">
            予約番号：<span>${reservationNo}</span>
        </div>
        <table class="confirm-table">
            <tr><th>席</th><td>${seatName}</td></tr>
            <tr><th>氏名</th><td>${name}</td></tr>
            <tr><th>人数</th><td>${pax}</td></tr>
            <tr><th>時間帯</th><td>${time}</td></tr>
        </table>
        <div class="confirm-btn-row">
            <button class="btn-back" onclick="history.back()">戻る</button>
            <button class="btn-confirm" id="btnFix" onclick="doReserve()">この内容で予約する</button>
        </div>
    `;
}

function showSuccess() {
    card.innerHTML = `
        <h2>予約が完了しました</h2>
        <div class="success-box">
            <span class="success-icon">✅</span>
            <p><strong>${seatName}</strong> の予約が完了いたしました。<br>当日スタッフにお知らせください。</p>
        </div>
        <div class="reservation-num" style="margin-top:16px;">
            予約番号：<span>${reservationNo}</span>
        </div>
        <div class="qr-wrap">
            <p class="qr-label">予約QRコード</p>
            <canvas id="qrCanvas" width="200" style="display:block; margin:0 auto; border:1.5px solid #e0d0b0; border-radius:8px;"></canvas>
            <p class="qr-sub">このQRコードをスタッフにご提示ください</p>
        </div>
        <button class="btn-back-only" style="margin-top:24px;" onclick="location.href='reservation.html'">予約ページへ戻る</button>
    `;

    /* 予約番号をQRコードに描画（qrgen.js使用） */
    try {
        const matrix = QRGen.generate(reservationNo);
        const canvas = document.getElementById('qrCanvas');
        QRGen.draw(canvas, matrix);
    } catch (e) {
        console.error('QR生成エラー:', e);
        const canvas = document.getElementById('qrCanvas');
        canvas.height = 60;
        const ctx = canvas.getContext('2d');
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#888';
        ctx.fillText('QR生成できませんでした', 100, 35);
    }
}

/* ============================================
   起動時：空席チェック
   ============================================ */

async function checkAndRender() {
    if (!seatId || !name) {
        card.innerHTML = `<h2>エラー</h2><p>予約情報が不正です。<a href="reservation.html">予約ページ</a>からやり直してください。</p>`;
        return;
    }
    showLoading();
    try {
        const res  = await fetch(GAS_URL + '?t=' + Date.now(), { redirect: 'follow' });
        const data = await res.json();
        const reservations = data.reservations || {};
        if (reservations[seatId]) {
            showError();
        } else {
            showConfirm();
        }
    } catch (e) {
        console.error('空席チェック失敗', e);
        showConfirm();
    }
}

/* ============================================
   予約確定送信
   ============================================ */

let isSubmitting = false;

async function doReserve() {
    if (isSubmitting) return;
    isSubmitting = true;

    const btn = document.getElementById('btnFix');
    if (btn) { btn.disabled = true; btn.textContent = '送信中…'; }

    try {
        const res  = await fetch(GAS_URL + '?t=' + Date.now(), { redirect: 'follow' });
        const data = await res.json();
        const reservations = data.reservations || {};

        if (reservations[seatId]) {
            showError();
            isSubmitting = false;
            return;
        }

        await fetch(GAS_URL, {
            method: 'POST',
            mode:   'no-cors',
            body:   JSON.stringify({ action: 'reserve', seatId, name, pax, time, reservationNo })
        });

        const res2  = await fetch(GAS_URL + '?t=' + Date.now(), { redirect: 'follow' });
        const data2 = await res2.json();
        const after = (data2.reservations || {})[seatId];

        if (!after || after.name !== name) {
            showError();
        } else {
            showSuccess();
        }
    } catch (e) {
        console.error('予約送信エラー', e);
        alert('通信エラーが発生しました。もう一度お試しください。');
        if (btn) { btn.disabled = false; btn.textContent = 'この内容で予約する'; }
    } finally {
        isSubmitting = false;
    }
}

/* ===== 起動 ===== */
checkAndRender();