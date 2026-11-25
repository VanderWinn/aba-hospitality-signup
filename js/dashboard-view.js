/* Concept 2b markup. Returns HTML; the page binds events. */
(function (root) {
  'use strict';

  var model = root.ABADashboard;
  var POP = '#0077FF';
  var CLAY = '#D01F25';
  var PINE = '#407589';
  var INK = '#39393a';
  var ORANGE = '#F28C28';
  var TEAL = '#2F5D6B';
  var POP_TEXT = '#005FCC';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function hint(label, key, iconOnly) {
    var def = (model.DEFS && model.DEFS[key]) || '';
    var flag = (model.FLAGS && model.FLAGS[key]) || '';
    var body = escapeHtml(def);
    if (flag) body += '<span class="tip-flag">' + escapeHtml(flag) + '</span>';
    var icon = '<span class="info" tabindex="0" role="button" aria-label="About ' + escapeHtml(key) + '">ⓘ<span class="tip" role="tooltip"><strong>' +
      escapeHtml(key) + '</strong>' + body + '</span></span>';
    if (iconOnly) return icon;
    return escapeHtml(label) + icon;
  }

  function signed(n) {
    if (n > 0) return '+' + n;
    if (n < 0) return '−' + Math.abs(n);
    return '0';
  }

  function delta(current, prior) {
    var diff = current - prior;
    if (diff > 0) return '<i class="delta delta-up">▲' + diff + '</i>';
    if (diff < 0) return '<i class="delta delta-down">▼' + Math.abs(diff) + '</i>';
    return '<i class="delta delta-flat">●0</i>';
  }

  function priors(metric) {
    var cells = [
      ['Last month', metric.lastMonth],
      ['Last quarter', metric.lastQuarter],
      ['Last year', metric.lastYear]
    ];
    return '<div class="pr">' + cells.map(function (cell) {
      return '<div><div class="pl">' + escapeHtml(cell[0]) + '</div><div class="pv">' +
        cell[1] + delta(metric.value, cell[1]) + '</div></div>';
    }).join('') + '</div>';
  }

  function headline(text, tone, sizeClass) {
    return '<div class="big ' + sizeClass + ' tone-' + tone + '">' + text + '</div>';
  }

  function card(title, key, body, extra) {
    return '<section class="card' + (extra || '') + '"><div class="hd"><h2 class="ttl">' + hint(title, key) +
      '</h2><div class="open"><span>Open</span> ' + hint('', 'Open', true) + '<b aria-hidden="true">›</b></div></div><div class="bodycol">' +
      body + '</div></section>';
  }

  function niceMax(values) {
    var max = 0;
    values.forEach(function (value) { if (value > max) max = value; });
    if (max <= 3) return 3;
    if (max <= 5) return 5;
    if (max <= 10) return 10;
    return Math.ceil(max * 1.2 / 10) * 10;
  }

  function gainsSvg(series, selectedId, showLabels) {
    var w = 520;
    var h = showLabels ? 340 : 150;
    var maxUp = 1;
    var maxDown = 1;
    series.forEach(function (bucket) {
      if (bucket.joins > maxUp) maxUp = bucket.joins;
      if (bucket.losses > maxDown) maxDown = bucket.losses;
    });
    var mid = Math.round(h * (showLabels ? 0.56 : 0.55));
    var sc = Math.min((mid - (showLabels ? 28 : 16)) / maxUp, (h - mid - (showLabels ? 36 : 18)) / maxDown);
    var n = series.length || 1;
    var cw = (w - 20) / n;
    var bw = Math.min(cw * 0.56, showLabels ? 28 : 18);
    var parts = ['<line x1="6" y1="' + mid + '" x2="' + (w - 6) + '" y2="' + mid + '" stroke="#9aa6a9"/>'];
    series.forEach(function (bucket, index) {
      var x = 10 + index * cw + (cw - bw) / 2;
      var up = bucket.joins * sc;
      var down = bucket.losses * sc;
      parts.push('<rect x="' + x.toFixed(1) + '" y="' + (mid - up).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + up.toFixed(1) + '" fill="' + POP + '"/>');
      parts.push('<rect x="' + x.toFixed(1) + '" y="' + mid + '" width="' + bw.toFixed(1) + '" height="' + down.toFixed(1) + '" fill="' + CLAY + '"/>');
      if (showLabels) {
        if (bucket.joins) parts.push('<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (mid - up - 5).toFixed(1) + '" font-size="12" text-anchor="middle" fill="' + INK + '" font-weight="700" font-family="Montserrat, Raleway, sans-serif">' + bucket.joins + '</text>');
        if (bucket.losses) parts.push('<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (mid + down + 13).toFixed(1) + '" font-size="12" text-anchor="middle" fill="' + INK + '" font-weight="600" font-family="Montserrat, Raleway, sans-serif">' + bucket.losses + '</text>');
      }
      var labelSize = n > 16 ? 9 : 12;
      if (n <= 16 || index % 2 === 0) {
        parts.push('<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 4) + '" font-size="' + labelSize + '" text-anchor="middle" fill="#555" font-family="Montserrat, Raleway, sans-serif">' + escapeHtml(bucket.label) + '</text>');
      }
      var hit = '<rect class="hit" data-bucket="' + escapeHtml(bucket.id) + '" x="' + (x - 2).toFixed(1) + '" y="2" width="' + (bw + 4).toFixed(1) + '" height="' + (h - 18) + '" fill="transparent"/>';
      if (bucket.id === selectedId) {
        parts.push('<rect x="' + (x - 5).toFixed(1) + '" y="4" width="' + (bw + 10).toFixed(1) + '" height="' + (h - 22) + '" fill="none" stroke="#2d515f" stroke-width="1.6" stroke-dasharray="4 3" rx="3"/>');
      }
      parts.push(hit);
    });
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Membership gains and losses">' + parts.join('') + '</svg>';
  }

function lineSvg(values, lastYear, labels, kind, narrow) {
  var n = values.length || 1;
  var w = n > 16 ? 640 : 420;
  var h = 112;
  narrow = !!narrow || n > 14;
    var padX = 12;
    var padTop = narrow ? 22 : 16;
    var padBot = 18;
    var yZero = h - padBot - 7;
    var plotH = yZero - padTop;
    var ymax = niceMax(values.concat(lastYear));
    var cw = (w - 2 * padX) / n;
    function xx(i) { return padX + (i + 0.5) * cw; }
    function yy(v) { return yZero - (v / ymax) * plotH; }
    var parts = [];
    var ly = lastYear.map(function (value, index) { return xx(index).toFixed(1) + ',' + yy(value).toFixed(1); }).join(' ');
    var cur = values.map(function (value, index) { return xx(index).toFixed(1) + ',' + yy(value).toFixed(1); }).join(' ');
    parts.push('<polyline points="' + ly + '" fill="none" stroke="' + ORANGE + '" stroke-width="1.6" stroke-dasharray="3 3" stroke-linejoin="round" stroke-linecap="round"/>');
    parts.push('<polyline points="' + cur + '" fill="none" stroke="' + TEAL + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>');
    values.forEach(function (value, index) {
      var x = xx(index);
      var y = yy(value);
      parts.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.5" fill="' + TEAL + '"/>');
      var showValue = n <= 16;
      if (showValue) {
        var lift = narrow && n > 8 && index % 2 ? 16 : 8;
        parts.push('<text x="' + x.toFixed(1) + '" y="' + (y - lift).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="700" fill="' + INK + '" font-family="Montserrat, Raleway, sans-serif">' + value + '</text>');
      }
      var showLabel = n <= 16 || index % 2 === 0 || index === n - 1;
      if (showLabel) {
        parts.push('<text x="' + x.toFixed(1) + '" y="' + (h - 3) + '" text-anchor="middle" font-size="' + (n > 20 ? 9 : 12) + '" fill="#555" font-family="Montserrat, Raleway, sans-serif">' + escapeHtml(labels[index] || '') + '</text>');
      }
    });
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + escapeHtml(kind) + '">' + parts.join('') + '</svg>';
  }

  function pieSvg(pie, selected) {
    var size = 176;
    var members = pie.members;
    var guests = pie.guests;
    var total = members + guests;
    if (!total) {
      return '<svg class="pie" viewBox="0 0 176 176" role="img" aria-label="No attendance in this period"><circle cx="88" cy="88" r="78" fill="#e6e6e6"/><text x="88" y="92" text-anchor="middle" font-size="12" fill="#555">No attendance</text></svg>';
    }
    var r = size / 2 - 8;
    var cx = size / 2;
    var cy = size / 2;
    var a0 = -Math.PI / 2;
    var a1 = a0 + 2 * Math.PI * (members / total);
    var a2 = a0 + 2 * Math.PI;
    function point(angle, radius) {
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    }
    function slice(start, end, color, audience) {
      var p1 = point(start, r);
      var p2 = point(end, r);
      var large = (end - start) > Math.PI ? 1 : 0;
      var dim = selected && selected !== audience ? ' opacity="0.38"' : '';
      var ring = selected === audience ? ' stroke="#1a333c" stroke-width="3"' : '';
      return '<path data-audience="' + audience + '" d="M ' + cx + ' ' + cy + ' L ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) +
        ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) + ' Z" fill="' + color + '"' + dim + ring + '/>';
    }
    function label(start, end, title, count, pct) {
      var mid = (start + end) / 2;
      var pos = point(mid, r * 0.58);
      return '<text x="' + pos[0].toFixed(1) + '" y="' + (pos[1] - 7).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="Montserrat, Raleway, sans-serif">' + title + '</text>' +
        '<text x="' + pos[0].toFixed(1) + '" y="' + (pos[1] + 11).toFixed(1) + '" text-anchor="middle" font-size="18" font-weight="800" fill="#fff" font-family="Montserrat, Raleway, sans-serif">' + count + '</text>' +
        '<text x="' + pos[0].toFixed(1) + '" y="' + (pos[1] + 26).toFixed(1) + '" text-anchor="middle" font-size="12" fill="#fff">' + pct + '%</text>';
    }
    var memberGroup = members ? '<g data-audience="Member">' + slice(a0, a1, PINE, 'Member') + label(a0, a1, 'Members', members, pie.memberPct) + '</g>' : '';
    var guestStart = members ? a1 : a0;
    var guestGroup = guests ? '<g data-audience="Guest">' + slice(guestStart, a2, POP, 'Guest') + label(guestStart, a2, 'Guests', guests, pie.guestPct) + '</g>' : '';
    return '<svg class="pie" viewBox="0 0 176 176" role="img" aria-label="Attendance distribution, members ' + members + ', guests ' + guests + '">' +
      memberGroup + guestGroup + '</svg>';
  }

function yearControl(view, compact) {
  var options = view.years.map(function (year) {
    return '<option value="' + year + '"' + (year === view.year ? ' selected' : '') + '>' + year + '</option>';
  }).join('');
  var cls = 'ystep' + (compact ? ' compact' : '') + (view.yearEnabled ? '' : ' is-off');
  return '<div class="' + cls + '"' + (view.yearEnabled ? '' : ' aria-disabled="true"') + '>' +
    '<button type="button" data-year-step="-1" aria-label="Previous year"' + (view.yearEnabled ? '' : ' disabled') + '>◂</button>' +
    '<b>' + view.year + '</b>' +
    '<button type="button" data-year-step="1" aria-label="Next year"' + (view.yearEnabled ? '' : ' disabled') + '>▸</button>' +
    '<label class="ycaret"><span class="sr-only">Choose a year</span><select data-year-select aria-label="Year"' +
    (view.yearEnabled ? '' : ' disabled') + '>' + options + '</select></label></div>';
}

  function periodControl(view) {
    var items = [
      ['year', 'Year', 'Year'],
      ['quarter', 'Quarter', 'Quarter'],
      ['month', 'Month', 'Month'],
      ['last12', 'Last 12 months', 'Last 12 months (period)']
    ];
    return '<div class="pseg" role="group" aria-label="Period">' + items.map(function (item) {
      var on = view.period === item[0] && !view.custom;
      return '<button type="button" data-period="' + item[0] + '"' + (on ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' +
        escapeHtml(item[1]) + '<span class="tip" role="tooltip"><strong>' + escapeHtml(item[1]) + '</strong>' + escapeHtml(model.DEFS[item[2]] || '') + '</span></button>';
    }).join('') + '</div>';
  }

  function dateField(which, label, value) {
    return '<label class="drow"><span class="dlb">' + label + '</span><span class="dval">' + escapeHtml(model.formatDate(value)) +
      '</span><input type="date" data-date="' + which + '" value="' + escapeHtml(value) + '" aria-label="' + label + ' date"></label>';
  }

  function docLink(item) {
    if (!item.href) {
      return '<button type="button" class="' + item.className + '" data-more>' + item.label + '</button>';
    }
    var external = /^https?:/i.test(item.href);
    return '<a class="' + item.className + '" href="' + escapeHtml(item.href) + '"' +
      (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + item.label + '</a>';
  }

  function docsOf(view) {
    var found = view.documents || {};
    function byTitle(pattern) {
      var match = '';
      (found.extras || []).forEach(function (item) {
        if (!match && pattern.test(item.title || '')) match = item.url;
      });
      return match;
    }
    return {
      handbook: found.procedure || byTitle(/procedure|handbook/i),
      bylaws: byTitle(/bylaw/i),
      minutes: byTitle(/minute/i),
      roster: byTitle(/roster/i),
      extras: found.extras || []
    };
  }

  function moreMenu(docs) {
    var links = (docs.extras || []).map(function (item) {
      return '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.title) + '</a>';
    }).join('');
    if (!links) links = '<p>No other documents are listed yet.</p>';
    return '<div class="more-pop" hidden>' + links + '</div>';
  }

  function docbar(view) {
    var docs = docsOf(view);
    var signup = '../index.html';
    var pills = [
      { label: 'Handbook', href: docs.handbook, className: 'pill' },
      { label: 'Sign-up sheet', href: signup, className: 'pill' },
      { label: 'Bylaws', href: docs.bylaws, className: 'pill' },
      { label: 'Board minutes', href: docs.minutes, className: 'pill' },
      { label: 'Committee roster', href: docs.roster, className: 'pill' },
      { label: '⋯ More', href: '', className: 'pill' }
    ];
    var icons = [
      { label: 'H', name: 'Handbook', href: docs.handbook, className: 'icon-btn' },
      { label: 'S', name: 'Sign-up sheet', href: signup, className: 'icon-btn' },
      { label: 'B', name: 'Bylaws', href: docs.bylaws, className: 'icon-btn' },
      { label: '⋯', name: 'More', href: '', className: 'icon-btn more-icon' }
    ];
    var badge = view.example ? '<span class="example-badge">Example data</span>' : '';
    return '<header class="docbar"><div class="brand-wrap"><a class="brand" href="index.html">' +
      '<span class="brand-full">ABA · Board &amp; Committee Portal</span>' +
      '<span class="brand-short">ABA Board &amp; Committee</span></a>' + badge + '</div>' +
      '<div class="docs docs-full"><span class="lbl">Documents ' + hint('', 'Documents', true) + '</span>' +
      pills.map(docLink).join('') + moreMenu(docs) + '</div>' +
      '<div class="docs docs-short">' + icons.map(function (item) {
        var node = docLink({ label: item.label, href: item.href, className: item.className });
        return node.replace('>' + item.label, ' aria-label="' + escapeHtml(item.name) + '">' + item.label);
      }).join('') + moreMenu(docs) + '</div></header>';
  }

  function daterow(view) {
    var year = '<span class="lab">' + hint('Year', 'Year selector') + '</span>' + yearControl(view);
    var period = '<span class="lab">' + hint('Period', 'Period') + '</span>' + periodControl(view);
    var dates = '<span class="lab">' + hint('Dates', 'Calendar') + '</span>' +
      dateField('from', 'From', view.range.start) + dateField('to', 'To', view.range.end);
    var reset = '<button type="button" class="reset" data-reset>↺ Reset filters ' + hint('', 'Reset filters', true) + '</button>';
    var startText = model.formatDate(view.range.start);
    var endText = model.formatDate(view.range.end);
    if (view.range.start.slice(0, 4) === view.range.end.slice(0, 4)) {
      startText = startText.replace(', ' + view.range.start.slice(0, 4), '');
    }
    var mobileDates = '<span class="dval">' + escapeHtml(startText) + ' – ' + escapeHtml(endText) + '</span>' +
      '<input type="date" data-date="from" value="' + escapeHtml(view.range.start) + '" aria-label="From date">' +
      '<input type="date" data-date="to" value="' + escapeHtml(view.range.end) + '" aria-label="To date">';
    return '<div class="daterow daterow-full"><div class="dgroup">' + year + '</div><div class="dgroup">' + period +
      '</div><div class="dgroup">' + dates + '</div><div class="dgroup">' + reset + '</div></div>' +
      '<div class="daterow daterow-mob"><div class="cols"><div class="track">' + yearControl(view, true) + periodControl(view) +
      '</div><div class="dprow"><label class="drow drow-span">' + mobileDates + '</label></div></div>' +
      '<div class="sticky"><button type="button" class="reset" data-reset>↺ Reset filters</button></div></div>';
  }

  function eventTypes(view, chips) {
    var types = [['', 'All', 'All']].concat(model.TYPES.map(function (type) {
      return [type, type, type];
    }));
    if (chips) {
      return '<div class="chips"><div class="h">' + hint('Event type', 'Event type') + '</div><div class="chip-row">' +
        types.map(function (type) {
          var on = view.eventType === type[0];
          return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-type="' + escapeHtml(type[0]) + '" aria-pressed="' + on + '">' +
            escapeHtml(type[1]) + '</button>';
        }).join('') + '</div></div>';
    }
    return '<div class="h">' + hint('Event type', 'Event type') + '</div>' + types.map(function (type) {
      var on = view.eventType === type[0];
      var count = type[0] ? (view.eventCounts[type[0]] || 0) : view.eventCounts.all;
      return '<button type="button" class="tog' + (on ? ' on' : '') + '" data-type="' + escapeHtml(type[0]) + '" aria-pressed="' + on + '">' +
        '<span class="sw" aria-hidden="true"></span><span class="tog-label">' + escapeHtml(type[1]) + '</span>' +
        hint('', type[2], true) + '<span class="n">' + count + '</span></button>';
    }).join('');
  }

  function legend() {
    return '<p class="note"><span style="color:' + ORANGE + '">┅</span> last year</p>';
  }

  function render(view) {
    var labels = view.buckets.map(function (bucket) { return bucket.label; });
    var showBarLabels = !view.mobile && view.buckets.length <= 16;
    var members = card('Members', 'Members',
      headline(String(view.members.value), view.members.tone, 'big-members') + priors(view.members),
      ' card-members');
    var fresh = card('New Members', 'New Members',
      headline(String(view.newMembers.value), view.newMembers.tone, 'big-mid') + priors(view.newMembers),
      ' pop');
    var net = card('Net Gain', 'Net Gain',
      headline(signed(view.net.value), view.net.tone, 'big-mid') + priors(view.net),
      ' pop');
    var gains = card('Membership Gains V Losses', 'Membership Gains V Losses',
      '<div class="chart-slot">' + gainsSvg(view.gains, view.bucket, showBarLabels) + '</div>',
      ' card-gains');
    var events = card('Events Held', 'Events Held',
      headline(String(view.events.value), view.events.tone, 'big-mid') + priors(view.events) +
      '<div class="chart-slot">' + lineSvg(view.eventSeries, view.eventLastYear, labels, 'Events held', view.mobile) + '</div>' + legend(),
      ' card-events');
    var attendance = card('Attendance', 'Attendance',
      headline(String(view.attendance.value), view.attendance.tone, 'big-mid') + priors(view.attendance) +
      '<div class="chart-slot">' + lineSvg(view.attendanceSeries, view.attendanceLastYear, labels, 'Attendance', view.mobile) + '</div>' + legend(),
      ' card-attendance');
    var pie = card('Attendance Distribution', 'Attendance Distribution',
      pieSvg(view.pie, view.audience),
      ' card-pie');
    return docbar(view) + daterow(view) + '<div class="body" id="content"><aside class="side">' + eventTypes(view, false) +
      '</aside><div class="main">' + eventTypes(view, true) +
      '<div class="row row-top">' + members + '<div class="stack">' + fresh + net + '</div>' + gains + '</div>' +
      '<div class="row row-bottom">' + events + attendance + pie + '</div></div></div>' +
      '<footer class="sig"><img src="../assets/aba-logo.png" alt="Ada Business Association logo"><span class="credit">Powered by Donny C. Nguyen</span></footer>';
  }

  root.ABADashboardView = { render: render, escapeHtml: escapeHtml };
})(typeof window !== 'undefined' ? window : globalThis);
