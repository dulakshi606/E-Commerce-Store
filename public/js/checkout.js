
const checkoutForm = document.getElementById("checkoutForm");
const checkoutItems = document.getElementById("checkoutItems");
const checkoutSubtotal = document.getElementById("checkoutSubtotal");
const checkoutTotal = document.getElementById("checkoutTotal");
const placeOrderButton = document.getElementById("placeOrderButton");
const checkoutMessage = document.getElementById("checkoutMessage");

let products = [];
let cart = [];

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

function loadSavedCart() {
    try {
        const saved = JSON.parse(
            localStorage.getItem("novaraCart") || "[]"
        );

        if (!Array.isArray(saved)) {
            return [];
        }

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
    } catch (error) {
        console.error("Unable to load saved cart:", error);
        return [];
    }
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

function renderCheckout() {
    const validCart = cart.filter(item =>
        products.some(product => product.id === item.id)
    );

    cart = validCart;
    updateCartCount();

    if (cart.length === 0) {
        checkoutItems.innerHTML = `
            <div class="cart-empty">
                <p>Your shopping bag is empty.</p>
                <a href="/#products">Continue shopping</a>
            </div>
        `;

        checkoutSubtotal.textContent = money(0);
        checkoutTotal.textContent = money(0);
        placeOrderButton.disabled = true;

        return;
    }

    placeOrderButton.disabled = false;

    let subtotal = 0;

    checkoutItems.innerHTML = cart.map(item => {
        const product = products.find(
            entry => entry.id === item.id
        );

        const price = Number(product.price);
        const itemTotal = price * item.quantity;

        subtotal += itemTotal;

        const productImage = String(product.image || "");

        const image = /^https?:\/\//i.test(productImage)
            ? productImage
            : "/" + productImage.replace(/^\/+/, "");

        return `
            <div class="checkout-summary-item">
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name)}"
                    onerror="this.onerror=null;this.src='https://placehold.co/120x140/f0eee7/14251f?text=NOVARA'"
                >

                <div class="checkout-summary-details">
                    <h3>${escapeHTML(product.name)}</h3>
                    <p>Quantity: ${item.quantity}</p>
                    <p>${money(itemTotal)}</p>
                </div>
            </div>
        `;
    }).join("");

    checkoutSubtotal.textContent = money(subtotal);
    checkoutTotal.textContent = money(subtotal);
}

async function initializeCheckout() {
    try {
        const response = await fetch("/api/products");

        if (!response.ok) {
            throw new Error("Unable to retrieve products.");
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.products)) {
            throw new Error("Unexpected product data.");
        }

        products = data.products.map(product => ({
            ...product,
            id: Number(product.id),
            price: Number(product.price),
            stock: Number(product.stock)
        }));

        cart = loadSavedCart().filter(item => {
            const product = products.find(
                entry => entry.id === item.id
            );

            if (!product || product.stock <= 0) {
                return false;
            }

            item.quantity = Math.min(
                item.quantity,
                product.stock
            );

            return item.quantity > 0;
        });

        localStorage.setItem(
            "novaraCart",
            JSON.stringify(cart)
        );

        renderCheckout();
    } catch (error) {
        console.error("Checkout loading error:", error);

        checkoutItems.innerHTML = `
            <p class="summary-loading">
                Unable to load your order. Please refresh the page.
            </p>
        `;

        placeOrderButton.disabled = true;
    }
}

checkoutForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (cart.length === 0) {
        checkoutMessage.className = "checkout-message error";
        checkoutMessage.textContent =
            "Your shopping bag is empty. Please add products first.";
        return;
    }

    if (!checkoutForm.reportValidity()) {
        return;
    }

    checkoutMessage.className = "checkout-message";
    checkoutMessage.textContent = "Placing your order...";

    placeOrderButton.disabled = true;

    const formData = new FormData(checkoutForm);

    const customerName = String(
        formData.get("fullName") || ""
    ).trim();

    const phone = String(
        formData.get("phone") || ""
    ).trim();

    const email = String(
        formData.get("email") || ""
    ).trim();

    const address = String(
        formData.get("address") || ""
    ).trim();

    const city = String(
        formData.get("city") || ""
    ).trim();

    const postalCode = String(
        formData.get("postalCode") || ""
    ).trim();

    const paymentValue = formData.get("paymentMethod");

    // Match the payment method accepted by the existing backend.
    const paymentMethod = paymentValue === "COD"
        ? "cash_on_delivery"
        : paymentValue;

    const fullAddress = [
        address,
        city,
        postalCode
    ].filter(Boolean).join(", ");

    const orderData = {
        customer: {
            name: customerName,
            email: email,
            address: fullAddress
        },

        items: cart.map(item => ({
            productId: item.id,
            quantity: item.quantity
        })),

        paymentMethod: paymentMethod
    };

    try {
        const response = await fetch("/api/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to place your order."
            );
        }

        // Only clear the cart after the server confirms success.
        localStorage.removeItem("novaraCart");
        cart = [];

        renderCheckout();

        checkoutForm.reset();

        checkoutMessage.className =
            "checkout-message success";

        checkoutMessage.textContent =
            `Order placed successfully! Order ID: ${
                result.order?.id || "Confirmed"
            }. Thank you for shopping with NOVARA!`;

        checkoutMessage.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    } catch (error) {
        console.error("Order placement error:", error);

        checkoutMessage.className =
            "checkout-message error";

        checkoutMessage.textContent =
            error.message ||
            "Something went wrong. Please try again.";

    } finally {
        placeOrderButton.disabled = cart.length === 0;
    }
});

const currentYear = document.getElementById("currentYear");

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}

initializeCheckout();

