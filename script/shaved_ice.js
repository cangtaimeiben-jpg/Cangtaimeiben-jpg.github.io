/* ============================================
   かき氷ページ専用スクリプト
   - フェードインアニメーション
   - カウントダウン（9月20日まで）
   ============================================ */

(function () {
  'use strict';

  /* ------------------------------------------
     フェードインアニメーション
  ------------------------------------------ */
  var fadeEls = document.querySelectorAll('.fade-in-up');

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  fadeEls.forEach(function (el) {
    observer.observe(el);
  });

  /* ------------------------------------------
     カウントダウン（9月20日 21:00:00 まで）
  ------------------------------------------ */
  var END_DATE = new Date('2026-09-20T21:00:00'); // JST
  var YOUBI = ['日', '月', '火', '水', '木', '金', '土'];

  function toZenkaku(n) {
    return String(n).replace(/[0-9]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) + 0xFEE0);
    });
  }

  function updateCountdown() {
    var numEl  = document.getElementById('js-countdown');
    var dateEl = document.getElementById('js-countdown-date');
    var box    = document.querySelector('.matsuri-countdown');
    if (!numEl || !box) return;

    var now  = new Date();
    var diff = END_DATE - now;

    // 期間終了後：カウントダウン全体を「販売終了しました」に差し替え
    if (diff <= 0) {
      box.innerHTML = '<p class="matsuri-sold-out">販売終了しました</p>';
      return;
    }

    // 期間中：通常表示
    if (dateEl) {
      var youbi = YOUBI[END_DATE.getDay()];
      dateEl.textContent = '終了日：９月２０日（' + youbi + '）';
    }

    var days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    numEl.textContent = toZenkaku(days);
  }

  updateCountdown();
  setInterval(updateCountdown, 60000);

})();
