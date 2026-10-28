/* Идэвхжүүлэх цонхны үйлдэл (preload-ийн window.desktop-оор) */
(function () {
  var d = window.desktop;
  var $ = function (id) {
    return document.getElementById(id);
  };
  var msg = $('message');
  var setMsg = function (text, kind) {
    msg.textContent = text || '';
    msg.className = 'message' + (kind ? ' ' + kind : '');
  };
  var STATE_TEXT = {
    expired: 'Лицензийн хугацаа дууссан байна. Шинэ лиценз авч идэвхжүүлнэ үү.',
    machine: 'Хадгалсан лиценз өөр компьютерынх байна.',
    invalid: 'Хадгалсан лиценз хүчингүй байна.',
    clock: 'Компьютерын огноо, цаг буруу байна. Засаад программаа дахин нээнэ үү.',
  };

  function busy(on) {
    $('activate').disabled = on;
    $('file').disabled = on;
  }

  function onResult(r) {
    busy(false);
    if (r && r.ok) {
      setMsg('Амжилттай идэвхжлээ — ' + (r.license && r.license.licensee ? r.license.licensee : '') + '. Программ нээгдэж байна…', 'ok');
      busy(true);
    } else if (r && !r.canceled) {
      setMsg((r && r.message) || 'Идэвхжүүлж чадсангүй', 'error');
    }
  }

  d.license.status().then(function (s) {
    $('machine').textContent = s.machineCode;
    if (s.state !== 'missing' && STATE_TEXT[s.state]) {
      var box = $('state');
      box.textContent = s.message || STATE_TEXT[s.state];
      box.hidden = false;
    }
    if (s.state === 'clock') {
      $('activate').disabled = true;
      $('file').disabled = true;
    }
    try {
      if (localStorage.getItem('school_timetable_2027_v2')) $('export-box').hidden = false;
    } catch (e) {
      /* */
    }
  });

  $('copy').addEventListener('click', function () {
    d.app.copy($('machine').textContent).then(function () {
      $('copy').textContent = 'Хуулсан';
      setTimeout(function () {
        $('copy').textContent = 'Хуулах';
      }, 1500);
    });
  });

  $('activate').addEventListener('click', function () {
    var key = $('key').value.trim();
    if (!key) {
      setMsg('Лицензийн түлхүүрээ буулгана уу', 'error');
      $('key').focus();
      return;
    }
    busy(true);
    setMsg('Шалгаж байна…');
    d.license.activate(key).then(onResult);
  });

  $('file').addEventListener('click', function () {
    busy(true);
    d.license.importFile().then(onResult);
  });

  $('export').addEventListener('click', function () {
    var raw = null;
    try {
      raw = localStorage.getItem('school_timetable_2027_v2');
    } catch (e) {
      /* */
    }
    if (!raw) return;
    var name = 'School_Timetable_2027';
    try {
      var p = JSON.parse(raw);
      name = String(p.projectName || (p.settings && p.settings.schoolName) || name).replace(/[\\/:*?"<>|\s]+/g, '_');
    } catch (e) {
      /* */
    }
    d.app.saveFile(name + '.json', raw).then(function (r) {
      if (r && r.ok) setMsg('Хадгаллаа: ' + r.path, 'ok');
    });
  });

  d.app.info().then(function (info) {
    $('contact').textContent = 'Хувилбар ' + info.version + ' · Лиценз авах бол машины кодоо нийлүүлэгчид илгээнэ үү.';
  });
})();
