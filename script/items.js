// スクロール連動 fade-in-up
// IntersectionObserver で .fade-in-up 要素が画面内に入ったら .is-visible を付与

document.addEventListener('DOMContentLoaded', function () {
  const targets = document.querySelectorAll('.fade-in-up');

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          // 一度表示したら監視を外す（再スクロールで消えないように）
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15, // 要素の15%が見えたらトリガー
      rootMargin: '0px 0px -40px 0px' // 画面下端より40px手前で発火
    }
  );

  targets.forEach(function (el) {
    observer.observe(el);
  });
});
