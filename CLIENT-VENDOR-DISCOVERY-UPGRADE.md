# Finora — Client & Vendor Discovery Upgrade

## Tujuan
Master data Client/Vendor sekarang dapat dicari berdasarkan nama perusahaan **dan** konteks bisnis yang relevan saat owner mencari vendor, misalnya material, produk, jasa, bidang, atau kebutuhan.

## Perubahan data
- `ClientVendor.category` untuk klasifikasi kontak.
- `ClientVendor.offerings` untuk kata kunci produk/jasa/bidang yang dapat dicari.

## UX
- Search placeholder menjelaskan bahwa pencarian membaca perusahaan, bahan, jasa, dan PIC.
- Filter kategori tersedia setelah filter tipe dipilih.
- Vendor memiliki kategori seperti Supplier Material, Penyedia Jasa, Subkontraktor, Transportasi/Logistik, Peralatan/Sewa, Operasional, dan Tenaga Ahli/Freelancer.
- Form vendor meminta produk/jasa yang disediakan; contoh `kabel listrik, MCB, panel, instalasi listrik`.
- Email tidak lagi wajib untuk pembuatan kontak agar vendor lapangan bisa segera dicatat.
- Tabel menampilkan kategori dan produk/jasa sehingga pencarian manual lebih cepat.

## Contoh UAT Vendor
`Nama: PT Sumber Kabel Abadi`
`Kategori: SUPPLIER MATERIAL`
`Produk/jasa: kabel listrik, MCB, panel, conduit, grounding`

Pencarian `kabel` sekarang akan menemukan vendor tersebut walaupun kata `kabel` tidak ada pada nama perusahaannya.
