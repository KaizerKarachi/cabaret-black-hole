(function () {
    try {
        if (localStorage.getItem("cbh-theme") === "light") {
            document.documentElement.setAttribute("data-theme", "light");
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute("content", "#eef0f2");
        }
    } catch (e) {}
})();
