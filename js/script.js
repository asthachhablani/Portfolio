/* =========================================================
   PAGE LOADER
========================================================= */
window.addEventListener("load", () => {
    const loader = document.getElementById("pageLoader");
    if (loader) {
        setTimeout(() => loader.classList.add("loaded"), 250);
    }
});
const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const isSmall = window.innerWidth < 768;
const MAX_LINK_DIST = isSmall ? 105 : 135;
const MAX_LINK_DIST_SQ = MAX_LINK_DIST * MAX_LINK_DIST;
const MOUSE_RADIUS = isSmall ? 165 : 250;
const MOUSE_RADIUS_SQ = MOUSE_RADIUS * MOUSE_RADIUS;

const CYAN = "0,255,255";

let mouse = { x: -1000, y: -1000 };
let mouseTarget = { x: -1000, y: -1000 };
let mouseActive = false;

window.addEventListener("mousemove", (e) => {
    mouseTarget.x = e.clientX;
    mouseTarget.y = e.clientY;
    mouseActive = true;
});
window.addEventListener("mouseleave", () => { mouseActive = false; });
window.addEventListener(
    "touchmove",
    (e) => {
        if (!e.touches.length) return;
        mouseTarget.x = e.touches[0].clientX;
        mouseTarget.y = e.touches[0].clientY;
        mouseActive = true;
    },
    { passive: true }
);
window.addEventListener("touchend", () => { mouseActive = false; });

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.15;
        this.vy = (Math.random() - 0.5) * 0.15;
        this.size = Math.random() * 1.4 + 0.9;

        this.baseAlpha = 0.02 + Math.random() * 0.03;
        this.glow = 0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < -10) this.x = canvas.width + 10;
        if (this.x > canvas.width + 10) this.x = -10;
        if (this.y < -10) this.y = canvas.height + 10;
        if (this.y > canvas.height + 10) this.y = -10;

        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const distSq = dx * dx + dy * dy;

        if (mouseActive && distSq < MOUSE_RADIUS_SQ) {
            const dist = Math.sqrt(distSq) || 0.0001;
            const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
            const angle = Math.atan2(dy, dx) + Math.PI / 2.4;
            this.x += Math.cos(angle) * force * 0.7;
            this.y += Math.sin(angle) * force * 0.7;
            this._targetGlow = 1 - dist / MOUSE_RADIUS;
        } else {
            this._targetGlow = 0;
        }

        this.glow += (this._targetGlow - this.glow) * 0.1;
    }

    draw() {
        const alpha = Math.min(1, this.baseAlpha + this.glow * 0.8);
        const size = this.size + this.glow * 1.2;

        if (this.glow > 0.05) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, size + this.glow * 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${CYAN},${this.glow * 0.12})`;
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${CYAN},${alpha})`;
        ctx.fill();
    }
}

const area = window.innerWidth * window.innerHeight;
let particleCount = Math.max(100, Math.min(240, Math.round(area / 8000)));

let particles = [];
function buildParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) particles.push(new Particle());
}
buildParticles();

/* ---- Spatial grid for O(n) neighbor lookups ---- */
const CELL_SIZE = MAX_LINK_DIST;
let grid = new Map();

function cellKey(cx, cy) {
    return cx + "," + cy;
}

function buildGrid() {
    grid.clear();
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const cx = Math.floor(p.x / CELL_SIZE);
        const cy = Math.floor(p.y / CELL_SIZE);
        const key = cellKey(cx, cy);
        let cell = grid.get(key);
        if (!cell) {
            cell = [];
            grid.set(key, cell);
        }
        cell.push(i);
    }
}
const NEIGHBOR_OFFSETS = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
];

function drawLinks() {
    for (const [key, cellIndices] of grid) {
        const commaIdx = key.indexOf(",");
        const cx = parseInt(key.slice(0, commaIdx), 10);
        const cy = parseInt(key.slice(commaIdx + 1), 10);

        for (const [ox, oy] of NEIGHBOR_OFFSETS) {
            const neighborIndices = grid.get(cellKey(cx + ox, cy + oy));
            if (!neighborIndices) continue;
            const sameCell = ox === 0 && oy === 0;

            for (let ii = 0; ii < cellIndices.length; ii++) {
                const a = cellIndices[ii];
                const pa = particles[a];
                const startJ = sameCell ? ii + 1 : 0;

                for (let jj = startJ; jj < neighborIndices.length; jj++) {
                    const b = neighborIndices[jj];
                    const pb = particles[b];

                    const dx = pa.x - pb.x;
                    const dy = pa.y - pb.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < MAX_LINK_DIST_SQ) {
                        const dist = Math.sqrt(distSq);
                        const boost = Math.max(pa.glow, pb.glow);
                        const alpha = (1 - dist / MAX_LINK_DIST) * (0.015 + boost * 0.75);

                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(${CYAN},${alpha})`;
                        ctx.lineWidth = 0.6 + boost * 0.9;
                        ctx.moveTo(pa.x, pa.y);
                        ctx.lineTo(pb.x, pb.y);
                        ctx.stroke();
                    }
                }
            }
        }
    }

    // direct link from lit-up particles straight to the cursor
    if (mouseActive) {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p.glow > 0.1) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(${CYAN},${p.glow * 0.65})`;
                ctx.lineWidth = 0.9;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.stroke();
            }
        }
    }
}

function drawCursorGlow() {
    if (!mouseActive) return;
    const r = MOUSE_RADIUS * 0.75;
    const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, r);
    grad.addColorStop(0, "rgba(0,255,255,0.17)");
    grad.addColorStop(1, "rgba(0,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2);
    ctx.fill();
}

let isTabVisible = true;
document.addEventListener("visibilitychange", () => {
    isTabVisible = document.visibilityState === "visible";
});

function animate() {
    if (!isTabVisible) {
        requestAnimationFrame(animate);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ease raw cursor position for a bit of weight/lag
    mouse.x += (mouseTarget.x - mouse.x) * 0.15;
    mouse.y += (mouseTarget.y - mouse.y) * 0.15;

    drawCursorGlow();
    particles.forEach((p) => p.update());
    buildGrid();
    drawLinks();
    particles.forEach((p) => p.draw());

    requestAnimationFrame(animate);
}
animate();

function debounce(fn, wait) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

window.addEventListener(
    "resize",
    debounce(() => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const newArea = window.innerWidth * window.innerHeight;
        particleCount = Math.max(100, Math.min(240, Math.round(newArea / 8000)));
        buildParticles();
    }, 150)
);

function generateStars(containerId, count = 120) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
        const star = document.createElement("div");
        star.classList.add("star");
        star.style.left = Math.random() * 100 + "%";
        star.style.top = Math.random() * 100 + "%";

        const size = Math.random() * 2 + 1;
        star.style.width = size + "px";
        star.style.height = size + "px";

        star.style.animationDelay = Math.random() * 5 + "s";
        star.style.animationDuration = 1 + Math.random() * 4 + "s";

        fragment.appendChild(star);
    }

    container.appendChild(fragment);
}

generateStars("about-stars");
generateStars("education-stars");
generateStars("project-stars");

/* =========================================================
   PROJECT SLIDESHOW (runs independently for each project card)
========================================================= */
document.querySelectorAll(".project-showcase").forEach((showcase) => {
    const slides = showcase.querySelectorAll("img");
    let current = 0;

    if (slides.length > 1) {
        setInterval(() => {
            slides[current].classList.remove("active-slide");
            current = (current + 1) % slides.length;
            slides[current].classList.add("active-slide");
        }, 5000);
    }
});

/* =========================================================
   CLOCK / DATE
========================================================= */
function updateClock() {
    const now = new Date();
    const clock = document.getElementById("clock");
    const date = document.getElementById("date");

    if (clock) {
        clock.textContent = now.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    if (date) {
        date.textContent = now.toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
        });
    }
}
updateClock();
setInterval(updateClock, 1000);
const earthCanvas = document.getElementById("earth");

if (earthCanvas) {
    const earthCtx = earthCanvas.getContext("2d");
    const size = Math.min(earthCanvas.clientWidth || 260, 260);

    let w = size;
    let h = size;
    earthCanvas.width = w;
    earthCanvas.height = h;

    const projection = d3
        .geoOrthographic()
        .scale(size / 2.2)
        .translate([w / 2, h / 2])
        .clipAngle(90);

    const path = d3.geoPath(projection, earthCtx);
    let rotation = 0;
    let globeVisible = true;
    let globeRAF = null;

    const globeObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                globeVisible = entry.isIntersecting;
                if (globeVisible && globeRAF === null) {
                    globeRAF = requestAnimationFrame(draw);
                }
            });
        },
        { threshold: 0.01 }
    );
    globeObserver.observe(earthCanvas);

    function draw() {
        if (!globeVisible) {
            globeRAF = null;
            return;
        }

        earthCtx.clearRect(0, 0, w, h);
        projection.rotate([rotation, -15]);

        // ocean
        earthCtx.beginPath();
        path({ type: "Sphere" });
        earthCtx.fillStyle = "#050505";
        earthCtx.fill();
        earthCtx.strokeStyle = "#a855f7";
        earthCtx.lineWidth = 2;
        earthCtx.stroke();

        // land
        if (draw.world) {
            earthCtx.beginPath();
            path(draw.world);
            earthCtx.fillStyle = "#9333ea";
            earthCtx.globalAlpha = 0.15;
            earthCtx.fill();
            earthCtx.globalAlpha = 1;
            earthCtx.strokeStyle = "#ec4899";
            earthCtx.lineWidth = 0.6;
            earthCtx.stroke();
        }

        rotation += 0.15;
        globeRAF = requestAnimationFrame(draw);
    }

    d3.json(
        "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"
    ).then((world) => {
        draw.world = world;
        if (globeRAF === null) globeRAF = requestAnimationFrame(draw);
    });
}

/* =========================================================
   EDUCATION CARD REVEAL + PROGRESS BARS
========================================================= */
const educationCards = document.querySelectorAll(".education-card, .info-card");

const educationObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            const bar = entry.target.querySelector(".progress-fill");

            if (entry.isIntersecting) {
                entry.target.classList.add("show-card");
                if (bar) bar.style.width = bar.dataset.width + "%";
            } else {
                entry.target.classList.remove("show-card");
                if (bar) bar.style.width = "0%";
            }
        });
    },
    { threshold: 0.25 }
);

educationCards.forEach((card) => educationObserver.observe(card));

/* =========================================================
   GENERIC SCROLL REVEAL (.reveal-fade / .reveal-up)
========================================================= */
const revealEls = document.querySelectorAll(".reveal-fade, .reveal-up");

const revealObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("in-view");
                revealObserver.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.15 }
);

revealEls.forEach((el) => revealObserver.observe(el));
const navbar = document.getElementById("navbar");
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll("section[id]");
const backToTop = document.getElementById("backToTop");

function onScroll() {
    const scrollY = window.scrollY;

    if (navbar) {
        navbar.classList.toggle("scrolled", scrollY > 40);
    }

    if (backToTop) {
        backToTop.classList.toggle("show", scrollY > 500);
    }

    let currentSection = "home";
    sections.forEach((section) => {
        const top = section.offsetTop - 140;
        if (scrollY >= top) currentSection = section.getAttribute("id");
    });

    navLinks.forEach((link) => {
        link.classList.toggle("active", link.dataset.nav === currentSection);
    });
}

let scrollTicking = false;
window.addEventListener("scroll", () => {
    if (!scrollTicking) {
        requestAnimationFrame(() => {
            onScroll();
            scrollTicking = false;
        });
        scrollTicking = true;
    }
});
onScroll();

if (backToTop) {
    backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

/* =========================================================
   MOBILE MENU
========================================================= */
const menuBtn = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector(".mobile-menu");

if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", () => {
        mobileMenu.classList.toggle("active");

        menuBtn.innerHTML = mobileMenu.classList.contains("active")
            ? '<i class="fas fa-times"></i>'
            : '<i class="fas fa-bars"></i>';
    });

    document.querySelectorAll(".mobile-menu a").forEach((link) => {
        link.addEventListener("click", () => {
            mobileMenu.classList.remove("active");
            menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        });
    });
}