
const cartItemsElement = document.getElementById("cartItems");
const itemCountElement = document.getElementById("itemCount");
const subtotalElement = document.getElementById("subtotal");
const totalElement = document.getElementById("total");
const checkoutButton = document.getElementById("checkoutButton");
const toastElement = document.getElementById("toast");

let products = [];
let cart = [];

const formatMoney = amount =>
    new Intl.NumberFormat("en-LK", {
        style: "currency",
        currency: "LKR",
        maximumFractionDigits: 0
    }).format(amount);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function loadSavedCart() {
    try {
        const saved = JSON.parse(localStorage.getItem("novaraCart") || "[]");

        if (!Array.isArray(saved)) return [];

        return saved
            .filter(item =>
                Number.isInteger(Number(item.id)) &&
                Number.isInteger(Number(item.quantity)) &&
                Number(item.quantity) > 0
            )
            .map(item => ({
                id: Number(item.id),
                quantity: Number(item.quantity)
            }));
    } catch {
        return [];
    }
}

function saveCart() {
    localStorage.setItem("novaraCart", JSON.stringify(cart));

    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById("cartCount").textContent = count;
}

function showToast(message) {
    toastElement.textContent = message;
    toastElement.classList.add("show");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
        toastElement.classList.remove("show");
    }, 2300);
}

function renderCart() {
    cart = cart.filter(item =>
        products.some(product => product.id === item.id)
    );

    const count = cart.reduce((sum, item) => sum + item.quantity, 0);

    itemCountElement.textContent = `${count} ${count === 1 ? "item" : "items"}`;
    saveCart();

    if (cart.length === 0) {
        cartItemsElement.innerHTML = `
            <div class="cart-empty">
                <i class="fa-solid fa-bag-shopping"></i>
                <h3>Your bag is waiting.</h3>
                <p>Discover something you'll love.</p>
                <a href="/#products">Explore the collection</a>
            </div>`;

        subtotalElement.textContent = formatMoney(0);
        totalElement.textContent = formatMoney(0);
        checkoutButton.disabled = true;
        return;
    }

    checkoutButton.disabled = false;

    let subtotal = 0;

    cartItemsElement.innerHTML = cart.map(item => {
        const product = products.find(p => p.id === item.id);
        const price = Number(product.price);
        subtotal += price * item.quantity;

        const image = "/" + String(product.image || "").replace(/^\/+/, "");

        return `
            <article class="cart-item">
                <img
                    class="cart-item-image"
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name)}"
                    onerror="this.onerror=null;this.src='https://placehold.co/200x230/f0eee7/14251f?text=NOVARA'">

                <div class="cart-item-details">
                    <span class="cart-item-category">${escapeHTML(product.category)}</span>
                    <h3>${escapeHTML(product.name)}</h3>
                    <p class="cart-item-price">${formatMoney(price * item.quantity)}</p>

                    <div class="cart-item-controls">
                        <div class="quantity-control">
                            <button data-decrease="${item.id}" aria-label="Decrease quantity">−</button>
                            <span>${item.quantity}</span>
                            <button data-increase="${item.id}" aria-label="Increase quantity">+</button>
                        </div>
                        <button class="remove-item" data-remove="${item.id}">Remove</button>
                    </div>
                </div>
            </article>`;
    }).join("");

    subtotalElement.textContent = formatMoney(subtotal);
    totalElement.textContent = formatMoney(subtotal);
}

cartItemsElement.addEventListener("click", event => {
    const decreaseButton = event.target.closest("[data-decrease]");
    const increaseButton = event.target.closest("[data-increase]");
    const removeButton = event.target.closest("[data-remove]");

    if (decreaseButton) {
        const id = Number(decreaseButton.dataset.decrease);
        const item = cart.find(entry => entry.id === id);

        if (item) {
            item.quantity -= 1;
            if (item.quantity <= 0) {
                cart = cart.filter(entry => entry.id !== id);
            }
        }

        renderCart();
    }

    if (increaseButton) {
        const id = Number(increaseButton.dataset.increase);
        const item = cart.find(entry => entry.id === id);
        const product = products.find(entry => entry.id === id);

        if (item && product) {
            if (item.quantity >= Number(product.stock)) {
                showToast("You've reached the available stock.");
                return;
            }

            item.quantity += 1;
            renderCart();
        }
    }

    if (removeButton) {
        const id = Number(removeButton.dataset.remove);
        cart = cart.filter(item => item.id !== id);
        renderCart();
        showToast("Item removed from your bag.");
    }
});

checkoutButton.addEventListener("click", () => {
    if (!cart.length) return;

    window.location.href = "/checkout.html";
});

async function initializeCart() {
    try {
        const response = await fetch("/api/products");

        if (!response.ok) {
            throw new Error("Product request failed");
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.products)) {
            throw new Error("Invalid product response");
        }

        products = data.products;
        cart = loadSavedCart();

        cart = cart.filter(item => {
            const product = products.find(p => p.id === item.id);

            if (!product) return false;

            item.quantity = Math.min(item.quantity, Number(product.stock));
            return item.quantity > 0;
        });

        renderCart();
    } catch (error) {
        console.error(error);
        cartItemsElement.innerHTML =
            '<p class="cart-loading">Unable to load your bag. Please refresh the page.</p>';
        checkoutButton.disabled = true;
    }
}

document.getElementById("currentYear").textContent = new Date().getFullYear();
initializeCart();
