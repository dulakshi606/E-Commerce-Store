
const productGrid = document.getElementById("productGrid");
const categoryList = document.getElementById("categoryList");
const productTotal = document.getElementById("productTotal");
const searchPanel = document.getElementById("searchPanel");
const searchInput = document.getElementById("searchInput");
const toast = document.getElementById("toast");

let products = [];
let selectedCategory = "All";
let searchTerm = "";
let cart = [];

try {
    const savedCart = JSON.parse(
        localStorage.getItem("novaraCart") || "[]"
    );

    cart = Array.isArray(savedCart)
        ? savedCart
            .filter(item =>
                Number.isInteger(Number(item.id)) &&
                Number.isInteger(Number(item.quantity)) &&
                Number(item.quantity) > 0
            )
            .map(item => ({
                id: Number(item.id),
                quantity: Number(item.quantity)
            }))
        : [];
} catch {
    cart = [];
}

const money = amount =>
    new Intl.NumberFormat("en-LK", {
        style: "currency",
        currency: "LKR",
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function updateCartCount() {
    const cartCount = document.getElementById("cartCount");

    if (cartCount) {
        cartCount.textContent = cart.reduce(
            (sum, item) => sum + item.quantity,
            0
        );
    }
}

function saveCart() {
    localStorage.setItem("novaraCart", JSON.stringify(cart));
    updateCartCount();
}

function showToast(message) {
    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function renderCategories() {
    if (!categoryList) return;

    const categories = [
        "All",
        ...new Set(products.map(product => product.category))
    ];

    categoryList.innerHTML = categories.map(category => `
        <button
            class="category-chip ${
                selectedCategory === category ? "active" : ""
            }"
            data-category="${escapeHTML(category)}">
            ${
                category === "All"
                    ? "All products"
                    : escapeHTML(category)
            }
        </button>
    `).join("");
}

function renderProducts() {
    if (!productGrid || !productTotal) return;

    const filtered = products.filter(product => {
        const matchesCategory =
            selectedCategory === "All" ||
            product.category === selectedCategory;

        const text = `
            ${product.name}
            ${product.description || ""}
            ${product.category || ""}
        `.toLowerCase();

        return matchesCategory &&
            text.includes(searchTerm.toLowerCase());
    });

    productTotal.textContent =
        `${filtered.length} ${
            filtered.length === 1 ? "product" : "products"
        }`;

    if (filtered.length === 0) {
        productGrid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-magnifying-glass"></i>
                <p>No products found. Try another search or category.</p>
            </div>
        `;
        return;
    }

    productGrid.innerHTML = filtered.map(product => {
        const imagePath = "/" +
            String(product.image || "")
                .replace(/^\/+/, "");

        const stock = Number(product.stock) || 0;
        const outOfStock = stock <= 0;

        return `
            <article class="product-card">
                <div class="product-image">
                    <img
                        src="${escapeHTML(imagePath)}"
                        alt="${escapeHTML(product.name)}"
                        loading="lazy"
                        onerror="this.onerror=null;this.src='https://placehold.co/600x500/f0eee7/14251f?text=NOVARA'">

                    <span class="product-category">
                        ${escapeHTML(product.category)}
                    </span>
                </div>

                <div class="product-info">
                    <h3>${escapeHTML(product.name)}</h3>

                    <p class="product-description">
                        ${escapeHTML(product.description || "")}
                    </p>

                    <div class="product-bottom">
                        <span class="product-price">
                            ${money(product.price)}
                        </span>

                        <button
                            class="add-cart"
                            data-add="${Number(product.id)}"
                            aria-label="Add ${escapeHTML(product.name)} to cart"
                            ${outOfStock ? "disabled" : ""}>
                            <i class="fa-solid fa-bag-shopping"></i>
                        </button>
                    </div>

                    ${
                        outOfStock
                            ? '<p class="product-description">Out of stock</p>'
                            : ""
                    }
                </div>
            </article>
        `;
    }).join("");
}

async function loadProducts() {
    if (!productGrid || !productTotal) return;

    productTotal.textContent = "Loading products...";

    try {
        const response = await fetch("/api/products");

        if (!response.ok) {
            throw new Error(`Product request failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.products)) {
            throw new Error("Unexpected product data");
        }

        products = data.products.map(product => ({
            ...product,
            id: Number(product.id),
            price: Number(product.price),
            stock: Number(product.stock)
        }));

        // Remove saved cart entries for products that no longer exist.
        cart = cart.filter(item =>
            products.some(product => product.id === item.id)
        );

        saveCart();
        renderCategories();
        renderProducts();

    } catch (error) {
        console.error("Unable to load NOVARA products:", error);

        productTotal.textContent = "Collection unavailable";

        productGrid.innerHTML = `
            <div class="empty-state">
                <p>We couldn't load the collection.</p>
                <p>Please check your connection and refresh the page.</p>
                <button class="category-chip" id="retryProducts">
                    Try again
                </button>
            </div>
        `;
    }
}

if (categoryList) {
    categoryList.addEventListener("click", event => {
        const button = event.target.closest("[data-category]");

        if (!button) return;

        selectedCategory = button.dataset.category;

        renderCategories();
        renderProducts();
    });
}

if (productGrid) {
    productGrid.addEventListener("click", event => {
        const retryButton = event.target.closest("#retryProducts");

        if (retryButton) {
            loadProducts();
            return;
        }

        const button = event.target.closest("[data-add]");

        if (!button) return;

        const product = products.find(
            item => item.id === Number(button.dataset.add)
        );

        if (!product) return;

        const existing = cart.find(item => item.id === product.id);
        const currentQuantity = existing ? existing.quantity : 0;

        if (currentQuantity >= product.stock) {
            showToast("You've reached the available stock for this item.");
            return;
        }

        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({
                id: product.id,
                quantity: 1
            });
        }

        saveCart();
        showToast(`${product.name} added to your bag.`);
    });
}

const searchToggle = document.getElementById("searchToggle");

if (searchToggle && searchPanel && searchInput) {
    searchToggle.addEventListener("click", () => {
        searchPanel.classList.toggle("open");

        if (searchPanel.classList.contains("open")) {
            searchInput.focus();
        }
    });
}

const searchClose = document.getElementById("searchClose");

if (searchClose && searchPanel && searchInput) {
    searchClose.addEventListener("click", () => {
        searchPanel.classList.remove("open");
        searchInput.value = "";
        searchTerm = "";
        renderProducts();
    });
}

if (searchInput) {
    searchInput.addEventListener("input", event => {
        searchTerm = event.target.value;
        renderProducts();
    });
}

const menuToggle = document.getElementById("menuToggle");

if (menuToggle) {
    menuToggle.addEventListener("click", () => {
        const navigation = document.querySelector(".navigation");

        if (navigation) {
            navigation.classList.toggle("open");
        }
    });
}

document.querySelectorAll(".navigation a").forEach(link => {
    link.addEventListener("click", () => {
        document.querySelector(".navigation")?.classList.remove("open");
    });
});

const currentYear = document.getElementById("currentYear");

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}

updateCartCount();
loadProducts();

