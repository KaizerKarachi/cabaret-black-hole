(function () {
    var KEY = "cbh-theme";

    function current() {
        return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    }

    function apply(theme) {
        if (theme === "light") {
            document.documentElement.setAttribute("data-theme", "light");
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
        try {
            localStorage.setItem(KEY, theme);
        } catch (e) {}

        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", theme === "light" ? "#eef0f2" : "#0a0a0a");

        document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
            var light = theme === "light";
            btn.setAttribute("aria-pressed", String(light));
            btn.textContent = light ? "Тёмная тема" : "Светлая тема";
            btn.setAttribute("aria-label", light ? "Включить тёмную тему" : "Включить светлую тему");
        });
    }

    apply(current());

    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            apply(current() === "light" ? "dark" : "light");
        });
    });
})();
