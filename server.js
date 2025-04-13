const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// File paths
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const INVENTORY_FILE = path.join(__dirname, 'data', 'inventory.json');

// Ensure data directory exists
async function ensureDataDirectory() {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// Initialize data files if they don't exist
async function initializeDataFiles() {
    try {
        await ensureDataDirectory();
        
        try {
            await fs.access(ORDERS_FILE);
        } catch {
            await fs.writeFile(ORDERS_FILE, JSON.stringify([]));
        }

        try {
            await fs.access(INVENTORY_FILE);
        } catch {
            const initialInventory = {
                cheesecake: 100,
                cookies: 200,
                cobblers: 50
            };
            await fs.writeFile(INVENTORY_FILE, JSON.stringify(initialInventory));
        }
    } catch (error) {
        console.error('Error initializing data files:', error);
    }
}

// API Routes

// Get all orders
app.get('/api/orders', async (req, res) => {
    try {
        const orders = JSON.parse(await fs.readFile(ORDERS_FILE, 'utf8'));
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Error reading orders' });
    }
});

// Get order by ID
app.get('/api/orders/:id', async (req, res) => {
    try {
        const orders = JSON.parse(await fs.readFile(ORDERS_FILE, 'utf8'));
        const order = orders.find(o => o.id === req.params.id);
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Error reading order' });
    }
});

// Create new order
app.post('/api/orders', async (req, res) => {
    try {
        const orders = JSON.parse(await fs.readFile(ORDERS_FILE, 'utf8'));
        const inventory = JSON.parse(await fs.readFile(INVENTORY_FILE, 'utf8'));
        
        const newOrder = {
            id: Date.now().toString(),
            ...req.body,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Update inventory
        for (const item of newOrder.items) {
            if (inventory[item.type]) {
                inventory[item.type] -= item.quantity;
            }
        }

        await fs.writeFile(INVENTORY_FILE, JSON.stringify(inventory));
        orders.push(newOrder);
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders));

        res.status(201).json(newOrder);
    } catch (error) {
        res.status(500).json({ error: 'Error creating order' });
    }
});

// Update order status
app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const orders = JSON.parse(await fs.readFile(ORDERS_FILE, 'utf8'));
        const orderIndex = orders.findIndex(o => o.id === req.params.id);
        
        if (orderIndex === -1) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        orders[orderIndex].status = req.body.status;
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders));
        
        res.json(orders[orderIndex]);
    } catch (error) {
        res.status(500).json({ error: 'Error updating order status' });
    }
});

// Get inventory
app.get('/api/inventory', async (req, res) => {
    try {
        const inventory = JSON.parse(await fs.readFile(INVENTORY_FILE, 'utf8'));
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ error: 'Error reading inventory' });
    }
});

// Update inventory
app.put('/api/inventory', async (req, res) => {
    try {
        await fs.writeFile(INVENTORY_FILE, JSON.stringify(req.body));
        res.json(req.body);
    } catch (error) {
        res.status(500).json({ error: 'Error updating inventory' });
    }
});

// Initialize server
async function startServer() {
    await initializeDataFiles();
    
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer(); 