import {
  need
} from "./chunks/chunk-RA74YNEB.js";

// src/camera.ts
function camera(engine, el, o = {}) {
  const rate = need(o.ease ?? 7, "ease", 1), lo = need(o.min ?? 1, "min", 1), hi = need(o.max ?? 4, "max", 1), box = o.contain !== false;
  const s = new Float64Array(17);
  s[
    2
    /* Z */
  ] = s[
    5
    /* GZ */
  ] = s[
    12
    /* RZ */
  ] = 1;
  s[
    14
    /* MEASURE */
  ] = 1;
  const mq = o.motion == null && typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const still = () => mq ? mq.matches : o.motion === false;
  const parent = el.parentElement;
  const clampZ = (z) => Math.min(hi, Math.max(lo, z));
  const fit2 = (f, p, z, size) => {
    if (!box || !size) return f;
    const t = p - f * z, a = size * (1 - z);
    return (p - Math.min(Math.max(a, 0), Math.max(Math.min(a, 0), t))) / z;
  };
  const pin = (px, py) => {
    const dx = px - s[
      6
      /* PX */
    ], dy = py - s[
      7
      /* PY */
    ];
    s[
      0
      /* FX */
    ] = s[
      0
      /* FX */
    ] + dx / s[
      2
      /* Z */
    ];
    s[
      1
      /* FY */
    ] = s[
      1
      /* FY */
    ] + dy / s[
      2
      /* Z */
    ];
    s[
      3
      /* GX */
    ] = s[
      3
      /* GX */
    ] + dx / s[
      5
      /* GZ */
    ];
    s[
      4
      /* GY */
    ] = s[
      4
      /* GY */
    ] + dy / s[
      5
      /* GZ */
    ];
    s[
      6
      /* PX */
    ] = px;
    s[
      7
      /* PY */
    ] = py;
  };
  const go = () => {
    s[
      3
      /* GX */
    ] = fit2(s[
      3
      /* GX */
    ], s[
      6
      /* PX */
    ], s[
      5
      /* GZ */
    ], s[
      8
      /* W */
    ]);
    s[
      4
      /* GY */
    ] = fit2(s[
      4
      /* GY */
    ], s[
      7
      /* PY */
    ], s[
      5
      /* GZ */
    ], s[
      9
      /* H */
    ]);
    s[
      13
      /* MOVE */
    ] = 1;
    if (!s[
      8
      /* W */
    ]) s[
      14
      /* MEASURE */
    ] = 1;
    engine.wake();
  };
  const measure = () => {
    s[
      14
      /* MEASURE */
    ] = 0;
    const r = el.getBoundingClientRect();
    s[
      8
      /* W */
    ] = r.width / s[
      12
      /* RZ */
    ];
    s[
      9
      /* H */
    ] = r.height / s[
      12
      /* RZ */
    ];
    s[
      3
      /* GX */
    ] = fit2(s[
      3
      /* GX */
    ], s[
      6
      /* PX */
    ], s[
      5
      /* GZ */
    ], s[
      8
      /* W */
    ]);
    s[
      4
      /* GY */
    ] = fit2(s[
      4
      /* GY */
    ], s[
      7
      /* PY */
    ], s[
      5
      /* GZ */
    ], s[
      9
      /* H */
    ]);
    if (box && parent && !s[
      15
      /* CLIP */
    ]) s[
      15
      /* CLIP */
    ] = getComputedStyle(parent).overflowX === "visible" ? 1 : 2;
  };
  measure();
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(() => s[
      14
      /* MEASURE */
    ] = 1);
    ro.observe(el);
    engine.signal.addEventListener("abort", () => ro.disconnect());
  }
  const cam = {
    /** Show world point (x, y) at screen point (px, py) (default: the same point, a zoom about it). */
    to(x, y, zoom = s[
      5
      /* GZ */
    ], px = x, py = y) {
      if (!(x - x === 0 && y - y === 0 && zoom > 0 && px - px === 0 && py - py === 0)) return;
      pin(px, py);
      s[
        3
        /* GX */
      ] = x;
      s[
        4
        /* GY */
      ] = y;
      s[
        5
        /* GZ */
      ] = clampZ(zoom);
      go();
    },
    /** Stage size in px (untransformed), as last measured. */
    get width() {
      return s[
        8
        /* W */
      ];
    },
    get height() {
      return s[
        9
        /* H */
      ];
    },
    /** Drag by a screen delta (px): follows at once, no easing. */
    pan(dx, dy) {
      if (!(dx - dx === 0 && dy - dy === 0)) return;
      s[
        0
        /* FX */
      ] = s[
        0
        /* FX */
      ] - dx / s[
        2
        /* Z */
      ];
      s[
        1
        /* FY */
      ] = s[
        1
        /* FY */
      ] - dy / s[
        2
        /* Z */
      ];
      s[
        3
        /* GX */
      ] = s[
        3
        /* GX */
      ] - dx / s[
        5
        /* GZ */
      ];
      s[
        4
        /* GY */
      ] = s[
        4
        /* GY */
      ] - dy / s[
        5
        /* GZ */
      ];
      go();
    },
    /** Back to the page as it is (zoom 1, no offset), eased. */
    home() {
      s[
        3
        /* GX */
      ] = s[
        6
        /* PX */
      ];
      s[
        4
        /* GY */
      ] = s[
        7
        /* PY */
      ];
      s[
        5
        /* GZ */
      ] = 1;
      go();
    },
    /** Screen (stage box px) to world, into `out` (no allocation). */
    toWorld(x, y, out) {
      out[0] = s[
        0
        /* FX */
      ] + (x - s[
        6
        /* PX */
      ]) / s[
        2
        /* Z */
      ];
      out[1] = s[
        1
        /* FY */
      ] + (y - s[
        7
        /* PY */
      ]) / s[
        2
        /* Z */
      ];
      return out;
    },
    get zoom() {
      return s[
        2
        /* Z */
      ];
    },
    /** Still easing toward the target. */
    get moving() {
      return s[
        13
        /* MOVE */
      ] > 0;
    },
    read() {
      if (s[
        14
        /* MEASURE */
      ]) measure();
      if (s[
        13
        /* MOVE */
      ]) s[
        16
        /* JUMP */
      ] = +still();
    },
    step(e, dt) {
      if (!s[
        13
        /* MOVE */
      ]) return;
      const a = s[
        16
        /* JUMP */
      ] ? 1 : 1 - Math.exp(-rate * dt);
      s[
        2
        /* Z */
      ] = s[
        2
        /* Z */
      ] + (s[
        5
        /* GZ */
      ] - s[
        2
        /* Z */
      ]) * a;
      s[
        0
        /* FX */
      ] = fit2(s[
        0
        /* FX */
      ] + (s[
        3
        /* GX */
      ] - s[
        0
        /* FX */
      ]) * a, s[
        6
        /* PX */
      ], s[
        2
        /* Z */
      ], s[
        8
        /* W */
      ]);
      s[
        1
        /* FY */
      ] = fit2(s[
        1
        /* FY */
      ] + (s[
        4
        /* GY */
      ] - s[
        1
        /* FY */
      ]) * a, s[
        7
        /* PY */
      ], s[
        2
        /* Z */
      ], s[
        9
        /* H */
      ]);
      if (Math.abs(s[
        5
        /* GZ */
      ] - s[
        2
        /* Z */
      ]) < 1e-4 && Math.abs(s[
        3
        /* GX */
      ] - s[
        0
        /* FX */
      ]) * s[
        2
        /* Z */
      ] < 0.02 && Math.abs(s[
        4
        /* GY */
      ] - s[
        1
        /* FY */
      ]) * s[
        2
        /* Z */
      ] < 0.02)
        s[
          0
          /* FX */
        ] = s[
          3
          /* GX */
        ], s[
          1
          /* FY */
        ] = s[
          4
          /* GY */
        ], s[
          2
          /* Z */
        ] = s[
          5
          /* GZ */
        ], s[
          13
          /* MOVE */
        ] = 0;
      e.busy();
    },
    render() {
      const z = s[
        2
        /* Z */
      ], x = s[
        6
        /* PX */
      ] - s[
        0
        /* FX */
      ] * z, y = s[
        7
        /* PY */
      ] - s[
        1
        /* FY */
      ] * z;
      if (x === s[
        10
        /* RX */
      ] && y === s[
        11
        /* RY */
      ] && z === s[
        12
        /* RZ */
      ]) return;
      s[
        10
        /* RX */
      ] = x;
      s[
        11
        /* RY */
      ] = y;
      s[
        12
        /* RZ */
      ] = z;
      const L = engine.ledger, home = Math.abs(x) < 5e-3 && Math.abs(y) < 5e-3 && Math.abs(z - 1) < 1e-6;
      if (s[
        15
        /* CLIP */
      ] === 1 && !home) L.style(parent, "overflow", "clip");
      L.style(el, "transform-origin", home ? "" : "0 0");
      L.style(el, "transform", home ? "" : `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${z.toFixed(4)})`);
      L.style(el, "will-change", home ? "" : "transform");
    }
  };
  engine.add(cam);
  return cam;
}
function zoomAt(cam, x, y, zoom) {
  cam.to(x, y, zoom);
}
function flyTo(cam, x, y, zoom = cam.zoom) {
  cam.to(x, y, zoom, cam.width / 2, cam.height / 2);
}
function toScreen(cam, x, y, out) {
  cam.toWorld(0, 0, out);
  out[0] = (x - out[0]) * cam.zoom;
  out[1] = (y - out[1]) * cam.zoom;
  return out;
}
function fit(cam, x, y, w, h, pad = 0.1) {
  if (w > 0 && h > 0 && cam.width) flyTo(cam, x + w / 2, y + h / 2, Math.min(cam.width / w, cam.height / h) * (1 - pad));
}
export {
  camera,
  fit,
  flyTo,
  toScreen,
  zoomAt
};
