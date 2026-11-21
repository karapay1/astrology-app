/*
 * Compatibility engine for compatibility.html.
 * Pure logic and copy, no DOM, so it runs in the browser (window.VEDIC_COMPAT)
 * and in Node (module.exports) for `node scripts/lint-copy.js --compat`.
 *
 *   buildReport(chartA, chartB, rel)   rel = "partners" | "friends" | "family"
 *
 * Copy rules: same as CHART-GUIDE.md §4 (no em dashes, no banned words, no
 * contrast reveals). The lint checks every generated string for all pairs.
 */
(function (root) {
  "use strict";

  // ─── basics ────────────────────────────────────────────────────────────────
  var SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
  var SIGN_LORD = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
    "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"];
  var SIGN_ELEMENT = ["Fire", "Earth", "Air", "Water", "Fire", "Earth",
    "Air", "Water", "Fire", "Earth", "Air", "Water"];
  var PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
  var NAKSHATRAS = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula",
    "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];

  var REL = {
    partners: { label: "Partners", focus: [7, 5, 1, 4, 8, 12] },
    friends:  { label: "Friends",  focus: [11, 3, 5, 1, 9] },
    family:   { label: "Family",   focus: [4, 9, 5, 1, 2, 3] },
  };

  function signIndex(s) { return SIGNS.indexOf(s); }
  function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function fill(t, map) { return t.replace(/\{(\w+)\}/g, function (m, k) { return k in map ? map[k] : m; }); }
  function poss(name) { return name + "’s"; }

  // "16° 45'" in Leo -> 136.75
  function longitude(p) {
    var m = /(\d+)\D+(\d+)/.exec(p.degree || "");
    var d = m ? +m[1] + +m[2] / 60 : 15;
    return signIndex(p.sign) * 30 + d;
  }
  function planet(chart, name) {
    return (chart.planets || []).filter(function (p) { return p.name === name; })[0];
  }

  function birthDate(chart) {
    var d = chart.birth && Date.parse(chart.birth.date);
    return isNaN(d) ? null : new Date(d);
  }
  function isMinor(chart, today) {
    var b = birthDate(chart); if (!b) return false;
    var t = today || new Date();
    var age = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--;
    return age < 18;
  }

  // ─── house names ───────────────────────────────────────────────────────────
  var HOUSE = {
    1: "self", 2: "money and voice", 3: "courage and communication", 4: "home and family",
    5: "creativity and play", 6: "daily work and health", 7: "partnership", 8: "depth and change",
    9: "luck and beliefs", 10: "career and public life", 11: "friends and gains", 12: "rest and solitude",
  };
  function houseName(h, rel) { return h === 5 && rel === "partners" ? "romance and creativity" : HOUSE[h]; }

  function houseOf(p, chart) {
    return ((signIndex(p.sign) - signIndex(chart.ascendant.sign) + 12) % 12) + 1;
  }

  // Chart ruler, luck planet and busiest house, worked out the same way as the
  // chart guide: luck = planet ruling a kendra (4, 7, 10) and a trikona (5, 9),
  // otherwise the 9th lord.
  function keyPlanets(chart) {
    var ps = (chart.planets || []).filter(function (p) { return PLANETS.indexOf(p.name) >= 0; });
    var owns = function (p, hs) { return (p.housesOwned || []).some(function (h) { return hs.indexOf(h) >= 0; }); };
    var ruler = ps.filter(function (p) { return owns(p, [1]); })[0];
    var luck = ps.filter(function (p) { return owns(p, [4, 7, 10]) && owns(p, [5, 9]); })[0] ||
      ps.filter(function (p) { return owns(p, [9]); })[0];
    var busiest = null;
    (chart.houses || []).forEach(function (h) {
      var n = (h.occupants || []).length;
      if (n >= 3 && (!busiest || n > busiest.count)) busiest = { house: h.num, count: n };
    });
    return { ruler: ruler, luck: luck, busiest: busiest };
  }

  // ─── Ashtakoota (the traditional Moon match) ──────────────────────────────
  // Varna by Moon sign: 3 = Brahmin, 2 = Kshatriya, 1 = Vaishya, 0 = Shudra
  var VARNA = [2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0, 3];
  // Vashya groups: 0 quadruped, 1 human, 2 water, 3 wild, 4 insect
  function vashyaGroup(sign, deg) {
    switch (sign) {
      case 0: case 1: return 0;
      case 2: case 5: case 6: case 10: return 1;
      case 3: case 11: return 2;
      case 4: return 3;
      case 7: return 4;
      case 8: return deg < 15 ? 1 : 0;
      case 9: return deg < 15 ? 0 : 2;
    }
  }
  var VASHYA = [
    [2, 1, 1, 0.5, 1],
    [1, 2, 0.5, 0, 1],
    [1, 0.5, 2, 1, 1],
    [0.5, 0, 1, 2, 0],
    [1, 1, 1, 0, 2],
  ];
  var YONI_ANIMAL = ["Horse", "Elephant", "Sheep", "Serpent", "Serpent", "Dog", "Cat", "Sheep",
    "Cat", "Rat", "Rat", "Cow", "Buffalo", "Tiger", "Buffalo", "Tiger", "Deer", "Deer", "Dog",
    "Monkey", "Mongoose", "Monkey", "Lion", "Horse", "Lion", "Cow", "Elephant"];
  var ANIMALS = ["Horse", "Elephant", "Sheep", "Serpent", "Dog", "Cat", "Rat", "Cow",
    "Buffalo", "Tiger", "Deer", "Monkey", "Mongoose", "Lion"];
  var YONI = [
    [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1],
    [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
    [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
    [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
    [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
    [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
    [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
    [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
    [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
    [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1],
    [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1],
    [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
    [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2],
    [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
  ];
  // Natural planet friendships: 2 friend, 1 neutral, 0 enemy
  var FRIENDS = {
    Sun:     { Moon: 2, Mars: 2, Jupiter: 2, Mercury: 1, Venus: 0, Saturn: 0 },
    Moon:    { Sun: 2, Mercury: 2, Mars: 1, Jupiter: 1, Venus: 1, Saturn: 1 },
    Mars:    { Sun: 2, Moon: 2, Jupiter: 2, Venus: 1, Saturn: 1, Mercury: 0 },
    Mercury: { Sun: 2, Venus: 2, Mars: 1, Jupiter: 1, Saturn: 1, Moon: 0 },
    Jupiter: { Sun: 2, Moon: 2, Mars: 2, Saturn: 1, Mercury: 0, Venus: 0 },
    Venus:   { Mercury: 2, Saturn: 2, Mars: 1, Jupiter: 1, Sun: 0, Moon: 0 },
    Saturn:  { Mercury: 2, Venus: 2, Jupiter: 1, Sun: 0, Moon: 0, Mars: 0 },
  };
  var GANA = ["Deva", "Manushya", "Rakshasa", "Manushya", "Deva", "Manushya", "Deva", "Deva",
    "Rakshasa", "Rakshasa", "Manushya", "Manushya", "Deva", "Rakshasa", "Deva", "Rakshasa",
    "Deva", "Rakshasa", "Rakshasa", "Manushya", "Manushya", "Deva", "Rakshasa", "Rakshasa",
    "Manushya", "Manushya", "Deva"];
  var GANA_WORD = { Deva: "gentle", Manushya: "practical", Rakshasa: "intense" };
  // Traditional table, rows = groom, cols = bride (Deva, Manushya, Rakshasa)
  var GANA_PTS = [[6, 6, 1], [5, 6, 0], [1, 0, 6]];
  var GANAS = ["Deva", "Manushya", "Rakshasa"];

  function moonInfo(chart) {
    var m = planet(chart, "Moon");
    var lon = longitude(m);
    var sign = Math.floor(lon / 30);
    var nak = Math.floor(lon * 3 / 40) % 27;
    return {
      sign: sign, signName: SIGNS[sign], deg: lon - sign * 30, nak: nak,
      nakName: (chart.nakshatra && chart.nakshatra.name) || NAKSHATRAS[nak],
      lord: SIGN_LORD[sign], gana: GANA[nak], animal: YONI_ANIMAL[nak],
      nadi: [0, 1, 2, 2, 1, 0][nak % 6],
    };
  }

  function grahaMaitri(la, lb) {
    if (la === lb) return 5;
    var a = FRIENDS[la][lb], b = FRIENDS[lb][la];
    var key = Math.max(a, b) + "" + Math.min(a, b);
    return { "22": 5, "21": 4, "11": 3, "20": 1, "10": 0.5, "00": 0 }[key];
  }

  function taraOneWay(from, to) {
    var n = ((to - from + 27) % 27) + 1;
    return [3, 5, 7].indexOf(n % 9) >= 0 ? 0 : 1.5;
  }

  function ashtakoota(a, b, rel) {
    var rows = [];
    var full = rel === "partners";
    var NADI = ["front", "middle", "back"];

    if (full) {
      var varna = VARNA[a.sign] === VARNA[b.sign] ? 1 : 0.5;
      rows.push({ key: "varna", label: "Outlook", term: "Varna", points: varna, max: 1,
        line: varna === 1
          ? "Your Moon signs belong to the same traditional group, so you approach duty and work in a similar way."
          : "Your Moon signs belong to different traditional groups. Scored both ways round, that comes to half a point." });

      var ga = vashyaGroup(a.sign, a.deg), gb = vashyaGroup(b.sign, b.deg);
      var vashya = (VASHYA[ga][gb] + VASHYA[gb][ga]) / 2;
      rows.push({ key: "vashya", label: "Pull", term: "Vashya", points: vashya, max: 2,
        line: vashya === 2 ? "Your Moon signs sit in the same group, so neither of you tries to steer the other."
          : vashya >= 1 ? "Your Moon signs get on, and one of you tends to take the lead."
          : "Your Moon signs come from groups that don't sit easily together, so you may disagree about who leads." });
    }

    var tara = taraOneWay(a.nak, b.nak) + taraOneWay(b.nak, a.nak);
    rows.push({ key: "tara", label: "Wellbeing", term: "Tara", points: tara, max: 3,
      line: tara === 3 ? "Counting from each birth star to the other lands on a good number both ways, a sign that you're good for each other's wellbeing."
        : tara > 0 ? "The count between your birth stars works one way and fails the other, so one of you gets more ease from the bond than the other."
        : "The count between your birth stars fails both ways, so the bond can wear you both down at times." });

    if (full) {
      var yoni = YONI[ANIMALS.indexOf(a.animal)][ANIMALS.indexOf(b.animal)];
      var pair = a.animal === b.animal ? "Both your birth stars are the " + a.animal
        : "Your birth star animals are the " + a.animal + " and the " + b.animal;
      rows.push({ key: "yoni", label: "Physical match", term: "Yoni", points: yoni, max: 4,
        line: pair + ". " + [
          "They are natural enemies, the weakest physical match in this check.",
          "They are wary of each other, so your physical rhythms take some adjusting.",
          "They are neutral to each other, an average physical match.",
          "They are friendly, an easy physical match.",
          "That's the best physical match this check gives.",
        ][yoni] });
    }

    var gm = grahaMaitri(a.lord, b.lord);
    var lords = a.lord === b.lord ? null : a.lord + " and " + b.lord;
    rows.push({ key: "maitri", label: "Friendship", term: "Graha Maitri", points: gm, max: 5,
      line: !lords ? "Both your Moon signs are ruled by " + a.lord + ", so your minds work alike and you like each other easily."
        : gm === 5 ? "Your Moon signs are ruled by " + lords + ", which are friends. You see the world in a similar way and like each other easily."
        : gm === 4 ? "Your Moon signs are ruled by " + lords + ", which are on good terms. You like each other easily, with small differences in outlook."
        : gm === 3 ? "Your Moon signs are ruled by " + lords + ", which are neutral to each other. Liking grows with time."
        : gm > 0 ? "Your Moon signs are ruled by " + lords + ", which don't get along. You see things differently and need patience with each other's views."
        : "Your Moon signs are ruled by " + lords + ", which are enemies, the weakest result here. You see the world in different ways." });

    var gi = GANAS.indexOf(a.gana), gj = GANAS.indexOf(b.gana);
    var gana = (GANA_PTS[gi][gj] + GANA_PTS[gj][gi]) / 2;
    var wa = GANA_WORD[a.gana], wb = GANA_WORD[b.gana];
    var an = function (w) { return (/^[aeiou]/.test(w) ? "an " : "a ") + w; };
    rows.push({ key: "gana", label: "Temperament", term: "Gana", points: gana, max: 6,
      line: a.gana === b.gana ? "You share " + an(wa) + " temperament (" + a.gana + "), so you react to life in similar ways."
        : gana >= 5 ? "One of you has " + an(wa) + " temperament and the other " + an(wb) + " one. The mix works well."
        : gana >= 1 ? "One of you has " + an(wa) + " temperament and the other " + an(wb) + " one. Your instincts clash, so say what you mean."
        : "One of you has " + an(wa) + " temperament and the other " + an(wb) + " one, the hardest mix in this check. Expect different reactions to the same event." });

    var n = ((b.sign - a.sign + 12) % 12) + 1, m = ((a.sign - b.sign + 12) % 12) + 1;
    var lo = Math.min(n, m), hi = Math.max(n, m);
    var good = (lo === 1 && hi === 1) || (lo === 7) || (lo === 3 && hi === 11) || (lo === 4 && hi === 10);
    var bhakoot = good ? 7 : 0, line;
    if (lo === 1) line = "Your Moons share a sign, so your emotional needs are close.";
    else if (lo === 7) line = "Your Moons sit in opposite signs, and you balance each other out.";
    else if (good) line = "Your Moons sit " + lo + " and " + hi + " signs apart, a steady placement that supports a long bond.";
    else if (lo === 2) line = "Your Moons sit in neighbouring signs. The traditional reading links this to differing priorities, often over money.";
    else if (lo === 5) line = full
      ? "Your Moons sit 5 and 9 signs apart. The marriage score counts this against you, though outside marriage it reads as warm and easy."
      : "Your Moons sit 5 and 9 signs apart. The traditional score marks this down with marriage in mind. Between friends and family it reads as warm and easy.";
    else line = "Your Moons sit 6 and 8 signs apart, the hardest placement in this check. Emotional needs clash, and small things can turn into big ones.";
    if (!good && gm === 5) {
      bhakoot = 7;
      line += " The usual exception applies here: your Moon signs' rulers are friends, so the full points come back.";
    }
    rows.push({ key: "bhakoot", label: "Moon distance", term: "Bhakoot", points: bhakoot, max: 7, line: line, fiveNine: lo === 5 });

    if (full) {
      var nadi = a.nadi === b.nadi ? 0 : 8;
      rows.push({ key: "nadi", label: "Health and children", term: "Nadi", points: nadi, max: 8,
        line: nadi ? "Your birth stars sit in different groups (" + NADI[a.nadi] + " and " + NADI[b.nadi] + "), which scores full marks."
          : "Your birth stars sit in the same group (" + NADI[a.nadi] + "), which the marriage score treats as its biggest single flaw. Traditionally it concerns health and children." });
    }

    var total = rows.reduce(function (s, r) { return s + r.points; }, 0);
    var max = rows.reduce(function (s, r) { return s + r.max; }, 0);
    return { rows: rows, total: total, max: max };
  }

  // ─── planet contacts with real orbs ───────────────────────────────────────
  var ASPECTS = [
    { type: "conj", angle: 0,   orb: 8, kind: "blend",   label: "conjunct", weight: 1 },
    { type: "opp",  angle: 180, orb: 7, kind: "tension", label: "opposite", weight: 0.9 },
    { type: "tri",  angle: 120, orb: 6, kind: "flow",    label: "trine",    weight: 0.9 },
    { type: "sq",   angle: 90,  orb: 5, kind: "tension", label: "square",   weight: 0.85 },
    { type: "sxt",  angle: 60,  orb: 4, kind: "flow",    label: "sextile",  weight: 0.7 },
  ];
  var PLANET_WEIGHT = {
    partners: { Sun: 3, Moon: 3, Mercury: 1, Venus: 2.5, Mars: 2.5, Jupiter: 1.5, Saturn: 1.5 },
    friends:  { Sun: 3, Moon: 2.5, Mercury: 2, Venus: 2, Mars: 1.5, Jupiter: 2, Saturn: 1.5 },
    family:   { Sun: 3, Moon: 3, Mercury: 1.5, Venus: 1.5, Mars: 1.5, Jupiter: 2, Saturn: 2 },
  };
  var THEME = { Sun: "sense of purpose", Moon: "moods", Mercury: "ideas", Venus: "affection",
    Mars: "drive", Jupiter: "encouragement", Saturn: "sense of duty" };

  function findAspect(lonA, lonB) {
    var d = Math.abs(lonA - lonB) % 360; if (d > 180) d = 360 - d;
    for (var i = 0; i < ASPECTS.length; i++) {
      var asp = ASPECTS[i], off = Math.abs(d - asp.angle);
      if (off <= asp.orb) return { asp: asp, off: off };
    }
    return null;
  }

  // Pair readings. Key is canonical order; {X} owns the first planet, {Y} the second.
  var PAIR = {
    "Sun|Sun": {
      blend: "Your Suns sit together, so you want similar things from life and recognise each other quickly. You can also compete for the same spotlight.",
      flow: "Your Suns support each other. You respect each other's goals and find it easy to back them.",
      tension: "Your Suns pull in different directions, so you want different things from life. Respect for the other person's path keeps this from turning into a contest." },
    "Sun|Moon": {
      blend: "{X}'s Sun sits on {Y}'s Moon, one of the classic signs of a close bond. {Y} feels understood by {X}, and {X} feels supported by {Y}.",
      flow: "{X}'s Sun and {Y}'s Moon work together easily. What {X} wants and what {Y} needs line up, so daily life together runs smoothly.",
      tension: "{X}'s Sun and {Y}'s Moon are at odds. {X}'s plans can unsettle {Y}'s moods, so check in with each other before big decisions." },
    "Sun|Mercury": {
      blend: "{Y}'s Mercury sits on {X}'s Sun, so {Y} gets {X}'s ideas quickly and can put them into words. You plan well together.",
      flow: "{Y}'s thinking supports {X}'s goals, which makes {Y} a good sounding board for {X}.",
      tension: "{Y}'s opinions can rub against {X}'s sense of self. Debates get personal fast, so keep them about the idea." },
    "Sun|Venus": {
      blend: "{Y}'s Venus sits on {X}'s Sun. {Y} likes {X} easily, and {X} feels appreciated in {Y}'s company.",
      flow: "{Y}'s Venus and {X}'s Sun get along well. There's easy affection, and you enjoy the same things.",
      tension: "{Y}'s tastes and {X}'s pride don't always match. Small differences over money or style can sting more than they should." },
    "Sun|Mars": {
      blend: "{Y}'s Mars sits on {X}'s Sun. {Y} energises {X}, and the two of you get a lot done, with flashes of temper along the way.",
      flow: "{Y}'s drive backs up {X}'s goals. You make a good team on anything that needs energy.",
      tension: "{Y}'s drive and {X}'s pride clash easily. Arguments start quickly, so agree early on who leads what." },
    "Sun|Jupiter": {
      blend: "{Y}'s Jupiter sits on {X}'s Sun. {Y} encourages {X} and brings out {X}'s best, a generous contact in any relationship.",
      flow: "{Y}'s Jupiter supports {X}'s Sun. {Y} believes in {X}, and {X} grows in confidence around {Y}.",
      tension: "{Y}'s advice can feel like too much for {X}. Generous intentions land as pressure unless {Y} lets {X} lead." },
    "Sun|Saturn": {
      blend: "{Y}'s Saturn sits on {X}'s Sun. {Y} takes {X} seriously and helps {X} build something lasting, and {X} can also feel judged.",
      flow: "{Y}'s Saturn steadies {X}'s Sun. This contact helps a relationship last, with {Y} as the steady one.",
      tension: "{Y}'s caution and {X}'s goals collide. {X} can feel held back, so {Y}'s criticism needs a lighter touch." },
    "Moon|Moon": {
      blend: "Your Moons sit together, so you feel things in the same way. You understand each other's moods without having to explain them.",
      flow: "Your Moons get along well. Your emotional rhythms match, and you comfort each other easily.",
      tension: "Your Moons react in different ways. What soothes one of you can unsettle the other, so ask what the other person needs." },
    "Moon|Mercury": {
      blend: "{Y}'s Mercury sits on {X}'s Moon. {Y} can talk {X} through hard feelings, and {X} feels heard.",
      flow: "{Y}'s words and {X}'s feelings work together, so talking things through comes easily.",
      tension: "{Y}'s logic can miss {X}'s feelings. Lead with sympathy before solutions." },
    "Moon|Venus": {
      blend: "{Y}'s Venus sits on {X}'s Moon. This is one of the warmest contacts two charts can make, and you feel comfortable together from the start.",
      flow: "{Y}'s Venus soothes {X}'s Moon. There's easy affection between you and a shared love of comfort.",
      tension: "The way {Y} shows care and what {X} needs emotionally don't quite match. Spell out what feels loving to each of you." },
    "Moon|Mars": {
      blend: "{Y}'s Mars sits on {X}'s Moon. {Y} stirs up {X}'s feelings, which brings warmth and quick flare-ups.",
      flow: "{Y}'s energy lifts {X}'s mood. {Y} helps {X} act on feelings instead of sitting with them.",
      tension: "{Y}'s bluntness can hurt {X}'s feelings. When tempers rise, slow down, and {X} will feel safer." },
    "Moon|Jupiter": {
      blend: "{Y}'s Jupiter sits on {X}'s Moon. {Y} makes {X} feel safe and hopeful, a protective contact.",
      flow: "{Y}'s Jupiter supports {X}'s Moon. {Y} is generous with {X}'s feelings, and {X} trusts {Y}.",
      tension: "{Y}'s optimism can brush past {X}'s worries. {X} needs to feel heard before being cheered up." },
    "Moon|Saturn": {
      blend: "{Y}'s Saturn sits on {X}'s Moon. {Y} gives {X} stability, and {X} can find {Y} cool or critical. This contact tends to bind people for a long time.",
      flow: "{Y}'s Saturn steadies {X}'s Moon. {X} feels secure with {Y}, and the bond holds up under pressure.",
      tension: "{Y}'s reserve can leave {X} feeling shut out. A little warmth from {Y} goes a long way here." },
    "Mercury|Mercury": {
      blend: "Your Mercurys sit together, so you think alike and finish each other's sentences.",
      flow: "Your minds work well together. Conversation is easy, and you can plan almost anything as a pair.",
      tension: "You think in different ways and can talk past each other. Write things down when it matters." },
    "Mercury|Venus": {
      blend: "{Y}'s Venus sits on {X}'s Mercury. Kind words come easily between you, and you share a sense of humour.",
      flow: "{X}'s Mercury and {Y}'s Venus make for easy, pleasant conversation and shared taste.",
      tension: "{X}'s frankness can bruise {Y}. A softer delivery keeps things sweet." },
    "Mercury|Mars": {
      blend: "{Y}'s Mars sits on {X}'s Mercury. Conversations are lively and quick, and they can turn into arguments.",
      flow: "{Y}'s drive and {X}'s ideas work well together. {X} plans and {Y} acts.",
      tension: "{Y}'s Mars sharpens every debate with {X}. Agree to pause when it gets heated." },
    "Mercury|Jupiter": {
      blend: "{Y}'s Jupiter sits on {X}'s Mercury. {Y} widens {X}'s thinking, and you learn a lot from each other.",
      flow: "{Y}'s Jupiter supports {X}'s Mercury, which is good for studying, teaching or planning together.",
      tension: "{Y} sees the big picture and {X} sees the details. Both views are useful once you stop arguing about which one matters." },
    "Mercury|Saturn": {
      blend: "{Y}'s Saturn sits on {X}'s Mercury. {Y} takes {X}'s ideas seriously and helps make them practical, and {X} can feel corrected.",
      flow: "{Y}'s Saturn grounds {X}'s ideas, a useful contact for work or any long project.",
      tension: "{Y} can come across as dismissive of {X}'s ideas. Hear the idea out before testing it." },
    "Venus|Venus": {
      blend: "Your Venuses sit together, so you like the same things and enjoy the same company.",
      flow: "Your Venuses get along, and shared tastes make time together easy.",
      tension: "You show affection in different ways and like different things. Making room for both tastes keeps it easy." },
    "Venus|Mars": {
      blend: "{X}'s Venus and {Y}'s Mars sit together. There's a strong spark between you and plenty of energy for shared plans.",
      flow: "{X}'s Venus and {Y}'s Mars work well together. {Y} acts and {X} smooths the way.",
      tension: "{X}'s Venus and {Y}'s Mars pull against each other. There's friction, and it keeps things lively.",
      partners: "Between partners, this is the classic contact for physical attraction." },
    "Venus|Jupiter": {
      blend: "{Y}'s Jupiter sits on {X}'s Venus. {Y} is generous with {X}, and you enjoy each other's company.",
      flow: "{Y}'s Jupiter supports {X}'s Venus, one of the kindest contacts there is. Fondness and goodwill come easily.",
      tension: "{Y}'s Jupiter and {X}'s Venus encourage each other to overdo it. Watch the spending and the late nights." },
    "Venus|Saturn": {
      blend: "{Y}'s Saturn sits on {X}'s Venus. {Y} is loyal to {X} for the long haul, and {X} may want more warmth.",
      flow: "{Y}'s Saturn steadies {X}'s Venus. Affection between you is loyal and lasts.",
      tension: "{Y}'s reserve can cool {X}'s affection. Saying the warm thing out loud helps." },
    "Mars|Mars": {
      blend: "Your Marses sit together, so you share a pace and a temper. Shared projects go well; in a fight, give each other room.",
      flow: "Your energies match. You enjoy doing things together, especially anything active.",
      tension: "You both push hard, in different directions. Competition comes easily, so pick goals you share." },
    "Mars|Jupiter": {
      blend: "{Y}'s Jupiter sits on {X}'s Mars. {Y} backs {X}'s plans, and together you take bold steps.",
      flow: "{Y}'s Jupiter supports {X}'s Mars, which is good for ambitious shared projects.",
      tension: "{X} wants to move now and {Y} wants to think bigger. Agree on the plan first." },
    "Mars|Saturn": {
      blend: "{Y}'s Saturn sits on {X}'s Mars. {Y} slows {X} down, which helps with discipline and can feel frustrating.",
      flow: "{Y}'s Saturn channels {X}'s Mars. {X} has the energy and {Y} has the patience, so together you finish what you start.",
      tension: "{X}'s push and {Y}'s caution grind against each other. This is the contact to watch for stubborn standoffs." },
    "Jupiter|Jupiter": {
      blend: "Your Jupiters sit together, so you share beliefs and hopes, and you encourage each other.",
      flow: "Your Jupiters get along. You share an outlook and lift each other's spirits.",
      tension: "Your beliefs differ. Respect for each other's outlook keeps it friendly." },
    "Jupiter|Saturn": {
      blend: "{Y}'s Saturn sits on {X}'s Jupiter. {X} brings hope and {Y} brings caution, a useful balance for long-term plans.",
      flow: "{X}'s Jupiter and {Y}'s Saturn balance each other, which is good for building something that lasts.",
      tension: "{X}'s optimism and {Y}'s caution clash over plans. Dream big together, then plan carefully." },
    "Saturn|Saturn": {
      blend: "Your Saturns sit together, so you take responsibility in the same way and understand each other's pressures.",
      flow: "Your Saturns support each other. You share a sense of duty and can rely on each other.",
      tension: "You handle pressure in different ways, so hard times can pull you apart. Talk about how each of you copes." },
  };

  function contacts(cA, cB, rel) {
    var out = [];
    var w = PLANET_WEIGHT[rel];
    PLANETS.forEach(function (na) {
      PLANETS.forEach(function (nb) {
        var pA = planet(cA, na), pB = planet(cB, nb);
        if (!pA || !pB) return;
        var hit = findAspect(longitude(pA), longitude(pB));
        if (!hit) return;
        var firstIsA = PLANETS.indexOf(na) <= PLANETS.indexOf(nb);
        var key = firstIsA ? na + "|" + nb : nb + "|" + na;
        var X = firstIsA ? cA.name : cB.name, Y = firstIsA ? cB.name : cA.name;
        var tpl = PAIR[key];
        var text = fill(tpl[hit.asp.kind], { X: X, Y: Y }).replace(/'s/g, "’s");
        if (rel === "partners" && tpl.partners) text += " " + tpl.partners;
        var tight = 1 - hit.off / hit.asp.orb;
        // Jupiter and Saturn move slowly, so people born close together share them.
        var slowTwin = na === nb && (na === "Jupiter" || na === "Saturn") ? 0.4 : 1;
        out.push({
          planetA: na, planetB: nb, type: hit.asp.type, kind: hit.asp.kind, label: hit.asp.label,
          orb: hit.off, text: text,
          score: (w[na] + w[nb]) * hit.asp.weight * (0.35 + 0.65 * tight) * slowTwin,
        });
      });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  function orbText(o) {
    return o < 0.5 ? "exact" : "within " + Math.ceil(o) + "°";
  }

  // ─── where each person's planets land in the other's chart ────────────────
  var GIFT = { Sun: "attention", Moon: "care", Mercury: "ideas", Venus: "warmth",
    Mars: "energy", Jupiter: "encouragement", Saturn: "structure" };

  // What it means when {A}'s planets land in this house of {B}'s chart.
  var HOUSE_REL = {
    partners: {
      1: "{B} feels this directly and tends to feel more like themselves with {A} around.",
      2: "It reaches {B}'s finances and the way {B} speaks up. Shared money is worth talking about early.",
      3: "It gets {B} talking and trying things, so the two of you work well on projects together.",
      4: "It goes straight to {B}'s sense of home, and living together tends to feel natural.",
      5: "It lights up {B}'s romantic, playful side. This is one of the warmest places a partner's planet can land.",
      6: "It shows up in {B}'s daily routine and health. That's caring, and it can slide into one of you managing the other.",
      7: "This is the partnership house itself, so {B} sees {A} as a natural partner.",
      8: "It goes below the surface for {B}. The bond tends to be intense, and it changes you both.",
      9: "It widens {B}'s view of the world. Travel, study and shared beliefs bring you closer.",
      10: "It reaches {B}'s career. {A} can give {B}'s work a push, and other people tend to see you as a couple.",
      11: "It reaches {B}'s friendships and hopes, so you tend to be friends as well as partners.",
      12: "It reaches {B}'s private, inward side. The bond can feel very intimate, and each of you needs time alone to keep it healthy.",
    },
    friends: {
      1: "{B} notices it from the first meeting and tends to feel more like themselves in {A}'s company.",
      2: "It reaches the way {B} handles money and speaks up, so {A}'s advice on either tends to stick.",
      3: "This is one of the friendship houses. {A} gets {B} talking and trying new things, and the two of you collaborate well.",
      4: "It reaches {B}'s private life, so {B} lets {A} closer than most friends get.",
      5: "It brings out {B}'s playful side. You have fun together, and creative projects come easily.",
      6: "It shows up in {B}'s daily routine. {A} is the friend who helps {B} get things done.",
      7: "This house covers one-to-one bonds of every kind. {B} treats {A} as an equal, and the friendship feels like a partnership.",
      8: "It reaches the private, intense side of {B}. {B} tells {A} things they keep from other people.",
      9: "It widens {B}'s view of the world, and {B} tends to treat {A} as a teacher or guide.",
      10: "It reaches {B}'s career. {A} is a useful ally at work and can open professional doors.",
      11: "This is the main friendship house. {A} sits at the heart of {B}'s social life and tends to bring people and luck into it.",
      12: "It reaches {B}'s private, inward side. {A} sees parts of {B} that most friends never do.",
    },
    family: {
      1: "It shapes how {B} sees themselves, so {A} has a strong hand in {B}'s confidence.",
      2: "It shapes {B}'s sense of family values, food and money at home.",
      3: "This house covers siblings. {A} reaches {B} the way a brother or sister does, close and a little competitive.",
      4: "This is the main family house. {A} shapes how safe and settled {B} feels at home.",
      5: "This house covers children. {A} reaches {B} the way a parent or a child does, warm and protective.",
      6: "It shows up in {B}'s daily care and health, so {A} tends to look after {B} in practical ways.",
      7: "{B} relates to {A} as an equal, one to one.",
      8: "It reaches {B}'s private worries and shared money, so {A} is part of the bigger turning points in {B}'s life.",
      9: "This house covers fathers and mentors. {A} shapes {B}'s beliefs, and {B} tends to look up to {A}.",
      10: "It reaches {B}'s ambitions, so {A} has a say in the direction {B} takes.",
      11: "It reaches {B}'s hopes and wider circle. {A} wants good things for {B} and helps bring them in.",
      12: "It reaches {B}'s inner life and rest. {A} is a calming presence, and one that can tire {B} out if neither of you notices.",
    },
  };

  function listOf(xs) { return xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]; }

  // One card per house, planets grouped, ordered by the relationship's focus houses.
  function overlays(src, tgt, rel) {
    var focus = REL[rel].focus, byHouse = {};
    PLANETS.forEach(function (n) {
      var p = planet(src, n); if (!p) return;
      var h = houseOf(p, tgt);
      (byHouse[h] = byHouse[h] || []).push(n);
    });
    var cards = Object.keys(byHouse).map(function (k) {
      var h = +k, ps = byHouse[h];
      var text = poss(src.name) + " " + listOf(ps) + " land" + (ps.length === 1 ? "s" : "") + " in " + poss(tgt.name) +
        " house of " + houseName(h, rel) + ", bringing " + listOf(ps.map(function (n) { return GIFT[n]; })) + ". " +
        fill(HOUSE_REL[rel][h], { A: src.name, B: tgt.name }).replace(/'s/g, "’s");
      var lum = ps.indexOf("Sun") >= 0 || ps.indexOf("Moon") >= 0;
      return { planets: ps, house: h, text: text, rank: focus.indexOf(h), lum: lum };
    });
    var hits = cards.filter(function (c) { return c.rank >= 0; })
      .sort(function (a, b) { return a.rank - b.rank; }).slice(0, 3);
    cards.forEach(function (c) { if (c.lum && hits.indexOf(c) < 0 && hits.length < 4) hits.push(c); });
    return hits;
  }

  // ─── links to each person's own chart ─────────────────────────────────────
  function spotlights(other, self, rel) {
    var k = keyPlanets(self), out = [];
    if (k.busiest) {
      var landing = PLANETS.filter(function (n) { var p = planet(other, n); return p && houseOf(p, self) === k.busiest.house; });
      if (landing.length) {
        var names = landing.length === 1 ? landing[0] : landing.slice(0, -1).join(", ") + " and " + landing[landing.length - 1];
        out.push({
          score: 3 + landing.length, kind: "flow",
          text: poss(other.name) + " " + names + " land" + (landing.length === 1 ? "s" : "") + " in " + poss(self.name) +
            " house of " + houseName(k.busiest.house, rel) + ", where " + k.busiest.count + " of " + poss(self.name) +
            " planets sit. That house is the center of " + poss(self.name) + " chart, so " + other.name +
            " shows up where " + poss(self.name) + " life is busiest.",
          story: poss(other.name) + " planets land in the busiest part of " + poss(self.name) + " chart, the house of " +
            houseName(k.busiest.house, rel) + ", so " + other.name + " shows up where " + poss(self.name) + " life is centered.",
        });
      }
    }
    [["ruler", "the planet that rules " + poss(self.name) + " chart"], ["luck", "the planet that brings " + self.name + " luck"]]
      .forEach(function (pair) {
        var target = k[pair[0]];
        if (!target || (pair[0] === "luck" && k.ruler && target.name === k.ruler.name)) return;
        var best = null;
        PLANETS.forEach(function (n) {
          var p = planet(other, n); if (!p) return;
          if (n === target.name && (n === "Jupiter" || n === "Saturn")) return; // shared by age
          var hit = findAspect(longitude(p), longitude(target));
          if (!hit) return;
          if (hit.asp.type !== "conj" && hit.off > 3) return;
          if (!best || hit.off < best.hit.off) best = { n: n, hit: hit };
        });
        if (!best) return;
        var verb = { blend: "sits on", flow: "supports", tension: "challenges" }[best.hit.asp.kind];
        var after = pair[0] === "ruler"
          ? (best.hit.asp.kind === "tension"
            ? other.name + " can unsettle how " + self.name + " sees themselves, and pushes " + self.name + " to grow."
            : other.name + " has a direct line to how " + self.name + " sees themselves.")
          : (best.hit.asp.kind === "tension"
            ? other.name + " stirs up the place " + poss(self.name) + " luck comes from, which pushes " + self.name + " to work for it."
            : other.name + " tends to bring " + self.name + " good fortune.");
        out.push({
          score: 4 - best.hit.off / 3, kind: best.hit.asp.kind,
          text: poss(other.name) + " " + best.n + " " + verb + " " + poss(self.name) + " " + target.name + ", " + pair[1] + ". " + after,
          story: poss(other.name) + " " + best.n + " " + verb + " " + poss(self.name) + " " + target.name + ", " + pair[1] + ".",
        });
      });
    return out;
  }

  // ─── element balance: one line, only when lopsided ────────────────────────
  var EL_HIGH = { Fire: "fast and enthusiastic", Earth: "practical and steady", Air: "talkative and full of ideas", Water: "emotional and intuitive" };
  var EL_NONE = { Fire: "you may need to bring the spark on purpose", Earth: "practical matters need deliberate attention",
    Air: "talking things out takes more effort", Water: "feelings can go unspoken" };
  function elementLine(cA, cB) {
    var count = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
    [cA, cB].forEach(function (c) { PLANETS.forEach(function (n) { var p = planet(c, n); if (p) count[SIGN_ELEMENT[signIndex(p.sign)]]++; }); });
    var els = Object.keys(count);
    var top = els.sort(function (a, b) { return count[b] - count[a]; })[0];
    if (count[top] >= 7) return count[top] + " of your 14 planets between you are in " + top.toLowerCase() + " signs, so the bond leans " + EL_HIGH[top] + ".";
    var none = els.filter(function (e) { return count[e] === 0; })[0];
    if (none) return "Neither of you has a planet in " + none.toLowerCase() + " signs, so " + EL_NONE[none] + ".";
    return null;
  }

  // ─── pair story: one shared theme, one tension ────────────────────────────
  var KOOTA_GOOD = {
    maitri: "Your Moon signs' rulers get on, so you like each other easily.",
    gana: "You share a temperament, so you react to life in similar ways.",
    bhakoot: "Your Moons sit well together, which supports a long bond.",
    tara: "Your birth stars are good for each other's wellbeing.",
    yoni: "Your birth stars make an easy physical match.",
  };
  var KOOTA_BAD = {
    maitri: "Your Moon signs' rulers don't get along, so you see the world in different ways and need patience with each other's views.",
    gana: "Your temperaments differ, so the same event can get very different reactions from each of you.",
    bhakoot: "Your Moons sit awkwardly to each other, so your emotional needs don't line up without some effort.",
    tara: "Your birth stars count badly to each other, so the bond can wear you down if you don't make time to recharge.",
    yoni: "Your physical rhythms differ and take some adjusting.",
    nadi: "Your birth stars share a group, which the marriage score treats as its biggest single flaw.",
  };

  function story(report) {
    var pos = [], neg = [];
    report.score.rows.forEach(function (r) {
      var f = r.points / r.max;
      if (f === 1 && KOOTA_GOOD[r.key]) pos.push({ score: 1.5 + r.max / 3, text: KOOTA_GOOD[r.key] });
      if (f <= 0.25 && KOOTA_BAD[r.key] && !(r.key === "bhakoot" && r.fiveNine && report.rel !== "partners"))
        neg.push({ score: 1.5 + r.max / 3, text: KOOTA_BAD[r.key] });
    });
    report.aspects.slice(0, 6).forEach(function (a) {
      var X = report.nameA, Y = report.nameB;
      var head = poss(X) + " " + a.planetA + " and " + poss(Y) + " " + a.planetB;
      if (a.kind === "tension") {
        neg.push({ score: a.score, text: head + " pull against each other, so " + poss(X) + " " + THEME[a.planetA] +
          " and " + poss(Y) + " " + THEME[a.planetB] + " need some negotiating." });
      } else {
        pos.push({ score: a.score, text: head + (a.kind === "blend" ? " sit together" : " work together easily") +
          ", so " + poss(X) + " " + THEME[a.planetA] + " and " + poss(Y) + " " + THEME[a.planetB] + " line up." });
      }
    });
    report.spotlightsA.concat(report.spotlightsB).forEach(function (s) {
      (s.kind === "tension" ? neg : pos).push({ score: s.score, text: s.story });
    });
    pos.sort(function (a, b) { return b.score - a.score; });
    neg.sort(function (a, b) { return b.score - a.score; });
    var theme = pos[0] ? pos[0].text : "This pairing has no single standout strength, so what you build together comes from effort and time.";
    var tension;
    if (neg[0]) tension = neg[0].text;
    else {
      var low = report.score.rows.slice().sort(function (a, b) { return a.points / a.max - b.points / b.max; })[0];
      tension = low.points === low.max
        ? "Nothing in this match scores badly. The work here is keeping it from becoming too comfortable."
        : "Nothing in this match scores badly. The softest spot is " + low.label.toLowerCase() + ": " + low.line.charAt(0).toLowerCase() + low.line.slice(1);
    }
    return { theme: theme, tension: tension };
  }

  function scoreNote(s, rel) {
    var t = fmt(s.total);
    if (rel === "partners") {
      return t + " of 36. Eighteen is the traditional pass mark, and above 24 counts as a good match.";
    }
    return t + " of 21, from the four checks that apply to any relationship.";
  }
  function fmt(n) { return (Math.round(n * 2) / 2).toString(); }

  function buildReport(cA, cB, rel, today) {
    rel = REL[rel] ? rel : "friends";
    var mA = moonInfo(cA), mB = moonInfo(cB);
    var report = {
      nameA: cA.name, nameB: cB.name, rel: rel, relLabel: REL[rel].label,
      moonA: { nak: mA.nakName, sign: mA.signName, themes: cA.nakshatra && cA.nakshatra.themes },
      moonB: { nak: mB.nakName, sign: mB.signName, themes: cB.nakshatra && cB.nakshatra.themes },
      score: ashtakoota(mA, mB, rel),
      aspects: contacts(cA, cB, rel).slice(0, 5).map(function (a) { a.orbText = orbText(a.orb); return a; }),
      overlaysAtoB: overlays(cA, cB, rel),
      overlaysBtoA: overlays(cB, cA, rel),
      spotlightsA: spotlights(cB, cA, rel), // B's planets in A's chart
      spotlightsB: spotlights(cA, cB, rel),
      elementLine: elementLine(cA, cB),
    };
    report.score.note = scoreNote(report.score, rel);
    report.story = story(report);
    return report;
  }

  // Every string a report can show, for the lint.
  function allText(r) {
    var out = [r.story.theme, r.story.tension, r.score.note, r.elementLine];
    r.score.rows.forEach(function (x) { out.push(x.line); });
    r.aspects.forEach(function (x) { out.push(x.text); });
    r.overlaysAtoB.concat(r.overlaysBtoA).forEach(function (x) { out.push(x.text); });
    r.spotlightsA.concat(r.spotlightsB).forEach(function (x) { out.push(x.text, x.story); });
    return out.filter(Boolean);
  }

  var API = { buildReport: buildReport, isMinor: isMinor, allText: allText, ordinal: ordinal,
    houseName: houseName, fmt: fmt, REL: REL,
    _tables: { YONI: YONI, VASHYA: VASHYA, FRIENDS: FRIENDS, PAIR: PAIR, HOUSE_REL: HOUSE_REL } };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.VEDIC_COMPAT = API;
})(this);
