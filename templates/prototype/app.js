/* {{NAME}} — prototype. One IIFE, one block per section in flow order. */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  // The prototype must also run with the kit removed (proto-chrome.js not loaded, e.g. handed off without it): then
  // every chrome call is a no-op — no capsule, no toasts / hints, the screens work the same.
  const ProtoChrome = window.ProtoChrome ?? { init: () => ({ isHost: false, isEmbed: false }), screen() {}, toast() {}, hint() {}, toggle() {} };

  /* ============ Prototype chrome (flow starting points; web: device switcher, sizes, resizable frame) ============
     Add each new section's entry screen to FLOWS. A point reloads with ?screen=<id> + its own params;
     FLOW_KEYS are cleared by every other point. */
  const FLOWS = [
    { label: "Start", screen: "start" },
  ];
  const FLOW_KEYS = ["open", "state"];
  // Demo hints beside the device — only for screens where the prototype branches on a rule the viewer can't guess.
  // `value` = the same constant the code checks; tap on it types it into `fill`. Same object on two screens = card stays.
  // e.g. "sign-in": { title: "Two ways in", text: "The app checks whether this email already has an account.",
  //   rows: [{ label: "Existing user", text: "Signs in with a password.", value: REGISTERED_EMAIL, fill: 'input[name="email"]' },
  //          { label: "New user", text: "Any other email starts sign up with it." }] }
  const HINTS = {};
  const pc = ProtoChrome.init({
    id: "{{SLUG}}",
    title: "{{NAME}} prototype",
    mode: "{{MODE}}",
    frame: "#device",
    defaultScreen: "start",
    flows: FLOWS,
    flowKeys: FLOW_KEYS,
    hints: HINTS,
  });
  if (pc.isHost) return;   // web: this page is only the stage around the device iframe

  /* ============ Mobile: scale the phone to fit the window ============ */
  const device = document.getElementById("device");
  if (device) {
    const fit = () => {
      const cs = getComputedStyle(document.documentElement);
      const bezel = parseFloat(cs.getPropertyValue("--bezel")) * 2;
      const w = parseFloat(cs.getPropertyValue("--screen-w")) + bezel, h = parseFloat(cs.getPropertyValue("--screen-h")) + bezel;
      device.style.setProperty("--scale", Math.min(1, (innerHeight - 32) / h, (innerWidth - 32) / w).toFixed(3));
    };
    addEventListener("resize", fit);
    fit();
  }

  // System messages (prototype limits): data-action="soon" / data-soon="…" on elements, or ProtoChrome.toast(msg)

  /* ============ Router ============ */
  const screens = [...document.querySelectorAll(".screen")];
  const onEnter = {};
  let current = null;
  function go(id) {
    const next = screens.find((s) => s.dataset.screen === id) || screens[0];
    if (current === next) return;
    current?.classList.remove("is-active");
    next.classList.add("is-active");
    current = next;
    ProtoChrome.screen(next.dataset.screen);
    onEnter[next.dataset.screen]?.();
  }

  /* ============ Sections ============ */
  // one block per section, in flow order

  /* ============ Boot ============ */
  go(params.get("screen") || "start");
})();
