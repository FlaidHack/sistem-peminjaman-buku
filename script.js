// ========== CONSTANTS ==========
const USERS_KEY = "users";
const BOOKS_KEY = "books";
const LOANS_KEY = "loans";
const SESSION_KEY = "session";
const MAX_LOANS = 3;
const BORROW_DAYS = 7;

// ========== SEED DATA ==========
const SEED_USERS = [
    { id: "MHS001", name: "Ahmad Fadil", password: "123456" },
    { id: "MHS002", name: "Budi Santoso", password: "123456" },
    { id: "MHS003", name: "Citra Dewi", password: "123456" }
];

const SEED_BOOKS = [
    { id: "B001", title: "Pemrograman Web", author: "Andi Setiawan", status: "available" },
    { id: "B002", title: "Basis Data", author: "Rina Wati", status: "available" },
    { id: "B003", title: "Jaringan Komputer", author: "Dedi Kurniawan", status: "available" },
    { id: "B004", title: "Struktur Data dan Algoritma", author: "Siti Nurhaliza", status: "available" },
    { id: "B005", title: "Sistem Operasi", author: "Bambang Susilo", status: "available" },
    { id: "B006", title: "Rekayasa Perangkat Lunak", author: "Maya Putri", status: "available" }
];

// ========== LOCALSTORAGE HELPERS ==========
function getData(key) {
    var raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function setData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function generateId(prefix) {
    return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
}

// ========== SEED INIT ==========
function seedData() {
    if (!getData(USERS_KEY)) {
        setData(USERS_KEY, SEED_USERS);
    }
    if (!getData(BOOKS_KEY)) {
        setData(BOOKS_KEY, SEED_BOOKS);
    }
    if (!getData(LOANS_KEY)) {
        setData(LOANS_KEY, []);
    }
}

// ========== DATE HELPER ==========
function formatDate(dateStr) {
    var d = new Date(dateStr);
    var day = String(d.getDate()).padStart(2, "0");
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var year = d.getFullYear();
    return day + "/" + month + "/" + year;
}

function addDays(dateStr, days) {
    var d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
}

function getTodayStr() {
    return new Date().toISOString().split("T")[0];
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

// ========== SESSION ==========
function getCurrentUser() {
    return getData(SESSION_KEY);
}

function saveSession(user) {
    setData(SESSION_KEY, { studentId: user.id, name: user.name });
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// ========== AUTH ==========
function login(nim, password) {
    if (!nim || !password) {
        return { success: false, message: "Masukkan NIM dan password" };
    }
    var users = getData(USERS_KEY) || [];
    for (var i = 0; i < users.length; i++) {
        if (users[i].id === nim && users[i].password === password) {
            saveSession(users[i]);
            return { success: true };
        }
    }
    return { success: false, message: "NIM atau password salah" };
}

function logout() {
    clearSession();
}

// ========== CATALOG ==========
function getBooks() {
    return getData(BOOKS_KEY) || [];
}

function getLoans() {
    return getData(LOANS_KEY) || [];
}

function getActiveLoansByStudent(studentId) {
    var loans = getLoans();
    var result = [];
    for (var i = 0; i < loans.length; i++) {
        if (loans[i].studentId === studentId) {
            result.push(loans[i]);
        }
    }
    return result;
}

function borrowBook(bookId) {
    var user = getCurrentUser();
    if (!user) {
        return { success: false, message: "Silakan login terlebih dahulu" };
    }

    var books = getBooks();
    var book = null;
    for (var i = 0; i < books.length; i++) {
        if (books[i].id === bookId) {
            book = books[i];
            break;
        }
    }

    if (!book) {
        return { success: false, message: "Buku tidak ditemukan" };
    }

    if (book.status !== "available") {
        return { success: false, message: "Buku sedang dipinjam oleh pengguna lain" };
    }

    var activeLoans = getActiveLoansByStudent(user.studentId);
    if (activeLoans.length >= MAX_LOANS) {
        return { success: false, message: "Batas maksimal peminjaman (3 buku) telah tercapai" };
    }

    var today = getTodayStr();
    var dueDate = addDays(today, BORROW_DAYS);

    var loan = {
        id: generateId("LN"),
        studentId: user.studentId,
        bookId: bookId,
        borrowDate: today,
        dueDate: dueDate
    };

    var loans = getLoans();
    loans.push(loan);
    setData(LOANS_KEY, loans);

    book.status = "borrowed";
    setData(BOOKS_KEY, books);

    return { success: true, message: "Berhasil meminjam buku. Harap kembalikan sebelum " + formatDate(dueDate) };
}

// ========== RETURN ==========
function returnBook(loanId) {
    var user = getCurrentUser();
    if (!user) {
        return { success: false, message: "Silakan login terlebih dahulu" };
    }

    var loans = getLoans();
    var loanIndex = -1;
    for (var i = 0; i < loans.length; i++) {
        if (loans[i].id === loanId && loans[i].studentId === user.studentId) {
            loanIndex = i;
            break;
        }
    }

    if (loanIndex === -1) {
        return { success: false, message: "Data peminjaman tidak ditemukan" };
    }

    var loan = loans[loanIndex];

    var books = getBooks();
    for (var j = 0; j < books.length; j++) {
        if (books[j].id === loan.bookId) {
            books[j].status = "available";
            break;
        }
    }
    setData(BOOKS_KEY, books);

    loans.splice(loanIndex, 1);
    setData(LOANS_KEY, loans);

    return { success: true, message: "Buku berhasil dikembalikan" };
}

// ========== RENDER ==========
function renderCatalog() {
    var books = getBooks();
    var container = document.getElementById("catalog-list");
    container.innerHTML = "";

    for (var i = 0; i < books.length; i++) {
        var book = books[i];
        var isAvailable = book.status === "available";

        var card = document.createElement("div");
        card.className = "book-card";

        var titleEl = document.createElement("div");
        titleEl.className = "book-title";
        titleEl.textContent = book.title;

        var authorEl = document.createElement("div");
        authorEl.className = "book-author";
        authorEl.textContent = "oleh " + book.author;

        var badge = document.createElement("span");
        if (isAvailable) {
            badge.className = "badge badge-available";
            badge.textContent = "Tersedia";
        } else {
            badge.className = "badge badge-borrowed";
            badge.textContent = "Dipinjam";
        }

        var btn = document.createElement("button");
        btn.className = "btn btn-borrow";
        btn.textContent = "Pinjam";
        btn.disabled = !isAvailable;
        btn.setAttribute("data-book-id", book.id);
        btn.addEventListener("click", handleBorrow);

        card.appendChild(titleEl);
        card.appendChild(authorEl);
        card.appendChild(badge);
        card.appendChild(btn);
        container.appendChild(card);
    }
}

function renderLoans() {
    var user = getCurrentUser();
    if (!user) return;

    var loans = getActiveLoansByStudent(user.studentId);
    var container = document.getElementById("loans-list");
    container.innerHTML = "";

    if (loans.length === 0) {
        container.innerHTML = '<p class="empty-msg">Tidak ada peminjaman aktif.</p>';
        return;
    }

    var books = getBooks();
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
        var bookTitle = "";
        for (var b = 0; b < books.length; b++) {
            if (books[b].id === loan.bookId) {
                bookTitle = books[b].title;
                break;
            }
        }

        var row = document.createElement("tr");

        var tdNo = document.createElement("td");
        tdNo.textContent = i + 1;

        var tdTitle = document.createElement("td");
        tdTitle.textContent = bookTitle;

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
}

// ========== EVENT HANDLERS ==========
function handleBorrow(e) {
    var bookId = e.target.getAttribute("data-book-id");
    var result = borrowBook(bookId);
    showNotification(result.message, result.success ? "success" : "error");
    if (result.success) {
        renderCatalog();
        renderLoans();
    }
}

function handleReturn(e) {
    var loanId = e.target.getAttribute("data-loan-id");
    var result = returnBook(loanId);
    showNotification(result.message, result.success ? "success" : "error");
    if (result.success) {
        renderCatalog();
        renderLoans();
    }
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
    seedData();

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
        var result = login(nim, password);

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

    document.getElementById("logout-btn").addEventListener("click", function () {
        logout();
        showPage("login-page");
    });

    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener("click", function () {
            switchTab(this.getAttribute("data-tab"));
        });
    }
}

function showApp(session) {
    document.getElementById("student-name").textContent = session.name;
    renderCatalog();
    renderLoans();
    showPage("app-page");
    switchTab("catalog");
}

document.addEventListener("DOMContentLoaded", initApp);
