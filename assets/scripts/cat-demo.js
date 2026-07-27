//* ============= Custom capability vector demo ================ */
// Drives the "Explore a Custom Capability Vector" section against the public
// CAT Gradio Space. Everything below the network call is local: moving a
// slider, switching scene, prototype, or view never contacts the Space, so the
// page costs nothing until the visitor presses Run CAT.
//
// Why this talks to Gradio's HTTP queue protocol directly instead of using
// @gradio/client
// ---------------------------------------------------------------------------
// @gradio/client issues every request with `credentials: "include"` (hardcoded
// in 9 places in 1.19.1, with no option to disable). Hugging Face's edge proxy
// answers CORS preflights for *.hf.space itself, and its preflight response
// omits `Access-Control-Allow-Credentials`, which a browser requires before it
// will send a credentialed cross-origin request. So Client.connect() dies on
// its own /config fetch with:
//   "The value of the 'Access-Control-Allow-Credentials' header in the response
//    is '' which must be 'true' when the request's credentials mode is
//    'include'."
// Verified in Chromium from this page, and reproduced with curl from both
// http://localhost and https://capability-aware-traversability.github.io — it
// is not a local-development artifact. The same preflight is returned for
// unrelated public Spaces, so it is an HF-wide condition, not a CAT one.
//
// The same preflight *does* allow uncredentialed cross-origin POSTs (it echoes
// the origin and allows `content-type`). So the plain queue protocol below
// works from the browser, needs no dependency, and reports queue rank and ETA
// straight from the Space rather than through a wrapper.
var CATDEMO = {
  base: 'https://gianluca-capezzuto-cat-capability-demo.hf.space',
  // The contract below is copied from the deployed model artifacts, not invented:
  //   terrain keys/order  model_repo/config.json   -> terrain_order
  //   terrain labels      configs/demo.yaml        -> ui.terrain_labels
  //   prototype keys      model_repo/config.json   -> profile_order
  //   prototype labels    model_repo/profiles.json -> <key>.label
  //   scene keys          configs/demo.yaml        -> scenes
  //   initial vector      profiles.json wheeled.vector, which is what the Gradio
  //                       app seeds its sliders with when custom mode is enabled
  //   slider step         app.py gr.Slider(0.0, 1.0, step=0.01)
  terrain: ['Grass', 'Pavement', 'Dirt / gravel', 'Rocks', 'Vegetation',
            'Building wall', 'Water', 'Stairs', 'Snow', 'Sky'],
  prototypeLabels: {
    wheeled: 'Wheeled', quadruped: 'Legged', ATV: 'ATV', differential: 'Differential'
  },
  sceneLabels: {
    stairs: 'Broad staircase', lawn: 'Path and lawn',
    street: 'Shared street', plaza: 'Plaza steps'
  },
  initialVector: [0.8, 1.0, 0.7, 0.3, 0.11, 0.0, 0.0, 0.0, 0.2, 0.0],
  initialScene: 'stairs',
  initialPrototype: 'wheeled',
  wakeNoticeMs: 4000
};

window.addEventListener('DOMContentLoaded', function() {
  var root = document.getElementById('custom-vector-demo');
  if (!root) return;

  var sliders = CATDEMO.terrain.map(function(_, i) { return root.querySelector('#cv-slider-' + i); });
  var outputs = CATDEMO.terrain.map(function(_, i) { return root.querySelector('#cv-value-' + i); });
  var sceneGroup = root.querySelector('.cv-choice[data-group="scene"]');
  var protoGroup = root.querySelector('.cv-choice[data-group="prototype"]');
  var runBtn = root.querySelector('.cv-run');
  var resetBtn = root.querySelector('.cv-reset');
  var retryBtn = root.querySelector('.cv-retry');
  var stageImg = root.querySelector('.cv-stage-img');
  var placeholder = root.querySelector('.cv-placeholder');
  var statusEl = root.querySelector('.cv-status');
  var readoutEl = root.querySelector('.cv-readout');

  var state = {
    scene: CATDEMO.initialScene,
    prototype: CATDEMO.initialPrototype,
    result: null
  };

  // Cached after the first successful connection: resolving the endpoint table
  // is a network round trip and it does not change between runs.
  var endpoints = null;
  var requestId = 0;

  /* ---------- local UI ---------- */

  function setChoice(group, value) {
    Array.prototype.forEach.call(group.querySelectorAll('.cv-opt'), function(o) {
      var on = o.getAttribute('data-value') === value;
      o.classList.toggle('is-active', on);
      o.setAttribute('aria-checked', on ? 'true' : 'false');
      o.tabIndex = on ? 0 : -1;
    });
  }

  function renderSlider(i) {
    var v = Number(sliders[i].value);
    outputs[i].textContent = v.toFixed(2);
    // Drives the filled portion of the track; see .cv-row input in cat.css.
    sliders[i].style.setProperty('--cv-fill', (v * 100) + '%');
  }

  function vector() { return sliders.map(function(s) { return Number(s.value); }); }

  function setVector(values) {
    values.forEach(function(v, i) { sliders[i].value = v; renderSlider(i); });
  }

  function setStatus(text, tone) {
    statusEl.textContent = text;
    // Tone drives a glyph as well as colour, so state is never colour-only.
    statusEl.setAttribute('data-tone', tone || 'idle');
  }

  function showResult(result) {
    stageImg.src = result.overlay;
    stageImg.alt = 'CAT traversability prediction blended over the ' +
      (CATDEMO.sceneLabels[result.scene] || result.scene).toLowerCase() +
      ', for a custom capability vector read out against the ' +
      (CATDEMO.prototypeLabels[result.prototype] || result.prototype) +
      ' prototype (blue = high traversability, red = low).';
  }

  function setBusy(busy) {
    runBtn.disabled = busy;
    runBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  /* ---------- Gradio queue protocol ---------- */

  // gradio 5.9.1 reports a FileData `url` of the form
  // <root>/gradio_a/gradio_api/file=... — the api prefix gets joined twice and
  // the result 308s. The `path` is correct, so the served URL is rebuilt here.
  function fileUrl(fileData) {
    if (!fileData || !fileData.path) return null;
    return CATDEMO.base + '/gradio_api/file=' + fileData.path;
  }

  function loadEndpoints() {
    if (endpoints) return Promise.resolve(endpoints);
    // A plain GET with no custom headers and no credentials stays a "simple"
    // request, so it is not preflighted.
    return fetch(CATDEMO.base + '/config').then(function(r) {
      if (!r.ok) throw new Error('config');
      return r.json();
    }).then(function(cfg) {
      var table = {};
      (cfg.dependencies || []).forEach(function(d) {
        if (d.api_name) table[d.api_name] = d.id;
      });
      if (!('run_inference' in table)) throw new Error('config');
      endpoints = table;
      return table;
    });
  }

  // One call = one SSE stream. The Space emits `close_stream` as soon as a
  // session has no work left, so a stream cannot be held open across two calls;
  // the *session hash* is what is reused, and that is what lets the legacy
  // two-call path find the observation the Space parked in its gr.State.
  //
  // Order matters: the work is queued first and the stream opened afterwards.
  // Opening a stream on a session with nothing queued gets it closed
  // immediately; the Space buffers a queued event's messages until the stream
  // for that session arrives, so nothing is missed by joining first.
  function call(sessionHash, fnIndex, data, onStatus) {
    return fetch(CATDEMO.base + '/gradio_api/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: data, fn_index: fnIndex, session_hash: sessionHash, trigger_id: null
      })
    }).then(function(r) {
      if (!r.ok) throw new Error('join');
      return r.json();
    }).then(function(body) {
      return new Promise(function(resolve, reject) {
        var source = new EventSource(
          CATDEMO.base + '/gradio_api/queue/data?session_hash=' + sessionHash);
        var settled = false;

        function finish(fn, value) {
          if (settled) return;
          settled = true;
          try { source.close(); } catch (e) { /* already closed */ }
          fn(value);
        }

        source.onmessage = function(ev) {
          var msg;
          try { msg = JSON.parse(ev.data); } catch (e) { return; }
          if (msg.event_id && body.event_id && msg.event_id !== body.event_id) return;
          if (msg.msg === 'estimation') {
            onStatus(msg.rank > 0
              ? 'Queued for ZeroGPU — position ' + msg.rank +
                (msg.rank_eta ? ', about ' + Math.max(1, Math.round(msg.rank_eta)) + 's.' : '.')
              : 'Queued for ZeroGPU…');
          } else if (msg.msg === 'process_starts') {
            onStatus('Running CAT…');
          } else if (msg.msg === 'process_completed') {
            if (msg.success === false || !msg.output || msg.output.error) {
              finish(reject, new Error('backend'));
            } else {
              finish(resolve, msg.output.data);
            }
          } else if (msg.msg === 'unexpected_error') {
            finish(reject, new Error('backend'));
          } else if (msg.msg === 'close_stream') {
            finish(reject, new Error('closed'));
          }
        };
        source.onerror = function() {
          // EventSource reconnects on its own; only a stream that has given up
          // for good is fatal here.
          if (source.readyState === 2) finish(reject, new Error('stream'));
        };
      });
    });
  }

  /* ---------- run ---------- */

  function run() {
    var id = ++requestId;
    var scene = state.scene;
    var prototype = state.prototype;
    var vec = vector();
    function stale() { return id !== requestId; }

    setBusy(true);
    retryBtn.hidden = true;
    setStatus('Connecting to the CAT demo…', 'busy');

    var wakeTimer = setTimeout(function() {
      if (!stale()) setStatus('The Space is waking up… this can take a minute.', 'busy');
    }, CATDEMO.wakeNoticeMs);

    function onStatus(text) { if (!stale()) setStatus(text, 'busy'); }

    loadEndpoints().then(function(table) {
      clearTimeout(wakeTimer);
      if (stale()) return null;
      setStatus('Running CAT…', 'busy');

      var hash = 'cat-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

      // Preferred: one stateless call carrying the scene, so nothing depends on
      // server-side session state.
      if ('custom_vector' in table) {
        return call(hash, table.custom_vector, [scene, vec, prototype], onStatus)
          .then(function(data) {
            return { overlay: fileUrl(data[0]), metadata: data[3] || null };
          });
      }

      // Fallback for Space revisions without /custom_vector: the observation
      // lives in a gr.State that Gradio strips from the public API, so it has to
      // be set by select_example first, on this same session hash.
      // select_example is CPU-only on the Space, so this still costs exactly one
      // ZeroGPU allocation, same as /custom_vector.
      return call(hash, table.select_example, [scene], onStatus).then(function() {
        if (stale()) return null;
        // The queue protocol is positional over *all* of the handler's inputs,
        // including the gr.State the named API hides. Its slot is sent as null
        // and the Space fills it from the session set by select_example above.
        return call(hash, table.run_inference,
          [null, prototype, true].concat(vec, [prototype]), onStatus
        ).then(function(data) {
          return { overlay: fileUrl(data[1]), metadata: null };
        });
      });
    }).then(function(result) {
      if (stale() || !result) return;
      if (!result.overlay) throw new Error('malformed');
      result.scene = scene;
      result.prototype = prototype;
      state.result = result;
      root.setAttribute('data-has-result', 'true');
      if (placeholder) placeholder.hidden = true;
      showResult(result);
      setStatus('Prediction ready.', 'ok');
      renderReadout(result);
      setBusy(false);
    }).catch(function(err) {
      clearTimeout(wakeTimer);
      if (stale()) return;
      // Deliberately coarse: the visitor gets one actionable sentence, never a
      // stack trace or a raw Gradio event.
      setStatus((err && err.message === 'backend')
        ? 'The demo returned an error. Your settings are kept — try again.'
        : 'The demo is temporarily unavailable. Your settings are kept — try again, or open the full Space.',
        'error');
      retryBtn.hidden = false;
      setBusy(false);
    });
  }

  function renderReadout(result) {
    var parts = ['Model output 224×224, resampled to the scene.'];
    if (result.metadata && typeof result.metadata.score_min === 'number') {
      parts.unshift('Raw cosine scores span ' + result.metadata.score_min.toFixed(2) +
        ' to ' + result.metadata.score_max.toFixed(2) +
        ' (mean ' + result.metadata.score_mean.toFixed(2) + ').');
    }
    readoutEl.textContent = parts.join(' ');
  }

  /* ---------- wiring ---------- */

  function wireChoice(group, onPick) {
    var opts = Array.prototype.slice.call(group.querySelectorAll('.cv-opt'));
    opts.forEach(function(o, i) {
      o.addEventListener('click', function() { onPick(o.getAttribute('data-value')); });
      o.addEventListener('keydown', function(e) {
        var idx = i;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') idx = (i + 1) % opts.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') idx = (i - 1 + opts.length) % opts.length;
        else if (e.key === 'Home') idx = 0;
        else if (e.key === 'End') idx = opts.length - 1;
        else return;
        e.preventDefault();
        onPick(opts[idx].getAttribute('data-value'));
        opts[idx].focus();
      });
    });
  }

  sliders.forEach(function(s, i) {
    s.addEventListener('input', function() { renderSlider(i); });
  });

  wireChoice(sceneGroup, function(v) { state.scene = v; setChoice(sceneGroup, v); });
  wireChoice(protoGroup, function(v) { state.prototype = v; setChoice(protoGroup, v); });

  runBtn.addEventListener('click', run);
  retryBtn.addEventListener('click', run);
  resetBtn.addEventListener('click', function() {
    setVector(CATDEMO.initialVector);
    state.scene = CATDEMO.initialScene;
    state.prototype = CATDEMO.initialPrototype;
    setChoice(sceneGroup, state.scene);
    setChoice(protoGroup, state.prototype);
    setStatus('Reset to the Wheeled profile vector.', 'idle');
  });

  setVector(CATDEMO.initialVector);
  setChoice(sceneGroup, state.scene);
  setChoice(protoGroup, state.prototype);
});
