// Digital zoom controls for the RTSP Main Stream page.
//
// image.zoom (percent, 100 = off) and image.zoom_center_x/y (percent of the
// sensor) are read and written through the prudynt config API.  prudynt
// applies a change by rebuilding its video channels in place, and saves it.
(function () {
  "use strict";

  var API_KEY_PROMISE = fetch("/x/api-key.cgi", { cache: "no-store" })
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      return d.exists && d.api_key ? d.api_key : "";
    })
    .catch(function () {
      return "";
    });

  var API_BASE = "http://" + location.hostname + ":8080/api/v1/config";
  var FIELDS = ["zoom", "zoom_center_x", "zoom_center_y"];
  var LIMITS = {
    zoom: [100, 800],
    zoom_center_x: [0, 100],
    zoom_center_y: [0, 100],
  };
  var SETTLE_MS = 3000;

  function el(id) {
    return document.getElementById(id);
  }

  function status(text) {
    var s = el("zoom-status");
    if (s) s.textContent = text;
  }

  async function api(path, options) {
    var key = await API_KEY_PROMISE;
    options = options || {};
    options.headers = options.headers || {};
    if (key) options.headers["X-API-Key"] = key;
    return fetch(API_BASE + path, options);
  }

  async function load() {
    try {
      var res = await api("/image", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var image = await res.json();
      FIELDS.forEach(function (name) {
        var input = el("image_" + name);
        if (input && image[name] !== undefined) input.value = image[name];
      });
      if (image.zoom === undefined) {
        status("This streamer has no digital zoom support.");
        el("zoom-apply").disabled = true;
      }
    } catch (err) {
      status("Could not read the zoom settings: " + err.message);
    }
  }

  function readFields() {
    var values = {};
    for (var i = 0; i < FIELDS.length; i++) {
      var name = FIELDS[i];
      var value = parseInt(el("image_" + name).value, 10);
      var range = LIMITS[name];
      if (isNaN(value) || value < range[0] || value > range[1]) {
        status("Zoom must be 100-800% and each centre 0-100%.");
        return null;
      }
      values[name] = value;
    }
    return values;
  }

  // Report the resulting main stream size and refresh the size fields above.
  async function showResult() {
    try {
      var res = await api("/stream0", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var s0 = await res.json();
      ["width", "height"].forEach(function (name) {
        var input = el("stream0_" + name);
        if (input && s0[name] !== undefined) input.value = s0[name];
      });
      status("Applied: main stream " + s0.width + " x " + s0.height + ".");
    } catch (err) {
      status("Applied; could not read the new stream size: " + err.message);
    } finally {
      el("zoom-apply").disabled = false;
    }
  }

  async function apply() {
    var values = readFields();
    if (!values) return;
    el("zoom-apply").disabled = true;
    status("Applying...");
    try {
      var res = await api("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: values }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      setTimeout(showResult, SETTLE_MS);
    } catch (err) {
      status("Failed: " + err.message);
      el("zoom-apply").disabled = false;
    }
  }

  function init() {
    var button = el("zoom-apply");
    if (!button) return;
    button.addEventListener("click", apply);
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
