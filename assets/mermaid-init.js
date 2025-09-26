(function () {
  function renderMermaid() {
    if (!window.mermaid) return;

    // Convert fenced code blocks (```mermaid) into <div class="mermaid"> so Mermaid can render them
    document.querySelectorAll('pre code.language-mermaid, code.language-mermaid').forEach(code => {
      const pre = code.closest('pre');
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = code.textContent;
      if (pre) pre.replaceWith(div); else code.replaceWith(div);
    });

    window.mermaid.initialize({ startOnLoad: true, securityLevel: "loose", theme: "default" });
    window.mermaid.run();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderMermaid);
  } else {
    renderMermaid();
  }
})();
