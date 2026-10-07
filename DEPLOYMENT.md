# 🚀 TOTO Development CRM — GitHub & Live Deployment Guide

এই প্রোজেক্টটি একটি **Full-Stack Application** (Node.js/Express Backend + React Vite Tailwind Frontend)।
সরাসরি GitHub এ আপলোড করে **১ ক্লিকে সম্পূর্ণ ফ্রিতে লাইভ URL** চালু করার সম্পূর্ণ নির্দেশিকা নিচে দেওয়া হলো:

---

## ১. GitHub-এ কোড পুশ করার নির্দেশিকা (3 টি কমান্ড)

আপনার কম্পিউটারে Git Repository ইতিমধ্যে প্রস্তুত এবং লোকাল কমিট সম্পন্ন হয়েছে (`main` branch)।

এখন আপনার GitHub অ্যাকাউন্টে কোড আপলোড করতে নিচের ধাপগুলো অনুসরণ করুন:

1. আপনার ব্রাউজারে [GitHub.com](https://github.com/new) এ যান এবং একটি নতুন Repository তৈরি করুন:
   - **Repository name:** `toto-dev-crm` (বা আপনার পছন্দের নাম)
   - **Public / Private:** আপনার ইচ্ছা অনুযায়ী সিলেক্ট করুন (Private রেকমেন্ডেড)
   - *Initialize with README / .gitignore* এ টিক দেওয়ার প্রয়োজন নেই (কারন লোকাল কোডে সব তৈরি আছে)।
   - **Create repository** বাটনে ক্লিক করুন।

2. আপনার কম্পিউটারের টার্মিনালে নিচের কমান্ড দুটি রান করুন (আপনার গিটহাব ইউজারনেম অনুযায়ী):

```bash
git remote add origin https://github.com/YousufMax/toto-dev-crm.git
git push -u origin main
```
*(GitHub পাসওয়ার্ড বা Personal Access Token চাইলে তা ইনপুট দিয়ে দিন)*

---

## ২. লাইভ ডিপ্লয়মেন্ট (Live URL চালু করা)

একটি ফুলস্ট্যাক প্রজেক্টের ব্যাকএন্ড API এবং ফ্রন্টএন্ড দুটোই একসাথে লাইভ চালাতে **Render.com** বা **Railway.app** সবচেয়ে সেরা ও সম্পূর্ণ ফ্রি। এতে লোকালহোস্ট এরর বা কানেকশন ফেইল্ড এর কোনো সম্ভাবনা থাকবে না।

### 🌟 অপশন A: Render.com (সম্পূর্ণ ফ্রি এবং সবচেয়ে সহজ — রেকমেন্ডেড)

1. [Render.com](https://render.com) এ গিয়ে আপনার GitHub দিয়ে লগইন / সাইন আপ করুন।
2. ড্যাশবোর্ডে **New +** বাটনে ক্লিক করে **Web Service** সিলেক্ট করুন।
3. **Build and deploy from a Git repository** সিলেক্ট করে আপনার `toto-dev-crm` রিপোজিটরিটি কানেক্ট করুন।
4. সেটিংসে শুধু নিচের তথ্যগুলো দিন:
   - **Name:** `toto-crm`
   - **Region:** Singapore (Asia) বা Frankfurt
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. পেজের নিচের দিকে **Environment Variables** এ গিয়ে `.env` এর ভ্যালুগুলো যোগ করতে পারেন (যেমন `PORT=5000`, `JWT_SECRET=...` ইত্যাদি)।
6. **Create Web Service** এ ক্লিক করুন!

🎉 **২-৩ মিনিটের মধ্যে Render আপনাকে একটি লাইভ HTTPS URL দিয়ে দিবে** (যেমন: `https://toto-crm.onrender.com`), যেখান থেকে লগইন, ডাটাবেস, গুগল শিট সিঙ্ক এবং টেলিগ্রাম বট সহ সম্পূর্ণ সফটওয়্যার ত্রুটিহীনভাবে কাজ করবে!

---

### 🌟 অপশন B: Railway.app (অতি দ্রুত ডিপ্লয়)

1. [Railway.app](https://railway.app) এ যান এবং GitHub দিয়ে লগইন করুন।
2. **New Project** -> **Deploy from GitHub repo** সিলেক্ট করুন।
3. আপনার `toto-dev-crm` রিপোজিটরি নির্বাচন করুন।
4. **Deploy Now** বাটনে ক্লিক করলেই স্বয়ংক্রিয়ভাবে প্রজেক্ট বিল্ড হয়ে লাইভ ডোমেইন চালু হয়ে যাবে।

---

## ৩. গুরুত্বপূর্ণ বৈশিষ্ট্যসমূহ যা কনফিগার করা হয়েছে:

- ✅ **Unified Full-Stack Architecture:** এক্সপ্রেস সার্ভার স্বয়ংক্রিয়ভাবে ক্লায়েন্ট বিল্ড ফাইল সার্ভ করে।
- ✅ **Zero CORS/Port Issues:** একই ডোমেইন থেকে API (`/api/*`) ও UI সার্ভ হওয়ায় কোনো নেটওয়ার্ক বা CORS এরর আসবে না।
- ✅ **Dynamic API Base:** ক্লায়েন্ট অ্যাপ্লিকেশন স্বয়ংক্রিয়ভাবে প্রোডাকশন ডোমেইন ডিটেক্ট করে।
- ✅ **Clean Repository:** অপ্রয়োজনীয় টেম্পোরারি ফাইল ও নোড মডিউল `.gitignore` দ্বারা সুরক্ষিত রাখা হয়েছে।
