/* Settings → Prototype Kit: add / remove point rows (the row markup comes from <template id="prototype-kit-row">). */
(() => {
  "use strict";
  const table = document.querySelector(".prototype-kit-points tbody");
  const template = document.getElementById("prototype-kit-row");
  if (!table || !template) return;
  let next = table.rows.length;   // new rows get fresh indexes; gaps are fine (PHP keeps the order)

  document.querySelector(".prototype-kit-add")?.addEventListener("click", () => {
    const html = template.innerHTML.replaceAll("__i__", String(next++));
    table.insertAdjacentHTML("beforeend", html);
    table.lastElementChild.querySelector("input")?.focus();
  });
  table.addEventListener("click", (e) => {
    const remove = e.target.closest(".prototype-kit-remove");
    if (remove) remove.closest("tr").remove();
  });
})();
