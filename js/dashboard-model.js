/* Period math and figures for the membership and events dashboard.
   No network calls. No emails, phones, or names. */
(function (root) {
  'use strict';

  var TYPES = ['Lunch & Learn', 'Ribbon Cutting', 'Happy Hour'];
  var LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var POP = '#0077FF';
  var CLAY = '#D01F25';
  var INK = '#39393a';

  var DEFS = {
    'Portal': 'A private page for ABA board and committee members, with documents and a dashboard of membership and events.',
    'Documents': 'Links to board and committee documents. They stay in this top bar, apart from the figures below.',
    'Handbook': 'Opens the procedure manual or handbook for board and committee members.',
    'Sign-up sheet': 'Opens the volunteer sign-up sheet that feeds the internal figures on this dashboard.',
    'Bylaws': 'Opens the ABA bylaws.',
    'Board minutes': 'Opens recent board meeting minutes.',
    'Committee roster': 'Opens the committee roster.',
    'More': 'Opens any remaining documents kept in this portal.',
    'Event type': 'Limits every figure on the page to one kind of event, or shows all types together. Toggles filter every card. The counts are the number of events in the selected period.',
    'All': 'Shows every event type in the period you selected.',
    'Lunch & Learn': 'Shows only Lunch & Learn events in the period you selected.',
    'Ribbon Cutting': 'Shows only Ribbon Cutting events in the period you selected.',
    'Happy Hour': 'Shows only Happy Hour events in the period you selected.',
    'Year selector': 'Steps or opens a list of years. Year, Quarter, and Month are measured within the year you select. The Year control is not used when Last 12 months is selected.',
    'Period': 'Chooses Year (the default), Quarter, Month, or Last 12 months. Year, Quarter, and Month are anchored to the Year control. Last 12 months is the trailing 12 full months and ignores the Year control. Every card, metric, comparison, and label on the page follows this choice, together with the Dates range.',
    'Year': 'In the current year, year to date: January 1 through today. Charts use monthly buckets and show only the elapsed months. When a previous year is chosen, Year shows that entire calendar year (January 1 to December 31). This is the default view.',
    'Quarter': 'In the current year, quarter to date: the current quarter\'s start through today. Charts use weekly buckets. When a previous year is chosen, Quarter runs to the end of that quarter.',
    'Month': 'In the current year, month to date: the 1st of the current month through today\'s day. Charts use daily buckets. When a previous year is chosen, Month runs to the end of that month.',
    'Last 12 months (period)': 'The trailing 12 full months, ending today, regardless of the Year control. Charts use monthly buckets. Comparisons are with the 12 months before that.',
    'Calendar': 'Lets you pick a start date and an end date; every figure on the page follows that range. In the default Year view, Dates show January 1 through November 24 of the selected year.',
    'Reset filters': 'Clears any click-to-filter choice (including a Members or Guests pie selection) and other selected filters, and restores the default view: the current year, Year, and all event types.',
    'Members': '412 is the member total at the end of the selected period. The figures below compare the member total with last month, last quarter, and last year, each the same length of time as the selected period, shifted back.',
    'New Members': 'How many members joined during the period you selected. In this example, 50 is 13% of starting members.',
    'Net Gain': 'The net change in membership for the selected period: members who joined minus members who left.',
    'Membership Gains V Losses': 'Up = gains (always blue). Down = losses (always red). New Members (bars up, always blue) and members who left (bars down, always red) by month for the elapsed months of the selected period (here January through November). Click a bar to filter the whole page to it; Reset filters clears it.',
    'Events Held': 'How many events took place in the period you selected. In this example, events averaged 36 attendees. The figures below compare the same length of time shifted back one month, one quarter, and one year. The line graph plots events for each elapsed month of the selected year (January through November), with the value at each point; a month with no events is plotted at zero. The faint dashed orange (#F28C28) line is the same months shifted back one year.',
    'Attendance': '462 is attendance for the selected period. The figures below compare the same length of time shifted back one month, one quarter, and one year. The line graph plots attendance for each elapsed month of the selected year (January through November), with the value at each point; a month with no events is plotted at zero. The faint dashed orange (#F28C28) line is the same months shifted back one year.',
    'Attendance Distribution': 'Of the people who attended in the selected period, how many were members and how many were guests. The raw count is the main number; the percentage is context. Click Members or Guests to filter the whole page; click again to clear.',
    'Open': 'Opens a closer look at this measure, then on to inputs and who did the work.',
    'Last month / quarter / year': 'The same measure for the same length of time as the selected period, shifted back one month, one quarter, or one year.',
    'Powered by Donny C. Nguyen': 'A credit line for the portal work. It is not a data measure.'
  };

  var FLAGS = {
    'Members': 'The sign-up sheet has no member roster yet, so this figure is example data until a roster source is provided.',
    'New Members': 'The sign-up sheet has no member roster yet, so this figure is example data until a roster source is provided.',
    'Net Gain': 'Uses the same open definition of who has left, and there is no member roster yet; this figure is example data.',
    'Membership Gains V Losses': 'Uses the same open definition of who has left, and is example data until a member roster is provided.',
    'Attendance': 'Internal sign-up figures are current; an external attendance source has been promised but is not connected yet. Capacity rules may still be refined. Figures here are example data.',
    'Attendance Distribution': 'Guest and member attendance will be firmer once the external attendance source is connected. Figures here are example data.'
  };

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function parseISO(value) {
    var parts = String(value || '').split('-');
    return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
  }

  function isISO(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    var p = parseISO(value);
    if (p.m < 1 || p.m > 12 || p.d < 1) return false;
    return p.d <= daysInMonth(p.y, p.m);
  }

  function iso(y, m, d) {
    return y + '-' + pad(m) + '-' + pad(d);
  }

  function dateUTC(value) {
    var p = parseISO(value);
    return Date.UTC(p.y, p.m - 1, p.d);
  }

  function fromUTC(ms) {
    var dt = new Date(ms);
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  function addDays(value, days) {
    return fromUTC(dateUTC(value) + days * 86400000);
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function addMonths(value, delta) {
    var p = parseISO(value);
    var idx = p.y * 12 + (p.m - 1) + delta;
    var y = Math.floor(idx / 12);
    var m = idx % 12;
    if (m < 0) {
      m += 12;
      y -= 1;
    }
    m += 1;
    return iso(y, m, Math.min(p.d, daysInMonth(y, m)));
  }

  function inclusiveDays(start, end) {
    return Math.round((dateUTC(end) - dateUTC(start)) / 86400000) + 1;
  }

  function shiftRange(start, end, months) {
    var end2 = addMonths(end, -months);
    var start2 = addDays(end2, -(inclusiveDays(start, end) - 1));
    return { start: start2, end: end2 };
  }

  function formatDate(value) {
    var p = parseISO(value);
    if (!p.y || !p.m || !p.d) return String(value || '');
    return MONTHS[p.m - 1] + ' ' + p.d + ', ' + p.y;
  }

  function periodRange(period, year, today) {
    var t = parseISO(today);
    year = Number(year);
    if (period === 'last12') {
      var idx = t.y * 12 + (t.m - 1) - 11;
      var y = Math.floor(idx / 12);
      var m = idx % 12;
      if (m < 0) {
        m += 12;
        y -= 1;
      }
      return { start: iso(y, m + 1, 1), end: today };
    }
    if (period === 'quarter') {
      var qStart = Math.floor((t.m - 1) / 3) * 3 + 1;
      var start = iso(year, qStart, 1);
      if (year === t.y) return { start: start, end: today };
      var endMonth = qStart + 2;
      return { start: start, end: iso(year, endMonth, daysInMonth(year, endMonth)) };
    }
    if (period === 'month') {
      var startMonth = iso(year, t.m, 1);
      if (year === t.y) return { start: startMonth, end: today };
      return { start: startMonth, end: iso(year, t.m, daysInMonth(year, t.m)) };
    }
    if (year === t.y) return { start: iso(year, 1, 1), end: today };
    if (year > t.y) return { start: iso(year, 1, 1), end: today };
    return { start: iso(year, 1, 1), end: iso(year, 12, 31) };
  }

  function granularityFor(period, custom, range) {
    if (!custom) {
      if (period === 'quarter') return 'week';
      if (period === 'month') return 'day';
      return 'month';
    }
    var days = inclusiveDays(range.start, range.end);
    if (days <= 35) return 'day';
    if (days <= 120) return 'week';
    return 'month';
  }

  function bucketsFor(range, granularity) {
    var out = [];
    var guard = 0;
    if (granularity === 'month') {
      var p = parseISO(range.start);
      var endP = parseISO(range.end);
      var idx = p.y * 12 + (p.m - 1);
      var endIdx = endP.y * 12 + (endP.m - 1);
      while (idx <= endIdx && guard < 240) {
        var y = Math.floor(idx / 12);
        var m = idx % 12 + 1;
        var bStart = iso(y, m, 1);
        var bEnd = iso(y, m, daysInMonth(y, m));
        if (bStart < range.start) bStart = range.start;
        if (bEnd > range.end) bEnd = range.end;
        out.push({ id: bStart + ':' + bEnd, label: LETTERS[m - 1], start: bStart, end: bEnd });
        idx += 1;
        guard += 1;
      }
      return out;
    }
    if (granularity === 'week') {
      var cursor = range.start;
      while (cursor <= range.end && guard < 200) {
        var day = new Date(dateUTC(cursor)).getUTCDay();
        var untilSun = day === 0 ? 0 : 7 - day;
        var bEnd = addDays(cursor, untilSun);
        if (bEnd > range.end) bEnd = range.end;
        var pp = parseISO(cursor);
        out.push({
          id: cursor + ':' + bEnd,
          label: MONTHS[pp.m - 1] + ' ' + pp.d,
          start: cursor,
          end: bEnd
        });
        cursor = addDays(bEnd, 1);
        guard += 1;
      }
      return out;
    }
    var cursorD = range.start;
    var spanMonths = range.start.slice(0, 7) !== range.end.slice(0, 7);
    while (cursorD <= range.end && guard < 400) {
      var pd = parseISO(cursorD);
      out.push({
        id: cursorD + ':' + cursorD,
        label: spanMonths ? (pd.m + '/' + pd.d) : String(pd.d),
        start: cursorD,
        end: cursorD
      });
      cursorD = addDays(cursorD, 1);
      guard += 1;
    }
    return out;
  }

  function groupKey(row) {
    return (row.audience || '') + '|' + (row.eventType || '');
  }

  function rowMatches(row, audience, eventType) {
    if (audience && row.audience !== audience) return false;
    if (eventType && row.eventType !== eventType) return false;
    return true;
  }

  function stockAt(data, day, audience, eventType) {
    var map = {};
    function slot(row) {
      var key = groupKey(row);
      if (!map[key]) map[key] = { openingDate: '', opening: 0, changes: [] };
      return map[key];
    }
    (data.openings || []).forEach(function (row) {
      if (!rowMatches(row, audience, eventType)) return;
      if (row.date > day) return;
      var item = slot(row);
      if (!item.openingDate || row.date >= item.openingDate) {
        item.openingDate = row.date;
        item.opening = Number(row.count) || 0;
      }
    });
    (data.changes || []).forEach(function (row) {
      if (!rowMatches(row, audience, eventType)) return;
      slot(row).changes.push(row);
    });
    var total = 0;
    Object.keys(map).forEach(function (key) {
      var item = map[key];
      var n = item.opening;
      item.changes.forEach(function (row) {
        if (item.openingDate && row.date <= item.openingDate) return;
        if (row.date > day) return;
        n += (Number(row.joins) || 0) - (Number(row.losses) || 0);
      });
      total += n;
    });
    return total;
  }

  function flowBetween(data, start, end, audience, eventType) {
    var joins = 0;
    var losses = 0;
    (data.changes || []).forEach(function (row) {
      if (row.date < start || row.date > end) return;
      if (!rowMatches(row, audience, eventType)) return;
      joins += Number(row.joins) || 0;
      losses += Number(row.losses) || 0;
    });
    return { joins: joins, losses: losses, net: joins - losses };
  }

  function attendanceByEvent(data) {
    var map = {};
    (data.attendance || []).forEach(function (row) {
      if (!map[row.eventId]) map[row.eventId] = { Member: 0, Guest: 0 };
      if (row.audience !== 'Member' && row.audience !== 'Guest') return;
      map[row.eventId][row.audience] += Number(row.count) || 0;
    });
    return map;
  }

  function eventsIn(data, start, end, eventType, audience, attendance) {
    return (data.events || []).filter(function (event) {
      if (!event.date || event.date < start || event.date > end) return false;
      if (eventType && event.type !== eventType) return false;
      if (audience) {
        var counts = attendance[event.id] || { Member: 0, Guest: 0 };
        if (!(counts[audience] > 0)) return false;
      }
      return true;
    });
  }

  function attendanceSum(events, attendance, audience) {
    var total = 0;
    events.forEach(function (event) {
      var counts = attendance[event.id] || { Member: 0, Guest: 0 };
      if (audience) total += counts[audience] || 0;
      else total += (counts.Member || 0) + (counts.Guest || 0);
    });
    return total;
  }

  function tone(value, lastYear) {
    if (value > lastYear) return 'up';
    if (value < lastYear) return 'down';
    return 'flat';
  }

  function headlineColor(kind) {
    if (kind === 'up') return POP;
    if (kind === 'down') return CLAY;
    return INK;
  }

  function metric(value, lastMonth, lastQuarter, lastYear) {
    return {
      value: value,
      lastMonth: lastMonth,
      lastQuarter: lastQuarter,
      lastYear: lastYear,
      tone: tone(value, lastYear),
      color: headlineColor(tone(value, lastYear))
    };
  }

  function defaultState(data) {
    return {
      year: Number(String(data && data.asOf || '2026-11-24').slice(0, 4)),
      period: 'year',
      from: '',
      to: '',
      eventType: '',
      audience: '',
      bucket: ''
    };
  }

  function yearsOf(data) {
    var set = {};
    function add(value) {
      if (isISO(value)) set[value.slice(0, 4)] = true;
    }
    (data.events || []).forEach(function (row) { add(row.date); });
    (data.changes || []).forEach(function (row) { add(row.date); });
    add(data.asOf);
    var max = Number(String(data.asOf || '').slice(0, 4)) || 2026;
    var years = Object.keys(set).map(Number).filter(function (year) {
      return year >= 2000 && year <= max;
    }).sort(function (a, b) { return a - b; });
    if (!years.length) years.push(max);
    return years;
  }

  function resolveView(data, state) {
    var today = isISO(data.asOf) ? data.asOf : '2026-11-24';
    var years = yearsOf(data);
    var year = Number(state && state.year);
    if (years.indexOf(year) === -1) year = Number(today.slice(0, 4));
    var period = state && state.period;
    if (period !== 'year' && period !== 'quarter' && period !== 'month' && period !== 'last12') period = 'year';
    var preset = periodRange(period, year, today);
    var custom = false;
    var range = preset;
    if (state && isISO(state.from) && isISO(state.to)) {
      var from = state.from <= state.to ? state.from : state.to;
      var to = state.from <= state.to ? state.to : state.from;
      if (from !== preset.start || to !== preset.end) {
        custom = true;
        range = { start: from, end: to };
      }
    }
    var eventType = state && TYPES.indexOf(state.eventType) !== -1 ? state.eventType : '';
    var audience = state && (state.audience === 'Member' || state.audience === 'Guest') ? state.audience : '';
    return {
      today: today,
      year: year,
      years: years,
      period: period,
      custom: custom,
      range: range,
      preset: preset,
      granularity: granularityFor(period, custom, range),
      yearEnabled: period !== 'last12',
      eventType: eventType,
      audience: audience,
      bucket: state && state.bucket ? String(state.bucket) : ''
    };
  }

  function copyState(state) {
    return {
      year: state.year,
      period: state.period,
      from: state.from || '',
      to: state.to || '',
      eventType: state.eventType || '',
      audience: state.audience || '',
      bucket: state.bucket || ''
    };
  }

  function applyAction(data, state, action) {
    var next = copyState(state || defaultState(data));
    action = action || {};
    if (action.type === 'reset') return defaultState(data);
    if (action.type === 'period') {
      next.period = action.period;
      next.from = '';
      next.to = '';
      next.bucket = '';
      return next;
    }
    if (action.type === 'year') {
      if (next.period === 'last12') return next;
      next.year = Number(action.year);
      next.from = '';
      next.to = '';
      next.bucket = '';
      return next;
    }
    if (action.type === 'dates') {
      next.from = action.from;
      next.to = action.to;
      next.bucket = '';
      return next;
    }
    if (action.type === 'eventType') {
      next.eventType = action.eventType || '';
      next.bucket = '';
      return next;
    }
    if (action.type === 'audience') {
      next.audience = next.audience === action.audience ? '' : (action.audience || '');
      return next;
    }
    if (action.type === 'bucket') {
      next.bucket = next.bucket === action.bucket ? '' : (action.bucket || '');
      return next;
    }
    return next;
  }

  function stateHash(state) {
    var parts = ['year=' + Number(state.year || 0), 'period=' + (state.period || 'year')];
    if (state.eventType) parts.push('type=' + encodeURIComponent(state.eventType));
    if (state.audience) parts.push('audience=' + encodeURIComponent(state.audience));
    if (state.from && state.to) {
      parts.push('from=' + state.from);
      parts.push('to=' + state.to);
    }
    if (state.bucket) parts.push('bucket=' + encodeURIComponent(state.bucket));
    return parts.join('&');
  }

  function stateFromHash(hash, data) {
    var state = defaultState(data);
    var query = String(hash || '').replace(/^#/, '');
    if (!query) return state;
    var bag = {};
    query.split('&').forEach(function (pair) {
      var bits = pair.split('=');
      var key = bits[0] || '';
      try { key = decodeURIComponent(key); } catch (err) {}
      var value = bits.slice(1).join('=');
      try { value = decodeURIComponent(value); } catch (err) {}
      bag[key] = value;
    });
    if (bag.year && /^\d{4}$/.test(bag.year)) state.year = Number(bag.year);
    if (bag.period === 'year' || bag.period === 'quarter' || bag.period === 'month' || bag.period === 'last12') {
      state.period = bag.period;
    }
    if (TYPES.indexOf(bag.type) !== -1) state.eventType = bag.type;
    if (bag.audience === 'Member' || bag.audience === 'Guest') state.audience = bag.audience;
    if (isISO(bag.from) && isISO(bag.to)) {
      state.from = bag.from;
      state.to = bag.to;
    }
    if (bag.bucket && /^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/.test(bag.bucket)) state.bucket = bag.bucket;
    return state;
  }

  function comparisons(range, measure) {
    var lm = shiftRange(range.start, range.end, 1);
    var lq = shiftRange(range.start, range.end, 3);
    var ly = shiftRange(range.start, range.end, 12);
    return metric(measure(range.start, range.end), measure(lm.start, lm.end), measure(lq.start, lq.end), measure(ly.start, ly.end));
  }

  function compute(data, state) {
    data = data || {};
    var view = resolveView(data, state || defaultState(data));
    var attendance = attendanceByEvent(data);
    var buckets = bucketsFor(view.range, view.granularity);
    var selected = null;
    buckets.forEach(function (bucket) {
      if (bucket.id === view.bucket) selected = bucket;
    });
    var measure = selected ? { start: selected.start, end: selected.end } : view.range;
    var eventType = view.eventType;
    var pieAudience = view.audience;
    var roster = pieAudience || 'Member';

    function countEvents(start, end) {
      return eventsIn(data, start, end, eventType, pieAudience, attendance).length;
    }
    function sumAttendance(start, end, audience) {
      return attendanceSum(eventsIn(data, start, end, eventType, '', attendance), attendance, audience || pieAudience);
    }
    function memberStock(start, end) {
      return stockAt(data, end, roster, eventType);
    }
    function joins(start, end) {
      return flowBetween(data, start, end, roster, eventType).joins;
    }
    function net(start, end) {
      return flowBetween(data, start, end, roster, eventType).net;
    }

    var gainSeries = buckets.map(function (bucket) {
      var flow = flowBetween(data, bucket.start, bucket.end, roster, eventType);
      return { id: bucket.id, label: bucket.label, joins: flow.joins, losses: flow.losses };
    });
    var eventSeries = buckets.map(function (bucket) {
      return countEvents(bucket.start, bucket.end);
    });
    var eventLastYear = buckets.map(function (bucket) {
      var shifted = shiftRange(bucket.start, bucket.end, 12);
      return countEvents(shifted.start, shifted.end);
    });
    var attendanceSeries = buckets.map(function (bucket) {
      return sumAttendance(bucket.start, bucket.end);
    });
    var attendanceLastYear = buckets.map(function (bucket) {
      var shifted = shiftRange(bucket.start, bucket.end, 12);
      return sumAttendance(shifted.start, shifted.end);
    });

    var counted = eventsIn(data, measure.start, measure.end, '', pieAudience, attendance);
    var typeCounts = { all: counted.length };
    TYPES.forEach(function (type) { typeCounts[type] = 0; });
    counted.forEach(function (event) {
      if (typeCounts[event.type] == null) typeCounts[event.type] = 0;
      typeCounts[event.type] += 1;
    });
    var pieEvents = eventsIn(data, measure.start, measure.end, eventType, '', attendance);
    var pieMembers = attendanceSum(pieEvents, attendance, 'Member');
    var pieGuests = attendanceSum(pieEvents, attendance, 'Guest');
    var pieTotal = pieMembers + pieGuests;
    var memberPct = pieTotal ? Math.round((pieMembers / pieTotal) * 100) : 0;

    return {
      example: data.example === true,
      asOf: view.today,
      year: view.year,
      years: view.years,
      period: view.period,
      custom: view.custom,
      yearEnabled: view.yearEnabled,
      range: view.range,
      granularity: view.granularity,
      eventType: eventType,
      audience: pieAudience,
      bucket: selected ? selected.id : '',
      buckets: buckets,
      eventCounts: typeCounts,
      members: comparisons(measure, memberStock),
      newMembers: comparisons(measure, joins),
      net: comparisons(measure, net),
      gains: gainSeries,
      events: comparisons(measure, countEvents),
      eventSeries: eventSeries,
      eventLastYear: eventLastYear,
      attendance: comparisons(measure, function (start, end) { return sumAttendance(start, end); }),
      attendanceSeries: attendanceSeries,
      attendanceLastYear: attendanceLastYear,
      pie: {
        members: pieMembers,
        guests: pieGuests,
        memberPct: memberPct,
        guestPct: pieTotal ? 100 - memberPct : 0
      }
    };
  }

  root.ABADashboard = {
    TYPES: TYPES,
    POP: POP,
    CLAY: CLAY,
    DEFS: DEFS,
    FLAGS: FLAGS,
    isISO: isISO,
    inclusiveDays: inclusiveDays,
    shiftRange: shiftRange,
    periodRange: periodRange,
    formatDate: formatDate,
    defaultState: defaultState,
    resolveView: resolveView,
    applyAction: applyAction,
    stateHash: stateHash,
    stateFromHash: stateFromHash,
    compute: compute,
    stockAt: stockAt
  };
})(typeof window !== 'undefined' ? window : globalThis);
