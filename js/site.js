/* ZAPPY FC — shared page behaviour */
(function () {
  const api = window.ZappyAPI;

  // demo banner
  const banner = document.getElementById("demoBanner");
  if (banner && api && api.demo) banner.hidden = false;

  // year
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // toasts
  const host = document.getElementById("toasts");
  window.zappyToast = function (msg, bad) {
    if (!host) return;
    const t = document.createElement("div");
    t.className = "toast" + (bad ? " bad" : "");
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 320); }, 3200);
  };

  // typed tagline
  const typed = document.getElementById("typed");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typed && !reduce) {
    const lines = ["FC 27 Pro Clubs", "Now recruiting", "Pass. Move. Win.", "All platforms welcome"];
    let li = 0, ci = lines[0].length, deleting = true;
    const tick = () => {
      const line = lines[li];
      if (deleting) {
        ci--;
        if (ci <= 0) { deleting = false; li = (li + 1) % lines.length; }
      } else {
        ci++;
        if (ci >= lines[li].length) { deleting = true; typed.textContent = lines[li]; return setTimeout(tick, 2200); }
      }
      typed.textContent = (deleting ? line : lines[li]).slice(0, Math.max(ci, 0));
      setTimeout(tick, deleting ? 40 : 85);
    };
    setTimeout(tick, 2600);
  }

  // reveal on scroll
  const els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const sibs = [...e.target.parentElement.children].filter((c) => c.classList.contains("reveal"));
          e.target.style.transitionDelay = Math.max(0, sibs.indexOf(e.target)) * 90 + "ms";
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    els.forEach((el) => io.observe(el));
  } else {
    els.forEach((el) => el.classList.add("in"));
  }
})();
