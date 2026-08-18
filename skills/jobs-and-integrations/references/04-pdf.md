# PDF

Invoices and challans with xhtml2pdf, and the Bangla-text problem that catches
every project in this region.

## Never render in the request

PDF generation is CPU-bound and unbounded — an order with 200 line items takes
as long as it takes. It goes to the outbox like everything else
([01-outbox.md](01-outbox.md)).

The exception: a user clicking "Download invoice" and waiting. Even then, cache
the rendered bytes on the order so the second click is a file read.

## Fonts and Bangla

**xhtml2pdf does not embed a font unless you tell it to, and its default font
has no Bengali glyphs.** Bangla text renders as empty boxes or vanishes
entirely — and it will look fine in your HTML preview, because the browser
substitutes a font that xhtml2pdf does not have.

```html
<style>
  @font-face {
    font-family: "NotoBengali";
    /* An ABSOLUTE filesystem path. A URL is fetched at render time — one
       network call per PDF, and a blank invoice when it fails. */
    src: url("/home/user/daf_backend/static/fonts/NotoSansBengali-Regular.ttf");
  }
  @font-face {
    font-family: "NotoBengali";
    src: url("/home/user/daf_backend/static/fonts/NotoSansBengali-Bold.ttf");
    font-weight: bold;
  }
  body { font-family: "NotoBengali", "Helvetica", sans-serif; }
</style>
```

Notes that cost an afternoon each:

- **TTF, not WOFF2.** ReportLab (underneath xhtml2pdf) reads TTF and OTF only.
  The WOFF2 you use on the web will not load.
- **Register bold as a separate `@font-face`.** There is no faux bold in
  ReportLab; an unregistered bold silently falls back to the default font, so a
  Bangla heading disappears while the body renders.
- **The `৳` sign needs the same font.** In a Latin-only face it is a box.
  Check the total line specifically — it is the one place the symbol appears
  and the one place it matters.
- **Ship the font in the repo**, under `static/fonts/`. A system font that
  exists on your laptop and not on the server produces a blank PDF in
  production only.

```bash
# Confirm the file is actually there on the server.
ls -l ~/daf_backend/static/fonts/NotoSansBengali-*.ttf
```

## Rendering

```python
from io import BytesIO

from django.template.loader import render_to_string
from xhtml2pdf import pisa


def render_invoice_pdf(order, base_url=''):
    """Return PDF bytes. Raises on failure — never returns a broken file."""
    html = render_to_string('invoices/invoice.html', {
        'order': order,
        'items': order.items.select_related('attribute__product'),
        'base_url': base_url,
        # Format in Python, not in the template. Locale-aware currency
        # formatting in a Django template is a source of subtle rounding bugs.
        'total': f'{order.total_amount:,.2f}',
    })

    buffer = BytesIO()
    result = pisa.CreatePDF(html, dest=buffer, encoding='utf-8')

    if result.err:
        raise PermanentFailure(f'PDF render failed for order {order.pk}: {result.err}')

    return buffer.getvalue()
```

`select_related` on the items — a 50-line invoice without it is 50 queries
inside a job that already runs on a schedule (`performance-budget/01`).

`encoding='utf-8'` explicitly. Without it, non-ASCII goes through the platform
default, which on some hosts is not UTF-8.

Check `result.err`. `pisa.CreatePDF` does not raise on a broken template — it
returns an error count and a partial PDF, which then gets emailed to a customer
as a corrupt attachment.

## Template constraints

xhtml2pdf supports a subset of CSS roughly equivalent to CSS 2.1. What does
**not** work, and what to use instead:

| Not supported | Use |
|---|---|
| Flexbox, Grid | `<table>` for layout. Genuinely — this is a print document |
| `position: sticky` | `-pdf-frame` for repeating headers |
| CSS variables | Literal values. This is the one place `ui-design-system` tokens do not reach |
| `rem` units | `pt` or `mm`. Print units for a print document |
| Web fonts by URL | Absolute filesystem paths |
| `box-shadow`, gradients | Borders and background colours |
| SVG | PNG. Rasterise the logo at 2× the print size |

Page setup:

```css
@page {
  size: A4 portrait;
  margin: 15mm;
  @frame footer { -pdf-frame-content: footer; bottom: 8mm; height: 10mm; }
}
```

Repeat the table header across pages, or a three-page invoice has unlabelled
columns after page one:

```html
<thead><tr><th>Item</th><th>Qty</th><th class="num">Price</th></tr></thead>
```

xhtml2pdf repeats `<thead>` automatically. It is one tag and it is the
difference between a professional and an amateur invoice.

## Content

An invoice is a financial document. Two rules follow:

**Denormalise everything.** The invoice shows the product name, unit price and
quantity **as sold** — read from `OrderItem`, never through the FK to the
product. Reading live prices means tomorrow's price change silently rewrites
last month's invoices. `data-layer/01` requires `OrderItem.unit_price` and
`product_name` as columns for exactly this reason.

**Never regenerate a sent invoice.** Cache the bytes on the order, or store the
file. Regenerating from current data produces a document that disagrees with
the one the customer holds — and if there is ever a dispute, the one they hold
is the one that counts.

Required on the document: invoice number (the order id is fine), issue date in
`Asia/Dhaka` (**C2** — a UTC timestamp dates a 10pm order to tomorrow), seller
name and address, buyer name and address, line items with unit price and
subtotal, delivery charge, discount, grand total, and payment method and status.

## Storage

- Cloudinary, or a directory outside the deploy path — never inside it, or the
  next deploy deletes them (`deploy-and-env/03`).
- **Not** publicly enumerable. `/media/invoices/1042.pdf` lets anyone walk
  integers and read every customer's name, address and order. Serve through a
  view that checks ownership, or use a signed URL with a short expiry.
- That is the same enumeration class as **N11** (`OrderViewSet.track` being
  `AllowAny` with a raw `pk` lookup). Do not reintroduce it through the file
  store.

## Verification

```bash
# 1. Fonts are present on the server.
ls -l ~/daf_backend/static/fonts/NotoSansBengali-*.ttf
# PASS: both regular and bold

# 2. A PDF renders and is plausible.
python manage.py shell -c "
from orders.models import Order
from orders.utils import render_invoice_pdf
pdf = render_invoice_pdf(Order.objects.first())
open('/tmp/test.pdf','wb').write(pdf)
print(len(pdf), 'bytes')"
# PASS: over ~10KB. A 2KB file is a blank page.

# 3. Bangla and ৳ actually render.
pdftotext /tmp/test.pdf - | head -40
# PASS: Bangla text readable, ৳ present. Boxes or gaps mean the font failed.

# 4. No live price lookup in the template.
grep -rn "attribute.mainPrice\|product.price" templates/invoices/
# PASS: no output — read OrderItem.unit_price

# 5. Query count inside the render.
python manage.py shell -c "
from django.test.utils import CaptureQueriesContext
from django.db import connection
from orders.models import Order
from orders.utils import render_invoice_pdf
with CaptureQueriesContext(connection) as ctx:
    render_invoice_pdf(Order.objects.first())
print(len(ctx.captured_queries), 'queries')"
# PASS: under 10

# 6. Invoices are not publicly enumerable.
curl -s -o /dev/null -w '%{http_code}\n' https://api.example.com/media/invoices/1.pdf
# PASS: 403 or 404, never 200

# 7. Multi-page headers repeat.
#    Render an order with 60 line items and open page 2.
# PASS: the table header is present
```

Check 3 is the one that fails in production and passes locally, every time.
