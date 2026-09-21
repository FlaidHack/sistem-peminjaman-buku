// ========== KONFIGURASI ==========
var APP_CONFIG = {
    catalogBaseUrl: "http://localhost:3001",
    loanBaseUrl: "http://localhost:3002"
};

var SESSION_KEY = "session";

// ========== SESSION (sessionStorage) ==========
function getCurrentUser() {
    var raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function saveSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
}

// ========== API HELPER ==========
function apiRequest(url, serviceName, options) {
    var opts = options || {};
    opts.headers = opts.headers || {};
    opts.headers["Content-Type"] = "application/json";
    var user = getCurrentUser();
    if (user) {
        opts.headers["x-user-id"] = user.studentId;
    }
    return fetch(url, opts).then(function (res) {
        return res.json().catch(function () {
            return {};
        }).then(function (data) {
            if (!res.ok) {
                var e = new Error(data.message || "Terjadi kesalahan");
                e.apiError = true;
                throw e;
            }
            return data;
        });
    }).catch(function (err) {
        if (err && err.apiError) throw err;
        throw new Error(serviceName + " service tidak tersedia");
    });
}

// ========== DATE HELPER ==========
function formatDate(dateStr) {
    var d = new Date(dateStr);
    var day = String(d.getDate()).padStart(2, "0");
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var year = d.getFullYear();
    return day + "/" + month + "/" + year;
}

// ========== NOTIFICATION ==========
function showNotification(message, type) {
    var el = document.getElementById("notification");
    el.textContent = message;
    el.className = "notification " + type;
    setTimeout(function () {
        el.className = "notification hidden";
    }, 3000);
}

// ========== AUTH ==========
function login(nim, password) {
    if (!nim || !password) {
        return Promise.reject({ message: "Masukkan NIM dan password" });
    }
    return apiRequest(APP_CONFIG.catalogBaseUrl + "/api/login", "Katalog", {
        method: "POST",
        body: JSON.stringify({ nim: nim, password: password })
    }).then(function (data) {
        saveSession({ studentId: data.user.id, name: data.user.name, token: data.token });
        return { success: true };
    }).catch(function (err) {
        return { success: false, message: err.message };
    });
}

function logout() {
    clearSession();
}

// ========== CATALOG ==========
var cachedBooks = [];

var COVER_GRADIENTS = [
    "linear-gradient(135deg, #16a34a, #14532d)",
    "linear-gradient(135deg, #65a30d, #1a4d2e)",
    "linear-gradient(135deg, #eab308, #92400e)",
    "linear-gradient(135deg, #0d9488, #14532d)",
    "linear-gradient(135deg, #15803d, #052e16)",
    "linear-gradient(135deg, #4d7c0f, #365314)"
];

function coverGradient(bookId) {
    var h = 0;
    var s = String(bookId || "");
    for (var i = 0; i < s.length; i++) h += s.charCodeAt(i);
    return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}

function setStat(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
}

function buildBookCard(book, index) {
    var isAvailable = book.status === "available";

    var card = document.createElement("div");
    card.className = "book-card";
    card.style.animationDelay = ((index % 12) * 40) + "ms";

    var cover = document.createElement("div");
    cover.className = "book-cover";
    cover.style.background = coverGradient(book.id);

    var initial = document.createElement("span");
    initial.className = "cover-initial";
    initial.textContent = (book.title || "?").charAt(0).toUpperCase();

    var ribbon = document.createElement("div");
    ribbon.className = "cover-ribbon";
    cover.appendChild(initial);
    cover.appendChild(ribbon);

    var body = document.createElement("div");
    body.className = "book-body";

    var cat = document.createElement("span");
    cat.className = "book-category";
    cat.textContent = book.category || "Umum";

    var titleEl = document.createElement("div");
    titleEl.className = "book-title";
    titleEl.textContent = book.title;

    var authorEl = document.createElement("div");
    authorEl.className = "book-author";
    authorEl.textContent = "oleh " + book.author;

    var foot = document.createElement("div");
    foot.className = "book-foot";

    var badge = document.createElement("span");
    if (isAvailable) {
        badge.className = "badge badge-available";
        badge.textContent = "Tersedia";
    } else {
        badge.className = "badge badge-borrowed";
        badge.textContent = "Dipinjam";
    }
    foot.appendChild(badge);

    var btn = document.createElement("button");
    btn.className = "btn btn-borrow";
    btn.textContent = "Pinjam";
    btn.disabled = !isAvailable;
    btn.setAttribute("data-book-id", book.id);
    btn.addEventListener("click", handleBorrow);

    body.appendChild(cat);
    body.appendChild(titleEl);
    body.appendChild(authorEl);
    body.appendChild(foot);
    body.appendChild(btn);

    card.appendChild(cover);
    card.appendChild(body);
    return card;
}

function renderCards(list) {
    var container = document.getElementById("catalog-list");
    container.innerHTML = "";
    if (list.length === 0) {
        container.innerHTML = '<p class="empty-msg">Tidak ada buku yang cocok dengan pencarian.</p>';
        return;
    }
    for (var i = 0; i < list.length; i++) {
        container.appendChild(buildBookCard(list[i], i));
    }
}

function applySearch(query) {
    var q = String(query || "").toLowerCase().trim();
    if (!q) {
        renderCards(cachedBooks);
        return;
    }
    var filtered = [];
    for (var i = 0; i < cachedBooks.length; i++) {
        var b = cachedBooks[i];
        var hay = ((b.title || "") + " " + (b.author || "") + " " + (b.category || "")).toLowerCase();
        if (hay.indexOf(q) !== -1) filtered.push(b);
    }
    renderCards(filtered);
}

function renderStatsFromBooks(books) {
    var available = 0;
    for (var i = 0; i < books.length; i++) {
        if (books[i].status === "available") available++;
    }
    setStat("stat-total", books.length);
    setStat("stat-available", available);
    setStat("stat-borrowed", books.length - available);
}

function renderCatalog() {
    var container = document.getElementById("catalog-list");
    container.innerHTML = "";

    return apiRequest(APP_CONFIG.catalogBaseUrl + "/api/books", "Katalog")
        .then(function (data) {
            cachedBooks = data.books || [];
            renderStatsFromBooks(cachedBooks);
            var searchInput = document.getElementById("search-input");
            applySearch(searchInput ? searchInput.value : "");
        })
        .catch(function (err) {
            showNotification(err.message, "error");
        });
}

// ========== LOANS ==========
function renderLoans() {
    var user = getCurrentUser();
    if (!user) return Promise.resolve();

    var container = document.getElementById("loans-list");
    container.innerHTML = "";

    return apiRequest(APP_CONFIG.loanBaseUrl + "/api/loans?studentId=" + encodeURIComponent(user.studentId), "Loan")
        .then(function (data) {
            var loans = data.loans || [];
            setStat("stat-active", loans.length);

            if (loans.length === 0) {
                container.innerHTML = '<p class="empty-msg">Tidak ada peminjaman aktif.</p>';
                return;
            }

            var table = document.createElement("table");
            table.className = "loans-table";

            var thead = document.createElement("thead");
            var headerRow = document.createElement("tr");
            var headers = ["No", "Judul Buku", "Tanggal Pinjam", "Batas Kembali", "Aksi"];
            for (var h = 0; h < headers.length; h++) {
                var th = document.createElement("th");
                th.textContent = headers[h];
                headerRow.appendChild(th);
            }
            thead.appendChild(headerRow);
            table.appendChild(thead);

            var tbody = document.createElement("tbody");
            for (var i = 0; i < loans.length; i++) {
                var loan = loans[i];

                var row = document.createElement("tr");

                var tdNo = document.createElement("td");
                tdNo.textContent = i + 1;

                var tdTitle = document.createElement("td");
                tdTitle.textContent = loan.title || loan.bookId;

                var tdBorrow = document.createElement("td");
                tdBorrow.textContent = formatDate(loan.borrowDate);

                var tdDue = document.createElement("td");
                tdDue.textContent = formatDate(loan.dueDate);

                var tdAction = document.createElement("td");
                var returnBtn = document.createElement("button");
                returnBtn.className = "btn btn-return";
                returnBtn.textContent = "Kembalikan";
                returnBtn.setAttribute("data-loan-id", loan.id);
                returnBtn.addEventListener("click", handleReturn);
                tdAction.appendChild(returnBtn);

                row.appendChild(tdNo);
                row.appendChild(tdTitle);
                row.appendChild(tdBorrow);
                row.appendChild(tdDue);
                row.appendChild(tdAction);
                tbody.appendChild(row);
            }

            table.appendChild(tbody);
            container.appendChild(table);
        })
        .catch(function (err) {
            showNotification(err.message, "error");
        });
}

// ========== BORROW ==========
function borrowBook(bookId) {
    var user = getCurrentUser();
    if (!user) {
        return Promise.reject({ message: "Silakan login terlebih dahulu" });
    }
    return apiRequest(APP_CONFIG.loanBaseUrl + "/api/loans", "Loan", {
        method: "POST",
        body: JSON.stringify({ studentId: user.studentId, bookId: bookId })
    }).then(function (data) {
        return { success: true, message: "Berhasil meminjam buku. Harap kembalikan sebelum " + formatDate(data.loan.dueDate) };
    }).catch(function (err) {
        return { success: false, message: err.message };
    });
}

// ========== RETURN ==========
function returnBook(loanId) {
    var user = getCurrentUser();
    if (!user) {
        return Promise.reject({ message: "Silakan login terlebih dahulu" });
    }
    return apiRequest(APP_CONFIG.loanBaseUrl + "/api/loans/" + loanId + "/return", "Loan", {
        method: "POST"
    }).then(function () {
        return { success: true, message: "Buku berhasil dikembalikan" };
    }).catch(function (err) {
        return { success: false, message: err.message };
    });
}

// ========== EVENT HANDLERS ==========
function handleBorrow(e) {
    var bookId = e.target.getAttribute("data-book-id");
    borrowBook(bookId).then(function (result) {
        showNotification(result.message, result.success ? "success" : "error");
        if (result.success) {
            renderCatalog();
            renderLoans();
        }
    });
}

function handleReturn(e) {
    var loanId = e.target.getAttribute("data-loan-id");
    returnBook(loanId).then(function (result) {
        showNotification(result.message, result.success ? "success" : "error");
        if (result.success) {
            renderCatalog();
            renderLoans();
        }
    });
}

function switchTab(tabName) {
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove("active");
        if (tabs[i].getAttribute("data-tab") === tabName) {
            tabs[i].classList.add("active");
        }
    }

    var contents = document.querySelectorAll(".tab-content");
    for (var j = 0; j < contents.length; j++) {
        contents[j].classList.remove("active");
    }
    document.getElementById(tabName + "-section").classList.add("active");
}

function showPage(pageId) {
    var pages = document.querySelectorAll(".page");
    for (var i = 0; i < pages.length; i++) {
        pages[i].classList.remove("active");
    }
    document.getElementById(pageId).classList.add("active");
}

// ========== INIT ==========
function initApp() {
    var session = getCurrentUser();
    if (session) {
        showApp(session);
    } else {
        showPage("login-page");
    }

    document.getElementById("login-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var nim = document.getElementById("nim").value.trim();
        var password = document.getElementById("password").value;
        login(nim, password).then(function (result) {
            if (result.success) {
                var user = getCurrentUser();
                showApp(user);
                document.getElementById("nim").value = "";
                document.getElementById("password").value = "";
                document.getElementById("login-error").textContent = "";
            } else {
                document.getElementById("login-error").textContent = result.message;
            }
        });
    });

    document.getElementById("logout-btn").addEventListener("click", function () {
        logout();
        showPage("login-page");
    });

    var searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            applySearch(searchInput.value);
        });
    }

    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener("click", function () {
            switchTab(this.getAttribute("data-tab"));
        });
    }
}

function showApp(session) {
    document.getElementById("student-name").textContent = session.name;
    var avatarEl = document.getElementById("avatar");
    if (avatarEl) {
        avatarEl.textContent = (session.name || "?").charAt(0).toUpperCase();
    }
    renderCatalog();
    renderLoans();
    showPage("app-page");
    switchTab("catalog");
}

document.addEventListener("DOMContentLoaded", initApp);