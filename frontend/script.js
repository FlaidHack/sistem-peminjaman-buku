// ========== KONFIGURASI ==========
// Fase 5: frontend hanya kenal api-gateway (:3000). Gateway yang meneruskan
// ke auth/catalog/loan + menyuntik x-api-key per service.
const APP_CONFIG = {
    gatewayBaseUrl: "http://localhost:3000"
};

const SESSION_KEY = "session";

// ========== SESSION (sessionStorage) ==========
function getCurrentUser() {
    const raw = sessionStorage.getItem(SESSION_KEY);
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
// Fase 5: selalu lewat gateway + kirim Bearer JWT (kecuali login yang belum
// punya token). Header x-user-id/x-api-key tidak dikirim dari browser:
// gateway menghapusnya lalu meng-inject nilai yang benar dari JWT.
// Opsi A: response 401 (token hilang/expired) -> sesi dibersihkan +
// tendang ke halaman login, kecuali request login itu sendiri.
function apiRequest(url, serviceName, options) {
    const opts = options || {};
    opts.headers = opts.headers || {};
    opts.headers["Content-Type"] = "application/json";
    const user = getCurrentUser();
    if (user && user.token) {
        opts.headers["Authorization"] = "Bearer " + user.token;
    }
    const skipAuthRedirect = !!opts.skipAuthRedirect;
    delete opts.skipAuthRedirect;
    return fetch(url, opts).then(function (res) {
        return res.json().catch(function () {
            return {};
        }).then(function (data) {
            if (!res.ok) {
                if (res.status === 401 && !skipAuthRedirect) {
                    clearSession();
                    if (typeof showPage === "function") {
                        showPage("login-page");
                    }
                    const se = new Error("Sesi berakhir, silakan login kembali");
                    se.apiError = true;
                    se.unauthorized = true;
                    throw se;
                }
                const e = new Error(data.message || "Terjadi kesalahan");
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
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return day + "/" + month + "/" + year;
}

// ========== NOTIFICATION ==========
function showNotification(message, type) {
    const el = document.getElementById("notification");
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
    return apiRequest(APP_CONFIG.gatewayBaseUrl + "/api/auth/login", "Auth", {
        method: "POST",
        body: JSON.stringify({ nim: nim, password: password }),
        skipAuthRedirect: true
    }).then(function (data) {
        saveSession({ studentId: data.user.id, name: data.user.name, token: data.token });
        return { success: true };
    }).catch(function (err) {
        return { success: false, message: err.message };
    });
}

function logout() {
    // Logout stateful: server me-revoke jti, token lama langsung 401.
    // Sesi lokal selalu dibersihkan walau request gagal (mis. token expired).
    const user = getCurrentUser();
    const token = user && user.token;
    clearSession();
    if (!token) return Promise.resolve();
    return fetch(APP_CONFIG.gatewayBaseUrl + "/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token }
    }).then(function (res) {
        return res.json().catch(function () { return {}; });
    }).catch(function () {});
}

// ========== CATALOG ==========
let cachedBooks = [];

const COVER_GRADIENTS = [
    "linear-gradient(135deg, #16a34a, #14532d)",
    "linear-gradient(135deg, #65a30d, #1a4d2e)",
    "linear-gradient(135deg, #eab308, #92400e)",
    "linear-gradient(135deg, #0d9488, #14532d)",
    "linear-gradient(135deg, #15803d, #052e16)",
    "linear-gradient(135deg, #4d7c0f, #365314)"
];

function coverGradient(bookId) {
    let h = 0;
    const s = String(bookId || "");
    for (let i = 0; i < s.length; i++) h += s.charCodeAt(i);
    return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}

function setStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function buildBookCard(book, index) {
    const isAvailable = book.status === "available";

    const card = document.createElement("div");
    card.className = "book-card";
    card.style.animationDelay = ((index % 12) * 40) + "ms";

    const cover = document.createElement("div");
    cover.className = "book-cover";
    cover.style.background = coverGradient(book.id);

    const initial = document.createElement("span");
    initial.className = "cover-initial";
    initial.textContent = (book.title || "?").charAt(0).toUpperCase();

    const ribbon = document.createElement("div");
    ribbon.className = "cover-ribbon";
    cover.appendChild(initial);
    cover.appendChild(ribbon);

    const body = document.createElement("div");
    body.className = "book-body";

    const cat = document.createElement("span");
    cat.className = "book-category";
    cat.textContent = book.category || "Umum";

    const titleEl = document.createElement("div");
    titleEl.className = "book-title";
    titleEl.textContent = book.title;

    const authorEl = document.createElement("div");
    authorEl.className = "book-author";
    authorEl.textContent = "oleh " + book.author;

    const foot = document.createElement("div");
    foot.className = "book-foot";

    const badge = document.createElement("span");
    if (isAvailable) {
        badge.className = "badge badge-available";
        badge.textContent = "Tersedia";
    } else {
        badge.className = "badge badge-borrowed";
        badge.textContent = "Dipinjam";
    }
    foot.appendChild(badge);

    const btn = document.createElement("button");
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
    const container = document.getElementById("catalog-list");
    container.innerHTML = "";
    if (list.length === 0) {
        container.innerHTML = '<p class="empty-msg">Tidak ada buku yang cocok dengan pencarian.</p>';
        return;
    }
    for (let i = 0; i < list.length; i++) {
        container.appendChild(buildBookCard(list[i], i));
    }
}

function applySearch(query) {
    const q = String(query || "").toLowerCase().trim();
    if (!q) {
        renderCards(cachedBooks);
        return;
    }
    const filtered = [];
    for (let i = 0; i < cachedBooks.length; i++) {
        const b = cachedBooks[i];
        const hay = ((b.title || "") + " " + (b.author || "") + " " + (b.category || "")).toLowerCase();
        if (hay.indexOf(q) !== -1) filtered.push(b);
    }
    renderCards(filtered);
}

function renderStatsFromBooks(books) {
    let available = 0;
    for (let i = 0; i < books.length; i++) {
        if (books[i].status === "available") available++;
    }
    setStat("stat-total", books.length);
    setStat("stat-available", available);
    setStat("stat-borrowed", books.length - available);
}

function renderCatalog() {
    const container = document.getElementById("catalog-list");
    container.innerHTML = "";

    return apiRequest(APP_CONFIG.gatewayBaseUrl + "/api/books", "Katalog")
        .then(function (data) {
            cachedBooks = data.books || [];
            renderStatsFromBooks(cachedBooks);
            const searchInput = document.getElementById("search-input");
            applySearch(searchInput ? searchInput.value : "");
        })
        .catch(function (err) {
            showNotification(err.message, "error");
        });
}

// ========== LOANS ==========
function renderLoans() {
    const user = getCurrentUser();
    if (!user) return Promise.resolve();

    const container = document.getElementById("loans-list");
    container.innerHTML = "";

    return apiRequest(APP_CONFIG.gatewayBaseUrl + "/api/loans?studentId=" + encodeURIComponent(user.studentId), "Loan")
        .then(function (data) {
            const loans = data.loans || [];
            setStat("stat-active", loans.length);

            if (loans.length === 0) {
                container.innerHTML = '<p class="empty-msg">Tidak ada peminjaman aktif.</p>';
                return;
            }

            const table = document.createElement("table");
            table.className = "loans-table";

            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");
            const headers = ["No", "Judul Buku", "Tanggal Pinjam", "Batas Kembali", "Aksi"];
            for (let h = 0; h < headers.length; h++) {
                const th = document.createElement("th");
                th.textContent = headers[h];
                headerRow.appendChild(th);
            }
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement("tbody");
            for (let i = 0; i < loans.length; i++) {
                const loan = loans[i];

                const row = document.createElement("tr");

                const tdNo = document.createElement("td");
                tdNo.textContent = i + 1;

                const tdTitle = document.createElement("td");
                tdTitle.textContent = loan.title || loan.bookId;

                const tdBorrow = document.createElement("td");
                tdBorrow.textContent = formatDate(loan.borrowDate);

                const tdDue = document.createElement("td");
                tdDue.textContent = formatDate(loan.dueDate);

                const tdAction = document.createElement("td");
                const returnBtn = document.createElement("button");
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
    const user = getCurrentUser();
    if (!user) {
        return Promise.reject({ message: "Silakan login terlebih dahulu" });
    }
    return apiRequest(APP_CONFIG.gatewayBaseUrl + "/api/loans", "Loan", {
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
    const user = getCurrentUser();
    if (!user) {
        return Promise.reject({ message: "Silakan login terlebih dahulu" });
    }
    return apiRequest(APP_CONFIG.gatewayBaseUrl + "/api/loans/" + loanId + "/return", "Loan", {
        method: "POST"
    }).then(function () {
        return { success: true, message: "Buku berhasil dikembalikan" };
    }).catch(function (err) {
        return { success: false, message: err.message };
    });
}

// ========== EVENT HANDLERS ==========
function handleBorrow(e) {
    const bookId = e.target.getAttribute("data-book-id");
    borrowBook(bookId).then(function (result) {
        showNotification(result.message, result.success ? "success" : "error");
        if (result.success) {
            renderCatalog();
            renderLoans();
        }
    });
}

function handleReturn(e) {
    const loanId = e.target.getAttribute("data-loan-id");
    returnBook(loanId).then(function (result) {
        showNotification(result.message, result.success ? "success" : "error");
        if (result.success) {
            renderCatalog();
            renderLoans();
        }
    });
}

function switchTab(tabName) {
    const tabs = document.querySelectorAll(".tab");
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove("active");
        if (tabs[i].getAttribute("data-tab") === tabName) {
            tabs[i].classList.add("active");
        }
    }

    const contents = document.querySelectorAll(".tab-content");
    for (let j = 0; j < contents.length; j++) {
        contents[j].classList.remove("active");
    }
    document.getElementById(tabName + "-section").classList.add("active");
}

function showPage(pageId) {
    const pages = document.querySelectorAll(".page");
    for (let i = 0; i < pages.length; i++) {
        pages[i].classList.remove("active");
    }
    document.getElementById(pageId).classList.add("active");
}

// ========== INIT ==========
function initApp() {
    const session = getCurrentUser();
    if (session) {
        showApp(session);
    } else {
        showPage("login-page");
    }

    document.getElementById("login-form").addEventListener("submit", function (e) {
        e.preventDefault();
        const nim = document.getElementById("nim").value.trim();
        const password = document.getElementById("password").value;
        login(nim, password).then(function (result) {
            if (result.success) {
                const user = getCurrentUser();
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
        logout().then(function () {
            showPage("login-page");
        });
    });

    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            applySearch(searchInput.value);
        });
    }

    const tabs = document.querySelectorAll(".tab");
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener("click", function () {
            switchTab(this.getAttribute("data-tab"));
        });
    }
}

function showApp(session) {
    document.getElementById("student-name").textContent = session.name;
    const avatarEl = document.getElementById("avatar");
    if (avatarEl) {
        avatarEl.textContent = (session.name || "?").charAt(0).toUpperCase();
    }
    renderCatalog();
    renderLoans();
    showPage("app-page");
    switchTab("catalog");
}

document.addEventListener("DOMContentLoaded", initApp);
