# SoloTec — Portfolio Site

One-page bilingual (EN/AR) portfolio for SoloTec, built as static HTML/CSS/JS.

## Structure

```
solotec-site/
├── index.html          # الصفحة الرئيسية
├── styles.css          # كل الستايلات
├── script.js           # تبديل اللغة + الحركات
├── README.md           # هذا الملف
└── assets/
    ├── logo-mark.png        # اللوجو mark فقط، شفاف (512×512) — للـ hero
    ├── logo-wordmark.png    # اللوجو + كلمة SoloTec، شفاف (1024×432) — للـ nav والـ footer
    ├── favicon.ico          # أيقونة المتصفح (multi-size)
    ├── favicon-light.png    # 32×32 — أيقونة بديلة PNG
    ├── icon-192.png         # 192×192 — لو حبيت تضيف manifest.json / PWA
    ├── icon-512.png         # 512×512 — لو حبيت تضيف manifest.json / PWA
    ├── apple-touch-icon.png # 180×180 — أيقونة iOS
    └── og-image.png         # 1200×630 — كارت مشاركة السوشيال
```

## Update before publishing

الملفات جاهزة بالمعلومات دي:

- **رقم الواتساب:** `+20 111 150 9666`
- **الإيميل:** `Soloever2@gmail.com`

اللي محتاج تحدّثه فقط:

1. **`index.html` → قسم `.socials`:**
   بدّل `href="#"` بلينكات صفحاتك الحقيقية على Facebook، Instagram، TikTok بعد ما تعمل الصفحات.

2. **`index.html` → meta `og:image` (اختياري):**
   لما ترفع على GitHub Pages بدومين نهائي، أضف URL كامل عشان مشاركات السوشيال تشتغل صح:
   ```html
   <meta property="og:url" content="https://YOUR-USERNAME.github.io/solotec/">
   ```

## Publish on GitHub Pages

1. اعمل repo جديد باسم `solotec` (أو أي اسم).
2. ارفع كل محتوى المجلد ده (بما فيهم مجلد `assets`).
3. من الـ repo → Settings → Pages → Branch: `main` (أو `master`) → Save.
4. الموقع هيشتغل خلال دقيقة على: `https://YOUR-USERNAME.github.io/REPO-NAME/`

## Local preview

مفيش build step. افتح `index.html` مباشرة في المتصفح، أو استخدم أي static server:

```bash
# لو عندك Python:
python3 -m http.server 8000
# ثم افتح http://localhost:8000
```

## What powers what

- **Language toggle** — الزرار "ع / EN" في الـ nav. القاموس في `script.js` جوّا `i18n`. تعديل النصوص بيتم من هنا لكل من العربية والإنجليزية.
- **Scroll reveal** — الكروت بتظهر تدريجياً مع الـ scroll (`IntersectionObserver`).
- **Reduced motion** — لو المستخدم مفعّل `prefers-reduced-motion`, الحركات كلها بتتلغى تلقائي.
- **Language persistence** — الاختيار بيتحفظ في `localStorage`، أول زيارة بتاخد لغة المتصفح.

## Regenerating assets

اللوجو (logo-mark, logo-wordmark, الأيقونات) ملفات جاهزة اتحطت زي ما هي — لو حبيت تعدّلها ابعتها لأداة تصميم اللوجو تاني. أما `og-image.png` فمولّد بسكريبت بايثون بسيط (`gen_og.py`) بياخد `logo-mark.png` الشفاف ويحط حواليه حلقات سداسي وخلفية العلامة التجارية — لو غيّرت الألوان في اللوجو، شغّل السكريبت تاني عشان يتحدّث.

## Brand tokens

```
Teal:    #3AF6C7
Blue:    #1FA1FF
BG:      #1B1E28
Surface: #232735
Text:    #F3F6FA
Muted:   #8B96A8
```

الـ gradient الأساسي: `linear-gradient(135deg, #3AF6C7, #1FA1FF)` — يظهر في الأزرار الأساسية، حرف S داخل السداسي، وحرف c في كلمة SoloTec، وحلقات السداسي المتحركة خلف اللوجو في الـ hero.
