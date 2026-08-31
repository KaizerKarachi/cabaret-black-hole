(function () {
    const audio = document.getElementById("audioPlayer");
    const playBtn = document.getElementById("playBtn");
    const playIcon = document.getElementById("playIcon");
    const pauseIcon = document.getElementById("pauseIcon");
    const progressBar = document.getElementById("progressBar");
    const progressContainer = document.getElementById("progressContainer");
    const timeDisplay = document.getElementById("timeDisplay");
    const volumeSlider = document.getElementById("volumeSlider");
    
    if (!audio || !playBtn) return;

    function setPlaying(isPlaying) {
        playIcon.style.display = isPlaying ? "none" : "block";
        pauseIcon.style.display = isPlaying ? "block" : "none";
        playBtn.classList.toggle("playing", isPlaying);
        playBtn.setAttribute("aria-pressed", String(isPlaying));
        playBtn.setAttribute("aria-label", isPlaying ? "Пауза" : "Играть");
    }

    playBtn.addEventListener("click", function () {
        if (audio.paused) {
            audio.play();
            setPlaying(true);
        } else {
            audio.pause();
            setPlaying(false);
        }
    });

    audio.addEventListener("timeupdate", function () {
        if (!audio.duration) return;
        progressBar.style.width = (audio.currentTime / audio.duration) * 100 + "%";
        updateTimeDisplay();
    });

    progressContainer.addEventListener("click", function (e) {
        const rect = progressContainer.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        if (audio.duration) audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
    });

    progressContainer.addEventListener("keydown", function (e) {
        if (!audio.duration) return;
        if (e.key === "ArrowRight") audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
        if (e.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
    });

    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ":" + String(secs).padStart(2, "0");
    }

    function updateTimeDisplay() {
        timeDisplay.textContent = formatTime(audio.currentTime) + " / " + formatTime(audio.duration);
    }

    volumeSlider.addEventListener("input", function (e) {
        audio.volume = e.target.value / 100;
    });

    audio.addEventListener("ended", function () {
        setPlaying(false);
        progressBar.style.width = "0%";
    });

    audio.volume = volumeSlider.value / 100;
    setPlaying(false);
})();
