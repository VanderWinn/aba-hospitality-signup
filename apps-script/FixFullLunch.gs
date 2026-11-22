/**
 * One-time fix for future "Ambassadors - Full lunch" rows.
 * Does not send email. Safe to run again.
 *
 * For each future Lunch & Learn row still on that old task, add Set-Up,
 * Food Table Host, and Clean-Up for the same person, then mark the original
 * row superseded. Past Nov 19 rows are left as needs-review.
 * Also rewrites Drink Delivery rows' stored time to the template window
 * (2:00–3:00 PM the day before) when it differs.
 */

function isFullLunchTask_(task) {
  var compact = String(task || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*-\s*/g, ' ');
  return compact === 'ambassadors full lunch';
}

function fullLunchPersonKey_(row) {
  var email = String(row.email || '').trim().toLowerCase();
  if (email) return 'e:' + email;
  return 'n:' + String(row.name || '').trim().toLowerCase();
}

function planFullLunchResolution_(signups, slots, today, factories) {
  var makeId = factories && factories.newId ? factories.newId : function () { return 'migration-id'; };
  var makeToken = factories && factories.newToken ? factories.newToken : function () { return 'migrationtokenmigrationtoken1234'; };
  var stamp = factories && factories.stamp ? factories.stamp : function () { return ''; };
  var byId = {};
  (slots || []).forEach(function (slot) { byId[slot.slotId] = slot; });
  var held = {};
  var counts = {};
  (signups || []).forEach(function (row) {
    if (!ABA_RULES.isActive(row)) return;
    held[fullLunchPersonKey_(row) + '|' + row.slotId] = true;
    counts[row.slotId] = (counts[row.slotId] || 0) + 1;
  });
  var roles = ['Set-Up', 'Food Table Host', 'Clean-Up'];
  var creates = [];
  var updates = [];
  var skipped = [];
  var over = [];
  var past = 0;
  var processed = 0;
  (signups || []).forEach(function (row) {
    if (!isFullLunchTask_(row.task)) return;
    var status = String(row.status || '').trim().toLowerCase();
    if (status === 'superseded' || status === 'cancelled') return;
    var parsed = parseSlotId_(row.slotId) || {};
    var date = row.date || parsed.date || '';
    var eventName = row.event || parsed.event || '';
    if (eventName !== 'Lunch & Learn') return;
    if (date < today) {
      past += 1;
      return;
    }
    processed += 1;
    roles.forEach(function (role) {
      var slotId = date + '|Lunch & Learn|' + role;
      var key = fullLunchPersonKey_(row) + '|' + slotId;
      if (held[key]) {
        skipped.push({ name: row.name, date: date, task: role });
        return;
      }
      var slot = byId[slotId];
      var capacity = slot ? Number(slot.capacity) : 0;
      var filled = counts[slotId] || 0;
      if (capacity && filled >= capacity) {
        over.push({ name: row.name, date: date, event: 'Lunch & Learn', task: role, capacity: capacity });
      }
      held[key] = true;
      counts[slotId] = filled + 1;
      creates.push({
        name: row.name,
        email: row.email || '',
        event: 'Lunch & Learn',
        date: date,
        time: slot ? slot.time : '',
        task: role,
        location: slot ? slot.location : (row.location || ''),
        capacity: slot ? slot.capacity : '',
        createdAt: stamp(),
        signupId: makeId(),
        slotId: slotId,
        source: 'migration',
        token: makeToken(),
        status: 'active',
        reminderSent: '',
        updatedAt: '',
        previousSlotId: '',
        sequence: 0,
        oldTask: 'Ambassadors - Full lunch'
      });
    });
    updates.push({ rowNumber: row.rowNumber, fields: { status: 'superseded' } });
  });
  var drinkUpdates = [];
  (signups || []).forEach(function (row) {
    if (row.task !== 'Drink Delivery') return;
    var slot = byId[row.slotId];
    if (!slot) {
      var id = (row.date || '') + '|' + (row.event || '') + '|Drink Delivery';
      slot = byId[id];
    }
    if (!slot || !slot.timeLabel || String(row.time || '') === slot.timeLabel) return;
    drinkUpdates.push({
      rowNumber: row.rowNumber,
      fields: { time: slot.timeLabel },
      name: row.name,
      date: row.date
    });
  });
  return {
    creates: creates,
    updates: updates,
    skipped: skipped,
    overCapacity: over,
    drinkUpdates: drinkUpdates,
    processed: processed,
    pastUntouched: past
  };
}

function fullLunchSummary_(plan) {
  var over = plan.overCapacity.length
    ? plan.overCapacity.map(function (row) {
      return row.date + ' Lunch & Learn ' + row.task + ' (capacity ' + row.capacity + ', adding ' + row.name + ')';
    }).join('; ')
    : 'none';
  return 'Resolved ' + plan.processed + ' Ambassadors - Full lunch rows. Created ' + plan.creates.length +
    ' sign-ups. Skipped ' + plan.skipped.length + ' roles already held. Over capacity: ' + over +
    '. Left ' + plan.pastUntouched + ' past rows unchanged. Updated ' + plan.drinkUpdates.length +
    ' Drink Delivery time' + (plan.drinkUpdates.length === 1 ? '' : 's') + ' to 2:00–3:00 PM the day before.';
}

function resolveFullLunchV3() {
  var state = readState_();
  var today = ABA_RULES.todayKeyIn(new Date(), 'America/New_York');
  var plan = planFullLunchResolution_(state.signups, state.slots, today, {
    newId: function () { return Utilities.getUuid(); },
    newToken: function () { return newToken_(); },
    stamp: function () { return ABA_RULES.stamp(new Date()); }
  });
  plan.creates.forEach(function (row) { appendSignup_(row); });
  plan.updates.forEach(function (change) { updateSignup_(change.rowNumber, change.fields); });
  plan.drinkUpdates.forEach(function (change) { updateSignup_(change.rowNumber, change.fields); });
  SpreadsheetApp.flush();
  var summary = fullLunchSummary_(plan);
  Logger.log(summary);
  try { SpreadsheetApp.getUi().alert(summary); } catch (err) {}
  return summary;
}
