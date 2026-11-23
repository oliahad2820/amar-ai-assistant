# আমার এআই (Amar AI) — নিজস্ব ডোমেইনে ফ্রি পার্সোনাল এআই অ্যাসিস্ট্যান্ট

নিজস্ব ডোমেইন ও **GitHub Pages (১০০% ফ্রি)**-এ চলা ব্যক্তিগত বাংলা এআই অ্যাসিস্ট্যান্ট।

## মূল সুবিধাসমূহ
1. **ক্যামেরা অ্যাক্সেস, ফলো ও অটো-সালাম:** অন-ডিভাইস ভিশন (ভিডিও কখনো সার্ভারে যায় না)। আপনি ডেস্কের সামনে আসলেই চিনে বাংলায় **"আসসালামু আলাইকুম!"** বলে দিনের জরুরি কাজের ব্রিফ শোনাবে এবং ফ্রেমে আপনাকে ফলো করবে।
2. **অফিস অটো-প্ল্যানার ও প্রোঅ্যাক্টিভ ফিডব্যাক:** কোন কাজের পর কোনটা করবেন (dependency + priority) তা নিজে সাজিয়ে টাইম-ব্লক তৈরি করে, নির্দিষ্ট সময় পর পর চেক-ইন করে প্ল্যান অনুযায়ী এগোচ্ছেন কিনা ফিডব্যাক দেয় এবং দেরি হলে রিশিডিউল করে।
3. **ইমেইল হাব (Gmail ও নিজস্ব ডোমেইন IMAP):** নতুন ইমেইল পড়ে বাংলা সারাংশ শোনায়, এক ক্লিকে অফিস কাজে যোগ করে, এবং আপনার অনুমোদন ছাড়া কখনো রিপ্লাই পাঠায় না।
4. **ফেসবুক কমেন্ট ও লাইক মনিটর:**
   - **Facebook Page:** অফিশিয়াল Meta Graph API + রিয়েল-টাইম Webhook।
   - **Personal Facebook Profile (নিরাপদ মোড):** Facebook-এর ইমেইল নোটিফিকেশন স্বয়ংক্রিয়ভাবে পার্স করে লাইক/কমেন্ট অ্যালার্ট দেখায় (অ্যাকাউন্ট ব্যানের কোনো ঝুঁকি নেই)।
5. **বাংলা ভয়েস ও চ্যাট (Gemini 4 Hydrogen):** Google AI Studio-র ফ্রি Gemini API Key দিয়েই বাংলায় কথা বলা ও কাজ পরিচালনা করা যাবে।

---

## ১. এখনই ফ্রি ব্যবহার শুরু করুন (GitHub Pages + Custom Domain)

### ধাপ ক: অ্যাপ ওপেন ও ফ্রি Gemini API Key যুক্ত করা
1. আপনার GitHub Pages লিংক ওপেন করুন (যেমন: `https://oliahad2820.github.io/amar-ai-assistant/`)।
2. **সেটিংস ও ডোমেইন** ট্যাবে যান।
3. [Google AI Studio](https://aistudio.google.com/apikey) থেকে ফ্রি **Gemini API Key** কপি করে বসান এবং **সেভ করুন**। (কী শুধু আপনার ব্রাউজারেই থাকবে—গিটহাবে যায় না।)
4. **ড্যাশবোর্ড ও ক্যামেরা** ট্যাবে **ক্যামেরা চালু করুন** → **আমার চেহারা চেনান** চাপুন।

### ধাপ খ: আপনার নিজস্ব ডোমেইন যুক্ত করা (১০০% ফ্রি SSL সহ)
1. আপনার ডোমেইন প্যানেলের DNS-এ একটি **CNAME** রেকর্ড দিন:
   - **Type:** `CNAME`
   - **Host / Name:** `ai` (যেমন `ai.yourdomain.com`)
   - **Target / Value:** `oliahad2820.github.io`
2. GitHub রেপোতে **Settings → Pages → Custom domain** ঘরে `ai.yourdomain.com` লিখে Save করুন এবং **Enforce HTTPS** চালু করুন।
3. **Settings → Secrets and variables → Actions → Variables**-এ `CUSTOM_DOMAIN` = `ai.yourdomain.com` যোগ করুন, যাতে প্রতি পুশে অটোমেটিক আপনার ডোমেইনেই ডিপ্লয় হয়।

---

## ২. লাইভ Gmail/IMAP ইমেইল ও Facebook Page সিঙ্ক (ফ্রি ব্যাকএন্ড)

ব্রাউজার থেকে সরাসরি IMAP বা Facebook Webhook কানেক্ট করা যায় না—তাই রেপোতে একটি ফ্রি Python FastAPI ব্যাকএন্ড (`backend/`) ও ফ্রি GitHub Actions Cron (`.github/workflows/scheduled-briefing.yml`) দেওয়া আছে।

### অপশন A: নিজের পিসিতে চালানো
```bash
cp .env.example .env
# .env ফাইলে GEMINI_API_KEY, IMAP_USER, IMAP_PASS (Gmail App Password) দিন
chmod +x start-local.sh
./start-local.sh
```
এরপর ওয়েব অ্যাপের **সেটিংস → ব্যাকএন্ড URL**-এ `http://localhost:8000` দিন।

### অপশন B: Render.com-এ ফ্রি ক্লাউড হোস্টিং
1. [Render.com](https://render.com)-এ লগইন করে **New → Blueprint** চাপুন এবং এই GitHub রেপো সিলেক্ট করুন (`render.yaml` অটো ডিটেক্ট হবে)।
2. Environment Variables-এ `GEMINI_API_KEY`, `IMAP_USER`, `IMAP_PASS`, `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN` দিন।
3. Render-এর ফ্রি URL-টি (যেমন `https://amar-ai-assistant-api.onrender.com`) ওয়েব অ্যাপের **সেটিংস → ব্যাকএন্ড URL**-এ বসিয়ে সেভ করুন।

### অপশন C: GitHub Actions ফ্রি শিডিউল্ড ব্রিফিং (Telegram অ্যালার্ট)
GitHub রেপোতে **Settings → Secrets and variables → Actions → Secrets**-এ `IMAP_USER`, `IMAP_PASS`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` দিলে প্রতি ২ ঘণ্টা পর পর নিজেই ইমেইল ও ফেসবুক চেক করে বাংলায় আপডেট পাঠাবে।

---

## প্রজেক্ট স্ট্রাকচার
```text
amar-ai-assistant/
├── web/                  # React + TypeScript + Tailwind PWA (GitHub Pages)
├── backend/              # FastAPI + SQLite + Gemini + IMAP + Facebook Graph API
├── .github/workflows/    # Auto-deploy Pages, CI Tests, Free Scheduled Cron
├── docker-compose.yml    # Self-hosted VPS setup with automatic HTTPS (Caddy)
├── render.yaml           # One-click free cloud backend deploy
└── start-local.sh        # One-command local launcher
```
