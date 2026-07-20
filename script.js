/* ═══════════════════════════════════════════════════
   SoloTec — script.js
   ═══════════════════════════════════════════════════ */


/* ─── 1. I18N DICTIONARY ─── */
const i18n = {
  en: {
    nav_work:     'Work',
    nav_contact:  'Contact',
    hero_eyebrow: 'SOLOTEC · INDEPENDENT SOFTWARE STUDIO',
    hero_title:   'One developer.<br>Complete systems.',
    hero_sub:     'From CRM portals to WhatsApp platforms to App Store apps — designed, built, and shipped end to end.',
    cta_start:    'Start a project',
    cta_work:     'See the work',

    svc_eyebrow:  'WHAT I BUILD',
    svc_title:    'Systems your team uses every day',
    svc1_t: 'Web portals & dashboards',
    svc1_d: 'Admin panels, agent portals, and reporting dashboards with real-time data.',
    svc2_t: 'CRM & internal tools',
    svc2_d: 'Custom CRMs, campaign managers, and workflow tools shaped around how you actually work.',
    svc3_t: 'WhatsApp business platforms',
    svc3_d: 'Full contact-center platforms on the WhatsApp API: inbox, routing, campaigns, reports.',
    svc4_t: 'Mobile & PWA apps',
    svc4_d: 'Installable web apps and native iOS builds — shipped to the App Store.',
    svc5_t: 'HR & payroll systems',
    svc5_d: 'Attendance, leave, and payroll engines built for Egyptian tax and insurance rules.',
    svc6_t: 'Databases & automation',
    svc6_d: 'Solid data models, reporting pipelines, and automations that remove manual work.',

    work_eyebrow: 'SELECTED WORK',
    work_title:   'Real systems, in production, used daily',
    w1_t: 'WhatsApp Contact Center',
    w1_d: 'A complete support platform: shared inbox, smart conversation routing, agent permissions, campaigns, and five live reporting views — replacing a paid third-party tool.',
    w2_t: 'HRIS with Egyptian payroll',
    w2_d: 'A 26-table HR system: GPS attendance, leave requests, and a payroll engine handling progressive tax and social insurance.',
    w3_t: 'Studio booking app — on the App Store',
    w3_d: 'Class scheduling, bookings, payments, and push notifications for a yoga studio — from first line of code to App Store release.',
    w4_t: 'Workforce admin portal',
    w4_d: 'Schedule audits, automatic deviation detection against call-center logs, bulk actions, and Excel exports for operations teams.',
    w5_t: 'Campaigns portal',
    w5_d: 'Outbound campaign management with database-driven call scripts, duplicate handling, and live agent notifications.',
    w6_t: 'Medical network directory',
    w6_d: 'Provider data extracted from Arabic PDFs into a searchable, filterable map-based directory.',

    why_eyebrow: 'WHY SOLOTEC',
    why_title:   'You talk to the person who writes the code',
    why1: 'One point of contact from idea to launch — no handoffs, nothing lost in translation.',
    why2: 'Every project above is a real production system used daily by working teams.',
    why3: 'Fast, lean delivery — working software in days, not months of meetings.',

    ct_eyebrow: 'CONTACT',
    ct_title:   'Tell me what you need to build',
    ct_sub:     "Send a message on WhatsApp and you'll get a reply the same day.",
    ct_wa:      'Message on WhatsApp',
    ct_email:   'Email me',

    term_lines: [
      'deploying nos-cc-portal... ✓ live',
      'shipping HRIS payroll module... ✓ done',
      '6 systems in production, used daily',
      'no agencies, no handoffs — just me'
    ],

    footer: '© 2026 SoloTec. Built by one, used by many.'
  },

  ar: {
    nav_work:     'الأعمال',
    nav_contact:  'تواصل',
    hero_eyebrow: 'SOLOTEC · استوديو برمجيات مستقل',
    hero_title:   'مطوّر واحد.<br>أنظمة متكاملة.',
    hero_sub:     'من بوابات الـ CRM لمنصات واتساب لتطبيقات الـ App Store — تصميم وبناء وتسليم من الأول للآخر.',
    cta_start:    'ابدأ مشروعك',
    cta_work:     'شوف الأعمال',

    svc_eyebrow:  'بنبني إيه',
    svc_title:    'أنظمة فريقك يستخدمها كل يوم',
    svc1_t: 'بوابات ولوحات تحكم',
    svc1_d: 'لوحات إدارة وبوابات موظفين وتقارير ببيانات لحظية.',
    svc2_t: 'CRM وأدوات داخلية',
    svc2_d: 'أنظمة CRM مخصصة وإدارة حملات وأدوات شغل متفصّلة على طريقة عملك الفعلية.',
    svc3_t: 'منصات واتساب للأعمال',
    svc3_d: 'منصات خدمة عملاء كاملة على WhatsApp API: صندوق موحد، توجيه، حملات، وتقارير.',
    svc4_t: 'تطبيقات موبايل وPWA',
    svc4_d: 'تطبيقات ويب قابلة للتثبيت ونسخ iOS أصلية — وصلت فعلاً للـ App Store.',
    svc5_t: 'أنظمة موارد بشرية ورواتب',
    svc5_d: 'حضور وإجازات ومحرك رواتب مبني على قواعد الضرائب والتأمينات المصرية.',
    svc6_t: 'قواعد بيانات وأتمتة',
    svc6_d: 'نماذج بيانات متينة وخطوط تقارير وأتمتة بتلغي الشغل اليدوي.',

    work_eyebrow: 'أعمال مختارة',
    work_title:   'أنظمة حقيقية شغالة ومستخدمة يومياً',
    w1_t: 'منصة خدمة عملاء واتساب',
    w1_d: 'منصة دعم كاملة: صندوق موحد، توجيه ذكي للمحادثات، صلاحيات وكلاء، حملات، وخمس شاشات تقارير حية — بديل كامل لأداة مدفوعة.',
    w2_t: 'نظام HR برواتب مصرية',
    w2_d: 'نظام موارد بشرية بـ 26 جدول: حضور بالـ GPS، طلبات إجازات، ومحرك رواتب بيحسب الضريبة التصاعدية والتأمينات.',
    w3_t: 'تطبيق حجز استوديو — على الـ App Store',
    w3_d: 'جدولة حصص وحجوزات ومدفوعات وإشعارات push لاستوديو يوغا — من أول سطر كود لحد النشر على الـ App Store.',
    w4_t: 'بوابة إدارة القوى العاملة',
    w4_d: 'مراجعة جداول، كشف انحرافات تلقائي مقابل سجلات الكول سنتر، إجراءات جماعية، وتصدير Excel لفرق التشغيل.',
    w5_t: 'بوابة الحملات',
    w5_d: 'إدارة حملات صادرة بسكريبتات مكالمات من قاعدة البيانات، معالجة التكرارات، وإشعارات لحظية للوكلاء.',
    w6_t: 'دليل الشبكة الطبية',
    w6_d: 'بيانات مزودين مستخرجة من ملفات PDF عربية لدليل قابل للبحث والفلترة على الخريطة.',

    why_eyebrow: 'ليه SoloTec',
    why_title:   'بتكلم الشخص اللي بيكتب الكود بنفسه',
    why1: 'نقطة تواصل واحدة من الفكرة للإطلاق — من غير وسطاء ولا حاجة بتضيع في النقل.',
    why2: 'كل مشروع فوق ده نظام حقيقي شغال ومستخدم يومياً من فرق عمل فعلية.',
    why3: 'تسليم سريع وخفيف — سوفتوير شغال في أيام، مش شهور اجتماعات.',

    ct_eyebrow: 'تواصل',
    ct_title:   'قولي محتاج تبني إيه',
    ct_sub:     'ابعت رسالة واتساب وهيوصلك رد في نفس اليوم.',
    ct_wa:      'راسلني على واتساب',
    ct_email:   'ابعتلي إيميل',

    footer: '© 2026 SoloTec. بنَاه واحد، بيستخدمه كتير.'
  }
};


/* ─── 2. LANGUAGE TOGGLE ─── */
const langToggle = document.getElementById('langToggle');

function applyLang(lang) {
  const dict = i18n[lang];
  if (!dict) return;

  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });

  if (langToggle) langToggle.textContent = (lang === 'ar') ? 'EN' : 'ع';

  try { localStorage.setItem('solotec-lang', lang); } catch (e) { /* private mode */ }
}

if (langToggle) {
  langToggle.addEventListener('click', function () {
    const next = (document.documentElement.lang === 'ar') ? 'en' : 'ar';
    applyLang(next);
  });
}

/* لغة محفوظة، أو لغة المتصفح كافتراضي */
(function initLang() {
  let saved = null;
  try { saved = localStorage.getItem('solotec-lang'); } catch (e) { /* ignore */ }
  const browserAr = (navigator.language || '').toLowerCase().startsWith('ar');
  applyLang(saved || (browserAr ? 'ar' : 'en'));
})();


/* ─── 4. HERO TERMINAL TYPEWRITER ─── */
(function initTerminal() {
  const el = document.getElementById('terminalText');
  if (!el) return;

  const lines = i18n.en.term_lines || [];
  if (!lines.length) return;

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    el.textContent = lines[0];
    return;
  }

  const TYPE_MS = 45;
  const DELETE_MS = 22;
  const HOLD_MS = 1600;
  const GAP_MS = 350;

  let lineIndex = 0;
  let timer = null;

  function typeLine() {
    const full = lines[lineIndex];
    let i = 0;
    el.textContent = '';

    (function typeChar() {
      i++;
      el.textContent = full.slice(0, i);
      if (i < full.length) {
        timer = setTimeout(typeChar, TYPE_MS);
      } else {
        timer = setTimeout(deleteLine, HOLD_MS);
      }
    })();
  }

  function deleteLine() {
    const full = lines[lineIndex];
    let i = full.length;

    (function deleteChar() {
      i--;
      el.textContent = full.slice(0, i);
      if (i > 0) {
        timer = setTimeout(deleteChar, DELETE_MS);
      } else {
        lineIndex = (lineIndex + 1) % lines.length;
        timer = setTimeout(typeLine, GAP_MS);
      }
    })();
  }

  typeLine();
})();


/* ─── 5. SCROLL REVEAL ─── */
(function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('visible'); });
    return;
  }
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach(function (el) { io.observe(el); });
})();
