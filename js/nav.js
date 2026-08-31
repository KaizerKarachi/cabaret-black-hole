(function () {
    var mount = document.querySelector("[data-site-nav]");
    if (!mount) return;

    var page = document.body.getAttribute("data-page") || "";
    var showTheme = document.body.hasAttribute("data-show-theme");
    var items = [
        { href: "afisha.html", id: "afisha", label: "Афиша" },
        { href: "preview.html", id: "preview", label: "Превью" },
        { href: "posyl.html", id: "posyl", label: "Посыл" },
        { href: "team.html", id: "team", label: "Команда" },
        { href: "misc.html", id: "misc", label: "Разное" },
        { href: "chat.html", id: "chat", label: "Чат" }
    ];

    var links = items.map(function (item) {
        var current = item.id === page ? ' aria-current="page"' : "";
        return '<a href="' + item.href + '" class="sidebar-btn"' + current + ">" + item.label + "</a>";
    }).join("");

    var themeBtn = showTheme
        ? '<button type="button" class="theme-toggle" data-theme-toggle aria-pressed="false">Светлая тема</button>'
        : "";

    mount.outerHTML =
        '<input type="checkbox" id="nav-toggle" class="nav-toggle" aria-hidden="true">' +
        '<label for="nav-toggle" class="nav-overlay"></label>' +
        '<label for="nav-toggle" class="nav-toggle-btn" aria-label="Открыть меню">☰</label>' +
        '<nav class="sidebar" aria-label="Разделы кабаре">' +
        '<p class="sidebar-brand">Black Hole</p>' +
        links +
        themeBtn +
        "</nav>";
})();
