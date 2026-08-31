(function () {
    var TOKEN_KEY = "cbh-chat-token";
    var apiBase = (window.CHAT_API || location.origin).replace(/\/$/, "");

    var gate = document.getElementById("chatGate");
    var room = document.getElementById("chatRoom");
    var loginForm = document.getElementById("loginForm");
    var loginError = document.getElementById("loginError");
    var chatLog = document.getElementById("chatLog");
    var chatWho = document.getElementById("chatWho");
    var sendForm = document.getElementById("sendForm");
    var chatText = document.getElementById("chatText");
    var logoutBtn = document.getElementById("logoutBtn");
    var connection;

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatTime(iso) {
        var date = new Date(iso);
        if (isNaN(date.getTime())) return "";
        return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    }

    function addLine(message) {
        var p = document.createElement("p");
        p.className = "chat-line";
        p.innerHTML =
            "<time>" + escapeHtml(formatTime(message.at || message.At)) + "</time>" +
            "<strong>" + escapeHtml(message.name || message.Name) + "</strong>: " +
            escapeHtml(message.text || message.Text);
        chatLog.appendChild(p);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    function showError(text) {
        loginError.textContent = text;
    }

    function token() {
        try {
            return sessionStorage.getItem(TOKEN_KEY) || "";
        } catch (e) {
            return "";
        }
    }

    function setToken(value) {
        try {
            if (value) sessionStorage.setItem(TOKEN_KEY, value);
            else sessionStorage.removeItem(TOKEN_KEY);
        } catch (e) {}
    }

    function showRoom(name) {
        gate.classList.remove("is-open");
        room.classList.add("is-open");
        chatWho.textContent = "Вы: " + name;
    }

    function showGate() {
        room.classList.remove("is-open");
        gate.classList.add("is-open");
        if (connection) {
            connection.stop();
            connection = null;
        }
    }

    async function connect(name) {
        if (!window.signalR) {
            showError("Не загрузилась библиотека чата.");
            return;
        }
        if (!apiBase) {
            showError("Адрес сервера чата не задан.");
            return;
        }

        connection = new signalR.HubConnectionBuilder()
            .withUrl(apiBase + "/hubs/chat", {
                accessTokenFactory: function () { return token(); }
            })
            .withAutomaticReconnect()
            .build();

        connection.on("history", function (items) {
            chatLog.innerHTML = "";
            (items || []).forEach(addLine);
        });
        connection.on("message", addLine);

        try {
            await connection.start();
            showRoom(name);
            showError("");
        } catch (e) {
            showError("Сервер чата недоступен. Проверьте, что служба CabaretChat запущена.");
            showGate();
        }
    }

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!apiBase) {
            showError("Адрес сервера чата не задан.");
            return;
        }

        showError("Входим…");
        try {
            var response = await fetch(apiBase + "/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: document.getElementById("chatUser").value.trim(),
                    password: document.getElementById("chatPass").value
                })
            });
            var data = await response.json().catch(function () { return {}; });
            if (!response.ok) {
                showError(data.error || "Неверный логин или пароль");
                return;
            }
            setToken(data.token);
            await connect(data.name || data.username);
        } catch (e) {
            showError("Нет связи с сервером чата.");
        }
    });

    sendForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!connection) return;
        var text = chatText.value.trim();
        if (!text) return;
        chatText.value = "";
        try {
            await connection.invoke("SendMessage", text);
        } catch (e) {
            showError("Сообщение не отправилось.");
        }
    });

    logoutBtn.addEventListener("click", function () {
        setToken("");
        showGate();
    });

    (async function restore() {
        var existing = token();
        if (!existing || !apiBase) return;
        try {
            var response = await fetch(apiBase + "/api/me", {
                headers: { Authorization: "Bearer " + existing }
            });
            if (!response.ok) {
                setToken("");
                return;
            }
            var me = await response.json();
            await connect(me.name || me.username);
        } catch (e) {}
    })();
})();
