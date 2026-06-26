chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    /* ignore if API unavailable */
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    /* ignore */
  });
});

/* ── Forçar o nome do arquivo no download das imagens ─────────────────
 * O src da imagem gerada no Flow é um endpoint de redirect
 * (…/media.getMediaUrlRedirect?name=UUID) cujo Content-Disposition impõe
 * um nome UUID e ATROPELA o filename passado em downloads.download().
 * onDeterminingFilename é a palavra final do Chrome sobre o nome — sempre
 * vence o Content-Disposition. Guardamos o nome desejado por URL e o
 * aplicamos aqui. Sem isso, o arquivo sai como 941b6f11-….jpg e perde o
 * timestamp usado pra sincronizar com o áudio.
 * ---------------------------------------------------------------- */
const eltonDownloadNames = new Map(); // url -> filename desejado

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const want = eltonDownloadNames.get(item.url) || eltonDownloadNames.get(item.finalUrl);
  if (!want) return false; // não é um download nosso — deixa o Chrome decidir
  eltonDownloadNames.delete(item.url);
  eltonDownloadNames.delete(item.finalUrl);
  suggest({ filename: want, conflictAction: "uniquify" });
  return true;
});

/* ── MAIN world React fiber submit ───────────────────────────────────
 * chrome.scripting.executeScript with world:"MAIN" bypasses the page's
 * CSP and runs in the same JS context as React / Slate.
 *
 * The content script marks the target button with a data attribute,
 * then asks us to find and invoke the real submission handler from
 * the React fiber tree.
 * ---------------------------------------------------------------- */

/**
 * Injected into the page's MAIN world via chrome.scripting.executeScript.
 * Must be fully self-contained — no closures over service-worker scope.
 */
function reactFiberSubmit(token, markerAttr) {
  var el = document.querySelector("[" + markerAttr + '="' + token + '"]');
  if (!el) return { ok: false, reason: "element not found in MAIN world" };

  // Find React fiber key
  var fiberKey = Object.keys(el).find(function (k) {
    return (
      k.startsWith("__reactFiber$") ||
      k.startsWith("__reactInternalInstance$")
    );
  });
  if (!fiberKey) return { ok: false, reason: "no React fiber on element" };

  // Walk the fiber tree and collect ALL handlers we might call
  var fiber = el[fiberKey];
  var depth = 0;
  var onSubmit = null;
  var onSubmitDepth = -1;
  var onClick = null;
  var onClickDepth = -1;

  while (fiber && depth < 30) {
    var props = fiber.memoizedProps;
    if (props) {
      // Prefer onSubmit — this is the real submission handler
      if (!onSubmit && typeof props.onSubmit === "function") {
        onSubmit = props.onSubmit;
        onSubmitDepth = depth;
      }
      // Also collect onClick as fallback
      if (!onClick && typeof props.onClick === "function") {
        onClick = props.onClick;
        onClickDepth = depth;
      }
    }
    fiber = fiber.return;
    depth++;
  }

  // Also check __reactProps$ for direct handlers
  var propsKey = Object.keys(el).find(function (k) {
    return k.startsWith("__reactProps$");
  });
  if (propsKey) {
    var directProps = el[propsKey];
    if (!onClick && typeof directProps.onClick === "function") {
      onClick = directProps.onClick;
      onClickDepth = -1; // direct props
    }
  }

  // Strategy 1: Call onSubmit directly (bypasses all click/isTrusted checks)
  // The argument is the isTrusted flag — onClick passes event.nativeEvent.isTrusted
  // to onSubmit, which uses it in a boolean guard: (!isLoading || arg).
  if (onSubmit) {
    try {
      onSubmit(true);
      return { ok: true, method: "onSubmit", depth: onSubmitDepth };
    } catch (e) {
      // If onSubmit() with no args fails, it might need an event — continue to fallbacks
    }
  }

  // Strategy 2: Call onClick with isTrusted: true in the fake event
  if (onClick) {
    try {
      var rect = el.getBoundingClientRect();
      onClick({
        type: "click",
        target: el,
        currentTarget: el,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        button: 0,
        isTrusted: true,
        preventDefault: function () {},
        stopPropagation: function () {},
        isPropagationStopped: function () { return false; },
        isDefaultPrevented: function () { return false; },
        nativeEvent: { type: "click", isTrusted: true },
      });
      return { ok: true, method: "onClick", depth: onClickDepth };
    } catch (e) {
      return {
        ok: false,
        reason: "onClick threw: " + e.message,
        hadOnSubmit: !!onSubmit,
      };
    }
  }

  return {
    ok: false,
    reason: "neither onSubmit nor onClick found in fiber tree",
  };
}

// Simple main-world click for toggle buttons (no fiber needed)
function mainWorldAgentClick() {
  var btn = Array.from(document.querySelectorAll("button[aria-pressed]"))
    .find(function(b) { return /agent/i.test(b.textContent); });
  if (!btn) return { ok: false, reason: "Agent button not found" };
  if (btn.getAttribute("aria-pressed") !== "true") return { ok: true, skipped: true };
  btn.click();
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "ELTON_DOWNLOAD") {
    // Registra o nome desejado pra URL e dispara o download. O onDeterminingFilename
    // acima força esse nome; o filename aqui é um reforço (fallback).
    eltonDownloadNames.set(msg.url, msg.filename);
    chrome.downloads
      .download({ url: msg.url, filename: msg.filename, saveAs: false })
      .then((id) => sendResponse({ ok: true, id }))
      .catch((e) => {
        eltonDownloadNames.delete(msg.url);
        sendResponse({ ok: false, error: String(e?.message || e) });
      });
    return true;
  }

  if (msg?.type === "MAIN_WORLD_AGENT_CLICK") {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, reason: "no tab id" }); return; }
    chrome.scripting
      .executeScript({ target: { tabId }, world: "MAIN", func: mainWorldAgentClick })
      .then(results => sendResponse(results?.[0]?.result || { ok: false, reason: "no result" }))
      .catch(e => sendResponse({ ok: false, reason: String(e?.message || e) }));
    return true;
  }

  if (msg?.type !== "REACT_FIBER_CLICK") return;

  const tabId = sender.tab?.id;
  if (!tabId) {
    sendResponse({ ok: false, reason: "no tab id" });
    return;
  }

  chrome.scripting
    .executeScript({
      target: { tabId },
      world: "MAIN",
      func: reactFiberSubmit,
      args: [msg.token, msg.markerAttr],
    })
    .then((results) => {
      const val = results?.[0]?.result;
      sendResponse(val || { ok: false, reason: "no result from injection" });
    })
    .catch((e) => {
      sendResponse({ ok: false, reason: String(e?.message || e) });
    });

  return true; // async sendResponse
});
