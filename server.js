
const express = require("express");
const path = require("path");
require("dotenv").config();

const db = require("./config/db");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT DATABASE() AS database_name");
        res.json({
            success: true,
            message: "NOVARA server and database connected!",
            database: rows[0].database_name
        });
    } catch (error) {
        console.error("Database error:", error.message);
        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

const PORT = process.env.PORT || 3000;

app.get("/api/products", async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT
                p.id,
                p.name,
                p.description,
                p.price,
                p.image,
                p.stock,
                c.name AS category
            FROM products p
            JOIN categories c ON c.id = p.category_id
            ORDER BY p.id DESC
        `);

        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        console.error("Products error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not load products"
        });
    }
});
app.get("/test-cart", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "cart.html"));
});
app.listen(PORT, () => {
    console.log(`NOVARA server running at http://localhost:${PORT}`);
});
