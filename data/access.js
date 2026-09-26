/*
 * Soft, link-based access control for the chart viewer.
 * ----------------------------------------------------
 * IMPORTANT — this is "soft" permissions by design:
 *   A share link controls WHICH charts the viewer will DISPLAY, but the raw
 *   chart data still lives in data/chart-data.js, so a technically-minded
 *   visitor could open that file directly. This is fine for trust-based
 *   sharing with friends & family. If you ever need real, enforced privacy,
 *   the charts would need to be encrypted or served from a backend.
 *
 * How a link encodes access:
 *   index.html?s=<token>     token = base64url(JSON array of chart ids)
 *   index.html?charts=a,b    human-readable fallback (comma-separated ids)
 *   index.html?c=<id>        which chart to open first (optional)
 *   (no params)              owner view: shows ALL charts
 */
(function () {
  function b64urlEncode(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    return decodeURIComponent(escape(atob(str)));
  }

  function getParams() {
    var q = {};
    var s = location.search.replace(/^\?/, "");
    if (!s) return q;
    s.split("&").forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf("=");
      var k = i < 0 ? kv : kv.slice(0, i);
      var v = i < 0 ? "" : kv.slice(i + 1);
      q[decodeURIComponent(k)] = decodeURIComponent(v);
    });
    return q;
  }

  function encodeIds(ids) {
    return b64urlEncode(JSON.stringify(ids));
  }
  function decodeToken(token) {
    try {
      var arr = JSON.parse(b64urlDecode(token));
      return Array.isArray(arr) ? arr : null;
    } catch (e) { return null; }
  }

  // Build a shareable URL for the given base + ids (+ optional first chart)
  function buildLink(baseUrl, ids, firstId) {
    var url = baseUrl.split("#")[0].split("?")[0];
    var params = ["s=" + encodeIds(ids)];
    if (firstId && ids.indexOf(firstId) >= 0) params.push("c=" + encodeURIComponent(firstId));
    return url + "?" + params.join("&");
  }

  // Resolve which charts this visitor may see, and which to open first.
  function resolve(allIds) {
    var q = getParams();
    var allowed = null;

    if (q.s) allowed = decodeToken(q.s);
    else if (q.charts) allowed = q.charts.split(",").map(function (x) { return x.trim(); });

    // No valid token -> owner/default view: everything
    if (!allowed || !allowed.length) allowed = allIds.slice();

    // Keep only ids that actually exist, preserving order
    allowed = allowed.filter(function (id) { return allIds.indexOf(id) >= 0; });
    if (!allowed.length) allowed = []; // explicit empty -> "no access" screen

    var activeId = (q.c && allowed.indexOf(q.c) >= 0) ? q.c : allowed[0];
    return { allowed: allowed, activeId: activeId, params: q };
  }

  // Update the ?c= param in the address bar without reloading, preserving token.
  function setActive(id) {
    var q = getParams();
    q.c = id;
    var parts = [];
    ["s", "charts", "c"].forEach(function (k) {
      if (q[k] != null && q[k] !== "") parts.push(k + "=" + encodeURIComponent(q[k]));
    });
    var newUrl = location.pathname + (parts.length ? "?" + parts.join("&") : "") + location.hash;
    try { history.replaceState(null, "", newUrl); } catch (e) {}
  }

  window.VEDIC_ACCESS = {
    resolve: resolve,
    setActive: setActive,
    encodeIds: encodeIds,
    decodeToken: decodeToken,
    buildLink: buildLink,
    getParams: getParams
  };
})();
