const track = document.getElementById("sliderTrack");
const dots = document.querySelectorAll(".dot");
const prevBtn = document.querySelector(".slider-btn.prev");
const nextBtn = document.querySelector(".slider-btn.next");

let currentIndex = 0;
const slideCount = dots.length;

/* スライド切り替え */
function updateSlider() {
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    dots.forEach(dot => {
        dot.classList.remove("active");
    });

    dots[currentIndex].classList.add("active");
}

/* 前へボタン */
prevBtn.addEventListener("click", () => {
    currentIndex--;
    if (currentIndex < 0) {
        currentIndex = slideCount - 1;
    }
    updateSlider();
});

/* 次へボタン */
nextBtn.addEventListener("click", () => {
    currentIndex++;
    if (currentIndex >= slideCount) {
        currentIndex = 0;
    }
    updateSlider();
});

/* ドットボタン */
dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
        currentIndex = index;
        updateSlider();
    });
});

/* 10秒ごとに自動切り替え */
setInterval(() => {
    currentIndex++;
    if (currentIndex >= slideCount) {
        currentIndex = 0;
    }
    updateSlider();
}, 10000);