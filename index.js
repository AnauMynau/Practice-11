require("dotenv").config() //  connect env
const express = require("express")
const { MongoClient, ObjectId } = require("mongodb")
const uri = "mongodb+srv://241637_db_user:150501@cluster0.fvp2hcs.mongodb.net/?appName=Cluster0"

const app = express()
const PORT = process.env.PORT || 3000

// Middleware JSON
app.use(express.json())

// Logger middleware
app.use((req, res, next) => {
    console.log(req.method, req.url)
    next()
})

// [3] Ссылка на базу теперь берется из .env, иначе ошибка или локалхост (для тестов)
const MONGO_URL = process.env.MONGO_URI || "mongodb://localhost:27017"
const client = new MongoClient(MONGO_URL)

let productsCollection

async function startServer() {
    try {
        // Connect to MongoDB
        await client.connect()
        console.log("Connected to MongoDB")

        const db = client.db("shop")
        productsCollection = db.collection("products")

        // Start server only after DB connection
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`)
        })
    } catch (error) {
        console.error("MongoDB connection error:", error)
    }
}

// Routes

// GET /
app.get("/", (req, res) => {
    res.send(`
    <h1>Products API Demo</h1>
    <ul>
      <li><a href="/api/products">All products</a></li>
      <li><a href="/api/products?category=food">Category = food</a></li>
      <li><a href="/api/products?minPrice=300">Price >= 300</a></li>
    </ul>
  `);
});

// GET /api/products (Filter + Sort + Projection)
app.get("/api/products", async (req, res) => {
    try {
        const { category, minPrice, sort, fields } = req.query
        const filter = {}

        // Filtering
        if (category) filter.category = category
        if (minPrice !== undefined) {
            const min = Number(minPrice)
            if (Number.isNaN(min)) {
                return res.status(400).json({ error: "minPrice must be a number" })
            }
            filter.price = { $gte: min }
        }

        // Options
        const options = {}
        if (sort === "price") options.sort = { price: 1 }

        if (fields) {
            options.projection = {}
            const list = fields.split(",")
            for (const f of list) {
                const field = f.trim()
                if (field.length > 0) options.projection[field] = 1
            }
            if (!options.projection._id) options.projection._id = 0
        }

        const products = await productsCollection.find(filter, options).toArray()

        res.json({
            count: products.length,
            products: products
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// GET /api/products/:id
app.get("/api/products/:id", async (req, res) => {
    const id = req.params.id
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid product id" })
    }
    const product = await productsCollection.findOne({ _id: new ObjectId(id) })
    if (!product) {
        return res.status(404).json({ error: "Product not found" })
    }
    res.json(product)
})

// POST /api/products
app.post("/api/products", async (req, res) => {
    const { name, price, category } = req.body
    if (!name || !price || !category) {
        return res.status(400).json({ error: "Missing required fields" })
    }
    const result = await productsCollection.insertOne({ name, price, category })
    res.status(201).json({
        _id: result.insertedId,
        name,
        price,
        category
    })
})

// PUT /api/products/:id
app.put("/api/products/:id", async (req, res) => {
    const id = req.params.id
    const { name, price, category } = req.body
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid product id" })
    if (!name && !price && !category) return res.status(400).json({ error: "No fields to update" })

    const result = await productsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { name, price, category } }
    )
    if (result.matchedCount === 0) return res.status(404).json({ error: "Product not found" })
    res.json({ message: "Product updated" })
})

// DELETE /api/products/:id
app.delete("/api/products/:id", async (req, res) => {
    const id = req.params.id
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid product id" })
    const result = await productsCollection.deleteOne({ _id: new ObjectId(id) })
    if (result.deletedCount === 0) return res.status(404).json({ error: "Product not found" })
    res.json({ message: "Product deleted" })
})

// 404
app.use((req, res) => {
    res.status(404).json({ error: "API endpoint not found" })
})

// Start
startServer()