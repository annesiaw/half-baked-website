// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Add animation to menu items when they come into view
const menuItems = document.querySelectorAll('.menu-item');

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, {
    threshold: 0.1
});

menuItems.forEach(item => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(20px)';
    item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(item);
});

// Add animation to testimonials
const testimonials = document.querySelectorAll('.testimonial');

testimonials.forEach(testimonial => {
    testimonial.style.opacity = '0';
    testimonial.style.transform = 'translateY(20px)';
    testimonial.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(testimonial);
});

// Mobile menu toggle (to be implemented when needed)
// const menuToggle = document.querySelector('.menu-toggle');
// const navLinks = document.querySelector('.nav-links');

// menuToggle.addEventListener('click', () => {
//     navLinks.classList.toggle('active');
// });

// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Order Form Handling
document.addEventListener('DOMContentLoaded', () => {
    const orderForm = document.getElementById('orderForm');
    const trackingForm = document.getElementById('trackingForm');
    const adminDashboard = document.getElementById('admin-dashboard');

    if (orderForm) {
        orderForm.addEventListener('submit', handleOrderSubmit);
    }

    if (trackingForm) {
        trackingForm.addEventListener('submit', handleTrackingSubmit);
    }

    if (adminDashboard) {
        loadAdminDashboard();
    }
});

// Handle Order Submission
async function handleOrderSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const orderData = {
        customer: {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            address: formData.get('address')
        },
        items: [],
        delivery: {
            date: formData.get('deliveryDate'),
            time: formData.get('deliveryTime'),
            instructions: formData.get('specialInstructions')
        }
    };

    // Process cheesecake items
    const cheesecakeTypes = ['strawberry', 'peach', 'cookies', 'brownie', 'newyork'];
    cheesecakeTypes.forEach(type => {
        const quantity = parseInt(formData.get(`${type}_qty`));
        if (quantity > 0) {
            orderData.items.push({
                type: 'cheesecake',
                flavor: type,
                quantity: quantity,
                price: 10
            });
        }
    });

    // Process cookies
    const singleQty = parseInt(formData.get('single_qty'));
    const doubleQty = parseInt(formData.get('double_qty'));
    
    if (singleQty > 0) {
        orderData.items.push({
            type: 'cookies',
            size: 'single',
            quantity: singleQty,
            price: 3
        });
    }
    
    if (doubleQty > 0) {
        orderData.items.push({
            type: 'cookies',
            size: 'double',
            quantity: doubleQty,
            price: 5
        });
    }

    // Process cobblers
    const cobblerQty = parseInt(formData.get('peach_cobbler_qty'));
    if (cobblerQty > 0) {
        orderData.items.push({
            type: 'cobbler',
            flavor: 'peach',
            quantity: cobblerQty,
            price: 10
        });
    }

    try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            const order = await response.json();
            alert(`Order placed successfully! Your order ID is: ${order.id}`);
            window.location.href = `tracking.html?orderId=${order.id}`;
        } else {
            throw new Error('Failed to place order');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to place order. Please try again.');
    }
}

// Handle Order Tracking
async function handleTrackingSubmit(event) {
    event.preventDefault();
    
    const orderId = document.getElementById('orderId').value;
    const email = document.getElementById('trackingEmail').value;

    try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`);
        if (response.ok) {
            const order = await response.json();
            displayOrderStatus(order);
        } else {
            throw new Error('Order not found');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Order not found. Please check your order ID and email.');
    }
}

// Display Order Status
function displayOrderStatus(order) {
    const orderStatus = document.getElementById('orderStatus');
    const orderItems = document.getElementById('orderItems');
    const deliveryAddress = document.getElementById('deliveryAddress');
    const deliveryTime = document.getElementById('deliveryTime');

    // Update status timeline
    const statusSteps = ['pending', 'processing', 'preparing', 'ready', 'delivered'];
    statusSteps.forEach((status, index) => {
        const step = document.getElementById(`step${index + 1}`);
        if (statusSteps.indexOf(order.status) >= index) {
            step.classList.add('completed');
        } else {
            step.classList.remove('completed');
        }
    });

    // Update order details
    orderItems.innerHTML = order.items.map(item => `
        <div class="order-item">
            <span>${item.quantity}x ${item.type} ${item.flavor || item.size || ''}</span>
            <span>$${item.price * item.quantity}</span>
        </div>
    `).join('');

    deliveryAddress.textContent = order.customer.address;
    deliveryTime.textContent = `Scheduled for ${order.delivery.date} at ${order.delivery.time}`;

    orderStatus.classList.remove('hidden');
}

// Admin Dashboard Functions
async function loadAdminDashboard() {
    try {
        const [orders, inventory] = await Promise.all([
            fetch(`${API_BASE_URL}/orders`).then(res => res.json()),
            fetch(`${API_BASE_URL}/inventory`).then(res => res.json())
        ]);

        updateDashboardStats(orders);
        updateOrdersTable(orders);
        updateInventoryDisplay(inventory);

        // Set up event listeners
        document.getElementById('statusFilter').addEventListener('change', () => updateOrdersTable(orders));
        document.getElementById('dateFilter').addEventListener('change', () => updateOrdersTable(orders));
        document.getElementById('refreshOrders').addEventListener('click', loadAdminDashboard);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function updateDashboardStats(orders) {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(order => order.createdAt.startsWith(today));
    const pendingOrders = orders.filter(order => order.status === 'pending');
    const completedOrders = orders.filter(order => order.status === 'delivered');

    document.getElementById('todayOrders').textContent = todayOrders.length;
    document.getElementById('pendingOrders').textContent = pendingOrders.length;
    document.getElementById('completedOrders').textContent = completedOrders.length;
}

function updateOrdersTable(orders) {
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    let filteredOrders = orders;
    
    if (statusFilter !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
    }
    
    if (dateFilter) {
        filteredOrders = filteredOrders.filter(order => order.delivery.date === dateFilter);
    }

    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = filteredOrders.map(order => `
        <tr>
            <td>${order.id}</td>
            <td>${order.customer.name}</td>
            <td>${order.items.map(item => `${item.quantity}x ${item.type}`).join(', ')}</td>
            <td>$${order.items.reduce((total, item) => total + (item.price * item.quantity), 0)}</td>
            <td>
                <select class="status-select" data-order-id="${order.id}">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
                    <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                    <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Ready</option>
                    <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                </select>
            </td>
            <td>
                <button class="view-order" data-order-id="${order.id}">View</button>
            </td>
        </tr>
    `).join('');

    // Add event listeners for status updates
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async (event) => {
            const orderId = event.target.dataset.orderId;
            try {
                await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: event.target.value })
                });
                loadAdminDashboard();
            } catch (error) {
                console.error('Error updating order status:', error);
            }
        });
    });
}

function updateInventoryDisplay(inventory) {
    document.getElementById('cheesecakeStock').value = inventory.cheesecake;
    document.getElementById('cookiesStock').value = inventory.cookies;
    document.getElementById('cobblersStock').value = inventory.cobblers;

    // Add event listeners for inventory updates
    document.querySelectorAll('.update-stock').forEach(button => {
        button.addEventListener('click', async (event) => {
            const type = event.target.parentElement.querySelector('input').id.replace('Stock', '');
            const newValue = parseInt(event.target.parentElement.querySelector('input').value);
            
            try {
                const updatedInventory = { ...inventory, [type]: newValue };
                await fetch(`${API_BASE_URL}/inventory`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatedInventory)
                });
                loadAdminDashboard();
            } catch (error) {
                console.error('Error updating inventory:', error);
            }
        });
    });
}