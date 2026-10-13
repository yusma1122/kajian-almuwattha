==============================================================
 TRANSCRIPT FINDER
 Murajaah & pencari fatwa dari kajian Kitab Al-Muwaththa'
==============================================================

TENTANG APLIKASI
----------------
Transcript Finder adalah aplikasi web sederhana untuk mencari kata kunci
di dalam kumpulan transkrip video YouTube kajian Kitab Al-Muwaththa'
karya Imam Malik rahimahullah, yang disampaikan oleh:

  Ustadz Dr. Muhammad Haikal Ali Basyarahil, M.A.
  Masjid Al Faruq, Banjarmasin
  Peta: https://maps.app.goo.gl/GGTbNYxkcemYF31W8

Pengajian dilaksanakan rutin setiap hari Kamis, ba'da Maghrib hingga
waktu salat Isya, insya Allah selama tidak ada gangguan atau halangan.

Aplikasi ini dibuat untuk memudahkan murajaah ceramah beliau dan
menemukan fatwa-fatwa yang beliau singgung di dalam kajian. Setiap hasil
pencarian langsung mengarah ke menit dan detik yang tepat di video
YouTube-nya.

Berjalan 100% di browser (tanpa backend, tanpa database server).


ISI FOLDER
----------
  index.html     -> tampilan aplikasi
  script.js      -> logika aplikasi
  README.txt     -> panduan ini
  database/      -> tempat file transkrip (.txt), 1 file = 1 video


CARA MENJALANKAN
----------------
Aplikasi membaca folder "database" secara otomatis. Karena aturan
keamanan browser, aplikasi harus dibuka lewat web server lokal, BUKAN
dengan klik dua kali pada index.html.

Cara termudah (butuh Python):
  1. Buka terminal / Command Prompt di folder aplikasi ini
     (folder yang berisi index.html, script.js, dan database).
  2. Jalankan:
         python -m http.server 8000
     (di sebagian komputer perintahnya: python3 -m http.server 8000)
  3. Buka browser, lalu masuk ke:
         http://localhost:8000
  4. Selesai. Semua file .txt di folder database terbaca otomatis.

Alternatif lain:
  - VS Code: pasang ekstensi "Live Server", klik kanan index.html
    lalu pilih "Open with Live Server".
  - Node.js: jalankan  npx serve  di folder aplikasi.

Butuh koneksi internet saat pertama dibuka, karena Tailwind CSS dan
font (Poppins, Amiri) dimuat dari CDN.

Jika dibuka langsung lewat file:// atau pembacaan otomatis gagal, akan
muncul tombol "Pilih Folder Secara Manual". Klik tombol itu lalu pilih
folder yang berisi file .txt.


FORMAT FILE TRANSKRIP
---------------------
Taruh semua file transkrip di dalam folder "database".
Aturan: 1 file .txt berisi data untuk 1 video saja.

Contoh isi file:

  [VIDEO]
  Link: https://youtube.com/watch?v=abcd1234
  Judul: Kajian Fiqih
  Ustadz: Ustadz Ahmad
  Tanggal: Jan 13, 2022
  Transcript:
  60:46 wajib tersebut seperti itu. Wallahu tib.
  60:51 Saya kira cukup kita tutup dan majelis.
  01:05:10 Jangan sampai kita membuang waktu.

Catatan:
  - Waktu boleh MM:SS (contoh 60:46) atau HH:MM:SS (contoh 01:05:10).
  - Pemisah antara waktu dan teks hanya spasi (tidak pakai tanda panah).
  - Baris lanjutan tanpa waktu akan digabung ke baris sebelumnya.
  - Link bisa berupa youtube.com/watch?v=..., youtu.be/..., dll.
  - Tanggal: tulis tanggal video dengan format  Bulan Singkat Tanggal, Tahun
    contoh:  Jan 13, 2022  atau  Okt 5, 2026.  Format  13 Jan 2022  juga bisa.
    Baris Tanggal bersifat opsional, tapi disarankan agar jamaah tahu
    kapan video tersebut disampaikan. Video akan diurutkan dari tanggal
    terlama; video tanpa tanggal diletakkan di belakang.


CARA MENAMBAH VIDEO BARU
------------------------
  1. Simpan transkrip baru sebagai file .txt di folder "database".
  2. Muat ulang halaman (atau klik tombol "Muat ulang").
  3. Angka "video telah ditranskrip" di bagian atas akan bertambah.
     Angka itu dihitung dari jumlah file .txt di folder database.

Jika aplikasi dipasang di hosting statis yang tidak menampilkan daftar
isi folder, buat file database/manifest.json yang berisi daftar nama
file, misalnya:

  ["kajian-01.txt", "kajian-02.txt", "kajian-03.txt"]

Cara membuatnya otomatis (butuh Python), jalankan di folder aplikasi:

  python -c "import os,json;print(json.dumps(sorted(f for f in os.listdir('database') if f.endswith('.txt'))))" > database/manifest.json

Ulangi perintah itu setiap kali menambah atau menghapus file.


CARA MENCARI
------------
  1. Ketik kata kunci di kolom pencarian, lalu klik "Cari" atau tekan
     Enter. Pencarian selalu mencakup SEMUA video.
  2. Atau klik salah satu tombol "Cari cepat fatwa / hukum"
     (Wajib, Sunnah, Haram, Makruh, Boleh, dst).

Tips pencarian:
  - Beberapa kata = semua kata harus ada, urutannya bebas.
        contoh:  hukum puasa musafir
  - Frasa persis: pakai tanda kutip.
        contoh:  "tidak boleh"
  - Huruf besar/kecil, harakat, dan apostrof (') diabaikan.
        contoh:  bid'ah  juga menemukan  bidah
  - Kata dasar ikut cocok, misalnya "wajib" menemukan "diwajibkan".
  - Pencarian menyambung antar-baris transkrip, jadi kalimat yang
    terpotong di tengah tetap bisa ditemukan.


MEMBACA HASIL
-------------
Setiap hasil menampilkan:
  - Thumbnail video beserta waktu (timestamp) kemunculannya.
  - Judul video, nama ustadz, dan tanggal video (jika ada).
  - Lencana hukum otomatis (Wajib, Sunnah, Haram, Makruh, Boleh,
    Tidak boleh, Bid'ah, Fatwa, Khilaf) jika kalimat memuat kata
    terkait. Lencana ini hanya tebakan dari kata kunci; selalu cek
    ke video untuk memastikan konteksnya.
  - Teks transkrip dengan kata kunci yang ditandai warna kuning.

Tombol di tiap hasil:
  - Buka YouTube    : membuka video di tab baru, tepat di detik tersebut.
  - Preview         : memutar video langsung di dalam aplikasi
                      (tekan Esc atau tombol Tutup untuk menutup).
  - Lihat konteks   : menampilkan beberapa baris sebelum dan sesudah,
                      tiap baris bisa diklik menuju detiknya.
  - Salin           : menyalin kutipan siap tempel (teks, judul, ustadz,
                      tanggal, menit, dan link YouTube tepat di detiknya).
  - WhatsApp        : membuka WhatsApp dengan kutipan yang sama siap kirim.

Pengaturan hasil:
  - Urutan: "Paling relevan" atau "Urut tanggal kajian & waktu".
  - "Hanya yang memuat hukum / fatwa": tampilkan hanya kalimat yang
    mengandung kata hukum seperti wajib, haram, boleh, dan sebagainya.


MODE TERANG / GELAP
-------------------
  - Tombol di pojok kanan atas ("Mode terang" / "Mode gelap") mengganti
    tampilan sesuai kenyamanan mata Anda.
  - Saat pertama dibuka, tema mengikuti pengaturan perangkat (HP/komputer).
    Jika perangkat tidak punya preferensi, dipakai mode gelap.
  - Setelah Anda menekan tombol itu, pilihan Anda diingat oleh browser
    untuk kunjungan berikutnya.


SALIN & BAGIKAN
---------------
  - Tombol "Salin" di tiap hasil menyalin kutipan seperti ini:

        "wajib tersebut seperti itu. Wallahu a'lam."

        Kajian Fiqih
        Ustadz Ahmad · Jan 13, 2022
        Menit 60:46
        https://youtube.com/watch?v=abcd1234&t=3646s

  - Tombol "WhatsApp" mengirim kutipan yang sama ke WhatsApp.
  - Tombol "Salin link pencarian" (di atas daftar hasil) menyalin alamat
    halaman beserta kata kunci, misalnya:
        http://localhost:8000/?q=hukum+puasa
    Siapa pun yang membuka link itu akan langsung melihat hasil pencarian
    yang sama. Link ini baru bisa dipakai orang lain jika aplikasi
    dipasang di alamat yang bisa diakses mereka (bukan hanya localhost).


PAGINASI (PER HALAMAN)
----------------------
  - Hasil dibagi per halaman. Bawaannya 10 hasil per halaman.
  - Ubah lewat pilihan "Per halaman": 10, 20, 50, 100, atau pilih
    "Lainnya..." lalu ketik jumlah sendiri (1 sampai 500).
  - Pilihan Anda diingat oleh browser untuk kunjungan berikutnya.
  - Pindah halaman dengan tombol nomor, "Sebelumnya", dan "Berikutnya"
    di bagian bawah daftar hasil.


MASALAH UMUM
------------
  - Muncul pesan "Dibuka via file://":
        Jalankan lewat web server lokal (lihat CARA MENJALANKAN),
        atau pakai tombol "Pilih Folder Secara Manual".
  - "Gagal membaca folder database":
        Pastikan folder bernama persis "database" (huruf kecil) dan
        berada di samping index.html. Pada hosting statis, tambahkan
        database/manifest.json.
  - Ada file yang "dilewati":
        File itu tidak memiliki baris "Link:" atau "Transcript:" yang
        valid. Periksa format file sesuai contoh di atas.
  - Preview video tidak tampil:
        Buka lewat http://localhost (bukan file://) dan pastikan
        koneksi internet aktif. Bisa juga pakai tombol "Buka YouTube".
  - Thumbnail tidak muncul:
        Periksa koneksi internet dan kebenaran link YouTube di file.


BUILDER
-------
Adapun alat atau tools untuk membuat aplikasi ini yaitu:
Cleaner = ini untuk membersihkan transkrip youtube untuk ke format aplikasi
builder-txt = ini membuat .txt dari transkrip cleaner

CATATAN
-------
Transkrip dapat mengandung salah dengar atau salah tulis. Rujuklah
video asli dan kitab untuk memastikan fatwa.

Dibuat oleh yusma </>
