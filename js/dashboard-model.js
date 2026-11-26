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
    'Event type': 'Limits every card, chart, and list to Lunch & Learn, Ribbon Cutting, or Happy Hour. Membership rows use the event type stored on them. All events shows every member. The counts are how many events of that kind fall in the dates you selected.',
    'All': 'Shows Lunch & Learn, Ribbon Cutting, and Happy Hour together.',
    'Lunch & Learn': 'Shows only Lunch & Learn events in the period you selected.',
    'Ribbon Cutting': 'Shows only Ribbon Cutting events in the period you selected.',
    'Happy Hour': 'Shows only Happy Hour events in the period you selected.',
    'Year selector': 'Steps through fiscal years. A fiscal year runs from July 1 through June 30 and is named for the year it ends. Period then chooses the whole year, the current quarter, or the current month inside that year. A past year uses its last quarter or its last month. This control is not used when Last 12 months is selected.',
    'Period': 'Year keeps every total on the fiscal year chosen at the left. Quarter sets every total to the current fiscal quarter inside that year, or the last quarter of a past year. Month sets every total to the current calendar month inside that year, or the last month of a past year. The current quarter or month runs through today. Last 12 months uses the trailing 12 months and ignores the fiscal year. Each chart period is that period alone. Member Gains and Losses pairs it with the same period last fiscal year.',
    'Year': 'Sets every total to the fiscal year chosen at the left. The current year runs through today. A past year is July 1 through June 30. Member Gains and Losses shows that year beside the same dates last fiscal year.',
    'Quarter': 'The dates and the big numbers stay on the current fiscal quarter inside the year at the left, through today. A past year uses its last quarter, April through June. The charts show each quarter of that fiscal year separately, Q1 through the current quarter, each beside the same quarter last fiscal year. Later quarters are left off.',
    'Month': 'The dates and the big numbers stay on the current month inside the year at the left, through today. A past year uses June. The charts show each month of that fiscal year separately, July through the current month, each beside the same month last fiscal year. Later months are left off.',
    'Last 12 months (period)': 'Uses the trailing 12 full months ending today, and groups Member Gains and Losses by month. The Year control is not used. Comparisons use the 12 months before that.',
    'Reset filters': 'Clears every filter in one click: the year, the period, event types, companies, attendees, and a pie or bar selection. An open list refreshes to the unfiltered records.',
    'Members': 'Business member count at the end of the selected period. Month start and Quarter start are the counts at the beginning of that month and fiscal quarter. FY start is the count at the beginning of the fiscal year, July 1. The change from FY start is the net gain since then.',
    'New Members': 'How many business members joined during the period you selected. Last month is the previous calendar month through the same day. Last quarter is the previous fiscal quarter through the same number of days. Last year is the same dates in the prior fiscal year.',
    'Net Gain': 'Business members who joined minus business members who left during the period you selected. Last month, last quarter, and last year use the same fiscal windows as New Members.',
    'Member Gains and Losses': 'Up = gains (always blue). Down = losses (always red). The gray bars are the same period last fiscal year, clipped to the same day when this period is still open. Year is one pair for the fiscal year. Quarter shows each quarter of that year. Month shows each month from July. Click a current-year bar to filter the page to it; Reset filters clears it.',
    'Events Held': 'How many events took place in the dates you selected. The figures below compare the same length of time shifted back one month and one quarter, and the same dates in the prior fiscal year. The line stays month by month for those dates, including a month with no events at zero. It does not follow the Year, Quarter, or Month grouping. The faint dashed orange (#F28C28) line is those months in the prior fiscal year.',
    'Attendance': 'Attendee count for the dates you selected. The figures below compare the same length of time shifted back one month and one quarter, and the same dates in the prior fiscal year. The line stays month by month for those dates, including a month with no events at zero. It does not follow the Year, Quarter, or Month grouping. The faint dashed orange (#F28C28) line is those months in the prior fiscal year.',
    'Attendance Distribution': 'Of the people who attended in the selected period, how many were attendees and how many were guests. Attendees are people marked Member. The raw count is the main number; the percentage is context. Click Attendees or Guests to filter the whole page; click again to clear.',
    'Open': 'Opens the list of records behind this number. The list follows the filters already on the page.',
    'Company': 'Limits every figure to attendance and membership for the member companies you select. Companies combine with OR. Guests from other companies stay out of this list.',
    'Attendee': 'Limits every figure to the attendees you select. The list shows attendees at the selected companies, or everyone when no company is selected. Attendees combine with OR.',
    'Last month / quarter / year': 'On Events Held and Attendee Count, last month and last quarter are the same length of time shifted back one month or one quarter, and last year is the same dates in the prior fiscal year. On the business-member cards, the windows follow fiscal boundaries instead.',
    'Powered by Donny C. Nguyen': 'A credit line for the portal work. It is not a data measure.'
  };

  var FLAGS = {
    'Members': 'The sign-up sheet has no member roster yet, so this figure is example data until a roster source is provided.',
    'New Members': 'The sign-up sheet has no member roster yet, so this figure is example data until a roster source is provided.',
    'Net Gain': 'Uses the same open definition of who has left, and there is no member roster yet; this figure is example data.',
    'Member Gains and Losses': 'Uses the same open definition of who has left, and is example data until a member roster is provided.',
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

  function fiscalYearOf(value) {
    var p = parseISO(value);
    if (!p.y || !p.m) return 2027;
    return p.m >= 7 ? p.y + 1 : p.y;
  }

  function fiscalBounds(year) {
    year = Number(year);
    return { start: iso(year - 1, 7, 1), end: iso(year, 6, 30) };
  }

  function shiftYears(value, delta) {
    var p = parseISO(value);
    var y = p.y + delta;
    return iso(y, p.m, Math.min(p.d, daysInMonth(y, p.m)));
  }

  function priorYearRange(start, end) {
    return { start: shiftYears(start, -1), end: shiftYears(end, -1) };
  }

  function quarterIndex(value) {
    var p = parseISO(value);
    var fy = p.m >= 7 ? p.y + 1 : p.y;
    var q = p.m >= 10 ? 2 : (p.m >= 7 ? 1 : (p.m <= 3 ? 3 : 4));
    return fy * 4 + (q - 1);
  }

  function quarterBounds(index) {
    var fy = Math.floor(index / 4);
    var q = index % 4 + 1;
    if (q === 1) return { fy: fy, q: q, start: iso(fy - 1, 7, 1), end: iso(fy - 1, 9, 30) };
    if (q === 2) return { fy: fy, q: q, start: iso(fy - 1, 10, 1), end: iso(fy - 1, 12, 31) };
    if (q === 3) return { fy: fy, q: q, start: iso(fy, 1, 1), end: iso(fy, 3, 31) };
    return { fy: fy, q: q, start: iso(fy, 4, 1), end: iso(fy, 6, 30) };
  }

  function formatDate(value) {
    var p = parseISO(value);
    if (!p.y || !p.m || !p.d) return String(value || '');
    return MONTHS[p.m - 1] + ' ' + p.d + ', ' + p.y;
  }

  function clampWindow(start, end, today) {
    if (start > today) return null;
    return { start: start, end: end > today && start <= today ? today : end };
  }

  function quarterWindow(year, quarter, today) {
    quarter = Number(quarter);
    if (quarter < 1 || quarter > 4) quarter = quarterBounds(quarterIndex(today)).q;
    var bounds = quarterBounds(Number(year) * 4 + (quarter - 1));
    return clampWindow(bounds.start, bounds.end, today);
  }

  function monthWindow(month, today) {
    var key = String(month || '');
    if (!/^\d{4}-\d{2}$/.test(key)) key = String(today).slice(0, 7);
    var p = parseISO(key + '-01');
    var start = iso(p.y, p.m, 1);
    var end = iso(p.y, p.m, daysInMonth(p.y, p.m));
    return clampWindow(start, end, today);
  }

  function quarterForYear(year, today) {
    if (Number(year) >= fiscalYearOf(today)) return quarterBounds(quarterIndex(today)).q;
    return 4;
  }

  function monthForYear(year, today) {
    if (Number(year) >= fiscalYearOf(today)) return String(today).slice(0, 7);
    return iso(Number(year), 6, 1).slice(0, 7);
  }

  function periodRange(period, year, today) {
    var t = parseISO(today);
    var current = fiscalYearOf(today);
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
    var bounds = fiscalBounds(year);
    if (year >= current) return { start: bounds.start, end: today };
    return bounds;
  }

  function groupingOf(period) {
    if (period === 'quarter') return 'quarter';
    if (period === 'year') return 'year';
    return 'month';
  }

  function clipBucket(range, start, end, label) {
    var bStart = start < range.start ? range.start : start;
    var bEnd = end > range.end ? range.end : end;
    if (bStart > bEnd) return null;
    return { id: bStart + ':' + bEnd, label: label, start: bStart, end: bEnd };
  }

  function bucketsFor(range, grouping) {
    var out = [];
    var guard = 0;
    var startP = parseISO(range.start);
    var endP = parseISO(range.end);
    if (grouping === 'year') {
      var fy = fiscalYearOf(range.start);
      var fyEnd = fiscalYearOf(range.end);
      for (; fy <= fyEnd && guard < 40; fy++) {
        var bounds = fiscalBounds(fy);
        var bucket = clipBucket(range, bounds.start, bounds.end, 'FY' + fy);
        if (bucket) out.push(bucket);
        guard += 1;
      }
      return out;
    }
    if (grouping === 'quarter') {
      var idx = quarterIndex(range.start);
      var endIdx = quarterIndex(range.end);
      var multiYear = fiscalYearOf(range.start) !== fiscalYearOf(range.end);
      while (idx <= endIdx && guard < 80) {
        var quarter = quarterBounds(idx);
        var label = 'Q' + quarter.q;
        if (multiYear) label += ' ’' + String(quarter.fy).slice(2);
        var bucketQ = clipBucket(range, quarter.start, quarter.end, label);
        if (bucketQ) out.push(bucketQ);
        idx += 1;
        guard += 1;
      }
      return out;
    }
    var monthIdx = startP.y * 12 + (startP.m - 1);
    var monthEndIdx = endP.y * 12 + (endP.m - 1);
    var spanYears = fiscalYearOf(range.start) !== fiscalYearOf(range.end);
    while (monthIdx <= monthEndIdx && guard < 240) {
      var my = Math.floor(monthIdx / 12);
      var mm = monthIdx % 12 + 1;
      var letter = LETTERS[mm - 1];
      if (spanYears && mm === 1) letter = letter + String(my).slice(2);
      var bucketM = clipBucket(range, iso(my, mm, 1), iso(my, mm, daysInMonth(my, mm)), letter);
      if (bucketM) out.push(bucketM);
      monthIdx += 1;
      guard += 1;
    }
    return out;
  }

  function groupKey(row) {
    return (row.audience || '') + '|' + (row.eventType || '');
  }

  function typeSelected(value, filter) {
    if (filter == null || filter === '') return true;
    if (typeof filter === 'string') return value === filter;
    if (!filter.length) return true;
    var i;
    for (i = 0; i < filter.length; i++) if (filter[i] === value) return true;
    return false;
  }

  function rowMatches(row, audience, eventType) {
    if (audience && row.audience !== audience) return false;
    if (!typeSelected(row.eventType, eventType)) return false;
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
      if (!typeSelected(event.type, eventType)) return false;
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
    var today = isISO(data && data.asOf) ? data.asOf : '2026-11-24';
    var currentQuarter = quarterBounds(quarterIndex(today));
    return {
      year: fiscalYearOf(today),
      quarter: currentQuarter.q,
      month: today.slice(0, 7),
      period: 'year',
      eventType: '',
      eventTypes: [],
      companies: [],
      people: [],
      audience: '',
      bucket: ''
    };
  }

  function yearsOf(data) {
    var set = {};
    function add(value) {
      if (isISO(value)) set[fiscalYearOf(value)] = true;
    }
    (data.events || []).forEach(function (row) { add(row.date); });
    (data.changes || []).forEach(function (row) { add(row.date); });
    (data.openings || []).forEach(function (row) { add(row.date); });
    add(data.asOf);
    var max = fiscalYearOf(data.asOf || '2026-11-24');
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
    if (years.indexOf(year) === -1) year = fiscalYearOf(today);
    var period = state && state.period;
    if (period !== 'year' && period !== 'quarter' && period !== 'month' && period !== 'last12') period = 'year';
    var currentQuarter = quarterBounds(quarterIndex(today));
    var quarter = Number(state && state.quarter);
    if (quarter < 1 || quarter > 4) quarter = currentQuarter.q;
    var month = state && /^\d{4}-\d{2}$/.test(state.month) ? state.month : today.slice(0, 7);
    var range = periodRange('year', year, today);
    if (period === 'last12') {
      range = periodRange('last12', year, today);
    } else if (period === 'quarter') {
      quarter = quarterForYear(year, today);
      range = quarterWindow(year, quarter, today) || periodRange('year', year, today);
    } else if (period === 'month') {
      month = monthForYear(year, today);
      range = monthWindow(month, today) || periodRange('year', year, today);
    }
    var choices = years.map(function (item) {
      return { id: String(item), label: 'FY' + item, shortLabel: 'FY' + item, year: item };
    });
    var eventTypes = [];
    if (state && typeof state.eventTypes !== 'string' && state.eventTypes && state.eventTypes.length) {
      state.eventTypes.forEach(function (type) {
        if (TYPES.indexOf(type) !== -1 && eventTypes.indexOf(type) === -1) eventTypes.push(type);
      });
    } else if (state && TYPES.indexOf(state.eventType) !== -1) {
      eventTypes = [state.eventType];
    }
    var companies = listOf(state && state.companies);
    var people = listOf(state && state.people);
    var audience = state && (state.audience === 'Member' || state.audience === 'Guest') ? state.audience : '';
    return {
      today: today,
      year: year,
      years: years,
      quarter: quarter,
      month: month,
      period: period,
      range: range,
      grouping: groupingOf(period),
      yearEnabled: period !== 'last12',
      stepper: {
        id: String(year),
        label: 'Fiscal year',
        value: 'FY' + year,
        options: choices
      },
      eventType: eventTypes.length === 1 ? eventTypes[0] : '',
      eventTypes: eventTypes,
      companies: companies,
      people: people,
      audience: audience,
      bucket: state && state.bucket ? String(state.bucket) : ''
    };
  }

  function listOf(value) {
    var out = [];
    if (!value || typeof value === 'string') {
      if (value) out.push(String(value));
      return out;
    }
    value.forEach(function (item) {
      var text = String(item || '').trim();
      if (text && out.indexOf(text) === -1) out.push(text);
    });
    return out;
  }

  function copyState(state) {
    return {
      year: state.year,
      quarter: state.quarter,
      month: state.month || '',
      period: state.period,
      eventType: state.eventType || '',
      eventTypes: listOf(state.eventTypes),
      companies: listOf(state.companies),
      people: listOf(state.people),
      audience: state.audience || '',
      bucket: state.bucket || ''
    };
  }

  function syncPeriodSlice(data, state) {
    if (state.period !== 'quarter' && state.period !== 'month') return;
    var today = isISO(data && data.asOf) ? data.asOf : '2026-11-24';
    if (state.period === 'quarter') state.quarter = quarterForYear(state.year, today);
    if (state.period === 'month') state.month = monthForYear(state.year, today);
  }

  function applyAction(data, state, action) {
    var next = copyState(state || defaultState(data));
    action = action || {};
    if (action.type === 'reset') return defaultState(data);
    if (action.type === 'period') {
      next.period = action.period;
      next.bucket = '';
      syncPeriodSlice(data, next);
      return next;
    }
    if (action.type === 'year') {
      if (next.period === 'last12') return next;
      next.year = Number(action.year);
      next.bucket = '';
      syncPeriodSlice(data, next);
      return next;
    }
    if (action.type === 'focus') {
      if (next.period === 'last12') return next;
      next.bucket = '';
      if (action.year) next.year = Number(action.year);
      syncPeriodSlice(data, next);
      return next;
    }
    if (action.type === 'eventType') {
      if (!action.eventType) {
        next.eventTypes = [];
        next.eventType = '';
      } else {
        var types = listOf(next.eventTypes);
        if (!types.length && next.eventType) types = [next.eventType];
        var at = types.indexOf(action.eventType);
        if (at === -1) types.push(action.eventType);
        else types.splice(at, 1);
        next.eventTypes = types;
        next.eventType = '';
      }
      next.bucket = '';
      return next;
    }
    if (action.type === 'companies') {
      next.companies = listOf(action.companies);
      if (next.companies.length && action.allowedPeople) {
        var allowed = {};
        listOf(action.allowedPeople).forEach(function (name) { allowed[name] = true; });
        next.people = listOf(next.people).filter(function (name) { return allowed[name]; });
      }
      next.bucket = '';
      return next;
    }
    if (action.type === 'people') {
      next.people = listOf(action.people);
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
    if (state.quarter) parts.push('quarter=' + Number(state.quarter));
    if (state.month) parts.push('month=' + state.month);
    var hashTypes = listOf(state.eventTypes);
    if (!hashTypes.length && state.eventType) hashTypes = [state.eventType];
    if (hashTypes.length) parts.push('type=' + hashTypes.map(encodeURIComponent).join(','));
    if (state.audience) parts.push('audience=' + encodeURIComponent(state.audience));
    if (listOf(state.companies).length) parts.push('companies=' + listOf(state.companies).map(encodeURIComponent).join(','));
    if (listOf(state.people).length) parts.push('people=' + listOf(state.people).map(encodeURIComponent).join(','));
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
    if (/^[1-4]$/.test(bag.quarter)) state.quarter = Number(bag.quarter);
    if (/^\d{4}-\d{2}$/.test(bag.month)) state.month = bag.month;
    if (bag.period === 'year' || bag.period === 'quarter' || bag.period === 'month' || bag.period === 'last12') {
      state.period = bag.period;
    }
    if (bag.type) {
      var parsedTypes = String(bag.type).split(',').map(function (part) {
        try { return decodeURIComponent(part); } catch (err) { return part; }
      }).filter(function (type) { return TYPES.indexOf(type) !== -1; });
      state.eventTypes = parsedTypes;
      state.eventType = parsedTypes.length === 1 ? parsedTypes[0] : '';
    }
    if (bag.companies) state.companies = String(bag.companies).split(',').map(function (part) {
      try { return decodeURIComponent(part); } catch (err) { return part; }
    }).filter(Boolean);
    if (bag.people) state.people = String(bag.people).split(',').map(function (part) {
      try { return decodeURIComponent(part); } catch (err) { return part; }
    }).filter(Boolean);
    if (bag.audience === 'Member' || bag.audience === 'Guest') state.audience = bag.audience;
    if (bag.bucket && /^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/.test(bag.bucket)) state.bucket = bag.bucket;
    return state;
  }

  function comparisons(range, measure) {
    var lm = shiftRange(range.start, range.end, 1);
    var lq = shiftRange(range.start, range.end, 3);
    var ly = priorYearRange(range.start, range.end);
    return metric(measure(range.start, range.end), measure(lm.start, lm.end), measure(lq.start, lq.end), measure(ly.start, ly.end));
  }

  function dayBefore(value) {
    return addDays(value, -1);
  }

  function stockBoundaries(end) {
    var p = parseISO(end);
    var quarter = quarterBounds(quarterIndex(end));
    var year = fiscalBounds(fiscalYearOf(end));
    return {
      month: dayBefore(iso(p.y, p.m, 1)),
      quarter: dayBefore(quarter.start),
      fy: dayBefore(year.start)
    };
  }

  function priorMonthWindow(end) {
    var p = parseISO(end);
    var start = addMonths(iso(p.y, p.m, 1), -1);
    var sp = parseISO(start);
    return { start: start, end: iso(sp.y, sp.m, Math.min(p.d, daysInMonth(sp.y, sp.m))) };
  }

  function priorQuarterWindow(end) {
    var current = quarterBounds(quarterIndex(end));
    var prev = quarterBounds(quarterIndex(end) - 1);
    var elapsed = inclusiveDays(current.start, end) - 1;
    var stop = addDays(prev.start, elapsed);
    if (stop > prev.end) stop = prev.end;
    return { start: prev.start, end: stop };
  }

  function memberStockComparisons(range, stock) {
    var bounds = stockBoundaries(range.end);
    var result = metric(
      stock(range.start, range.end),
      stock(bounds.month, bounds.month),
      stock(bounds.quarter, bounds.quarter),
      stock(bounds.fy, bounds.fy)
    );
    result.labels = ['Month start', 'Quarter start', 'FY start'];
    return result;
  }

  function memberFlowComparisons(range, flow) {
    var lm = priorMonthWindow(range.end);
    var lq = priorQuarterWindow(range.end);
    var ly = priorYearRange(range.start, range.end);
    var result = metric(
      flow(range.start, range.end),
      flow(lm.start, lm.end),
      flow(lq.start, lq.end),
      flow(ly.start, ly.end)
    );
    result.labels = ['Last month', 'Last quarter', 'Last year'];
    return result;
  }

  function compute(data, state, directory) {
    data = data || {};
    var view = resolveView(data, state || defaultState(data));
    if (directory) view.directory = directory;
    var attendance = attendanceByEvent(data);
    var chartRange = view.range;
    if (view.period === 'month' || view.period === 'quarter') {
      chartRange = periodRange('year', view.year, view.today);
    }
    var buckets = bucketsFor(chartRange, view.grouping);
    var selected = null;
    buckets.forEach(function (bucket) {
      if (bucket.id === view.bucket) selected = bucket;
    });
    var measure = selected ? { start: selected.start, end: selected.end } : view.range;
    var eventTypes = view.eventTypes;
    var pieAudience = view.audience;
    var roster = pieAudience || 'Member';
    var identity = view.companies.length || view.people.length;
    var narrowed = identity && directory && directory.narrow;

    function countEvents(start, end) {
      if (narrowed) return directory.narrow.countEvents(start, end, eventTypes, pieAudience, view);
      return eventsIn(data, start, end, eventTypes, pieAudience, attendance).length;
    }
    function sumAttendance(start, end, audience) {
      if (narrowed) return directory.narrow.sumAttendance(start, end, eventTypes, audience || pieAudience, view);
      return attendanceSum(eventsIn(data, start, end, eventTypes, '', attendance), attendance, audience || pieAudience);
    }
    function memberStock(start, end) {
      if (narrowed) return directory.narrow.stock(end, eventTypes, roster, view);
      return stockAt(data, end, roster, eventTypes);
    }
    function joins(start, end) {
      if (narrowed) return directory.narrow.flow(start, end, eventTypes, roster, view).joins;
      return flowBetween(data, start, end, roster, eventTypes).joins;
    }
    function net(start, end) {
      if (narrowed) return directory.narrow.flow(start, end, eventTypes, roster, view).net;
      return flowBetween(data, start, end, roster, eventTypes).net;
    }

    function flowSpan(start, end) {
      if (narrowed) return directory.narrow.flow(start, end, eventTypes, roster, view);
      return flowBetween(data, start, end, roster, eventTypes);
    }
    var gainSeries = buckets.map(function (bucket) {
      var flow = flowSpan(bucket.start, bucket.end);
      var priorSpan = priorYearRange(bucket.start, bucket.end);
      var prior = flowSpan(priorSpan.start, priorSpan.end);
      return {
        id: bucket.id,
        label: bucket.label,
        joins: flow.joins,
        losses: flow.losses,
        priorJoins: prior.joins,
        priorLosses: prior.losses
      };
    });
    var gainLegend = { current: 'This FY', prior: 'Last FY' };
    if (buckets.length) {
      var legendYear = fiscalYearOf(buckets[0].end);
      var oneYear = buckets.every(function (bucket) { return fiscalYearOf(bucket.end) === legendYear; });
      if (oneYear) gainLegend = { current: 'FY' + legendYear, prior: 'FY' + (legendYear - 1) };
    }
    var lineRange = measure;
    var lineGrouping = 'month';
    if (!selected && (view.period === 'month' || view.period === 'quarter')) {
      lineRange = chartRange;
      lineGrouping = view.grouping;
    }
    var lineBuckets = bucketsFor(lineRange, lineGrouping);
    var eventSeries = lineBuckets.map(function (bucket) {
      return countEvents(bucket.start, bucket.end);
    });
    var eventLastYear = lineBuckets.map(function (bucket) {
      var shifted = priorYearRange(bucket.start, bucket.end);
      return countEvents(shifted.start, shifted.end);
    });
    var attendanceSeries = lineBuckets.map(function (bucket) {
      return sumAttendance(bucket.start, bucket.end);
    });
    var attendanceLastYear = lineBuckets.map(function (bucket) {
      var shifted = priorYearRange(bucket.start, bucket.end);
      return sumAttendance(shifted.start, shifted.end);
    });

    var counted = narrowed
      ? directory.narrow.events(measure.start, measure.end, [], pieAudience, view)
      : eventsIn(data, measure.start, measure.end, '', pieAudience, attendance);
    var typeCounts = { all: counted.length };
    TYPES.forEach(function (type) { typeCounts[type] = 0; });
    counted.forEach(function (event) {
      if (typeCounts[event.type] == null) typeCounts[event.type] = 0;
      typeCounts[event.type] += 1;
    });
    var pieMembers;
    var pieGuests;
    if (narrowed) {
      var pieCounts = directory.narrow.pie(measure.start, measure.end, eventTypes, view);
      pieMembers = pieCounts.Member;
      pieGuests = pieCounts.Guest;
    } else {
      var pieEvents = eventsIn(data, measure.start, measure.end, eventTypes, '', attendance);
      pieMembers = attendanceSum(pieEvents, attendance, 'Member');
      pieGuests = attendanceSum(pieEvents, attendance, 'Guest');
    }
    var pieTotal = pieMembers + pieGuests;
    var memberPct = pieTotal ? Math.round((pieMembers / pieTotal) * 100) : 0;

    return {
      example: data.example === true,
      asOf: view.today,
      year: view.year,
      years: view.years,
      quarter: view.quarter,
      month: view.month,
      stepper: view.stepper,
      period: view.period,
      yearEnabled: view.yearEnabled,
      range: view.range,
      grouping: view.grouping,
      monthBuckets: lineBuckets,
      eventType: view.eventType,
      eventTypes: eventTypes,
      companies: view.companies,
      people: view.people,
      audience: pieAudience,
      bucket: selected ? selected.id : '',
      buckets: buckets,
      eventCounts: typeCounts,
      members: memberStockComparisons(measure, memberStock),
      newMembers: memberFlowComparisons(measure, joins),
      net: memberFlowComparisons(measure, net),
      gains: gainSeries,
      gainLegend: gainLegend,
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
    fiscalYearOf: fiscalYearOf,
    fiscalBounds: fiscalBounds,
    priorYearRange: priorYearRange,
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
