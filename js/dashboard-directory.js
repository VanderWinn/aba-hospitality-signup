/* Fake example people for the placeholder dashboard. Real names, emails, and
   phone numbers are never stored here. Emails and phones are added only when
   an attendance drill-down is opened. */
(function (root) {
  'use strict';

  var COMPANIES = [
    'Ada River Cafe',
    'Brookside Bakery',
    'Cedar & Co.',
    'Driftwood Dental',
    'Elm Street Books',
    'Fulton Fitness',
    'Garden Gate Nursery',
    'Harbor Light Inn',
    'Iris Studio',
    'Juniper Goods'
  ];
  var GUEST_COMPANY = 'Visitor Co.';
  var FIRST = ['Avery', 'Blake', 'Casey', 'Drew', 'Ellis', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jules', 'Kai', 'Logan', 'Morgan', 'Noah', 'Oakley', 'Parker', 'Quinn', 'Riley', 'Sage', 'Taylor'];
  var LAST = ['Sample', 'Placeholder', 'Example', 'Demo', 'Fictitious', 'Mock', 'Testcase', 'Notreal', 'Standin', 'Imaginary', 'Specimen', 'Prototype'];

  function personName(index) {
    var size = FIRST.length * LAST.length;
    var cycle = Math.floor(index / size);
    var first = FIRST[index % FIRST.length];
    var last = LAST[Math.floor(index / FIRST.length) % LAST.length];
    return cycle ? first + ' ' + last + ' ' + (cycle + 1) : first + ' ' + last;
  }

  function phoneOf(index) {
    var n = 1000 + (index % 8000);
    return '555-' + n;
  }

  function emailOf(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') + '@example.com';
  }

  function typeOk(value, types) {
    if (!types || !types.length) return true;
    var i;
    for (i = 0; i < types.length; i++) if (types[i] === value) return true;
    return false;
  }

  function identityOk(row, view) {
    var companies = view.companies || [];
    var people = view.people || [];
    var query = String(view.nameQuery || '').toLowerCase();
    if (companies.length && companies.indexOf(row.company) === -1) return false;
    if (people.length && people.indexOf(row.name) === -1) return false;
    if (query && String(row.name || '').toLowerCase().indexOf(query) === -1) return false;
    return true;
  }

  function build(source) {
    var people = [];
    var seq = 0;
    var companyCursor = 0;
    function memberCompany() {
      var name = COMPANIES[companyCursor % COMPANIES.length];
      companyCursor += 1;
      return name;
    }
    function addPerson(audience, eventType, joined) {
      var company = audience === 'Member' ? memberCompany() : (seq % 3 === 0 ? GUEST_COMPANY : memberCompany());
      var person = {
        name: personName(seq),
        company: company,
        audience: audience,
        eventType: eventType,
        joined: joined,
        lost: ''
      };
      seq += 1;
      people.push(person);
      return person;
    }
    (source.openings || []).forEach(function (row) {
      var i;
      for (i = 0; i < row.count; i++) addPerson(row.audience, row.eventType, row.date);
    });
    var changes = (source.changes || []).slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
    changes.forEach(function (row) {
      var i;
      for (i = 0; i < row.joins; i++) addPerson(row.audience, row.eventType, row.date);
      for (i = 0; i < row.losses; i++) {
        var victim = null;
        people.forEach(function (person) {
          if (victim) return;
          if (person.audience !== row.audience || person.eventType !== row.eventType) return;
          if (person.lost || person.joined > row.date) return;
          victim = person;
        });
        if (victim) victim.lost = row.date;
      }
    });

    var members = people.filter(function (person) { return person.audience === 'Member'; });
    var guests = [];
    var g;
    for (g = 0; g < 24; g++) {
      guests.push({
        name: personName(seq),
        company: g % 4 === 0 ? GUEST_COMPANY : COMPANIES[g % COMPANIES.length],
        audience: 'Guest'
      });
      seq += 1;
    }
    var attendance = [];
    var memberCursor = 0;
    var guestCursor = 0;
    var visit = 0;
    (source.events || []).forEach(function (event) {
      var memberCount = 0;
      var guestCount = 0;
      (source.attendance || []).forEach(function (row) {
        if (row.eventId !== event.id) return;
        if (row.audience === 'Member') memberCount += row.count;
        if (row.audience === 'Guest') guestCount += row.count;
      });
      var i;
      for (i = 0; i < memberCount; i++) {
        var member = members[memberCursor % members.length];
        memberCursor += 1;
        visit += 1;
        attendance.push({
          name: member.name,
          company: member.company,
          audience: 'Member',
          event: event.type,
          eventType: event.type,
          eventId: event.id,
          date: event.date
        });
      }
      for (i = 0; i < guestCount; i++) {
        var guest = guests[guestCursor % guests.length];
        guestCursor += 1;
        visit += 1;
        attendance.push({
          name: guest.name,
          company: guest.company,
          audience: 'Guest',
          event: event.type,
          eventType: event.type,
          eventId: event.id,
          date: event.date
        });
      }
    });

    var directoryPeople = [];
    var seen = {};
    function remember(person) {
      if (!person || !person.name || seen[person.name]) return;
      seen[person.name] = true;
      directoryPeople.push({ name: person.name, company: person.company || '', audience: person.audience || '' });
    }
    people.forEach(remember);
    guests.forEach(remember);
    directoryPeople.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });

    return {
      companies: COMPANIES.slice(),
      guestCompany: GUEST_COMPANY,
      people: directoryPeople,
      membership: people,
      attendance: attendance,
      narrow: narrow
    };
  }

  function peopleForCompanies(directory, companies) {
    var selected = companies || [];
    return (directory.people || []).filter(function (person) {
      if (!selected.length) return true;
      return selected.indexOf(person.company) !== -1;
    });
  }

  var ALLOWED = { 'Lunch & Learn': true, 'Ribbon Cutting': true, 'Happy Hour': true };

  function countedVisit(row) {
    if (row.eventType && !ALLOWED[row.eventType]) return false;
    if (row.status && String(row.status).toLowerCase() !== 'attended') return false;
    return true;
  }

  function attendanceRows(directory, start, end, eventTypes, audience, view) {
    return (directory.attendance || []).filter(function (row) {
      if (!countedVisit(row)) return false;
      if (row.date < start || row.date > end) return false;
      if (!typeOk(row.eventType, eventTypes)) return false;
      if (audience && row.audience !== audience) return false;
      if (view && !identityOk(row, view)) return false;
      return true;
    });
  }

  function liveMembershipOk(person, view) {
    if ((view.companies || []).length && view.companies.indexOf(person.company) === -1) return false;
    var selected = view.people || [];
    var query = String(view.nameQuery || '').toLowerCase();
    if (!selected.length && !query) return true;
    var wanted = {};
    (view.directory.people || []).forEach(function (entry) {
      var named = selected.indexOf(entry.name) !== -1;
      var queried = query && String(entry.name || '').toLowerCase().indexOf(query) !== -1;
      if (named || queried) wanted[entry.company] = true;
    });
    return !!wanted[person.company];
  }

  var narrow = {
    countEvents: function (start, end, eventTypes, audience, view) {
      var ids = {};
      attendanceRows(view.directory, start, end, eventTypes, audience, view).forEach(function (row) {
        ids[row.eventId] = true;
      });
      return Object.keys(ids).length;
    },
    sumAttendance: function (start, end, eventTypes, audience, view) {
      return attendanceRows(view.directory, start, end, eventTypes, audience, view).length;
    },
    events: function (start, end, eventTypes, audience, view) {
      var map = {};
      attendanceRows(view.directory, start, end, eventTypes, audience, view).forEach(function (row) {
        if (!map[row.eventId]) {
          map[row.eventId] = { id: row.eventId, date: row.date, type: row.eventType, name: row.event };
        }
      });
      return Object.keys(map).map(function (id) { return map[id]; });
    },
    pie: function (start, end, eventTypes, view) {
      var rows = attendanceRows(view.directory, start, end, eventTypes, '', view);
      var counts = { Member: 0, Guest: 0 };
      rows.forEach(function (row) {
        if (counts[row.audience] != null) counts[row.audience] += 1;
      });
      return counts;
    },
    stock: function (end, eventTypes, audience, view) {
      var total = 0;
      var live = view.directory && view.directory.live;
      (view.directory.membership || []).forEach(function (person) {
        if (audience && person.audience !== audience) return;
        if (!live && !typeOk(person.eventType, eventTypes)) return;
        if (person.joined > end) return;
        if (person.lost && person.lost <= end) return;
        if (live ? !liveMembershipOk(person, view) : !identityOk(person, view)) return;
        total += 1;
      });
      return total;
    },
    flow: function (start, end, eventTypes, audience, view) {
      var joins = 0;
      var losses = 0;
      var live = view.directory && view.directory.live;
      (view.directory.membership || []).forEach(function (person) {
        if (audience && person.audience !== audience) return;
        if (!live && !typeOk(person.eventType, eventTypes)) return;
        if (live ? !liveMembershipOk(person, view) : !identityOk(person, view)) return;
        if (person.joined >= start && person.joined <= end) joins += 1;
        if (person.lost && person.lost >= start && person.lost <= end) losses += 1;
      });
      return { joins: joins, losses: losses, net: joins - losses };
    }
  };

  function withContacts(rows) {
    return (rows || []).map(function (row, index) {
      return {
        name: row.name,
        audience: row.audience,
        event: row.event,
        date: row.date,
        email: emailOf(row.name),
        phone: phoneOf(index + 1),
        company: row.company || '',
        notes: 'Example visit'
      };
    });
  }

  function drill(directory, kind, view) {
    var range = view.measure || view.range;
    var eventTypes = view.eventTypes || [];
    var audience = view.audience || '';
    var roster = audience || 'Member';
    if (kind === 'attendance') {
      var found = attendanceRows(directory, range.start, range.end, eventTypes, audience, view);
      var rows = directory.live ? found : withContacts(found);
      return {
        title: 'Attendance',
        kind: kind,
        columns: columnList(rows, ['name', 'audience', 'event', 'date', 'email', 'phone']),
        rows: rows
      };
    }
    if (kind === 'events') {
      var map = {};
      attendanceRows(directory, range.start, range.end, eventTypes, audience, view).forEach(function (row) {
        if (!map[row.eventId]) {
          map[row.eventId] = { event: row.event, type: row.eventType, date: row.date, attendance: 0 };
        }
        map[row.eventId].attendance += 1;
      });
      var eventRows = Object.keys(map).map(function (id) { return map[id]; });
      eventRows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      return {
        title: 'Events Held',
        kind: kind,
        columns: [
          { key: 'event', label: 'Event' },
          { key: 'type', label: 'Type' },
          { key: 'date', label: 'Date' },
          { key: 'attendance', label: 'Attendance count' }
        ],
        rows: eventRows
      };
    }
    var status = kind === 'newMembers' ? 'new' : (kind === 'members' ? 'member' : 'changes');
    var memberRows = [];
    (directory.membership || []).forEach(function (person) {
      if (person.audience !== roster) return;
      if (directory.live) {
        if (!liveMembershipOk(person, view)) return;
      } else if (!identityOk(person, view)) return;
      if (status === 'member') {
        if (person.joined > range.end) return;
        if (person.lost && person.lost <= range.end) return;
        memberRows.push({ name: person.name, company: person.company, status: 'member', date: person.joined });
      } else if (status === 'new') {
        if (person.joined < range.start || person.joined > range.end) return;
        memberRows.push({ name: person.name, company: person.company, status: 'new', date: person.joined });
      } else {
        if (person.joined >= range.start && person.joined <= range.end) {
          memberRows.push({ name: person.name, company: person.company, status: 'new', date: person.joined });
        }
        if (person.lost && person.lost >= range.start && person.lost <= range.end) {
          memberRows.push({ name: person.name, company: person.company, status: 'lost', date: person.lost });
        }
      }
    });
    var titles = { members: 'Members', newMembers: 'New Members', changes: 'Membership records' };
    return {
      title: titles[kind] || 'Membership',
      kind: kind,
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'company', label: 'Company' },
        { key: 'status', label: 'Status' },
        { key: 'date', label: 'Date' }
      ],
      rows: memberRows
    };
  }

  function columnList(rows, preferred) {
    var labels = {
      name: 'Name',
      audience: 'Member or Guest',
      event: 'Event',
      date: 'Date',
      email: 'Email',
      phone: 'Phone',
      company: 'Company',
      notes: 'Notes'
    };
    var seen = {};
    var keys = [];
    preferred.forEach(function (key) {
      seen[key] = true;
      keys.push(key);
    });
    (rows || []).forEach(function (row) {
      Object.keys(row).forEach(function (key) {
        if (seen[key]) return;
        seen[key] = true;
        keys.push(key);
      });
    });
    return keys.map(function (key) {
      var label = labels[key] || key.replace(/_/g, ' ');
      return { key: key, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }

  function queryRows(rows, columns, query, sortKey, dir) {
    var q = String(query || '').toLowerCase();
    var list = (rows || []).filter(function (row) {
      if (!q) return true;
      var i;
      for (i = 0; i < columns.length; i++) {
        if (String(row[columns[i].key] == null ? '' : row[columns[i].key]).toLowerCase().indexOf(q) !== -1) return true;
      }
      return false;
    });
    var key = sortKey || 'date';
    var direction = dir === 'desc' ? -1 : 1;
    list.sort(function (a, b) {
      var av = a[key] == null ? '' : a[key];
      var bv = b[key] == null ? '' : b[key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
      if (av < bv) return -1 * direction;
      if (av > bv) return 1 * direction;
      return 0;
    });
    return list;
  }

  function suggestions(directory, text, companies) {
    var q = String(text || '').toLowerCase().trim();
    if (!q) return { people: [], companies: [] };
    var people = peopleForCompanies(directory, companies).filter(function (person) {
      return person.name.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 6);
    var companyHits = (directory.companies || []).filter(function (name) {
      return name.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 6);
    return { people: people, companies: companyHits };
  }

  function fromLive(payload) {
    payload = payload || {};
    var attendance = [];
    (payload.attendanceRecords || []).forEach(function (row) {
      var type = ALLOWED[row.eventType] ? row.eventType : '';
      if (!type) return;
      var date = String(row.date || row.event_date || '').slice(0, 10);
      var name = String(row.name || '').trim();
      if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      var copy = {};
      Object.keys(row).forEach(function (key) { copy[key] = row[key]; });
      copy.name = name;
      copy.date = date;
      copy.eventType = type;
      copy.event = row.event || row.event_name || type;
      copy.eventId = String(row.eventId || row.event_id || '');
      copy.audience = row.audience || '';
      copy.company = row.company || '';
      copy.status = String(row.status || '').toLowerCase();
      attendance.push(copy);
    });
    var seen = {};
    var people = [];
    attendance.forEach(function (row) {
      var key = row.name + '|' + row.company;
      if (seen[key]) return;
      seen[key] = true;
      people.push({ name: row.name, company: row.company, audience: row.audience });
    });
    people.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    var membership = (payload.roster || []).map(function (row) {
      var company = String(row.company || '').trim();
      if (!company) return null;
      var deactivated = String(row.status || '').toLowerCase() === 'deactivated';
      return {
        name: '',
        company: company,
        audience: 'Member',
        eventType: '',
        joined: row.joinDate || row.join_date || '2011-12-31',
        lost: deactivated ? (row.lostDate || row.lost_date || '2026-06-30') : ''
      };
    }).filter(Boolean);
    var companies = (payload.companies || []).slice();
    if (!companies.length) {
      membership.forEach(function (row) {
        if (!row.lost && companies.indexOf(row.company) === -1) companies.push(row.company);
      });
      companies.sort();
    }
    return {
      companies: companies,
      guestCompany: '',
      people: people,
      membership: membership,
      attendance: attendance,
      live: true,
      narrow: narrow
    };
  }

  root.ABADirectory = {
    COMPANIES: COMPANIES,
    build: build,
    fromLive: fromLive,
    peopleForCompanies: peopleForCompanies,
    attendanceRows: attendanceRows,
    withContacts: withContacts,
    drill: drill,
    queryRows: queryRows,
    suggestions: suggestions,
    narrow: narrow,
    emailOf: emailOf,
    phoneOf: phoneOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
