//* ======================== Slide Control ===================== */
var contents = document.getElementsByClassName("slide-content");

//* ================= Capability comparison ==================== */
var COMPARE = {
  profiles: { wheeled: 'Wheeled', legged: 'Legged', atv: 'ATV', differential: 'Differential' },
  profileOrder: ['wheeled', 'legged', 'atv', 'differential'],
  scenes: {
    stairs: {
      title: 'broad staircase',
      def: ['wheeled', 'legged'],
      captions: {
        'wheeled|legged': 'The legged prediction extends across the staircase, while the wheeled prediction keeps the steps at low traversability.',
        'wheeled|atv': 'The wheeled and ATV predictions closely agree, favoring the paved route while keeping the staircase at low traversability.',
        'wheeled|differential': 'Both predictions favor the paved route and keep the staircase low, with the wheeled prediction slightly stronger across the pavement.',
        'legged|atv': 'The legged prediction extends across the staircase, while the ATV prediction confines high traversability to the paved route.',
        'legged|differential': 'The legged prediction covers the staircase, while the differential prediction limits high traversability to the paved route.',
        'atv|differential': 'The ATV and differential predictions trace the same paved route, while the ATV prediction assigns higher traversability across the foreground pavement.'
      }
    },
    lawn: {
      title: 'path and lawn',
      def: ['wheeled', 'differential'],
      captions: {
        'wheeled|legged': 'The wheeled and legged predictions closely agree: both favor the paved path and road while keeping the stone blocks low.',
        'wheeled|atv': 'The wheeled and ATV predictions nearly coincide, favoring pavement over grass and keeping both stone blocks low.',
        'wheeled|differential': 'The wheeled prediction keeps more of the lawn near the path traversable, while the differential prediction lowers the grass.',
        'legged|atv': 'The legged and ATV predictions closely agree, favoring the path and road while leaving both stone blocks low.',
        'legged|differential': 'The legged prediction rates the lawn beside the path higher, while the differential prediction lowers the surrounding grass.',
        'atv|differential': 'The ATV prediction rates the grass beside the path higher, while the differential prediction narrows the favored area to pavement.'
      }
    },
    snow: {
      title: 'snow crossing',
      def: ['wheeled', 'atv'],
      captions: {
        'wheeled|legged': 'The legged prediction opens a wider route across the snow, while the wheeled prediction favors the packed track.',
        'wheeled|atv': 'The ATV prediction extends high traversability across the churned snow, while the wheeled prediction concentrates it on the packed track.',
        'wheeled|differential': 'The wheeled and differential predictions both favor the packed track, with lower traversability across the churned snow to its left.',
        'legged|atv': 'The legged and ATV predictions both open a broad high-traversability region across the churned foreground snow.',
        'legged|differential': 'The legged prediction opens a wider route across the snow, while the differential prediction favors the packed track.',
        'atv|differential': 'The ATV prediction spans the churned snow, while the differential prediction concentrates high traversability along the packed track.'
      }
    },
    street: {
      title: 'shared street',
      def: ['wheeled', 'legged'],
      captions: {
        'wheeled|legged': 'The wheeled and legged predictions closely agree, tracing nearly the same high-traversability region across the open pavement.',
        'wheeled|atv': 'The wheeled and ATV predictions closely agree, tracing nearly the same high-traversability region across the open pavement.',
        'wheeled|differential': 'Both predictions cover the open pavement, but the wheeled prediction assigns higher traversability across the foreground road.',
        'legged|atv': 'The legged and ATV predictions closely agree, tracing nearly the same high-traversability region across the open pavement.',
        'legged|differential': 'Both predictions cover the open pavement, but the legged prediction assigns higher traversability across the foreground road.',
        'atv|differential': 'Both predictions cover the open pavement, but the ATV prediction assigns higher traversability across the foreground road.'
      }
    }
  }
};
function cmpSrc(scene, profile) { return 'assets/figures/compare/' + scene + '_' + profile + '.jpg'; }
function cmpAlt(scene, profile) {
  return COMPARE.profiles[profile] + ' profile: CAT traversability prediction for the ' +
    COMPARE.scenes[scene].title + ' (blue = high traversability, red = low).';
}
function cmpPair(left, right) {
  return [left, right].sort(function(a, b) {
    return COMPARE.profileOrder.indexOf(a) - COMPARE.profileOrder.indexOf(b);
  }).join('|');
}
function cmpCaption(scene, left, right) {
  return COMPARE.scenes[scene].captions[cmpPair(left, right)];
}

window.addEventListener('DOMContentLoaded', function() {
  var comparisonSlider = document.querySelector('img-comparison-slider');
  if (!comparisonSlider) return;

  var leftImg = document.getElementById('compare-left');
  var rightImg = document.getElementById('compare-right');
  var leftLabel = document.getElementById('profile-label-left');
  var rightLabel = document.getElementById('profile-label-right');
  var interpretation = document.getElementById('comparison-interpretation');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.scene-tab'));
  var groups = {
    left: document.querySelector('.profile-opts[data-side="left"]'),
    right: document.querySelector('.profile-opts[data-side="right"]')
  };
  var state = { scene: 'stairs', left: 'wheeled', right: 'legged' };

  function setGroupActive(side) {
    if (!groups[side]) return;
    var opts = groups[side].querySelectorAll('.profile-opt');
    Array.prototype.forEach.call(opts, function(o) {
      var on = o.getAttribute('data-profile') === state[side];
      o.classList.toggle('is-active', on);
      o.setAttribute('aria-checked', on ? 'true' : 'false');
      o.tabIndex = on ? 0 : -1;
    });
  }

  function render() {
    var sc = state.scene;
    leftImg.src = cmpSrc(sc, state.left);
    leftImg.alt = cmpAlt(sc, state.left);
    rightImg.src = cmpSrc(sc, state.right);
    rightImg.alt = cmpAlt(sc, state.right);
    if (leftLabel) leftLabel.textContent = COMPARE.profiles[state.left] + ' profile';
    if (rightLabel) rightLabel.textContent = COMPARE.profiles[state.right] + ' profile';
    if (interpretation) {
      var nextCaption = cmpCaption(sc, state.left, state.right);
      if (interpretation.textContent !== nextCaption) {
        interpretation.textContent = nextCaption;
        interpretation.classList.remove('is-updating');
        void interpretation.offsetWidth;
        interpretation.classList.add('is-updating');
      }
    }
    comparisonSlider.setAttribute('aria-label',
      'CAT traversability comparison: ' + COMPARE.profiles[state.left] +
      ' profile on the left, ' + COMPARE.profiles[state.right] + ' profile on the right');
    tabs.forEach(function(t) {
      var on = t.getAttribute('data-scene') === sc;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    setGroupActive('left');
    setGroupActive('right');
  }

  function selectScene(name) {
    if (!COMPARE.scenes[name]) return;
    state.scene = name;
    state.left = COMPARE.scenes[name].def[0];
    state.right = COMPARE.scenes[name].def[1];
    render();
  }

  function selectProfile(side, profile) {
    if (state[side] === profile) return;
    var other = side === 'left' ? 'right' : 'left';
    if (state[other] === profile) state[other] = state[side]; // swap to keep two distinct profiles
    state[side] = profile;
    render();
  }

  render();

  tabs.forEach(function(t) {
    t.addEventListener('click', function() { selectScene(t.getAttribute('data-scene')); });
  });

  ['left', 'right'].forEach(function(side) {
    var g = groups[side];
    if (!g) return;
    var opts = Array.prototype.slice.call(g.querySelectorAll('.profile-opt'));
    opts.forEach(function(o, i) {
      o.addEventListener('click', function() { selectProfile(side, o.getAttribute('data-profile')); });
      o.addEventListener('keydown', function(e) {
        var idx = i;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') idx = (i + 1) % opts.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') idx = (i - 1 + opts.length) % opts.length;
        else if (e.key === 'Home') idx = 0;
        else if (e.key === 'End') idx = opts.length - 1;
        else return;
        e.preventDefault();
        var target = opts[idx];
        selectProfile(side, target.getAttribute('data-profile'));
        target.focus();
      });
    });
  });

  // Fallback: component unavailable — show both maps side by side; scene/profile
  // switching still works, only the drag affordance is dropped.
  if (!customElements.get('img-comparison-slider')) {
    comparisonSlider.classList.add('is-fallback');
    comparisonSlider.removeAttribute('tabindex');
    comparisonSlider.removeAttribute('aria-describedby');
    var hint = document.getElementById('comparison-instructions');
    if (hint) hint.textContent = 'Select a scene or robot profile to update the comparison.';
    return;
  }

  // Keyboard support for the divider (the component exposes numeric `value`
  // but no arrow-key behavior). A divider key press also ends the one-time
  // nudge in-place, so the key's own value change is never stomped.
  comparisonSlider.addEventListener('keydown', function(e) {
    var nextValue = Number(comparisonSlider.value);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nextValue -= 2;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nextValue += 2;
    else if (e.key === 'Home') nextValue = 0;
    else if (e.key === 'End') nextValue = 100;
    else return;
    e.preventDefault();
    userInteracted = true;
    if (nudgeRAF) { cancelAnimationFrame(nudgeRAF); nudgeRAF = null; }
    comparisonSlider.value = Math.max(0, Math.min(100, nextValue));
  });

  // One-time discoverability nudge: a single gentle sweep of the divider the
  // first time the comparison scrolls into view. Cancelled by any interaction,
  // disabled under reduced-motion, and never loops.
  var nudgeStarted = false, nudgeRAF = null, userInteracted = false;
  function cancelNudge() {
    userInteracted = true;
    if (nudgeRAF) { cancelAnimationFrame(nudgeRAF); nudgeRAF = null; }
    comparisonSlider.value = 50;
  }
  // Pointer/touch/focus snap the divider back to centre if a sweep is in
  // progress. Keydown is handled in the divider keyboard listener above so it
  // does not override the key's own value change.
  ['pointerdown', 'touchstart', 'focus'].forEach(function(ev) {
    comparisonSlider.addEventListener(ev, cancelNudge, { once: true });
  });
  function runNudge() {
    if (nudgeStarted || userInteracted) return;
    nudgeStarted = true;
    var start = null, dur = 1150;
    function frame(ts) {
      if (userInteracted) return;
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      comparisonSlider.value = 50 + Math.sin(p * Math.PI * 2) * 12;
      if (p < 1) { nudgeRAF = requestAnimationFrame(frame); }
      else { comparisonSlider.value = 50; nudgeRAF = null; }
    }
    nudgeRAF = requestAnimationFrame(frame);
  }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(en) {
        if (en.isIntersecting && en.intersectionRatio >= 0.4) {
          io.disconnect();
          setTimeout(runNudge, 250);
        }
      });
    }, { threshold: 0.4 });
    io.observe(comparisonSlider);
  }
});

//* ===================== Related Work Dropdown ===================== */
window.addEventListener('DOMContentLoaded', function() {
  var container = document.querySelector('.related-works');
  if (!container) return;

  var trigger = container.querySelector('.related-works-trigger');
  var panel = container.querySelector('.related-works-panel');
  var closeButton = container.querySelector('.related-works-close');

  function setOpen(open, restoreFocus) {
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open && restoreFocus) trigger.focus();
  }

  trigger.addEventListener('click', function() {
    setOpen(trigger.getAttribute('aria-expanded') !== 'true', false);
  });

  closeButton.addEventListener('click', function() {
    setOpen(false, true);
  });

  document.addEventListener('click', function(event) {
    if (!container.contains(event.target)) setOpen(false, false);
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
      setOpen(false, true);
    }
  });
});

var slideMenu = document.getElementById("slide-menu");
if (slideMenu) {
  slideMenu.addEventListener("click", function(e) {
    const idx = [...this.children]
      .filter(el => el.className.indexOf('dot') > -1)
      .indexOf(e.target);

    if (idx >= 0) {
      var prev = document.querySelector(".dot.active");
      if (prev) prev.classList.remove("active");
      e.target.classList.add("active");

      for (var i = 0; i < contents.length; i++) {
        if (i == idx) {
          contents[i].style.display = "block";
        } else {
          contents[i].style.display = "none";
        }
      }
    }
  });
}

//* ======================== Video Control ===================== */
function ToggleVideo(x) {
  var videos = document.getElementsByClassName(x + '-video');
  for (var i = 0; i < videos.length; i++) {
      if (videos[i].paused) {
          videos[i].play();
      } else {
          videos[i].pause();
      }
  }
};


function SlowVideo(x) {
  var videos = document.getElementsByClassName(x + '-video');
  for (var i = 0; i < videos.length; i++) {
    videos[i].playbackRate = videos[i].playbackRate * 0.9;
    videos[i].play();
  }

  var msg = document.getElementById(x + '-msg');
  msg.innerHTML = 'Speed: ' + '×' + videos[0].playbackRate.toFixed(2);

  msg.classList.add("fade-in-out");
  msg.style.animation = 'none';
  msg.offsetHeight; /* trigger reflow */
  msg.style.animation = null; };


function FastVideo(x) {
  var videos = document.getElementsByClassName(x + '-video');
  for (var i = 0; i < videos.length; i++) {
    videos[i].playbackRate = videos[i].playbackRate / 0.9;
    videos[i].play();
  }

  var msg = document.getElementById(x + '-msg');
  msg.innerHTML = 'Speed: ' + '×' + videos[0].playbackRate.toFixed(2);

  msg.classList.add("fade-in-out");
  msg.style.animation = 'none';
  msg.offsetHeight; /* trigger reflow */
  msg.style.animation = null;
};

function RestartVideo(x) {
  var videos = document.getElementsByClassName(x + '-video');
  for (var i = 0; i < videos.length; i++) {
    videos[i].pause();
    videos[i].playbackRate = 1.0;
    videos[i].currentTime = 0;
    videos[i].play();
  }

  var msg = document.getElementById(x + '-msg');
  msg.innerHTML = 'Speed: ' + '×' + videos[0].playbackRate.toFixed(2);

  msg.classList.add("fade-in-out");
  msg.style.animation = 'none';
  msg.offsetHeight; /* trigger reflow */
  msg.style.animation = null;
};

//* ======================== Slide Show Control ===================== */
const slider = document.querySelector('.container .slider');
const [btnLeft, btnRight] = ['prev_btn', 'next_btn'].map(id => document.getElementById(id));
let interval;

// Set positions
const setPositions = () => {
    if (slider) {
        [...slider.children].forEach((item, i) =>
            item.style.left = `${(i-1) * 440}px`);
    }
};

// Initial setup
if (slider) {
    setPositions();
}

// Set transition speed
const setTransitionSpeed = (speed) => {
    if (slider) {
        [...slider.children].forEach(item =>
            item.style.transitionDuration = speed);
    }
};

// Slide functions
const next = (isAuto = false) => {
    if (slider) {
        setTransitionSpeed(isAuto ? '1.5s' : '0.2s');
        slider.appendChild(slider.firstElementChild);
        setPositions();
    }
};

const prev = () => {
    if (slider) {
        setTransitionSpeed('0.2s');
        slider.prepend(slider.lastElementChild);
        setPositions();
    }
};

// Auto slide
const startAuto = () => interval = interval || setInterval(() => next(true), 2000);
const stopAuto = () => { clearInterval(interval); interval = null; };

// Event listeners
if (btnRight) btnRight.addEventListener('click', () => next(false));
if (btnLeft) btnLeft.addEventListener('click', prev);

// Mouse hover controls
[slider, btnLeft, btnRight].forEach(el => {
    if (el) {
        el.addEventListener('mouseover', stopAuto);
        el.addEventListener('mouseout', startAuto);
    }
});

// Start auto slide
if (slider) startAuto();

//* ======================== Copy Button in Code ===================== */
// add copy button to code blocks
var codeBlocks = document.querySelectorAll('pre');
codeBlocks.forEach(function(pre) {
  var button = document.createElement('button');
  button.className = 'code-copy-btn';
  button.type = 'button';
  button.setAttribute('aria-label', 'Copy citation to clipboard');
  button.innerHTML = '<i class="far fa-copy"></i><span class="copy-text"></span>';
  pre.appendChild(button);

  // Add click handler for copy functionality
  button.addEventListener('click', function(e) {
    e.preventDefault();

    // Get the code text from the code element
    var code = pre.querySelector('code');
    if (code) {
      var text = code.textContent;

      // Copy to clipboard
      navigator.clipboard.writeText(text).then(function() {
          // Add copied class to show text (kept for animation)
          button.classList.add('copied');
          // Change icon to check and show text
          var icon = button.querySelector('i');
          var span = button.querySelector('.copy-text');
          icon.className = 'fa-solid fa-check';
          if (span) span.textContent = 'Copied';

          // Reset icon, text and class after 2 seconds
          setTimeout(function() {
            icon.className = 'far fa-copy';
            if (span) span.textContent = '';
            button.classList.remove('copied');
          }, 2000);
      }).catch(function(err) {
        console.error('Failed to copy:', err);
      });
    }
  });
});
