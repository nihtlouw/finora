# UAT — PO Kabel Power SS3

Source: **PO Kabel Power SS3** uploaded by the user.

Customer: PT Hurip Utama  
Supplier: PT Berjaya Sukses Makmur  
PO: `00077/PO/HU/VIII/2026`  
PO date: `10 August 2026`  
Reference offer: `0072/PH-BSM/HU/VIII/2026`

## Source commercial snapshot

- Material: Rp22.000.000
- Jasa Terminasi: Rp6.377.500
- Subtotal: Rp28.377.500
- PPN 11%: Rp3.121.525
- Grand Total: Rp31.500.000
- Harga sudah termasuk PPN
- Garansi 6 bulan
- DP 50% dari PO terbit; 7 hari setelah invoice masuk
- Pelunasan 50% setelah pekerjaan selesai dengan BAP

## UAT bridge

Customer PO di Finora mensyaratkan Proposal `WON`. PDF ini tidak menyertakan quotation matching terpisah. Seed membuat **source bridge proposal** yang diturunkan dari isi PO, berstatus `WON`, dan ditandai sebagai bridge UAT. Ini bukan klaim bahwa proposal tersebut adalah quotation asli.

PO dibuat `RECEIVED`, sehingga langkah `VERIFY` tetap harus dilakukan melalui aplikasi.

## Expected flow

`RECEIVED → VERIFIED → PROJECT → BILLING/PAYMENT`

Expected project values:
- Contract Value: Rp31.500.000
- Revenue Basis: Rp28.377.500

Expected payment:
- 50% DP: Rp15.750.000, trigger PO released, due 7 days after invoice.
- 50% final: Rp15.750.000, trigger BAP completed; no due-day value because the source PO does not specify it.

UAT negative gate:
- Final billing/payment must not become ready without completed BAP evidence.

## Assumption

The PDF shows the PO date but not a separate received date. The seed uses the PO date as `receivedDate` and records this as a UAT assumption in PO remarks.
