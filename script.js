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