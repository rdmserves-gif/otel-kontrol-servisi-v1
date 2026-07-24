// ---------------------------------------------------------------
// Otel Kontrol Listesi - Gün Sonu Raporu E-posta Servisi
// ---------------------------------------------------------------
// Bu küçük sunucu, telefon uygulamasından gelen PDF raporunu alır
// ve Resend API üzerinden e-posta olarak iletir.
//
// Kurulum:
//   1) npm install
//   2) .env dosyası oluşturun (.env.example'a bakın)
//   3) node server.js
// ---------------------------------------------------------------

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";
const PORT = process.env.PORT || 3000;

if (!RESEND_API_KEY) {
  console.warn(
    "UYARI: RESEND_API_KEY tanımlı değil. .env dosyanızı kontrol edin."
  );
}

const app = express();
app.use(cors()); // Artifact/uygulama farklı bir adresten istek atacağı için gerekli
app.use(express.json({ limit: "15mb" })); // PDF base64 olarak geldiği için limiti yükselttik

// Basit bir sağlık kontrolü ucu (Render gibi platformlar bunu kullanır)
app.get("/", (req, res) => {
  res.send("Otel Kontrol Listesi e-posta servisi çalışıyor.");
});

app.post("/gun-sonu-raporu", async (req, res) => {
  const { to, subject, hotelName, department, date, fileName, pdfBase64 } = req.body || {};

  if (!to || !pdfBase64 || !fileName) {
    return res.status(400).json({
      basarili: false,
      hata: "Eksik bilgi: 'to', 'fileName' ve 'pdfBase64' alanları zorunludur.",
    });
  }

  const govdeHtml = `
    <p>Merhaba,</p>
    <p><strong>${hotelName || ""}</strong> otelinin <strong>${department || ""}</strong>
    departmanına ait <strong>${date || ""}</strong> tarihli günlük kontrol listesi ektedir.</p>
    <p>Bu e-posta, Otel Kontrol Listesi uygulaması tarafından otomatik olarak gönderilmiştir.</p>
  `;

  try {
    const yanit = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Otel Kontrol Listesi <${FROM_EMAIL}>`,
        to: [to],
        subject: subject || `Günlük Kontrol Listesi - ${date || ""}`,
        html: govdeHtml,
        attachments: [
          {
            filename: fileName,
            content: pdfBase64, // base64 string, "data:application/pdf;base64," ön eki OLMADAN
          },
        ],
      }),
    });

    const veri = await yanit.json();

    if (!yanit.ok) {
      console.error("Resend hatası:", veri);
      return res.status(502).json({ basarili: false, hata: veri });
    }

    return res.json({ basarili: true, id: veri.id });
  } catch (e) {
    console.error("Sunucu hatası:", e);
    return res.status(500).json({ basarili: false, hata: "Sunucu hatası" });
  }
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
