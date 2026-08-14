# PRD P1 manual QA evidence

Canonical screenshots captured from the live Angular application on 2026-08-14:

- `warehouse-scan-selected-{375,768,1280}-final.png`: manual scanner fallback resolves `DEMO-I-001`, then fills both partner and product.
- `warehouse-adjustment-{375,768,1280}-final.png`: adjustment-in entry exposes the required reason field at all supported widths.
- `settlement-invoice-{375,1280}-canonical.png`: HQ invoice view with issued status, matching settlement detail, VAT, total, PDF and Excel actions.
- `partner-statement-{375,1280}-canonical.png`: scoped partner portal view of an issued invoice. Draft invoices are excluded by the API.

The temporary records used for these captures were removed after QA. Files without `canonical` or `-final` in this directory are earlier iteration evidence and are not the acceptance reference.
